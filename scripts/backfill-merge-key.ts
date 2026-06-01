/**
 * scripts/backfill-merge-key.ts — ADR-174 / META-23-C 阶段 A：存量归并键重算
 *
 * 把 media_catalog.title_normalized 全量重算为 normalizeMergeKey(title)（剥标点），
 * 使其与 META-23-B 切换后的写入侧 + 外部匹配键对齐。R5：必须 TS 调 normalizeMergeKey
 * （含 QUALITY_TAGS/SEASON_PATTERNS 等 TS 逻辑，纯 SQL 复刻必漂移）。
 *
 * 用法：
 *   node --env-file=.env.local --import tsx scripts/backfill-merge-key.ts [--dry-run]
 *
 * 幂等（R5 + 防重跑）：UPDATE ... WHERE title_normalized IS DISTINCT FROM $new。
 *   重跑只对已正确行 no-op，结束打印 updated/skipped；重跑应得 updated=0。
 *
 * uq_catalog_title_year_type 部分唯一索引规避（§2）：该索引仅约束「四外部 ID 全 NULL」的行
 *   (title_normalized, year, type)。两无外部 ID 行重算后若同键同 year/type 会当场撞索引。
 *   故对「多行组 + 全组四 ID 全 NULL」只更新留存行（其余冗余行键暂留旧值彼此互异，
 *   待阶段 B 合并删除）；含外部 ID 行不进该索引 WHERE，正常更新。
 *
 * dry-run：全程不写库，只打印将更新/跳过/暂缓的计数。
 *
 * **执行编排（A→B→A' 三步，重要）**：
 *   1. 本脚本首跑（阶段 A）：重算单行组键；**冗余组整组跳过**（避免组内重算撞 uq_catalog_title_year_type）。
 *   2. scripts/dedup-catalog-084.ts（阶段 B）：合并冗余组、删冗余行。
 *   3. **本脚本再跑一次（A'）**：合并后冗余组已消失（每键单行），此时补齐留存行的键
 *      （首跑被跳过的冗余组留存行仍是旧带标点键）。不补则留存行键不自洽（R6），未来同番新写入无法归并。
 *   幂等：三次跑均 IS DISTINCT FROM 守卫，A' 后再跑得 updated=0。
 *
 * 须在 META-23-B（写入侧已切 normalizeMergeKey）merge 后执行。
 */

import { Pool } from 'pg'
import { normalizeMergeKey } from '@/api/services/TitleNormalizer'

const DRY_RUN = process.argv.includes('--dry-run')

interface CatalogRow {
  id: string
  title: string
  title_normalized: string
  year: number | null
  type: string
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL 未设置')
  const pool = new Pool({ connectionString: databaseUrl })

  try {
    // 阶段 A 整组跳过冗余组（不读外部 ID），只需 id/title/title_normalized/year/type
    const { rows: catalog } = await pool.query<CatalogRow>(
      `SELECT id, title, title_normalized, year, type FROM media_catalog`,
    )

    // 内存按 (normalizeMergeKey(title), year, type) 分组（与阶段 B 同函数同结果）
    const groups = new Map<string, CatalogRow[]>()
    const newKeyOf = new Map<string, string>()
    for (const row of catalog) {
      const nk = normalizeMergeKey(row.title)
      newKeyOf.set(row.id, nk)
      const gk = `${nk}|${row.year ?? ''}|${row.type}`
      const arr = groups.get(gk)
      if (arr) arr.push(row)
      else groups.set(gk, [row])
    }

    // 决定每行是否在本阶段更新（uq_catalog_title_year_type 规避，修正版）：
    //  - 单行组：更新（无组内碰撞）
    //  - 多行组（= 阶段 B 会合并的冗余组）：**整组跳过不更新**。
    //    理由：组内重算后键相同，任意更新都可能与组内「已是该新键的行」撞 uq_catalog_title_year_type
    //    （无外部 ID 行进部分唯一索引 WHERE）。这些组阶段 B 合并后只剩 survivor 一行，键自然统一；
    //    survivor 在合并前键是否最新无意义。pickSurvivor 仅用于日志，不在此更新。
    const toUpdate: string[] = [] // catalog ids（仅单行组）
    let deferred = 0
    for (const members of groups.values()) {
      if (members.length === 1) {
        toUpdate.push(members[0].id)
      } else {
        deferred += members.length // 整组暂不更新，交阶段 B 合并
      }
    }

    // 仅统计「键确实变化」的（IS DISTINCT FROM 语义在内存先过滤，减少无谓 UPDATE）
    const changed = toUpdate.filter((id) => {
      const row = catalog.find((c) => c.id === id)!
      return row.title_normalized !== newKeyOf.get(id)
    })

    process.stdout.write(
      `[backfill-merge-key] catalog 总 ${catalog.length} / 分组 ${groups.size} / ` +
        `计划更新 ${toUpdate.length}（键变化 ${changed.length}）/ 暂缓冗余行 ${deferred}（待阶段 B 删除）/ dryRun=${DRY_RUN}\n`,
    )

    if (DRY_RUN) {
      process.stdout.write('[backfill-merge-key] dry-run：未写库。\n')
      return
    }

    // 真跑：逐行 UPDATE（IS DISTINCT FROM 守卫，幂等）
    let updated = 0
    for (const id of changed) {
      const nk = newKeyOf.get(id)!
      const res = await pool.query(
        `UPDATE media_catalog SET title_normalized = $1
         WHERE id = $2 AND title_normalized IS DISTINCT FROM $1`,
        [nk, id],
      )
      updated += res.rowCount ?? 0
    }
    process.stdout.write(
      `[backfill-merge-key] 完成。实际更新 ${updated} 行（重跑应得 0）。暂缓 ${deferred} 冗余行键留待阶段 B。\n`,
    )
  } finally {
    await pool.end()
  }
}

void main().catch((err) => {
  const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : JSON.stringify(err)
  process.stderr.write(`[backfill-merge-key] failed: ${msg}\n`)
  process.exit(1)
})

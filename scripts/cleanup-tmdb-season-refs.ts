/**
 * scripts/cleanup-tmdb-season-refs.ts — 存量 show-id-as-season 清理（ADR-207 D-207-9b BLOCKER / SEQ-20260616-03）
 *
 * 旧 confirm 路径（card B 修复前）在 `seasonNumber != null` 时把入参 **show id** 直接写作 season exact ref
 * 的 external_id（违 D-207-2：应为季自身 id）。这些 stale 行 external_id 与正确季 id 不同 → 不触发 R10 唯一索引
 * 冲突而**并存**（decisions.md ADR-207 勘误），必须主动降级。
 *
 * 检测：对每条 `provider='tmdb' ∧ external_kind='season' ∧ relation='exact'` 且 catalog.season_number IS NOT NULL 的行，
 * 把 external_id 当作 **show id** 调 `getTvDetail`：
 *   - 返 null（404）→ external_id 实为季 id（正确），跳过；
 *   - 返 show 且其 seasons[] 按 season_number 命中季、且该季 id ≠ external_id → external_id 是 show id（stale）→ `demoteExactRef` 降级 candidate
 *     （非 DELETE，保审计痕迹；note='demoted: stale show-id-as-season'；exceptExternalId=正确季 id 保留 backfill 已写的正确 ref）。
 * **幂等**：降级后行 relation='candidate' 不再被 exact 查询命中；重跑零副作用。
 *
 * ⚠️ 边界（低概率）：若某季 id 恰好也是一个有效 tv show id 且该 show 含同 season_number 的季，会被误判 stale。
 *   故**务必先 --dry-run 复核报表**再正式跑。
 *
 * ⚠️⚠️ 重要限制（review round-2 F1）——「写回正确季 ref」对 stale 人群**不自动生效**：
 *   stale 行只来自人工 `confirm`（端点收 seasonNumber），这些 video 都有 `manual_confirmed` isPrimary tmdb video ref；
 *   而 `reenrich-backfill --mode tmdb-season` 经 `MetadataEnrichService.stepTmdb` 的 alreadyBound 守卫（跳过任何带
 *   isPrimary auto_matched/manual_confirmed ref 的 video）**恰好跳过整个 stale 人群** → autoMatch 不跑、正确 season exact 不会写回。
 *   故本清理只能**降级**（去除错误精确绑定，安全有益），**无法自动恢复**季精度——这些 catalog 需**人工重新 confirm**（confirm 已纠偏 D-207-9a），
 *   或另起 force-rematch/先解绑 video ref 的恢复路径（见 task-queue「META-53 round-2 follow-up」，须先核实生产库确有 stale 行）。
 *   上线前先查：`SELECT count(*) FROM catalog_external_refs r JOIN media_catalog mc ON mc.id=r.catalog_id
 *     WHERE r.provider='tmdb' AND r.external_kind='season' AND r.relation='exact' AND mc.season_number IS NOT NULL;`
 *   若该口径下经本脚本判定的 stale 数为 0（端点/UI 实际从未发 seasonNumber），则纯属文档措辞、无需恢复动作。
 *
 * 用法：
 *   node --env-file=.env.local --import tsx scripts/cleanup-tmdb-season-refs.ts [--dry-run]
 */

import { db } from '@/api/lib/postgres'
import { getTvDetail } from '@/api/lib/tmdb'
import { loadTmdbClientConfig } from '@/api/services/tmdb-config'
import { demoteExactRef } from '@/api/db/queries/catalogExternalRefs'
import type { TmdbTvDetail } from '@/api/lib/tmdb.types'

/**
 * 判定一条 tmdb season exact ref 是否为 stale show-id-as-season（纯函数，便于单测）。
 * @param show  把 ref.external_id 当作 show id 调 getTvDetail 的结果（null=非有效 show id）
 * @param seasonNumber  catalog.season_number
 * @param externalId  ref.external_id（疑似 show id 或正确季 id）
 * @returns stale=true 时附 correctSeasonId（用于 demote 时 except 保留正确 ref）
 */
export function classifyStaleSeasonRef(
  show: TmdbTvDetail | null,
  seasonNumber: number,
  externalId: string,
): { stale: boolean; correctSeasonId?: number } {
  if (!show) return { stale: false } // external_id 非有效 show id → 实为季 id（正确），跳过
  const season = show.seasons?.find((s) => s.season_number === seasonNumber)
  if (!season) return { stale: false } // 该 show 无对应季号 → 无法判定，保守跳过
  if (season.id === Number(externalId)) return { stale: false } // external_id 已是正确季 id
  return { stale: true, correctSeasonId: season.id } // external_id 是 show id（≠ 正确季 id）→ stale
}

interface StaleSeasonRow {
  catalog_id: string
  external_id: string
  season_number: number
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')
  process.stdout.write(`[cleanup-tmdb-season-refs] dryRun=${dryRun}\n`)

  const cfg = await loadTmdbClientConfig(db)
  if (!cfg.readAccessToken && !cfg.apiKey) {
    throw new Error('TMDB 凭证缺失（read_access_token / api_key）——无法解析正确季 id，终止')
  }

  const { rows } = await db.query<StaleSeasonRow>(
    `SELECT r.catalog_id, r.external_id, mc.season_number
       FROM catalog_external_refs r
       JOIN media_catalog mc ON mc.id = r.catalog_id
      WHERE r.provider = 'tmdb' AND r.external_kind = 'season' AND r.relation = 'exact'
        AND mc.season_number IS NOT NULL
      ORDER BY r.catalog_id`,
  )
  process.stdout.write(`[cleanup-tmdb-season-refs] 扫描 tmdb season exact 行：${rows.length.toLocaleString()} 条\n`)

  let scanned = 0
  let demoted = 0
  let skipped = 0
  for (const row of rows) {
    scanned++
    const show = await getTvDetail(Number(row.external_id), { language: 'zh-CN' }, cfg, 'enrich_worker')
    const verdict = classifyStaleSeasonRef(show, row.season_number, row.external_id)
    if (!verdict.stale) {
      skipped++
      continue
    }
    process.stdout.write(
      `[cleanup-tmdb-season-refs] STALE catalog=${row.catalog_id} season=${row.season_number} ` +
        `external_id=${row.external_id}(show id) → 正确季 id=${verdict.correctSeasonId}${dryRun ? ' [dry-run]' : ''}\n`,
    )
    if (dryRun) {
      demoted++
      continue
    }
    const n = await demoteExactRef(db, row.catalog_id, 'tmdb', String(verdict.correctSeasonId), 'demoted: stale show-id-as-season')
    if (n > 0) demoted++
  }

  process.stdout.write(
    `[cleanup-tmdb-season-refs] 完成：扫描 ${scanned} / ${dryRun ? '可降级' : '已降级'} ${demoted} / 跳过(正确) ${skipped}\n`,
  )
}

// VITEST 下不执行 main（仅导出纯函数供单测），避免 import 触发 db/TMDB。
if (!process.env.VITEST) {
  void main()
    .catch((err) => {
      const msg = err instanceof Error ? `${err.message}${err.stack ? `\n${err.stack}` : ''}` : JSON.stringify(err)
      process.stderr.write(`[cleanup-tmdb-season-refs] failed: ${msg}\n`)
      process.exitCode = 1
    })
    .finally(async () => {
      try { await db.end() } catch { /* ignore close error */ }
      process.exit(process.exitCode ?? 0)
    })
}

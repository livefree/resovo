/**
 * catalog-rollup-external-refs.ts — video_external_refs → catalog_external_refs 确定性上卷
 * （ADR-177 D-177-4 + AMENDMENT D-177-14 / CHG-VIR-12-E / Phase 5e）
 *
 * 输入：同 catalog × 同 provider 的全部 video 级 primary 观测（is_primary=true AND
 * match_status ∈ manual_confirmed/auto_matched，video 未软删）。
 * 规则：`services/identity/externalRefRollup.ts` 纯函数（D-177-4 四行规则表 / R3 保守底线）。
 * 写入：
 *   - exact 产出 → **经 MediaCatalogService.safeUpdate**（复用 CHG-VIR-12-D 写侧接线：
 *     exact ref + cache 回填同事务 YY-C / 锁与优先级尊重 / 跨 catalog exact 冲突由索引①
 *     预检自动降级 candidate）→ 写后补 rollup_rule 溯源（YY-B）
 *   - candidate 产出 → insertCandidateRef（幂等 NOT EXISTS，rollup_rule 直传）
 * 范围：bangumi / douban（subject 精确级 / D-177-11）；imdb/tmdb show/parent 留实装卡。
 * 自动绑定保持 OFF（Y-177-4）：本脚本手动触发；exact 通道仅 manual_confirmed 一致（R3）。
 *
 * 运行（默认 dry-run 只读报告）：
 *   node --env-file=.env.local --import tsx scripts/catalog-rollup-external-refs.ts [--apply]
 *
 * 上卷后核验：scripts/report-catalog-identity-consistency.ts（三口径 + 冲突簇）
 */

import { db } from '@/api/lib/postgres'
import { MediaCatalogService } from '@/api/services/MediaCatalogService'
import { insertCandidateRef, resolveAndWriteExactRef } from '@/api/db/queries/catalogExternalRefs'
import {
  rollupCatalogProviderRefs,
  type VideoRefObservation,
} from '@/api/services/identity/externalRefRollup'

const PROVIDERS = [
  // cacheField = safeUpdate 写入字段（12-D 接线触发键）；numeric = bangumi_subject_id INT 转换
  { provider: 'bangumi' as const, cacheField: 'bangumiSubjectId' as const, numeric: true, source: 'bangumi' as const },
  { provider: 'douban' as const, cacheField: 'doubanId' as const, numeric: false, source: 'douban' as const },
]

interface InputRow {
  catalog_id: string
  provider: string
  video_id: string
  external_id: string
  match_status: 'manual_confirmed' | 'auto_matched'
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  console.log(`catalog-rollup-external-refs — mode=${apply ? 'APPLY' : 'dry-run'}`)
  const svc = new MediaCatalogService(db)

  const stats = { exact: 0, exactAlready: 0, exactSkipped: 0, candidate: 0, candidateAlready: 0, conflictGroups: 0 }

  for (const spec of PROVIDERS) {
    // 同 catalog × 同 provider 的 primary 观测（输入域 = D-177-4；video 未软删）
    const rows = await db.query<InputRow>(
      `SELECT v.catalog_id, r.provider, r.video_id, r.external_id, r.match_status
         FROM video_external_refs r
         JOIN videos v ON v.id = r.video_id AND v.deleted_at IS NULL
        WHERE r.provider = $1 AND r.is_primary = true
          AND r.match_status IN ('manual_confirmed', 'auto_matched')
          AND v.catalog_id IS NOT NULL
        ORDER BY v.catalog_id`,
      [spec.provider]
    )
    const byCatalog = new Map<string, VideoRefObservation[]>()
    for (const row of rows.rows) {
      const list = byCatalog.get(row.catalog_id) ?? []
      list.push({ videoId: row.video_id, externalId: row.external_id, matchStatus: row.match_status })
      byCatalog.set(row.catalog_id, list)
    }
    console.log(`[${spec.provider}] 输入 ${rows.rowCount} 观测 / ${byCatalog.size} catalog 组`)

    for (const [catalogId, observations] of byCatalog) {
      const decisions = rollupCatalogProviderRefs(observations)
      if (decisions.some((d) => d.rollupRule === 'conflict')) stats.conflictGroups++

      for (const d of decisions) {
        if (d.relation === 'exact') {
          // 幂等预检：cache 已同值 + 已有 exact ref → 跳过（减少重写噪声）
          const existing = await db.query<{ has_ref: boolean; cache_same: boolean }>(
            `SELECT
               EXISTS (SELECT 1 FROM catalog_external_refs
                       WHERE catalog_id = $1 AND provider = $2 AND external_id = $3
                         AND relation = 'exact') AS has_ref,
               EXISTS (SELECT 1 FROM media_catalog
                       WHERE id = $1 AND ${spec.provider === 'bangumi' ? 'bangumi_subject_id::text' : 'douban_id'} = $3) AS cache_same`,
            [catalogId, spec.provider, d.externalId]
          )
          if (existing.rows[0]?.has_ref && existing.rows[0]?.cache_same) {
            stats.exactAlready++
            continue
          }
          console.log(`  exact: catalog=${catalogId.slice(0, 8)} ${spec.provider}=${d.externalId}（${d.rollupRule}）`)
          if (!apply) { stats.exact++; continue }
          if (existing.rows[0]?.cache_same) {
            // cache 已同值 → ref 升级零元数据变更，不需 safeUpdate 优先级许可
            // （metadata_source=manual 的 catalog 仅升 ref 不该被源优先级误伤）；
            // YY-C「同事务」在 cache 无需回填时自然满足。降 demote 的 candidate 同值行留审计。
            const outcome = await resolveAndWriteExactRef(db, {
              catalogId,
              provider: spec.provider,
              externalId: d.externalId,
              externalKind: 'subject',
              source: 'auto',
              linkedBy: 'rollup-job',
              rollupRule: d.rollupRule,
            })
            if (outcome.outcome === 'exact_written' || outcome.outcome === 'already_exact') stats.exact++
            else stats.exactSkipped++
            continue
          }
          // cache 需变更（NULL/异值）→ 元数据写入，经 safeUpdate 复用 12-D 接线
          // （ref+cache 同事务 / 锁与源优先级尊重 / 跨 catalog 冲突自动降级）
          const value = spec.numeric ? Number(d.externalId) : d.externalId
          const { skippedFields } = await svc.safeUpdate(
            catalogId,
            { [spec.cacheField]: value },
            spec.source,
          )
          if (skippedFields.includes(spec.cacheField)) {
            // 锁/源优先级/exact 冲突被阻 → 登记 skipped 交人工（manual 元数据所有权场景）
            stats.exactSkipped++
            console.log(`    ↳ skipped（锁/源优先级/冲突）：交人工裁定`)
          } else {
            stats.exact++
            // rollup_rule 溯源补写（YY-B；safeUpdate 接线路径 rollup_rule=NULL）
            await db.query(
              `UPDATE catalog_external_refs
                  SET rollup_rule = $4
                WHERE catalog_id = $1 AND provider = $2 AND external_id = $3
                  AND relation = 'exact' AND rollup_rule IS NULL`,
              [catalogId, spec.provider, d.externalId, d.rollupRule]
            )
          }
        } else {
          if (!apply) {
            // dry-run 同口径预查（与 insertCandidateRef NOT EXISTS 一致），保证计数与 apply 实插一致
            const exists = await db.query<{ n: number }>(
              `SELECT COUNT(*)::int AS n FROM catalog_external_refs
                WHERE catalog_id = $1 AND provider = $2 AND external_id = $3
                  AND relation IN ('candidate', 'exact')`,
              [catalogId, spec.provider, d.externalId]
            )
            if ((exists.rows[0]?.n ?? 0) > 0) { stats.candidateAlready++; continue }
            console.log(`  candidate: catalog=${catalogId.slice(0, 8)} ${spec.provider}=${d.externalId}（${d.rollupRule}）`)
            stats.candidate++
            continue
          }
          const inserted = await insertCandidateRef(db, {
            catalogId,
            provider: spec.provider,
            externalId: d.externalId,
            externalKind: 'subject',
            source: 'auto',
            linkedBy: 'rollup-job',
            rollupRule: d.rollupRule,
          })
          if (inserted) stats.candidate++
          else stats.candidateAlready++
        }
      }
    }
  }

  console.log('━━ 汇总 ━━')
  console.log(JSON.stringify(stats))
  await db.end()
}

void main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})

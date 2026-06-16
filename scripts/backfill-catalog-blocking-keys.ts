/**
 * scripts/backfill-catalog-blocking-keys.ts — 回填 catalog_blocking_alias_keys 派生表
 *   （ADR-206 §META-50-2A / migration 120 / 2A-1）
 *
 * 遍历存量 media_catalog，对每行调 recomputeCatalogBlockingKeys（loadKnownNames→阈值→归一→replace），
 * 把 knownNames 投影的 blocking 归一键落派生表。新增/变更 catalog 由 enrich reconcile 后增量重算
 * （MetadataEnrichService），本脚本一次性补齐存量 + worker 漏算兜底。
 *
 * 用法：
 *   node --env-file=.env.local --import tsx scripts/backfill-catalog-blocking-keys.ts [选项]
 * 选项：
 *   --limit <N>    仅前 N 个 catalog（小批验证用）
 *   --dry-run      只统计将处理的 catalog 数与样例键数，不写库
 *
 * 幂等：replace（delete+insert）→ 可重复执行；keyset 分页按 id 升序。
 */

import { db } from '@/api/lib/postgres'
import { recomputeCatalogBlockingKeys, projectBlockingKeyRows } from '@/api/services/metadata/catalogBlockingKeys'
import { loadKnownNames } from '@/api/services/metadata/knownNames'

function parseArgs(): { limit: number | null; dryRun: boolean } {
  const args = process.argv.slice(2)
  const i = args.indexOf('--limit')
  const rawLimit = i !== -1 ? args[i + 1] ?? null : null
  const limit = rawLimit != null ? Number.parseInt(rawLimit, 10) : null
  if (limit != null && (!Number.isFinite(limit) || limit <= 0)) {
    throw new Error(`--limit 非法：${rawLimit}`)
  }
  return { limit, dryRun: args.includes('--dry-run') }
}

async function main(): Promise<void> {
  const { limit, dryRun } = parseArgs()
  const BATCH = 500
  let cursor = ''
  let processed = 0
  let totalKeys = 0

  for (;;) {
    if (limit != null && processed >= limit) break
    const take = limit != null ? Math.min(BATCH, limit - processed) : BATCH
    const r = await db.query<{ id: string }>(
      `SELECT id FROM media_catalog WHERE id::text > $1 ORDER BY id::text ASC LIMIT $2`,
      [cursor, take],
    )
    if (r.rows.length === 0) break
    for (const row of r.rows) {
      if (dryRun) {
        const rows = projectBlockingKeyRows(await loadKnownNames(db, row.id))
        totalKeys += rows.length
      } else {
        await recomputeCatalogBlockingKeys(db, row.id)
      }
      processed++
    }
    cursor = r.rows[r.rows.length - 1].id
    console.log(`[backfill-blocking-keys] 已处理 ${processed} 个 catalog${dryRun ? `（dry-run 累计 ${totalKeys} 键）` : ''}`)
  }

  console.log(`[backfill-blocking-keys] 完成：${processed} 个 catalog${dryRun ? `，dry-run 共 ${totalKeys} 键（未写库）` : ' 已重算落库'}`)
  await db.end()
}

main().catch((err) => {
  console.error('[backfill-blocking-keys] 失败：', err)
  process.exit(1)
})

/**
 * scripts/resync-es-short-id.ts — BUGFIX-SHORTID-DASH-B：migration 110 后 ES short_id 重同步
 *
 * Migration 110 重新生成了含 `-` 的 videos.short_id（nanoid 默认字母表遗留），但
 * migration 无法触达 ES——resovo_videos 索引中受影响文档仍持旧值，搜索结果会继续
 * 派生 404 链接。本脚本一次性收敛：
 *
 *   1. ES 侧按 `short_id: *-*`（keyword wildcard）圈定持旧值的文档（精确 = 受影响全集）；
 *   2. 文档 id 即 videos.id（VideoIndexSyncService 同键），逐个分流：
 *      - DB 行存活（deleted_at IS NULL）→ syncVideo（upsert 覆盖新 short_id）；
 *      - DB 行已软删/不存在 → unindexVideo（对齐 reconcileStale 语义，防旧文档残留破坏幂等）。
 *
 * 用法：
 *   node --env-file=.env.local --import tsx scripts/resync-es-short-id.ts [--dry-run]
 *
 * 幂等可重入：收敛后 wildcard 查询 0 命中，重跑空转。
 */

import { Pool } from 'pg'
import { es, ES_INDEX } from '@/api/lib/elasticsearch'
import { VideoIndexSyncService } from '@/api/services/VideoIndexSyncService'

const DRY_RUN = process.argv.includes('--dry-run')
const BATCH_SIZE = 500

async function fetchAffectedIds(): Promise<string[]> {
  const ids: string[] = []
  let searchAfter: unknown[] | undefined

  for (;;) {
    const res = await es.search<{ short_id: string }>({
      index: ES_INDEX,
      size: BATCH_SIZE,
      query: { wildcard: { short_id: { value: '*-*' } } },
      sort: [{ short_id: 'asc' }],
      _source: ['short_id'],
      ...(searchAfter ? { search_after: searchAfter } : {}),
    })
    const hits = res.hits.hits
    if (hits.length === 0) break
    for (const hit of hits) {
      if (hit._id) ids.push(hit._id)
    }
    searchAfter = hits[hits.length - 1].sort
    if (hits.length < BATCH_SIZE) break
  }

  return ids
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL 未设置，请检查 .env.local')
  const pool = new Pool({ connectionString: databaseUrl })
  const syncService = new VideoIndexSyncService(pool, es)

  try {
    const affectedIds = await fetchAffectedIds()
    console.log(`[resync-es-short-id] ES 中 short_id 含 \`-\` 的文档：${affectedIds.length} 条`)

    if (DRY_RUN) {
      console.log('[resync-es-short-id] --dry-run，不执行同步')
      return
    }

    let synced = 0
    let removed = 0
    for (const id of affectedIds) {
      const { rows } = await pool.query<{ id: string }>(
        'SELECT id FROM videos WHERE id = $1 AND deleted_at IS NULL',
        [id],
      )
      if (rows[0]) {
        await syncService.syncVideo(id)
        synced++
      } else {
        await syncService.unindexVideo(id)
        removed++
      }
    }

    console.log(`[resync-es-short-id] 完成：syncVideo ${synced} 条 / unindexVideo ${removed} 条`)

    // 收敛断言：重查应为 0（syncVideo 失败只 warn 不抛，此处兜底显式暴露）。
    // 先显式 refresh——ES near-real-time，index/delete 后立即 count 会读到旧 segment
    // （首跑实测 2768 条处理完 count 仍报 221 残留即此窗口）。
    await es.indices.refresh({ index: ES_INDEX })
    const residual = await es.count({
      index: ES_INDEX,
      query: { wildcard: { short_id: { value: '*-*' } } },
    })
    if (residual.count > 0) {
      console.error(`[resync-es-short-id] ⚠️ 残留 ${residual.count} 条未收敛（检查上方 syncVideo warn 日志）`)
      process.exitCode = 1
    } else {
      console.log('[resync-es-short-id] 收敛断言通过：ES 零残留')
    }
  } finally {
    await pool.end()
    await es.close()
  }
}

main().catch((err) => {
  console.error('[resync-es-short-id] 失败：', err)
  process.exitCode = 2
})

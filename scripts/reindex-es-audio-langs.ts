/**
 * scripts/reindex-es-audio-langs.ts — HANDOFF-41：ES 存量索引补 audio_langs 字段
 *
 * 背景：统一筛选区 lang 维 = 音频语音（audio_language）。`/search`（ES）此前 lang 误打在
 * `subtitle_langs`（字幕），现改打新字段 `audio_langs`（VideoIndexSyncService AUDIO_LANGS_SUBQUERY
 * 以与 /videos EXISTS 逐字段对齐的语义聚合 video_sources.audio_language）。存量 ES 文档无此字段，
 * lang 搜索回填前零结果——本脚本一次性收敛：
 *
 *   1. putMapping 给已存在索引补 `audio_langs`（keyword，additive，幂等无副作用，无需 drop/全量 reindex）；
 *   2. keyset 分页遍历**全部已上架视频**（is_published+public+approved+未软删——SearchService lang
 *      搜索的可召回全集），逐个 syncVideo（FETCH_SQL 已含 audio_langs）重写文档，回填 audio_langs；
 *   3. refresh + 按计数收敛断言（DB published 总数 == 已 reindex 计数）。
 *      ⚠️ 不用 exists:audio_langs 断言——空数组（无活跃音频源的 video）在 ES 不算 exists，会假阴性。
 *
 * 设计说明（arch-reviewer M3）：不复用 VideoIndexSyncService.reconcilePublished——其 RECONCILE_SQL
 * 为 `ORDER BY updated_at DESC LIMIT $1` 无游标分页，循环调用反复回填同一批 top-N 不前进。本脚本自带
 * DB 端 keyset（id > $lastId ORDER BY id）全量翻页，保证覆盖且可收敛。
 *
 * 用法：
 *   node --env-file=.env.local --import tsx scripts/reindex-es-audio-langs.ts [--dry-run]
 *
 * 幂等可重入：putMapping 加同名同型字段无副作用；syncVideo upsert 覆盖；重跑空转（计数不变）。
 */

import { Pool } from 'pg'
import { es, ES_INDEX } from '@/api/lib/elasticsearch'
import { VideoIndexSyncService } from '@/api/services/VideoIndexSyncService'

const DRY_RUN = process.argv.includes('--dry-run')
const BATCH_SIZE = 500
// 全零 UUID 哨兵：小于任意真实 uuid，作 keyset 起点（id > $1 包含全集）。
const UUID_MIN = '00000000-0000-0000-0000-000000000000'

// SearchService lang 搜索的可召回全集谓词（与 RECONCILE_SQL WHERE 一致）。
const PUBLISHED_PREDICATE = `
  is_published = true
  AND visibility_status = 'public'
  AND review_status = 'approved'
  AND deleted_at IS NULL
`

async function countPublished(pool: Pool): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM videos WHERE ${PUBLISHED_PREDICATE}`,
  )
  return Number(rows[0]?.n ?? 0)
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL 未设置，请检查 .env.local')
  const pool = new Pool({ connectionString: databaseUrl })
  const syncService = new VideoIndexSyncService(pool, es)

  try {
    // 1. 补 mapping（additive，幂等）
    if (DRY_RUN) {
      console.log('[reindex-es-audio-langs] --dry-run，跳过 putMapping')
    } else {
      await es.indices.putMapping({
        index: ES_INDEX,
        properties: { audio_langs: { type: 'keyword' } },
      })
      console.log('[reindex-es-audio-langs] putMapping audio_langs(keyword) 完成')
    }

    const publishedTotal = await countPublished(pool)
    console.log(`[reindex-es-audio-langs] DB 已上架视频：${publishedTotal} 条`)

    if (DRY_RUN) {
      console.log('[reindex-es-audio-langs] --dry-run，不执行回填')
      return
    }

    // 2. keyset 分页遍历全部已上架视频，逐个 syncVideo 回填 audio_langs
    let synced = 0
    let lastId = UUID_MIN
    for (;;) {
      const { rows } = await pool.query<{ id: string }>(
        `SELECT id FROM videos
         WHERE ${PUBLISHED_PREDICATE}
           AND id > $1
         ORDER BY id ASC
         LIMIT $2`,
        [lastId, BATCH_SIZE],
      )
      if (rows.length === 0) break
      for (const { id } of rows) {
        await syncService.syncVideo(id)
        synced++
      }
      lastId = rows[rows.length - 1].id
      if (rows.length < BATCH_SIZE) break
    }

    console.log(`[reindex-es-audio-langs] 回填完成：syncVideo ${synced} 条`)

    // 3. refresh + 计数收敛断言（ES near-real-time，断言前显式 refresh）
    await es.indices.refresh({ index: ES_INDEX })
    if (synced !== publishedTotal) {
      console.error(
        `[reindex-es-audio-langs] ⚠️ 计数不一致：遍历 ${synced} != DB published ${publishedTotal}` +
          `（检查 syncVideo warn 日志——失败只 warn 不抛）`,
      )
      process.exitCode = 1
    } else {
      console.log(`[reindex-es-audio-langs] 收敛断言通过：遍历计数 ${synced} == DB published ${publishedTotal}`)
    }
  } finally {
    await pool.end()
    await es.close()
  }
}

main().catch((err) => {
  console.error('[reindex-es-audio-langs] 失败：', err)
  process.exitCode = 2
})

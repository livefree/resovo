/**
 * scripts/reindex-es-play-stats.ts — STATS-06-A（ADR-216 D-216-3 / D-216-4）：ES 存量索引回填 play 字段
 *
 * 背景：`/search?sort=hot` 改用 ES play 真源（`hot_score` / `play_count_7d` / `play_count_total`），与
 * `/videos?sort=hot`（PG `video_hot_scores` / `video_play_totals` LEFT JOIN）跨 surface 排序口径对齐。
 * 存量 ES 文档无这些字段——本脚本一次性收敛（批量 updater 路径，D-216-4「索引同步或批量 updater」）：
 *
 *   1. putMapping 给已存在索引补 `play_count_total`(long)/`play_count_7d`(long)/`hot_score`(double)——
 *      additive 幂等无副作用；对已存在同名异型字段 ES 原生硬失败（不 catch 吞，Codex 任务卡审 MEDIUM 8）。
 *   2. keyset 分页遍历全部已上架视频（is_published+public+approved+未软删——SearchService 可召回全集），
 *      逐个 `syncVideoStrict` 重写文档（FETCH_SQL 已含 play LEFT JOIN）。**syncVideoStrict 写入失败抛出**
 *      （非 syncVideo 吞错），按真实成功计数；任一失败 exit≠0——杜绝「遍历计数 == published」假收敛
 *      （Codex 任务卡审 HIGH 5）。
 *   3. refresh + **抽样数据收敛断言**：重读有 play 数据的 ES doc，断言 `es.hot_score == db.hot_score` 等
 *      （证 ES 真实回填、非仅遍历完成）；并抽样无 play 数据视频断言其排序字段为 null（保 NULLS LAST 等价）。
 *
 * 一致性注记（Codex 任务卡审 MEDIUM 10）：keyset 期间发布/下架会扰动 published 计数；建议低流量窗口运行。
 * 收敛断言基于「重读 ES == DB 当下值」抽样，对计数漂移稳健（不依赖起止 count 严格相等）。
 *
 * 用法：
 *   node --env-file=.env.local --import tsx scripts/reindex-es-play-stats.ts [--dry-run] [--allow-drift]
 *   --allow-drift：容忍 keyset 期间并发发布/下架导致的覆盖计数漂移（默认硬失败）。
 *
 * 幂等可重入：putMapping 同名同型无副作用；syncVideoStrict upsert 覆盖；重跑空转。
 */
/* eslint-disable no-console -- CLI 运维脚本：console 是其与运维者交互的预期输出接口（同 scripts/ 既有范式）。 */

import { Pool } from 'pg'
import { es, ES_INDEX } from '@/api/lib/elasticsearch'
import { VideoIndexSyncService } from '@/api/services/VideoIndexSyncService'

const DRY_RUN = process.argv.includes('--dry-run')
// Codex 实现审 HIGH 2：默认对「遍历覆盖 != DB published」硬失败（exit≠0）；并发发布/下架窗口用 --allow-drift 容忍。
const ALLOW_DRIFT = process.argv.includes('--allow-drift')
const BATCH_SIZE = 500
const SAMPLE_SIZE = 20
// 全零 UUID 哨兵：小于任意真实 uuid，作 keyset 起点（id > $1 包含全集）。
const UUID_MIN = '00000000-0000-0000-0000-000000000000'
// hot_score 为 NUMERIC（含小数，如 7d×0.3）→ double 比较用浮点容差。
const HOT_SCORE_EPSILON = 1e-6

// SearchService 可召回全集谓词（与 RECONCILE_SQL WHERE 一致）。
const PUBLISHED_PREDICATE = `
  is_published = true
  AND visibility_status = 'public'
  AND review_status = 'approved'
  AND deleted_at IS NULL
`

interface SampleRow {
  id: string
  hot_score: string | null
  play_count_7d: string | null
  total_play_count: string | null
}

function toNullableNumber(value: string | null): number | null {
  return value == null ? null : Number(value)
}

async function countPublished(pool: Pool): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM videos WHERE ${PUBLISHED_PREDICATE}`,
  )
  return Number(rows[0]?.n ?? 0)
}

/** 重读单条 ES doc，逐字段比对 DB 期望值（hot_score 浮点容差，play_count 精确）。 */
async function checkDoc(row: SampleRow): Promise<boolean> {
  const got = await es.get<Record<string, unknown>>({ index: ES_INDEX, id: row.id })
  const src = got._source ?? {}
  const expectedHot = toNullableNumber(row.hot_score)
  const expected7d = toNullableNumber(row.play_count_7d)
  const expectedTotal = toNullableNumber(row.total_play_count)
  const gotHot = (src.hot_score as number | null) ?? null
  const got7d = (src.play_count_7d as number | null) ?? null
  const gotTotal = (src.play_count_total as number | null) ?? null

  const hotMatch =
    expectedHot == null ? gotHot == null : gotHot != null && Math.abs(gotHot - expectedHot) < HOT_SCORE_EPSILON
  const sevenMatch = expected7d === got7d
  const totalMatch = expectedTotal === gotTotal

  if (!hotMatch || !sevenMatch || !totalMatch) {
    console.error(
      `[reindex-es-play-stats] ⚠️ 收敛不一致 id=${row.id}: ` +
        `hot_score es=${String(gotHot)} db=${String(expectedHot)} / ` +
        `play_count_7d es=${String(got7d)} db=${String(expected7d)} / ` +
        `play_count_total es=${String(gotTotal)} db=${String(expectedTotal)}`,
    )
    return false
  }
  return true
}

/**
 * 抽样重读 ES doc 断言与 DB 一致（真实数据收敛，非仅遍历计数；Codex 实现审 HIGH 1）。
 * 覆盖 3 个 join 形态——证明 BLOCK 2「无聚合行 → null、真实值 → 值」语义在回填后真成立：
 *   ① 有 hot 行：3 字段均匹配；② 全无聚合行：3 字段均 null；③ 仅 totals 行：total 匹配、hot/7d 为 null。
 */
async function assertSampleConvergence(pool: Pool): Promise<boolean> {
  const sample = async (predicate: string): Promise<SampleRow[]> => {
    const { rows } = await pool.query<SampleRow>(
      `SELECT v.id, vhs.hot_score, vhs.play_count_7d, vpt.total_play_count
       FROM videos v
       LEFT JOIN video_hot_scores vhs ON vhs.video_id = v.id
       LEFT JOIN video_play_totals vpt ON vpt.video_id = v.id
       WHERE ${PUBLISHED_PREDICATE}
         AND ${predicate}
       ORDER BY v.id ASC
       LIMIT $1`,
      [SAMPLE_SIZE],
    )
    return rows
  }

  const withHot = await sample('vhs.video_id IS NOT NULL')
  const noAggregate = await sample('vhs.video_id IS NULL AND vpt.video_id IS NULL')
  const totalsOnly = await sample('vpt.video_id IS NOT NULL AND vhs.video_id IS NULL')

  const all = [...withHot, ...noAggregate, ...totalsOnly]
  if (all.length === 0) {
    console.log('[reindex-es-play-stats] 无已上架视频可抽样——跳过数据收敛断言（库为空属正常初态）')
    return true
  }

  let ok = true
  for (const row of all) {
    if (!(await checkDoc(row))) ok = false
  }

  if (ok) {
    console.log(
      `[reindex-es-play-stats] 数据收敛断言通过：抽样 ${all.length} 条` +
        `（有 hot ${withHot.length} / 无聚合 ${noAggregate.length} / 仅 totals ${totalsOnly.length}）ES doc 与 DB 一致`,
    )
  }
  return ok
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL 未设置，请检查 .env.local')
  const pool = new Pool({ connectionString: databaseUrl })
  const syncService = new VideoIndexSyncService(pool, es)

  try {
    // 1. 补 mapping（additive，幂等；同名异型 ES 硬失败不吞）
    if (DRY_RUN) {
      console.log('[reindex-es-play-stats] --dry-run，跳过 putMapping')
    } else {
      await es.indices.putMapping({
        index: ES_INDEX,
        properties: {
          play_count_total: { type: 'long' },
          play_count_7d: { type: 'long' },
          hot_score: { type: 'double' },
        },
      })
      console.log('[reindex-es-play-stats] putMapping play_count_total/play_count_7d/hot_score 完成')
    }

    const publishedTotal = await countPublished(pool)
    console.log(`[reindex-es-play-stats] DB 已上架视频：${publishedTotal} 条`)

    if (DRY_RUN) {
      console.log('[reindex-es-play-stats] --dry-run，不执行回填')
      return
    }

    // 2. keyset 分页遍历全部已上架视频，syncVideoStrict 回填 play 字段（真实成功计数）
    let synced = 0
    let skipped = 0
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
        // syncVideoStrict 失败抛出 → 整脚本失败（exit≠0），不计假成功
        const outcome = await syncService.syncVideoStrict(id)
        if (outcome === 'synced') synced++
        else skipped++
      }
      lastId = rows[rows.length - 1].id
      if (rows.length < BATCH_SIZE) break
    }

    console.log(`[reindex-es-play-stats] 回填完成：synced ${synced} / skipped ${skipped}`)

    // 3a. 覆盖断言（Codex 实现审 HIGH 2）：稳定窗口下应 synced == DB published（skipped 应为 0——
    //     published 视频 FETCH_SQL 必有行；skipped>0 或计数不符 = 并发漂移）。
    const publishedAfter = await countPublished(pool)
    if (synced !== publishedAfter || skipped !== 0) {
      const msg =
        `synced ${synced} / skipped ${skipped} vs DB published ${publishedAfter}` +
        `（keyset 期间并发发布/下架？）`
      if (ALLOW_DRIFT) {
        console.warn(`[reindex-es-play-stats] ⚠️ 覆盖漂移（--allow-drift 容忍）：${msg}`)
      } else {
        console.error(`[reindex-es-play-stats] ⚠️ 覆盖不完整：${msg}（低流量窗口重跑或 --allow-drift）`)
        process.exitCode = 1
      }
    } else {
      console.log(`[reindex-es-play-stats] 覆盖断言通过：synced ${synced} == DB published ${publishedAfter}`)
    }

    // 3b. refresh + 数据收敛断言（ES near-real-time，断言前显式 refresh）
    await es.indices.refresh({ index: ES_INDEX })
    const converged = await assertSampleConvergence(pool)
    if (!converged) {
      console.error('[reindex-es-play-stats] ⚠️ 数据收敛断言失败——见上方逐条 diff')
      process.exitCode = 1
    }
  } finally {
    await pool.end()
    await es.close()
  }
}

main().catch((err) => {
  console.error('[reindex-es-play-stats] 失败：', err)
  process.exitCode = 2
})

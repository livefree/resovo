/**
 * report-title-observation-coverage.ts — title_observations 覆盖度验证报表
 * （SEQ-20260602-03 / CHG-VIR-OBS-BACKFILL）
 *
 * 用途：生产回填（scripts/backfill-title-observations.ts）前后验证覆盖度——
 * blocking 召回覆盖 = title_observations 覆盖度（CHG-VIR-8 offlineRescore core_title_key 分桶）。
 * 口径与 backfill 脚本（eligible videos）/ offlineRescore.fetchBlockingBuckets（分桶 SQL）严格一致。
 *
 * **只读**：不写任何表，可在生产任意时点重复执行。
 * 运行：node --env-file=.env.local --import tsx scripts/report-title-observation-coverage.ts
 */

import { db } from '@/api/lib/postgres'
import { TITLE_PARSER_VERSION } from '@/api/services/TitleIdentityParser'

/** offlineRescore 单桶护栏默认值（offlineRescore.ts `opts.maxBucket ?? 50`，未 export 故本地对齐）。 */
const DEFAULT_MAX_BUCKET = 50

interface ParserVersionRow {
  parser_version: string
  rows: number
  videos: number
}

async function main(): Promise<void> {
  // 1) eligible videos（与 backfill 脚本 WHERE 同口径）
  const eligible = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM videos WHERE deleted_at IS NULL AND title IS NOT NULL`,
  )
  const eligibleN = eligible.rows[0]!.n

  // 2) 当前 parser_version 下有观测的 videos（任意观测 / coreTitleKey 非空两档）
  const covered = await db.query<{ any_obs: number; with_core_key: number }>(
    `SELECT
       COUNT(DISTINCT t.video_id)::int AS any_obs,
       COUNT(DISTINCT t.video_id) FILTER (
         WHERE COALESCE(t.parsed_facets_jsonb->>'coreTitleKey', '') <> ''
       )::int AS with_core_key
     FROM title_observations t
     JOIN videos v ON v.id = t.video_id AND v.deleted_at IS NULL AND v.title IS NOT NULL
     WHERE t.parser_version = $1`,
    [TITLE_PARSER_VERSION],
  )
  const { any_obs: anyObs, with_core_key: withCoreKey } = covered.rows[0]!

  // 3) parser_version 分布（识别旧版本残留观测行）
  const versions = await db.query<ParserVersionRow>(
    `SELECT parser_version, COUNT(*)::int AS rows, COUNT(DISTINCT video_id)::int AS videos
     FROM title_observations
     GROUP BY parser_version
     ORDER BY parser_version ASC`,
  )

  // 4) blocking 分桶规模（与 offlineRescore.fetchBlockingBuckets 同口径：HAVING > 1）
  const buckets = await db.query<{
    buckets: number
    pair_upper_bound: string
    max_bucket_size: number
    oversize_buckets: number
  }>(
    `SELECT
       COUNT(*)::int AS buckets,
       COALESCE(SUM(n * (n - 1) / 2), 0)::bigint AS pair_upper_bound,
       COALESCE(MAX(n), 0)::int AS max_bucket_size,
       COUNT(*) FILTER (WHERE n > $2)::int AS oversize_buckets
     FROM (
       SELECT COUNT(DISTINCT t.video_id) AS n
       FROM title_observations t
       JOIN videos v ON v.id = t.video_id AND v.deleted_at IS NULL
       WHERE t.parser_version = $1
         AND COALESCE(t.parsed_facets_jsonb->>'coreTitleKey', '') <> ''
       GROUP BY t.parsed_facets_jsonb->>'coreTitleKey'
       HAVING COUNT(DISTINCT t.video_id) > 1
     ) b`,
    [TITLE_PARSER_VERSION, DEFAULT_MAX_BUCKET],
  )
  const bk = buckets.rows[0]!

  const pct = (x: number): string => (eligibleN === 0 ? '—' : `${((x / eligibleN) * 100).toFixed(1)}%`)

  console.log('=== title_observations 覆盖度报表 ===')
  console.log(`parser_version（当前）  : ${TITLE_PARSER_VERSION}`)
  console.log(`eligible videos        : ${eligibleN}（deleted_at IS NULL AND title IS NOT NULL）`)
  console.log(`有观测 videos          : ${anyObs}（覆盖率 ${pct(anyObs)}）`)
  console.log(`coreTitleKey 非空      : ${withCoreKey}（覆盖率 ${pct(withCoreKey)}）`)
  console.log(`未覆盖 videos          : ${eligibleN - anyObs}（回填后应为 0）`)

  console.log('\n=== parser_version 分布 ===')
  if (versions.rows.length === 0) {
    console.log('（title_observations 为空 — 尚未回填）')
  }
  for (const r of versions.rows) {
    const stale = r.parser_version === TITLE_PARSER_VERSION ? '' : '（旧版本残留，不参与召回）'
    console.log(`${r.parser_version}: ${r.rows} 行 / ${r.videos} videos ${stale}`)
  }

  console.log('\n=== blocking 分桶规模（offlineRescore 同口径）===')
  console.log(`桶数（HAVING > 1）     : ${bk.buckets}`)
  console.log(`pair 上限估算 ΣC(n,2)  : ${Number(bk.pair_upper_bound)}（强负拦截/低分跳过前的上界）`)
  console.log(`最大桶 video 数        : ${bk.max_bucket_size}`)
  console.log(`超护栏桶（n > ${DEFAULT_MAX_BUCKET}）   : ${bk.oversize_buckets}（job 将跳过并记 bucketsSkippedOversize）`)

  await db.end()
  process.exit(0)
}

main().catch((err) => {
  console.error('覆盖度报表生成失败:', err)
  process.exit(1)
})

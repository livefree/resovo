/**
 * blockingRecall.ts — Blocking 召回真源（ADR-105a D-105a-10 + D-105a-17 / CHG-VIR-10）
 *
 * 两类召回键（多 key 并集，确定性等值 / R2 B-tree 可承载）：
 *   ① core_title_key：title_observations.parsed_facets_jsonb->>'coreTitleKey'（CHG-VIR-8 既有）
 *   ② external_id：`provider:external_id` 桶（D-105a-17 / CHG-VIR-8 补记缺口治理——
 *      外部 ID 同/标题异 pair 仅靠 ① 召回不到）。双源沿 Y-105a-4：
 *      media_catalog 外部 ID 列（经 videos.catalog_id 上卷）∪ video_external_refs
 *      （is_primary AND match_status='manual_confirmed'）。
 *
 * 离线分桶（fetch*Buckets，keyset 分页）与单 video 召回（recall*Counterparts，
 * ingest shadow 用）共享同一数据源 SQL —— 两路径口径一致，报表才可比（D-105a-16）。
 */

import type { Pool } from 'pg'

/** 单个 blocking 桶（bucketKey = core_title_key 或 `provider:external_id`）。 */
export interface BlockingBucket {
  readonly bucketKey: string
  readonly videoIds: string[]
}

/**
 * external_id 桶数据源（双源 UNION / Y-105a-4）。bucket_key 形如 `imdb:tt0111161`。
 * provider 命名与 externalIdLoader 一致（imdb/tmdb/douban/bangumi + refs.provider 原样）。
 */
const EXT_ID_SOURCE_SQL = `
    SELECT v.id AS video_id, x.bucket_key
    FROM videos v
    JOIN media_catalog mc ON mc.id = v.catalog_id
    CROSS JOIN LATERAL (VALUES
      ('imdb:'    || mc.imdb_id,                  mc.imdb_id IS NOT NULL),
      ('tmdb:'    || mc.tmdb_id::text,            mc.tmdb_id IS NOT NULL),
      ('douban:'  || mc.douban_id,                mc.douban_id IS NOT NULL),
      ('bangumi:' || mc.bangumi_subject_id::text, mc.bangumi_subject_id IS NOT NULL)
    ) AS x(bucket_key, present)
    WHERE v.deleted_at IS NULL AND x.present
    UNION
    SELECT ver.video_id, ver.provider || ':' || ver.external_id AS bucket_key
    FROM video_external_refs ver
    JOIN videos v2 ON v2.id = ver.video_id AND v2.deleted_at IS NULL
    WHERE ver.is_primary = true AND ver.match_status = 'manual_confirmed'`

/** 段 ①：core_title_key 分桶召回（keyset 分页，HAVING >1 / CHG-VIR-8 既有逻辑迁入）。 */
export async function fetchCoreKeyBuckets(
  db: Pool,
  parserVersion: string,
  cursor: string,
  batchSize: number,
): Promise<BlockingBucket[]> {
  const r = await db.query<{ bucket_key: string; video_ids: string[] }>(
    `SELECT t.parsed_facets_jsonb->>'coreTitleKey' AS bucket_key,
            ARRAY_AGG(DISTINCT t.video_id) AS video_ids
     FROM title_observations t
     JOIN videos v ON v.id = t.video_id AND v.deleted_at IS NULL
     WHERE t.parser_version = $1
       AND COALESCE(t.parsed_facets_jsonb->>'coreTitleKey', '') <> ''
       AND t.parsed_facets_jsonb->>'coreTitleKey' > $2
     GROUP BY bucket_key
     HAVING COUNT(DISTINCT t.video_id) > 1
     ORDER BY bucket_key ASC
     LIMIT $3`,
    [parserVersion, cursor, batchSize],
  )
  return r.rows.map((row) => ({ bucketKey: row.bucket_key, videoIds: row.video_ids }))
}

/** 段 ②：external_id 分桶召回（keyset 分页，HAVING >1 / D-105a-17 第二召回键）。 */
export async function fetchExternalIdBuckets(
  db: Pool,
  cursor: string,
  batchSize: number,
): Promise<BlockingBucket[]> {
  const r = await db.query<{ bucket_key: string; video_ids: string[] }>(
    `SELECT bucket_key, ARRAY_AGG(DISTINCT video_id) AS video_ids
     FROM (${EXT_ID_SOURCE_SQL}) ext
     WHERE bucket_key > $1
     GROUP BY bucket_key
     HAVING COUNT(DISTINCT video_id) > 1
     ORDER BY bucket_key ASC
     LIMIT $2`,
    [cursor, batchSize],
  )
  return r.rows.map((row) => ({ bucketKey: row.bucket_key, videoIds: row.video_ids }))
}

/** 单 video core_title_key 同桶对侧召回（ingest shadow / 与段 ① 同口径）。 */
export async function recallCoreKeyCounterparts(
  db: Pool,
  parserVersion: string,
  coreTitleKey: string,
  excludeVideoId: string,
  limit: number,
): Promise<string[]> {
  const r = await db.query<{ video_id: string }>(
    `SELECT DISTINCT t.video_id
     FROM title_observations t
     JOIN videos v ON v.id = t.video_id AND v.deleted_at IS NULL
     WHERE t.parser_version = $1
       AND t.parsed_facets_jsonb->>'coreTitleKey' = $2
       AND t.video_id <> $3::uuid
     ORDER BY t.video_id ASC
     LIMIT $4`,
    [parserVersion, coreTitleKey, excludeVideoId, limit],
  )
  return r.rows.map((row) => row.video_id)
}

/** 单 video external_id 同桶对侧召回（ingest shadow / 与段 ② 同口径同数据源）。 */
export async function recallExternalIdCounterparts(
  db: Pool,
  bucketKeys: readonly string[],
  excludeVideoId: string,
  limit: number,
): Promise<string[]> {
  if (bucketKeys.length === 0) return []
  const r = await db.query<{ video_id: string }>(
    `SELECT DISTINCT ext.video_id
     FROM (${EXT_ID_SOURCE_SQL}) ext
     WHERE ext.bucket_key = ANY($1::text[]) AND ext.video_id <> $2::uuid
     ORDER BY ext.video_id ASC
     LIMIT $3`,
    [[...bucketKeys], excludeVideoId, limit],
  )
  return r.rows.map((row) => row.video_id)
}

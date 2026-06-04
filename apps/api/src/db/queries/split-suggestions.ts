/**
 * split-suggestions.ts — 拆分建议只读查询（ADR-105 AMENDMENT 2026-06-03 D-105-1 / CHG-VIR-11-B）
 *
 * 外部 ID 冲突信号数据源：media_catalog 外部 ID 列 + video_external_refs
 * （沿 ADR-105a Y-105a-4 双源口径）。同 video 同 provider 多个互斥 external_id
 * → 仅作 video 级拆分信号（signal），不参与线路归组（外部 ID 无线路粒度归属）。
 * 纯只读零副作用（R-105-S1）。
 */

import type { Pool } from 'pg'

/**
 * 返回该 video 存在外部 ID 冲突的 provider 列表（升序去重）。
 * 冲突 = 同 provider 出现 >1 个 distinct external_id：
 *   源① media_catalog 外部 ID 列（imdb/tmdb/douban/bangumi，经 videos.catalog_id 上卷）
 *   源② video_external_refs（排除 rejected 审计行）
 * 双源 UNION 后按 provider 聚合（确定性）。
 */
export async function listExternalIdConflictProviders(
  db: Pool,
  videoId: string,
): Promise<string[]> {
  const result = await db.query<{ provider: string }>(
    `WITH ids AS (
       SELECT 'imdb' AS provider, mc.imdb_id AS external_id
         FROM videos v JOIN media_catalog mc ON mc.id = v.catalog_id
        WHERE v.id = $1 AND mc.imdb_id IS NOT NULL
       UNION
       SELECT 'tmdb', mc.tmdb_id::text
         FROM videos v JOIN media_catalog mc ON mc.id = v.catalog_id
        WHERE v.id = $1 AND mc.tmdb_id IS NOT NULL
       UNION
       SELECT 'douban', mc.douban_id
         FROM videos v JOIN media_catalog mc ON mc.id = v.catalog_id
        WHERE v.id = $1 AND mc.douban_id IS NOT NULL
       UNION
       SELECT 'bangumi', mc.bangumi_subject_id::text
         FROM videos v JOIN media_catalog mc ON mc.id = v.catalog_id
        WHERE v.id = $1 AND mc.bangumi_subject_id IS NOT NULL
       UNION
       SELECT ver.provider, ver.external_id
         FROM video_external_refs ver
        WHERE ver.video_id = $1 AND ver.match_status <> 'rejected'
     )
     SELECT provider
       FROM ids
      GROUP BY provider
     HAVING COUNT(DISTINCT external_id) > 1
      ORDER BY provider ASC`,
    [videoId],
  )
  return result.rows.map((r) => r.provider)
}

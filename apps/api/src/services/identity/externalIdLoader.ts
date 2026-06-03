/**
 * externalIdLoader.ts — 批量加载 video 外部 ID 摘要（ADR-105a Y-105a-4 数据源）
 *
 * 供 Phase 2b 离线 job 填 PairSideInput.externalIds，使 scorePair 评估
 * external_exact_id_match / external_id_conflict（scorePair.ts 已就绪）。
 *
 * 数据源（ADR-177 落地前 / Y-105a-4）：
 *   ① media_catalog 外部 ID 列（catalog 级，经 videos.catalog_id JOIN）
 *   ② video_external_refs（video 级，is_primary=true AND match_status='manual_confirmed'）
 * Phase 2b **仅纳入 manual_confirmed**（保守 / 蓝图裁定 F）；auto_matched 留 scorer 升级后纳入。
 * alias/same_site_canonical 数据源（ADR-175 aliases）留 Phase 2b 后续细化。
 */

import type { Pool } from 'pg'
import type { ExternalIdSummary } from './scorePair'

interface MediaCatalogExternalRow {
  readonly video_id: string
  readonly imdb_id: string | null
  readonly tmdb_id: number | string | null
  readonly douban_id: string | null
  readonly bangumi_subject_id: number | string | null
}

interface VideoExternalRefRow {
  readonly video_id: string
  readonly provider: string
  readonly external_id: string
}

/**
 * 批量加载 videoIds 的外部 ID 摘要。返回 Map（每个 videoId 一条，无外部 ID 则 exactIds 空对象）。
 * provider 命名统一：imdb/tmdb/douban/bangumi（media_catalog 列）+ video_external_refs.provider 原样。
 */
export async function loadExternalIdSummaries(
  db: Pool,
  videoIds: readonly string[],
): Promise<Map<string, ExternalIdSummary>> {
  const result = new Map<string, { exactIds: Record<string, string> }>()
  if (videoIds.length === 0) return result
  for (const id of videoIds) result.set(id, { exactIds: {} })

  const ids = [...videoIds]

  // 源 ① media_catalog 外部 ID 列（catalog 级）
  const mc = await db.query<MediaCatalogExternalRow>(
    `SELECT v.id AS video_id, mc.imdb_id, mc.tmdb_id, mc.douban_id, mc.bangumi_subject_id
     FROM videos v
     JOIN media_catalog mc ON mc.id = v.catalog_id
     WHERE v.id = ANY($1::uuid[])`,
    [ids],
  )
  for (const row of mc.rows) {
    const e = result.get(row.video_id)?.exactIds
    if (!e) continue
    if (row.imdb_id) e.imdb = row.imdb_id
    if (row.tmdb_id != null) e.tmdb = String(row.tmdb_id)
    if (row.douban_id) e.douban = row.douban_id
    if (row.bangumi_subject_id != null) e.bangumi = String(row.bangumi_subject_id)
  }

  // 源 ② video_external_refs（video 级，is_primary + manual_confirmed / Y-105a-4）
  const ver = await db.query<VideoExternalRefRow>(
    `SELECT video_id, provider, external_id
     FROM video_external_refs
     WHERE video_id = ANY($1::uuid[]) AND is_primary = true AND match_status = 'manual_confirmed'`,
    [ids],
  )
  for (const row of ver.rows) {
    const e = result.get(row.video_id)?.exactIds
    if (e) e[row.provider] = row.external_id
  }

  return result
}

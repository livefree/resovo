/**
 * sources.maintenance.ts — video_sources 维护函数（投稿审核/导出/孤岛视频）
 * 从 sources.ts 拆出（CHG-SN-7-MISC-API-QUERIES-SIZE）
 */

import type { Pool } from 'pg'
import { extractHostname } from '@resovo/media-probe'
import type { UpsertSourceInput } from './sources.types'
import { languageSourceRankSql, languageUpgradeSetSql } from './sources.types'

// ── 投稿审核 ──────────────────────────────────────────────────────

const SUBMISSION_SORT_COLUMNS: Record<string, string> = {
  video: 'v.title',
  source_url: 's.source_url',
  submitted_by: 'u.username',
  created_at: 's.created_at',
}

export interface ListSubmissionsFilter {
  videoType?: string
  siteKey?: string
}

export async function listSubmissions(
  db: Pool,
  page: number,
  limit: number,
  sortField?: string,
  sortDir?: 'asc' | 'desc',
  filter?: ListSubmissionsFilter
): Promise<{ rows: unknown[]; total: number }> {
  const offset = (page - 1) * limit
  const validCol = sortField ? SUBMISSION_SORT_COLUMNS[sortField] : undefined
  const orderCol = validCol ?? 's.created_at'
  const orderDir = (validCol && sortDir === 'asc') ? 'ASC' : 'DESC'

  const whereClauses: string[] = [
    's.is_active = false',
    's.submitted_by IS NOT NULL',
    's.deleted_at IS NULL',
  ]
  const filterParams: unknown[] = []

  if (filter?.videoType) {
    filterParams.push(filter.videoType)
    whereClauses.push(`v.type = $${filterParams.length}`)
  }
  if (filter?.siteKey) {
    filterParams.push(filter.siteKey)
    whereClauses.push(`v.site_key = $${filterParams.length}`)
  }

  const whereSQL = whereClauses.join(' AND ')
  const listParams = [...filterParams, limit, offset]
  const countParams = [...filterParams]

  const [rows, countResult] = await Promise.all([
    db.query(
      `SELECT s.*, v.title AS video_title, v.type AS video_type, v.site_key AS video_site_key,
              u.username AS submitted_by_username
       FROM video_sources s
       LEFT JOIN videos v ON s.video_id = v.id
       LEFT JOIN users u ON s.submitted_by = u.id
       WHERE ${whereSQL}
       ORDER BY ${orderCol} ${orderDir}
       LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}`,
      listParams
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*)
       FROM video_sources s
       LEFT JOIN videos v ON s.video_id = v.id
       WHERE ${whereSQL}`,
      countParams
    ),
  ])

  return {
    rows: rows.rows,
    total: parseInt(countResult.rows[0]?.count ?? '0'),
  }
}

export async function batchApproveSubmissions(
  db: Pool,
  ids: string[]
): Promise<number> {
  if (ids.length === 0) return 0
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ')
  const result = await db.query(
    `UPDATE video_sources SET is_active = true, last_checked = NOW()
     WHERE id IN (${placeholders}) AND is_active = false AND deleted_at IS NULL`,
    ids
  )
  return result.rowCount ?? 0
}

export async function batchRejectSubmissions(
  db: Pool,
  ids: string[],
  reason?: string
): Promise<number> {
  if (ids.length === 0) return 0
  const reasonVal = reason ?? null
  const placeholders = ids.map((_, i) => `$${i + 2}`).join(', ')
  const result = await db.query(
    `UPDATE video_sources SET deleted_at = NOW(), rejection_reason = $1
     WHERE id IN (${placeholders}) AND is_active = false AND deleted_at IS NULL`,
    [reasonVal, ...ids]
  )
  return result.rowCount ?? 0
}

export async function approveSubmission(
  db: Pool,
  id: string
): Promise<boolean> {
  const result = await db.query(
    `UPDATE video_sources SET is_active = true, last_checked = NOW()
     WHERE id = $1 AND is_active = false AND deleted_at IS NULL
     RETURNING id`,
    [id]
  )
  return (result.rowCount ?? 0) > 0
}

export async function rejectSubmission(
  db: Pool,
  id: string,
  reason?: string
): Promise<boolean> {
  const result = await db.query(
    `UPDATE video_sources SET deleted_at = NOW(), rejection_reason = $2
     WHERE id = $1 AND is_active = false AND deleted_at IS NULL
     RETURNING id`,
    [id, reason ?? null]
  )
  return (result.rowCount ?? 0) > 0
}

// ── Admin 导出 ────────────────────────────────────────────────────

export interface ExportedSource {
  shortId: string
  sourceName: string
  sourceUrl: string
  isActive: boolean
  type: string
  episodeNumber: number | null
}

/**
 * 导出所有非删除的播放源（不含用户投稿，只含爬虫抓取/手动添加的源）
 */
export async function exportAllSources(db: Pool): Promise<ExportedSource[]> {
  const result = await db.query<{
    short_id: string
    source_name: string
    source_url: string
    is_active: boolean
    type: string
    episode_number: number | null
  }>(
    `SELECT v.short_id, s.source_name, s.source_url, s.is_active, s.type, s.episode_number
     FROM video_sources s
     JOIN videos v ON s.video_id = v.id
     WHERE s.deleted_at IS NULL
       AND s.submitted_by IS NULL
       AND v.deleted_at IS NULL
     ORDER BY s.created_at DESC`
  )

  return result.rows.map((row) => ({
    shortId: row.short_id,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    isActive: row.is_active,
    type: row.type,
    episodeNumber: row.episode_number,
  }))
}

// ── 全量替换策略（CRAWLER-02）─────────────────────────────────────

export interface ReplaceSourcesStats {
  sourcesAdded: number
  sourcesKept: number
  sourcesRemoved: number
}

/**
 * CRAWLER-02 / CRAWLER-05: 同站点全量替换策略
 *
 * 1. 查询指定 videoId + siteKey 的现有活跃源 URL
 *    - 行级 source_site_key 优先；历史数据（migration 046 之前）回落到 videos.site_key（COALESCE）
 *    - 注意：不再使用 source_name 匹配（source_name 是线路名如"线路1"，不是站点 key）
 * 2. 软删除不在新列表中的旧源
 * 3. 插入不在旧列表中的新源
 *
 * 返回 sourcesAdded / sourcesKept / sourcesRemoved 统计
 */
export async function replaceSourcesForSite(
  db: Pool,
  videoId: string,
  siteKey: string,
  newSources: UpsertSourceInput[]
): Promise<ReplaceSourcesStats> {
  // Fix-1 (R1): 后端兜底 assertion — 禁止以空数组调用，防止误清空整站源
  // 调用方在传入前应检查 newSources.length > 0（CrawlerService 已在 upsertVideo 守卫）
  if (newSources.length === 0) {
    throw new Error(
      'replaceSourcesForSite called with empty newSources — refuse to wipe site sources for safety'
    )
  }
  const client = await (db as import('pg').Pool).connect()
  try {
    await client.query('BEGIN')

    const existing = await client.query<{ id: string; source_url: string }>(
      `SELECT s.id, s.source_url
         FROM video_sources s
         LEFT JOIN videos v ON s.video_id = v.id
         WHERE s.video_id = $1
           AND COALESCE(s.source_site_key, v.site_key) = $2
           AND s.deleted_at IS NULL`,
      [videoId, siteKey],
    )

    const existingUrls = new Set(existing.rows.map((r) => r.source_url))
    const existingIdByUrl = new Map(existing.rows.map((r) => [r.source_url, r.id]))
    const newUrls = new Set(newSources.map((s) => s.sourceUrl))

    // 软删除不再出现的旧源
    const toRemoveIds = existing.rows
      .filter((r) => !newUrls.has(r.source_url))
      .map((r) => r.id)

    let sourcesRemoved = 0
    if (toRemoveIds.length > 0) {
      const placeholders = toRemoveIds.map((_, i) => `$${i + 1}`).join(', ')
      const result = await client.query(
        `UPDATE video_sources SET deleted_at = NOW() WHERE id IN (${placeholders})`,
        toRemoveIds,
      )
      sourcesRemoved = result.rowCount ?? 0
    }

    // 插入新增的源（包含恢复曾被软删除的同 URL 行）
    let sourcesAdded = 0
    let sourcesKept = 0
    const keptForLanguageUpgrade: Array<{ id: string; src: UpsertSourceInput }> = []
    for (const src of newSources) {
      if (existingUrls.has(src.sourceUrl)) {
        sourcesKept++
        const keptId = existingIdByUrl.get(src.sourceUrl)
        if (keptId) keptForLanguageUpgrade.push({ id: keptId, src })
        continue
      }
      // ON CONFLICT DO UPDATE 同时覆盖软删除行（恢复 deleted_at=NULL, is_active=true）
      // SRCHEALTH-P3-3-A: DO UPDATE 必须带 source_hostname——恢复的软删行可能是
      // 回填前 NULL；同 URL 冲突时 EXCLUDED 值与旧值相同，SET 幂等无害（裁决 F）
      // ADR-199: 语言四列入 INSERT；复活路径 DO UPDATE 经 provenance 等级守卫升级
      const insertResult = await client.query(
        `INSERT INTO video_sources
           (video_id, season_number, episode_number, source_url, source_name, type, is_active, source_site_key, source_hostname,
            audio_language, subtitle_languages, audio_language_source, subtitle_language_source)
         VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9::text, $10::text[], $11::text, $12::text)
         ON CONFLICT ON CONSTRAINT uq_sources_video_episode_url
         DO UPDATE SET deleted_at = NULL, is_active = true,
                       source_name = EXCLUDED.source_name,
                       type = EXCLUDED.type,
                       source_site_key = EXCLUDED.source_site_key,
                       source_hostname = EXCLUDED.source_hostname,
                       ${languageUpgradeSetSql()}`,
        [
          videoId, src.seasonNumber ?? 1, src.episodeNumber, src.sourceUrl, src.sourceName, src.type,
          src.sourceSiteKey ?? null, extractHostname(src.sourceUrl),
          src.audioLanguage ?? null, src.subtitleLanguages ?? null,
          src.audioLanguageSource ?? 'unknown', src.subtitleLanguageSource ?? 'unknown',
        ],
      )
      sourcesAdded += insertResult.rowCount ?? 0
    }

    // ADR-199 D-199-1：kept 行（重爬同 URL）语言四列经 provenance 等级守卫升级——
    // 否则升级规则在全量替换主路径永不生效（vod_lang 晚到 / 线路名变化无法落库）。
    // 按语言元组分组批量 UPDATE（同 vod 各行多为同值，通常 1~2 组）；裸参数显式 cast。
    if (keptForLanguageUpgrade.length > 0) {
      const groups = new Map<string, { ids: string[]; src: UpsertSourceInput }>()
      for (const { id, src } of keptForLanguageUpgrade) {
        const key = JSON.stringify([
          src.audioLanguage ?? null, src.audioLanguageSource ?? 'unknown',
          src.subtitleLanguages ?? null, src.subtitleLanguageSource ?? 'unknown',
        ])
        const group = groups.get(key)
        if (group) group.ids.push(id)
        else groups.set(key, { ids: [id], src })
      }
      const newAudioRank = languageSourceRankSql('$2::text')
      const oldAudioRank = languageSourceRankSql('audio_language_source')
      const newSubRank = languageSourceRankSql('$4::text')
      const oldSubRank = languageSourceRankSql('subtitle_language_source')
      for (const { ids, src } of groups.values()) {
        await client.query(
          `UPDATE video_sources SET
             audio_language = CASE WHEN ${newAudioRank} >= ${oldAudioRank} THEN $1::text ELSE audio_language END,
             audio_language_source = CASE WHEN ${newAudioRank} >= ${oldAudioRank} THEN $2::text ELSE audio_language_source END,
             subtitle_languages = CASE WHEN ${newSubRank} >= ${oldSubRank} THEN $3::text[] ELSE subtitle_languages END,
             subtitle_language_source = CASE WHEN ${newSubRank} >= ${oldSubRank} THEN $4::text ELSE subtitle_language_source END
           WHERE id = ANY($5::uuid[])
             AND (${newAudioRank} > ${oldAudioRank}
               OR (${newAudioRank} = ${oldAudioRank} AND ${newAudioRank} > 0 AND $1::text IS DISTINCT FROM audio_language)
               OR ${newSubRank} > ${oldSubRank}
               OR (${newSubRank} = ${oldSubRank} AND ${newSubRank} > 0 AND $3::text[] IS DISTINCT FROM subtitle_languages))`,
          [
            src.audioLanguage ?? null, src.audioLanguageSource ?? 'unknown',
            src.subtitleLanguages ?? null, src.subtitleLanguageSource ?? 'unknown',
            ids,
          ],
        )
      }
    }

    await client.query('COMMIT')
    return { sourcesAdded, sourcesKept, sourcesRemoved }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ── CHG-388: 孤岛视频查询 + source_health_events ─────────────────

export interface IslandVideo {
  id: string
  title: string
  siteKey: string | null
  reviewStatus: string
  visibilityStatus: string
  isPublished: boolean
  sourceCheckStatus: string
}

/**
 * 查询"孤岛视频"：is_published=true 且所有活跃源均已失效（source_check_status='all_dead'）
 * 用于 verify-published-sources Job 自动下架 + 触发补源
 */
export async function listIslandVideos(
  db: Pool,
  limit = 50,
): Promise<IslandVideo[]> {
  const result = await db.query<{
    id: string
    title: string
    site_key: string | null
    review_status: string
    visibility_status: string
    is_published: boolean
    source_check_status: string
  }>(
    `SELECT v.id, v.title, v.site_key,
            v.review_status, v.visibility_status, v.is_published, v.source_check_status
     FROM videos v
     WHERE v.is_published = true
       AND v.source_check_status = 'all_dead'
       AND v.deleted_at IS NULL
     ORDER BY v.updated_at ASC
     LIMIT $1`,
    [limit],
  )
  return result.rows.map((r) => ({
    id: r.id,
    title: r.title,
    siteKey: r.site_key,
    reviewStatus: r.review_status,
    visibilityStatus: r.visibility_status,
    isPublished: r.is_published,
    sourceCheckStatus: r.source_check_status,
  }))
}

export interface SourceHealthEventInput {
  videoId: string
  origin: 'island_detected' | 'auto_refetch_success' | 'auto_refetch_failed'
  oldStatus?: string | null
  newStatus?: string | null
  triggeredBy?: string
}

export async function insertSourceHealthEvent(
  db: Pool,
  input: SourceHealthEventInput,
): Promise<string> {
  const result = await db.query<{ id: string }>(
    `INSERT INTO source_health_events
       (video_id, origin, old_status, new_status, triggered_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      input.videoId,
      input.origin,
      input.oldStatus ?? null,
      input.newStatus ?? null,
      input.triggeredBy ?? 'maintenance_worker',
    ],
  )
  return result.rows[0].id
}

// ── ADMIN-12: 孤岛视频查询（最新事件为 auto_refetch_failed）────────

export interface OrphanVideoRow {
  id: string
  title: string
  siteKey: string | null
  sourceCheckStatus: string
  lastEventOrigin: string
  lastEventAt: string
}

/**
 * 查询孤岛视频：source_health_events 中最新事件为 auto_refetch_failed 且
 * 尚无 manually_resolved 事件的视频（需要人工处理）
 */
export async function listOrphanVideos(
  db: Pool,
  limit = 50,
): Promise<OrphanVideoRow[]> {
  const result = await db.query<{
    id: string
    title: string
    site_key: string | null
    source_check_status: string
    last_event_origin: string
    last_event_at: string
  }>(
    `WITH latest_events AS (
       SELECT DISTINCT ON (video_id)
         video_id, origin, created_at
       FROM source_health_events
       ORDER BY video_id, created_at DESC
     )
     SELECT v.id, v.title, v.site_key, v.source_check_status,
            le.origin AS last_event_origin,
            le.created_at AS last_event_at
     FROM videos v
     JOIN latest_events le ON le.video_id = v.id
     WHERE le.origin = 'auto_refetch_failed'
       AND v.deleted_at IS NULL
     ORDER BY le.created_at DESC
     LIMIT $1`,
    [limit],
  )
  return result.rows.map((r) => ({
    id: r.id,
    title: r.title,
    siteKey: r.site_key,
    sourceCheckStatus: r.source_check_status,
    lastEventOrigin: r.last_event_origin,
    lastEventAt: r.last_event_at,
  }))
}

/**
 * 标记孤岛视频已处理：写入 manually_resolved 事件
 */
export async function resolveOrphanVideo(
  db: Pool,
  videoId: string,
): Promise<void> {
  await db.query(
    `INSERT INTO source_health_events (video_id, origin, triggered_by)
     VALUES ($1, 'manually_resolved', 'admin')`,
    [videoId],
  )
}

/**
 * 替换播放源 URL（用于 SourceReplaceDialog 确认替换）
 * SRCHEALTH-P3-3-A: 换源即换主机，source_hostname 必须随 newUrl 重算（裁决 F——
 * 三处写路径中最不能漏的一处，漏写会导致 hostname 与 source_url 永久不一致）。
 */
export async function replaceSourceUrl(
  db: Pool,
  sourceId: string,
  newUrl: string,
): Promise<boolean> {
  const result = await db.query(
    `UPDATE video_sources
     SET source_url = $1, source_hostname = $2, is_active = true, last_checked = NOW()
     WHERE id = $3 AND deleted_at IS NULL
     RETURNING id`,
    [newUrl, extractHostname(newUrl), sourceId],
  )
  return (result.rowCount ?? 0) > 0
}

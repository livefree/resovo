/**
 * sources.ts — 播放源表 DB 查询
 * ADR-001: source_url 是直链，不做代理
 * 维护函数迁至 sources.maintenance.ts（CHG-SN-7-MISC-API-QUERIES-SIZE）
 */

import type { Pool } from 'pg'
import { extractHostname } from '@resovo/media-probe'
import type { VideoSource, VideoQuality, SourceType } from '@/types'
import type { UpsertSourceInput } from './sources.types'
import { languageSourceRankSql, languageUpgradeSetSql } from './sources.types'

export type { UpsertSourceInput } from './sources.types'
export type {
  ListSubmissionsFilter,
  ExportedSource,
  ReplaceSourcesStats,
  IslandVideo,
  SourceHealthEventInput,
  OrphanVideoRow,
} from './sources.maintenance'
export {
  listSubmissions, batchApproveSubmissions, batchRejectSubmissions,
  approveSubmission, rejectSubmission,
  exportAllSources,
  replaceSourcesForSite,
  listIslandVideos, insertSourceHealthEvent,
  listOrphanVideos, resolveOrphanVideo,
  replaceSourceUrl,
} from './sources.maintenance'

// ── 内部 DB 行类型 ────────────────────────────────────────────────

interface DbSourceRow {
  id: string
  video_id: string
  season_number: number
  episode_number: number
  source_url: string
  source_name: string
  /** CHG-413: JOIN videos v→crawler_sites cs via v.site_key（正确关联路径）*/
  site_display_name: string | null
  quality: string | null
  type: string
  is_active: boolean
  submitted_by: string | null
  last_checked: string | null
  deleted_at: string | null
  created_at: string
  /** ADR-199 D-199-7：语音规范词。provenance 列不透出前台（写侧治理用） */
  audio_language: string | null
  /** ADR-199 三态（null/[]/具体语言），pg TEXT[] 自动映射 JS 数组 */
  subtitle_languages: string[] | null
}

/**
 * CHG-352 / arch-reviewer I1：扩展行类型仅 SourceService 内部用
 * 含 effective_score 计算所需 4 raw 字段（probe/render/latency/quality_detected）
 * 不污染 mapSource / VideoSource 公共契约
 */
export interface DbSourceRowWithSignals extends DbSourceRow {
  probe_status: string
  render_status: string
  latency_ms: number | null
  quality_detected: string | null
  /** CHG-368-B-A3 / ADR-164 D-164-3：source_line_aliases.priority（0-100 / NOT NULL DEFAULT 0 / NULL 仅当无 sla 行 LEFT JOIN 时） */
  alias_priority: number | null
  /** SRCHEALTH-P3-3-B2：host_health.cooldown_until > NOW()（SQL 内判定布尔）；LEFT JOIN miss / NULL hostname → false */
  host_tripped: boolean
  /** SRCHEALTH-P3-1 双时钟新鲜度衰减输入（migration 054 列；NULL = 从未探测/渲染 → 衰减短路） */
  last_probed_at: string | null
  last_rendered_at: string | null
}

function mapSource(row: DbSourceRow): VideoSource {
  return {
    id: row.id,
    videoId: row.video_id,
    episodeNumber: row.episode_number,
    sourceUrl: row.source_url, // ADR-001: 直链，不做代理
    sourceName: row.source_name,
    siteDisplayName: row.site_display_name ?? null,
    quality: (row.quality as VideoQuality) ?? null,
    type: row.type as SourceType,
    isActive: row.is_active,
    lastChecked: row.last_checked,
    audioLanguage: row.audio_language ?? null,
    subtitleLanguages: row.subtitle_languages ?? null,
  }
}

/**
 * CHG-352 / 含 4 信号字段的 raw mapping（Service 层用）
 * Service 自行调 calculateEffectiveScore + sort 后合成 VideoSource
 */
export function mapSourceBase(row: DbSourceRow): VideoSource {
  return mapSource(row)
}

// ── 查询：按 videoId + episode 获取活跃播放源 ─────────────────────

export async function findActiveSourcesByVideoId(
  db: Pool,
  videoId: string,
  episode?: number
): Promise<VideoSource[]> {
  const conditions = [
    'video_id = $1',
    'is_active = true',
    'deleted_at IS NULL',
  ]
  const params: unknown[] = [videoId]
  let idx = 2

  if (episode !== undefined) {
    conditions.push(`episode_number = $${idx++}`)
    params.push(episode)
  }

  // CHG-413/414: JOIN 路径优先用行级 vs.source_site_key，NULL 时 fallback 到 v.site_key
  const result = await db.query<DbSourceRow>(
    `SELECT vs.id, vs.video_id, vs.season_number, vs.episode_number,
            vs.source_url, vs.source_name, vs.quality, vs.type,
            vs.is_active, vs.submitted_by, vs.last_checked,
            vs.deleted_at, vs.created_at,
            vs.audio_language, vs.subtitle_languages,
            cs.display_name AS site_display_name
     FROM video_sources vs
     JOIN videos v ON v.id = vs.video_id
     LEFT JOIN crawler_sites cs ON cs.key = COALESCE(vs.source_site_key, v.site_key)
     WHERE ${conditions.map((c) => `vs.${c}`).join(' AND ')}
     ORDER BY vs.created_at ASC`,
    params
  )
  return result.rows.map(mapSource)
}

/**
 * CHG-352 / route-labeling Phase 1：含 4 信号字段的查询变体
 * 返回 raw DbSourceRowWithSignals，由 SourceService 计算 effectiveScore + 排序
 * arch-reviewer I1：不污染 mapSource / findActiveSourcesByVideoId 既有契约
 */
export async function findActiveSourcesWithSignalsByVideoId(
  db: Pool,
  videoId: string,
  episode?: number
): Promise<DbSourceRowWithSignals[]> {
  const conditions = [
    'video_id = $1',
    'is_active = true',
    'deleted_at IS NULL',
  ]
  const params: unknown[] = [videoId]
  let idx = 2

  if (episode !== undefined) {
    conditions.push(`episode_number = $${idx++}`)
    params.push(episode)
  }

  const result = await db.query<DbSourceRowWithSignals>(
    // CHG-368-B-A3 / ADR-164 D-164-6：LEFT JOIN source_line_aliases sla 并加 retired_at IS NULL
    //   OR sla.source_site_key IS NULL（LEFT JOIN miss → 行保留）双条件守卫；已退役行不
    //   出现在前台排序池。读 sla.priority 供 SourceService.listSources 传入 route-scoring
    //   priority_bonus 通道（D-164-3 / priority/100 归一化）。
    // SRCHEALTH-P3-3-B2：LEFT JOIN host_health 取熔断布尔（cooldown_until > NOW() 读时判定，
    //   裁决 A 事实字段语义）；JOIN miss / source_hostname NULL → COALESCE false 不降权。
    //   SQL 只透出事实，分桶排序在 SourceService（CHG-352 A1：Service 层 + JS sort）。
    `SELECT vs.id, vs.video_id, vs.season_number, vs.episode_number,
            vs.source_url, vs.source_name, vs.quality, vs.type,
            vs.is_active, vs.submitted_by, vs.last_checked,
            vs.deleted_at, vs.created_at,
            vs.audio_language, vs.subtitle_languages,
            vs.probe_status, vs.render_status, vs.latency_ms, vs.quality_detected,
            vs.last_probed_at, vs.last_rendered_at,
            cs.display_name AS site_display_name,
            sla.priority AS alias_priority,
            COALESCE(hh.cooldown_until > NOW(), false) AS host_tripped
     FROM video_sources vs
     JOIN videos v ON v.id = vs.video_id
     LEFT JOIN crawler_sites cs ON cs.key = COALESCE(vs.source_site_key, v.site_key)
     LEFT JOIN source_line_aliases sla
       ON sla.source_site_key = COALESCE(vs.source_site_key, v.site_key)
      AND sla.source_name = vs.source_name
     LEFT JOIN host_health hh ON hh.hostname = vs.source_hostname
     WHERE ${conditions.map((c) => `vs.${c}`).join(' AND ')}
       AND (sla.retired_at IS NULL OR sla.source_site_key IS NULL)
     ORDER BY vs.created_at ASC`,
    params
  )
  return result.rows
}

// ── 查询：按 videoId 获取所有源 ID（用于举报验证）─────────────────

export async function findSourceById(
  db: Pool,
  sourceId: string
): Promise<VideoSource | null> {
  const result = await db.query<DbSourceRow>(
    `SELECT * FROM video_sources
     WHERE id = $1 AND deleted_at IS NULL`,
    [sourceId]
  )
  return result.rows[0] ? mapSource(result.rows[0]) : null
}

export type AdminSourceVerifyScope = 'video' | 'site' | 'video_site'

export interface AdminSourceBatchVerifyFilters {
  scope: AdminSourceVerifyScope
  videoId?: string
  siteKey?: string
  activeOnly?: boolean
  limit?: number
}

export interface AdminSourceVerifyCandidate {
  id: string
  source_url: string
}

export async function listSourcesForBatchVerify(
  db: Pool,
  filters: AdminSourceBatchVerifyFilters,
): Promise<AdminSourceVerifyCandidate[]> {
  const conditions = [
    's.deleted_at IS NULL',
    's.submitted_by IS NULL',
    'v.deleted_at IS NULL',
  ]
  const params: unknown[] = []
  let idx = 1

  if (filters.activeOnly ?? true) {
    conditions.push('s.is_active = true')
  }

  if (filters.scope === 'video') {
    if (!filters.videoId) return []
    conditions.push(`s.video_id = $${idx++}`)
    params.push(filters.videoId)
  } else if (filters.scope === 'site') {
    if (!filters.siteKey) return []
    conditions.push(`v.site_key = $${idx++}`)
    params.push(filters.siteKey)
  } else {
    if (!filters.videoId || !filters.siteKey) return []
    conditions.push(`s.video_id = $${idx++}`)
    params.push(filters.videoId)
    conditions.push(`v.site_key = $${idx++}`)
    params.push(filters.siteKey)
  }

  const limit = Math.max(1, Math.min(filters.limit ?? 200, 500))
  params.push(limit)

  const where = conditions.join(' AND ')
  const result = await db.query<AdminSourceVerifyCandidate>(
    `SELECT s.id, s.source_url
     FROM video_sources s
     JOIN videos v ON s.video_id = v.id
     WHERE ${where}
     ORDER BY s.last_checked ASC NULLS FIRST, s.created_at ASC
     LIMIT $${idx}`,
    params,
  )

  return result.rows
}

// ── 写入：更新活跃状态（用于验证服务）───────────────────────────

export async function updateSourceActiveStatus(
  db: Pool,
  sourceId: string,
  isActive: boolean
): Promise<void> {
  await db.query(
    `UPDATE video_sources
     SET is_active = $1, last_checked = NOW()
     WHERE id = $2`,
    [isActive, sourceId]
  )
}

export async function setSourceStatus(
  db: Pool,
  sourceId: string,
  isActive: boolean,
): Promise<boolean> {
  const result = await db.query(
    `UPDATE video_sources
     SET is_active = $1, last_checked = NOW()
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [isActive, sourceId],
  )
  return (result.rowCount ?? 0) > 0
}

export async function batchSetSourceStatus(
  db: Pool,
  ids: string[],
  isActive: boolean,
): Promise<number> {
  if (ids.length === 0) return 0
  const placeholders = ids.map((_, i) => `$${i + 2}`).join(', ')
  const result = await db.query(
    `UPDATE video_sources
     SET is_active = $1, last_checked = NOW()
     WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
    [isActive, ...ids],
  )
  return result.rowCount ?? 0
}

// ── 写入：Upsert 播放源（爬虫采集用）──────────────────────────────

/**
 * 播放源去重 upsert：
 * 同一 (video_id, episode_number, source_url) 已存在时不覆盖既有播放源状态
 * （规则 E(CHG-38)：避免误清除 is_active=false），**仅语言四列按 provenance
 * 等级守卫升级**（ADR-199 D-199-1：region_inferred/unknown 可被高级别证据覆盖，
 * 反向禁止；同级最新观测胜）——WHERE 守卫使纯 no-op 冲突不产生写放大。
 * ADR-016: episode_number 统一坐标系，单集/电影为 1（NOT NULL）。
 * SRCHEALTH-P3-3-A: source_hostname 在 query 层解析写入（「写 URL 必同步写 hostname」
 * 不变式封闭在 DB 层，新调用方无法漏传）。
 * 返回值语义保持「新插入行 | null」：语言升级的冲突行经 xmax=0 判定不计入插入。
 */
export async function upsertSource(
  db: Pool,
  input: UpsertSourceInput
): Promise<VideoSource | null> {
  const newAudioRank = languageSourceRankSql('EXCLUDED.audio_language_source')
  const oldAudioRank = languageSourceRankSql('video_sources.audio_language_source')
  const newSubRank = languageSourceRankSql('EXCLUDED.subtitle_language_source')
  const oldSubRank = languageSourceRankSql('video_sources.subtitle_language_source')
  const result = await db.query<DbSourceRow & { inserted: boolean }>(
    `INSERT INTO video_sources
       (video_id, season_number, episode_number, source_url, source_name, type, is_active, source_site_key, source_hostname,
        audio_language, subtitle_languages, audio_language_source, subtitle_language_source)
     VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9::text, $10::text[], $11::text, $12::text)
     ON CONFLICT ON CONSTRAINT uq_sources_video_episode_url
     DO UPDATE SET ${languageUpgradeSetSql()}
     WHERE ${newAudioRank} > ${oldAudioRank}
        OR (${newAudioRank} = ${oldAudioRank} AND ${newAudioRank} > 0 AND EXCLUDED.audio_language IS DISTINCT FROM video_sources.audio_language)
        OR ${newSubRank} > ${oldSubRank}
        OR (${newSubRank} = ${oldSubRank} AND ${newSubRank} > 0 AND EXCLUDED.subtitle_languages IS DISTINCT FROM video_sources.subtitle_languages)
     RETURNING *, (xmax = 0) AS inserted`,
    [
      input.videoId, input.seasonNumber ?? 1, input.episodeNumber, input.sourceUrl, input.sourceName, input.type,
      input.sourceSiteKey ?? null, extractHostname(input.sourceUrl),
      input.audioLanguage ?? null, input.subtitleLanguages ?? null,
      input.audioLanguageSource ?? 'unknown', input.subtitleLanguageSource ?? 'unknown',
    ]
  )
  const row = result.rows[0]
  return row && row.inserted ? mapSource(row) : null
}

/** 批量 upsert 播放源（爬虫采集后批量写入）。返回实际插入数量（跳过的不计入）。 */
export async function upsertSources(
  db: Pool,
  inputs: UpsertSourceInput[]
): Promise<number> {
  if (inputs.length === 0) return 0
  let count = 0
  for (const input of inputs) {
    const inserted = await upsertSource(db, input)
    if (inserted !== null) count++
  }
  return count
}

// ── Admin 查询 ────────────────────────────────────────────────────

export interface AdminSourceListFilters {
  active?: 'true' | 'false' | 'all'
  videoId?: string
  keyword?: string
  title?: string
  siteKey?: string
  sortField?: 'created_at' | 'last_checked' | 'is_active' | 'video_title' | 'source_url' | 'site_key'
  sortDir?: 'asc' | 'desc'
  page: number
  limit: number
}

export async function listAdminSources(
  db: Pool,
  filters: AdminSourceListFilters
): Promise<{ rows: unknown[]; total: number }> {
  const conditions = ['s.deleted_at IS NULL', 's.submitted_by IS NULL']
  const params: unknown[] = []
  let idx = 1

  if (filters.active === 'true') {
    conditions.push('s.is_active = true')
  } else if (filters.active === 'false') {
    conditions.push('s.is_active = false')
  }
  if (filters.videoId) {
    conditions.push(`s.video_id = $${idx++}`)
    params.push(filters.videoId)
  }
  if (filters.keyword) {
    conditions.push(`(s.source_url ILIKE $${idx} OR s.source_name ILIKE $${idx} OR v.title ILIKE $${idx})`)
    params.push(`%${filters.keyword}%`)
    idx += 1
  }
  if (filters.title) {
    conditions.push(`v.title ILIKE $${idx++}`)
    params.push(`%${filters.title}%`)
  }
  if (filters.siteKey) {
    // ADMIN-13: 切到行级 source_site_key，回落 v.site_key 保留历史兼容
    conditions.push(`COALESCE(s.source_site_key, v.site_key) = $${idx++}`)
    params.push(filters.siteKey)
  }

  const where = conditions.join(' AND ')
  const offset = (filters.page - 1) * filters.limit
  const ORDER_BY_MAP: Record<NonNullable<AdminSourceListFilters['sortField']>, string> = {
    created_at: 's.created_at',
    last_checked: 's.last_checked',
    is_active: 's.is_active',
    video_title: 'v.title',
    source_url: 's.source_url',
    site_key: 'COALESCE(s.source_site_key, v.site_key)',  // ADMIN-13: 行级优先
  }
  const orderByColumn = filters.sortField ? ORDER_BY_MAP[filters.sortField] : 's.created_at'
  const orderByDir = filters.sortDir === 'asc' ? 'ASC' : 'DESC'
  const nullsClause = filters.sortField === 'last_checked' ? ' NULLS LAST' : ''
  const orderBy = `${orderByColumn} ${orderByDir}${nullsClause}, s.created_at DESC, s.id ASC`

  const [rows, countResult] = await Promise.all([
    db.query(
      // ADMIN-13: 返回字段 site_key 改为行级 COALESCE（跨站聚合视频显示各行实际站点）
      // CHG-368-B-FOLLOWUP-CONTENT-SOURCE-ROW + CHG-368-B-FOLLOWUP-AUTO-RETIRED-LABEL：
      // LEFT JOIN source_line_aliases 透传 codename + retired_at + auto_retired（ADR-164 alias 派生 3 字段集）
      //   到 ContentSourceRow → LinesPanel codename badge + 退役行 opacity + 自动/手动文案区分
      // 索引设计 4 步核验（db-rules.md §"索引设计 4 步核验"）：
      //   1. 索引键: source_line_aliases (source_site_key, source_name) 复合 PK
      //   2. 部分索引 WHERE: N/A（PK 全表）
      //   3. 候选 driving 谓词: JOIN ON (sla.source_site_key, sla.source_name) 复合匹配
      //   4. 匹配判定: driving 列 = 索引键 ✅ 完整复合 PK 命中（实测留 EXPLAIN ANALYZE）
      // sla.retired_at 不加 JOIN 守卫：本路径需要透传 retired_at 状态到 UI（LinesPanel 退役行 opacity）
      `SELECT s.*, v.title AS video_title,
              COALESCE(s.source_site_key, v.site_key) AS site_key,
              sla.codename AS codename,
              sla.retired_at AS retired_at,
              sla.auto_retired AS auto_retired
       FROM video_sources s
       LEFT JOIN videos v ON s.video_id = v.id
       LEFT JOIN source_line_aliases sla
         ON s.source_site_key = sla.source_site_key
        AND s.source_name = sla.source_name
       WHERE ${where}
       ORDER BY ${orderBy}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, filters.limit, offset]
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*)
       FROM video_sources s
       LEFT JOIN videos v ON s.video_id = v.id
       WHERE ${where}`,
      params
    ),
  ])

  return {
    rows: rows.rows,
    total: parseInt(countResult.rows[0]?.count ?? '0'),
  }
}

export async function countShellVideos(
  db: Pool,
): Promise<{ count: number; videoIds: string[] }> {
  const result = await db.query<{ id: string }>(
    `SELECT v.id
     FROM videos v
     WHERE v.deleted_at IS NULL
       AND v.is_published = true
       AND EXISTS (
         SELECT 1
         FROM video_sources s
         WHERE s.video_id = v.id
           AND s.deleted_at IS NULL
       )
       AND NOT EXISTS (
         SELECT 1
         FROM video_sources s
         WHERE s.video_id = v.id
           AND s.deleted_at IS NULL
           AND s.is_active = true
       )
     ORDER BY v.updated_at DESC`
  )

  return {
    count: result.rows.length,
    videoIds: result.rows.map((row) => row.id),
  }
}

export async function deleteSource(
  db: Pool,
  id: string
): Promise<boolean> {
  const result = await db.query(
    `UPDATE video_sources SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
    [id]
  )
  return (result.rowCount ?? 0) > 0
}

export async function batchDeleteSources(
  db: Pool,
  ids: string[]
): Promise<number> {
  if (ids.length === 0) return 0
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ')
  const result = await db.query(
    `UPDATE video_sources SET deleted_at = NOW() WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
    ids
  )
  return result.rowCount ?? 0
}

/** 后台全局搜索 source 命中行（ADR-200 D-200-4）。 */
export interface AdminSourceSearchRow {
  id: string
  source_name: string
  source_url: string
  video_id: string
  video_title: string | null
  site_key: string | null
}

/**
 * 后台搜索播放源（ADR-200 D-200-4）：直接搜 source_url / source_name / 关联视频标题（不经 videos ES）。
 * 复用 listAdminSources `keyword` 同口径谓词 + 同可见性边界（非投稿、未软删）；按 is_active 优先 +
 * 最近创建排序，硬上限 limit。**不塞进列表函数**，独立轻量查询保职责单一。
 */
export async function searchAdminSources(
  db: Pool,
  q: string,
  limit: number
): Promise<AdminSourceSearchRow[]> {
  const res = await db.query<AdminSourceSearchRow>(
    `SELECT s.id::text AS id,
            s.source_name AS source_name,
            s.source_url AS source_url,
            s.video_id::text AS video_id,
            v.title AS video_title,
            COALESCE(s.source_site_key, v.site_key) AS site_key
       FROM video_sources s
       LEFT JOIN videos v ON s.video_id = v.id
      WHERE s.deleted_at IS NULL
        AND s.submitted_by IS NULL
        AND (s.source_url ILIKE $1 OR s.source_name ILIKE $1 OR v.title ILIKE $1)
      ORDER BY s.is_active DESC, s.created_at DESC, s.id ASC
      LIMIT $2`,
    [`%${q}%`, limit]
  )
  return res.rows
}


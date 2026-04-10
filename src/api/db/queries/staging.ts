/**
 * staging.ts — 暂存队列查询
 * CHG-383: 查询 approved+internal+false 视频及就绪状态
 * CHG-389: 修复 title_en/year/cover_url 字段来自 media_catalog，需 JOIN
 */

import type { Pool } from 'pg'
import type { VideoType } from '@/types'

// ── 类型 ─────────────────────────────────────────────────────────

export interface StagingVideo {
  id: string
  shortId: string
  slug: string | null
  title: string
  titleEn: string | null
  coverUrl: string | null
  type: VideoType
  year: number | null
  doubanStatus: 'pending' | 'matched' | 'candidate' | 'unmatched'
  sourceCheckStatus: 'pending' | 'ok' | 'partial' | 'all_dead'
  metaScore: number
  activeSourceCount: number
  approvedAt: string | null   // reviewed_at 作为进入暂存的时间
  updatedAt: string
}

export interface StagingPublishRules {
  minMetaScore: number          // 元数据最低分（default 40）
  requireDoubanMatched: boolean // 是否要求豆瓣匹配（default false）
  requireCoverUrl: boolean      // 是否要求封面（default true）
  minActiveSourceCount: number  // 最少活跃源数量（default 1）
}

export interface StagingReadinessSummary {
  all: number
  ready: number
  warning: number
  blocked: number
  /** 当前 type/siteKey 筛选条件下的可用站点 key 列表 */
  siteKeys: string[]
}

export const DEFAULT_STAGING_RULES: StagingPublishRules = {
  minMetaScore: 40,
  requireDoubanMatched: false,
  requireCoverUrl: true,
  minActiveSourceCount: 1,
}

interface DbStagingRow {
  id: string
  short_id: string
  slug: string | null
  title: string
  title_en: string | null
  cover_url: string | null
  type: VideoType
  year: number | null
  douban_status: 'pending' | 'matched' | 'candidate' | 'unmatched'
  source_check_status: 'pending' | 'ok' | 'partial' | 'all_dead'
  meta_score: number
  active_source_count: string
  reviewed_at: string | null
  updated_at: string
}

function mapStagingRow(row: DbStagingRow): StagingVideo {
  return {
    id: row.id,
    shortId: row.short_id,
    slug: row.slug,
    title: row.title,
    titleEn: row.title_en,
    coverUrl: row.cover_url,
    type: row.type,
    year: row.year,
    doubanStatus: row.douban_status,
    sourceCheckStatus: row.source_check_status,
    metaScore: row.meta_score ?? 0,
    activeSourceCount: parseInt(row.active_source_count ?? '0', 10),
    approvedAt: row.reviewed_at,
    updatedAt: row.updated_at,
  }
}

// ── 查询 ─────────────────────────────────────────────────────────

export async function listStagingVideos(
  db: Pool,
  params: {
    page?: number
    limit?: number
    type?: VideoType
    readiness?: 'ready' | 'warning' | 'blocked'
    siteKey?: string
    rules?: StagingPublishRules
  } = {},
): Promise<{ rows: StagingVideo[]; total: number; summary: StagingReadinessSummary }> {
  const page = params.page ?? 1
  const limit = params.limit ?? 20
  const offset = (page - 1) * limit
  const rules = params.rules ?? DEFAULT_STAGING_RULES

  // ── 基础 WHERE 条件（type / siteKey）────────────────────────────
  const baseConditions: string[] = [
    `v.review_status = 'approved'`,
    `v.visibility_status = 'internal'`,
    `v.is_published = false`,
    `v.deleted_at IS NULL`,
  ]
  const baseValues: unknown[] = []
  let idx = 1

  if (params.type) {
    baseConditions.push(`v.type = $${idx++}`)
    baseValues.push(params.type)
  }
  if (params.siteKey) {
    baseConditions.push(`v.site_key = $${idx++}`)
    baseValues.push(params.siteKey)
  }

  // ── 规则参数占位符（供 classified CTE 使用）──────────────────────
  const minSourcesIdx = idx++
  const minScoreIdx = idx++
  const reqDoubanIdx = idx++
  const reqCoverIdx = idx++
  const rulesValues: unknown[] = [
    rules.minActiveSourceCount,
    rules.minMetaScore,
    rules.requireDoubanMatched,
    rules.requireCoverUrl,
  ]

  // ── CTE：base（活跃源计数）+ classified（readiness 分类）────────
  const cteBase = `
    WITH base AS (
      SELECT
        v.id, v.short_id, v.slug, v.title, v.type, v.site_key,
        v.douban_status, v.source_check_status, v.meta_score,
        v.reviewed_at, v.updated_at,
        mc.title_en, mc.cover_url, mc.year,
        (SELECT COUNT(*)::text FROM video_sources vs
         WHERE vs.video_id = v.id AND vs.is_active = true AND vs.deleted_at IS NULL
        ) AS active_source_count
      FROM videos v
      LEFT JOIN media_catalog mc ON mc.id = v.catalog_id
      WHERE ${baseConditions.join(' AND ')}
    ),
    classified AS (
      SELECT *,
        CASE
          WHEN active_source_count::int = 0 OR source_check_status = 'all_dead' THEN 'blocked'
          WHEN active_source_count::int >= $${minSourcesIdx}
               AND meta_score >= $${minScoreIdx}
               AND ($${reqDoubanIdx}::boolean = false OR douban_status = 'matched')
               AND ($${reqCoverIdx}::boolean = false OR cover_url IS NOT NULL)
               AND source_check_status != 'all_dead'
          THEN 'ready'
          ELSE 'warning'
        END AS readiness_level
      FROM base
    )`

  // summaryParams = baseValues + rulesValues（不含 readiness/分页）
  const summaryParams = [...baseValues, ...rulesValues]

  // ── readiness 过滤子句（仅 data/count 查询使用）──────────────────
  const readinessValues: unknown[] = []
  let readinessClause = ''
  if (params.readiness) {
    readinessClause = `WHERE readiness_level = $${idx++}`
    readinessValues.push(params.readiness)
  }

  const limitIdx = idx++
  const offsetIdx = idx

  const dataParams = [...baseValues, ...rulesValues, ...readinessValues, limit, offset]
  const countParams = [...baseValues, ...rulesValues, ...readinessValues]

  // ── 并行执行 4 个查询 ─────────────────────────────────────────────
  const [dataResult, countResult, summaryResult, siteKeysResult] = await Promise.all([
    db.query<DbStagingRow & { readiness_level: string }>(
      `${cteBase}
       SELECT * FROM classified ${readinessClause}
       ORDER BY reviewed_at ASC NULLS LAST, updated_at ASC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      dataParams,
    ),
    db.query<{ total: string }>(
      `${cteBase}
       SELECT COUNT(*)::text AS total FROM classified ${readinessClause}`,
      countParams,
    ),
    db.query<{ readiness_level: string; cnt: number }>(
      `${cteBase}
       SELECT readiness_level, COUNT(*)::int AS cnt FROM classified GROUP BY readiness_level`,
      summaryParams,
    ),
    db.query<{ site_key: string }>(
      `${cteBase}
       SELECT DISTINCT site_key FROM classified WHERE site_key IS NOT NULL ORDER BY site_key`,
      summaryParams,
    ),
  ])

  const readinessMap: Record<string, number> = {}
  let totalAll = 0
  for (const r of summaryResult.rows) {
    readinessMap[r.readiness_level] = r.cnt
    totalAll += r.cnt
  }

  return {
    rows: dataResult.rows.map(mapStagingRow),
    total: parseInt(countResult.rows[0]?.total ?? '0', 10),
    summary: {
      all: totalAll,
      ready: readinessMap['ready'] ?? 0,
      warning: readinessMap['warning'] ?? 0,
      blocked: readinessMap['blocked'] ?? 0,
      siteKeys: siteKeysResult.rows.map((r) => r.site_key),
    },
  }
}

export async function getStagingVideoById(
  db: Pool,
  id: string,
): Promise<StagingVideo | null> {
  const result = await db.query<DbStagingRow>(
    `SELECT
       v.id, v.short_id, v.slug, v.title, v.type,
       v.douban_status, v.source_check_status, v.meta_score,
       v.reviewed_at, v.updated_at,
       mc.title_en, mc.cover_url, mc.year,
       (SELECT COUNT(*)::text FROM video_sources vs
        WHERE vs.video_id = v.id AND vs.is_active = true) AS active_source_count
     FROM videos v
     LEFT JOIN media_catalog mc ON mc.id = v.catalog_id
     WHERE v.id = $1
       AND v.review_status = 'approved'
       AND v.visibility_status = 'internal'
       AND v.is_published = false
       AND v.deleted_at IS NULL`,
    [id],
  )
  return result.rows[0] ? mapStagingRow(result.rows[0]) : null
}

/** 查询满足就绪条件的暂存视频 ID 列表，供 auto-publish Job 批量发布 */
export async function listReadyStagingVideoIds(
  db: Pool,
  rules: StagingPublishRules,
  limit = 50,
): Promise<string[]> {
  const conditions: string[] = [
    `v.review_status = 'approved'`,
    `v.visibility_status = 'internal'`,
    `v.is_published = false`,
    `v.deleted_at IS NULL`,
    `v.meta_score >= $1`,
    `(SELECT COUNT(*) FROM video_sources vs WHERE vs.video_id = v.id AND vs.is_active = true) >= $2`,
  ]
  const values: unknown[] = [rules.minMetaScore, rules.minActiveSourceCount]
  let idx = 3

  if (rules.requireDoubanMatched) {
    conditions.push(`v.douban_status = 'matched'`)
  }
  if (rules.requireCoverUrl) {
    conditions.push(`mc.cover_url IS NOT NULL`)
  }

  const result = await db.query<{ id: string }>(
    `SELECT v.id
     FROM videos v
     LEFT JOIN media_catalog mc ON mc.id = v.catalog_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY v.reviewed_at ASC NULLS LAST
     LIMIT $${idx}`,
    [...values, limit],
  )
  return result.rows.map((r) => r.id)
}

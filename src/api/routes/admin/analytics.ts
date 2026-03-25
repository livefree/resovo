/**
 * admin/analytics.ts — 数据看板 API
 * ADMIN-05: admin only
 *
 * GET /admin/analytics — 汇总统计数据
 */

import type { FastifyInstance } from 'fastify'
import { db } from '@/api/lib/postgres'
import { AnalyticsService } from '@/api/services/AnalyticsService'

export interface AnalyticsData {
  videos: {
    total: number
    published: number
    pending: number
  }
  sources: {
    total: number
    active: number
    inactive: number
    failRate: number  // 0~1
  }
  users: {
    total: number
    todayNew: number
    banned: number
  }
  queues: {
    submissions: number   // 待审投稿
    subtitles: number     // 待审字幕
  }
  crawlerTasks: {
    recent: Array<{
      id: string
      type: string
      status: string
      created_at: string
      finished_at: string | null
    }>
  }
}

/** 单站内容质量统计行 */
export interface ContentQualityRow {
  siteKey: string
  total: number
  published: number
  hasCover: number
  hasDescription: number
  hasYear: number
  activeSources: number
  totalSources: number
}

export async function adminAnalyticsRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['admin'])]
  const analyticsService = new AnalyticsService(db)

  fastify.get('/admin/analytics', { preHandler: auth }, async (_request, reply) => {
    const data = await analyticsService.getDashboard()
    return reply.send({ data })
  })

  // ── GET /admin/analytics/content-quality ────────────────────────
  // 按来源站点分组，统计字段覆盖率与源存活率
  fastify.get('/admin/analytics/content-quality', { preHandler: auth }, async (_request, reply) => {
    const result = await db.query<{
      site_key: string
      total: string
      published: string
      has_cover: string
      has_description: string
      has_year: string
      active_sources: string
      total_sources: string
    }>(`
      SELECT
        vs.source_name                                                      AS site_key,
        COUNT(DISTINCT v.id)::text                                          AS total,
        COUNT(DISTINCT v.id) FILTER (WHERE v.is_published = true)::text     AS published,
        COUNT(DISTINCT v.id) FILTER (WHERE v.cover_url IS NOT NULL)::text   AS has_cover,
        COUNT(DISTINCT v.id) FILTER (WHERE v.description IS NOT NULL AND v.description != '')::text AS has_description,
        COUNT(DISTINCT v.id) FILTER (WHERE v.year IS NOT NULL)::text        AS has_year,
        COUNT(vs.id)         FILTER (WHERE vs.is_active = true)::text       AS active_sources,
        COUNT(vs.id)::text                                                  AS total_sources
      FROM video_sources vs
      JOIN videos v ON v.id = vs.video_id AND v.deleted_at IS NULL
      WHERE vs.deleted_at IS NULL
        AND vs.source_name IS NOT NULL
      GROUP BY vs.source_name
      ORDER BY total DESC
    `)

    const data: ContentQualityRow[] = result.rows.map((r) => ({
      siteKey:        r.site_key,
      total:          parseInt(r.total),
      published:      parseInt(r.published),
      hasCover:       parseInt(r.has_cover),
      hasDescription: parseInt(r.has_description),
      hasYear:        parseInt(r.has_year),
      activeSources:  parseInt(r.active_sources),
      totalSources:   parseInt(r.total_sources),
    }))

    return reply.send({ data })
  })
}

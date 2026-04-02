/**
 * admin/analytics.ts — 数据看板 API
 * ADMIN-05: admin only
 *
 * GET /admin/analytics — 汇总统计数据
 */

import type { FastifyInstance } from 'fastify'
import { db } from '@/api/lib/postgres'
import { es, ES_INDEX } from '@/api/lib/elasticsearch'
import { AnalyticsService } from '@/api/services/AnalyticsService'
import type { AnalyticsData, ContentQualityRow } from '@/types/contracts/v1/admin'

export type { AnalyticsData, ContentQualityRow }

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
      alias_count: string
    }>(`
      SELECT
        vs.source_name                                                      AS site_key,
        COUNT(DISTINCT v.id)::text                                          AS total,
        COUNT(DISTINCT v.id) FILTER (WHERE v.is_published = true)::text     AS published,
        COUNT(DISTINCT v.id) FILTER (WHERE v.cover_url IS NOT NULL)::text   AS has_cover,
        COUNT(DISTINCT v.id) FILTER (WHERE v.description IS NOT NULL AND v.description != '')::text AS has_description,
        COUNT(DISTINCT v.id) FILTER (WHERE v.year IS NOT NULL)::text        AS has_year,
        COUNT(vs.id)         FILTER (WHERE vs.is_active = true)::text       AS active_sources,
        COUNT(vs.id)::text                                                  AS total_sources,
        COUNT(DISTINCT va.video_id)::text                                   AS alias_count
      FROM video_sources vs
      JOIN videos v ON v.id = vs.video_id AND v.deleted_at IS NULL
      LEFT JOIN video_aliases va ON va.video_id = v.id
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
      aliasCount:     parseInt(r.alias_count),
    }))

    return reply.send({ data })
  })

  // ── GET /admin/analytics/es-health ──────────────────────────────
  // ES 索引健康监控：对比 ES 与 DB 视频数量，暴露同步差异
  fastify.get('/admin/analytics/es-health', { preHandler: auth }, async (_request, reply) => {
    const [esCount, esPublishedCount, dbCount, dbPublishedCount] = await Promise.all([
      es.count({ index: ES_INDEX }).then((r) => r.count).catch(() => -1),
      es.count({ index: ES_INDEX, body: { query: { term: { is_published: true } } } })
        .then((r) => r.count).catch(() => -1),
      db.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM videos WHERE deleted_at IS NULL')
        .then((r) => parseInt(r.rows[0].count)),
      db.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM videos WHERE is_published = true AND deleted_at IS NULL')
        .then((r) => parseInt(r.rows[0].count)),
    ])

    return reply.send({
      data: {
        es: { total: esCount, published: esPublishedCount },
        db: { total: dbCount, published: dbPublishedCount },
        diff: {
          total: esCount >= 0 ? dbCount - esCount : null,
          published: esPublishedCount >= 0 ? dbPublishedCount - esPublishedCount : null,
        },
        indexName: ES_INDEX,
      },
    })
  })
}

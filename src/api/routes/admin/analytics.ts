/**
 * admin/analytics.ts — 数据看板 API
 * ADMIN-05: admin only
 *
 * GET /admin/analytics — 汇总统计数据
 */

import type { FastifyInstance } from 'fastify'
import { db } from '@/api/lib/postgres'
import { listTasks } from '@/api/db/queries/crawlerTasks'

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

export async function adminAnalyticsRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['admin'])]

  fastify.get('/admin/analytics', { preHandler: auth }, async (_request, reply) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayIso = today.toISOString()

    const [
      videoStats,
      sourceStats,
      userStats,
      submissionCount,
      subtitleCount,
      recentTasks,
    ] = await Promise.all([
      // 视频统计
      db.query<{ total: string; published: string; pending: string }>(`
        SELECT
          COUNT(*)                                          AS total,
          COUNT(*) FILTER (WHERE is_published = true)       AS published,
          COUNT(*) FILTER (WHERE is_published = false)      AS pending
        FROM videos WHERE deleted_at IS NULL
      `),
      // 播放源统计
      db.query<{ total: string; active: string; inactive: string }>(`
        SELECT
          COUNT(*)                                         AS total,
          COUNT(*) FILTER (WHERE is_active = true)         AS active,
          COUNT(*) FILTER (WHERE is_active = false)        AS inactive
        FROM video_sources WHERE deleted_at IS NULL
      `),
      // 用户统计
      db.query<{ total: string; today_new: string; banned: string }>(`
        SELECT
          COUNT(*)                                              AS total,
          COUNT(*) FILTER (WHERE created_at >= $1)             AS today_new,
          COUNT(*) FILTER (WHERE banned_at IS NOT NULL)        AS banned
        FROM users WHERE deleted_at IS NULL
      `, [todayIso]),
      // 投稿待审数
      db.query<{ count: string }>(
        `SELECT COUNT(*) FROM video_sources WHERE is_active = false AND submitted_by IS NOT NULL AND deleted_at IS NULL`
      ),
      // 字幕待审数
      db.query<{ count: string }>(
        `SELECT COUNT(*) FROM subtitles WHERE is_verified = false AND deleted_at IS NULL`
      ),
      // 最近 10 条爬虫任务
      listTasks(db, { limit: 10, offset: 0 }),
    ])

    const vs = videoStats.rows[0]
    const ss = sourceStats.rows[0]
    const us = userStats.rows[0]
    const totalSources = parseInt(ss?.total ?? '0')
    const inactiveSources = parseInt(ss?.inactive ?? '0')

    const data: AnalyticsData = {
      videos: {
        total: parseInt(vs?.total ?? '0'),
        published: parseInt(vs?.published ?? '0'),
        pending: parseInt(vs?.pending ?? '0'),
      },
      sources: {
        total: totalSources,
        active: parseInt(ss?.active ?? '0'),
        inactive: inactiveSources,
        failRate: totalSources > 0 ? inactiveSources / totalSources : 0,
      },
      users: {
        total: parseInt(us?.total ?? '0'),
        todayNew: parseInt(us?.today_new ?? '0'),
        banned: parseInt(us?.banned ?? '0'),
      },
      queues: {
        submissions: parseInt(submissionCount.rows[0]?.count ?? '0'),
        subtitles: parseInt(subtitleCount.rows[0]?.count ?? '0'),
      },
      crawlerTasks: {
        recent: recentTasks.rows.map((t) => ({
          id: t.id,
          type: t.sourceSite,
          status: t.status,
          created_at: t.scheduledAt,
          finished_at: t.finishedAt ?? null,
        })),
      },
    }

    return reply.send({ data })
  })
}

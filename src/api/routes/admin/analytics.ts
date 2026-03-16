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

export async function adminAnalyticsRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['admin'])]
  const analyticsService = new AnalyticsService(db)

  fastify.get('/admin/analytics', { preHandler: auth }, async (_request, reply) => {
    const data = await analyticsService.getDashboard()
    return reply.send({ data })
  })
}

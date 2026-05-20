/**
 * admin/dashboard.ts — Dashboard 专用 3 端点（ADR-127 / CHG-SN-7-MISC-DASHBOARD-2）
 *
 * 端点：
 *   GET /admin/dashboard/overview  — 4 KPI + 4 workflow + generatedAt（一次性）
 *   GET /admin/dashboard/spark     — 单 metric 历史 spark（7 天 default）
 *   GET /admin/dashboard/analytics — Analytics tab 专用（4 KPI + 采集时间线 + 源分布 + 近期任务）
 *
 * 设计决策（ADR-127）：
 *   - D-127-1：3 新端点 + moderation-stats 扩展（interceptDelta）
 *   - D-127-2：spark 实时聚合 GROUP BY day；触发 ADR-127a 时再建快照表
 *   - D-127-3：KPI×4 + Workflow×4 真实化；Attention/Activity/Site 延后
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { getDashboardOverview } from '@/api/db/queries/dashboardOverview'
import { getDashboardSpark } from '@/api/db/queries/dashboardSpark'
import { getDashboardAnalyticsData, type AnalyticsPeriod } from '@/api/db/queries/dashboardAnalytics'
import type { DashboardKpiSnapshot } from '@/types'

// ── Zod Schemas ───────────────────────────────────────────────────

const SparkQuerySchema = z.object({
  metric: z.enum(['videoTotal', 'pendingStaging', 'sourceReachableRate', 'inactiveSources']),
  days: z.coerce.number().int().min(1).max(30).default(7),
})

const AnalyticsQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d']).default('7d'),
})

// ── 路由 ──────────────────────────────────────────────────────────

export async function adminDashboardRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['admin'])]

  // ── GET /admin/dashboard/overview ───────────────────────────────

  fastify.get('/admin/dashboard/overview', { preHandler: auth }, async (_request, reply) => {
    const data = await getDashboardOverview(db)
    return reply.send({ data })
  })

  // ── GET /admin/dashboard/spark ───────────────────────────────────

  fastify.get('/admin/dashboard/spark', { preHandler: auth }, async (request, reply) => {
    const parsed = SparkQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }
    const { metric, days } = parsed.data
    const points = await getDashboardSpark(db, metric, days)
    return reply.send({ data: { metric, points } })
  })

  // ── GET /admin/dashboard/analytics ──────────────────────────────

  fastify.get('/admin/dashboard/analytics', { preHandler: auth }, async (request, reply) => {
    const parsed = AnalyticsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }
    const { period } = parsed.data

    const [overview, analyticsData] = await Promise.all([
      getDashboardOverview(db),
      getDashboardAnalyticsData(db, period as AnalyticsPeriod),
    ])

    const kpis: readonly DashboardKpiSnapshot[] = overview.kpis

    return reply.send({
      data: {
        kpis,
        collectTimeline: analyticsData.collectTimeline,
        sourceTypeDistribution: analyticsData.sourceTypeDistribution,
        recentTasks: analyticsData.recentTasks,
      },
    })
  })
}

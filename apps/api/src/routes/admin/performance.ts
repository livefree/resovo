/**
 * admin/performance.ts — 性能监控 API
 * CHG-32: admin only
 *
 * GET /admin/performance/stats — 请求速率、延迟、内存、uptime
 */

import type { FastifyInstance } from 'fastify'

export async function adminPerformanceRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['admin'])]

  fastify.get('/admin/performance/stats', { preHandler: auth }, async (_request, reply) => {
    const metrics = fastify.metrics
    const mem = process.memoryUsage()

    return reply.send({
      data: {
        requests: {
          perMinute: metrics.requestsPerMinute,
          total24h: metrics.total24h,
        },
        latency: {
          avgMs: metrics.avgResponseMs,
          p95Ms: metrics.p95ResponseMs,
        },
        memory: {
          heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
          rssMb: Math.round(mem.rss / 1024 / 1024),
        },
        uptime: Math.round(process.uptime()),
        slowRequests: metrics.slowRequests,
      },
    })
  })
}

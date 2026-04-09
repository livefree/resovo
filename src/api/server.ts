import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import multipart from '@fastify/multipart'

import { setupAuthenticate } from '@/api/plugins/authenticate'
import { authRoutes } from '@/api/routes/auth'
import { videoRoutes } from '@/api/routes/videos'
import { sourceRoutes } from '@/api/routes/sources'
import { searchRoutes } from '@/api/routes/search'
import { subtitleRoutes } from '@/api/routes/subtitles'
import { adminVideoRoutes } from '@/api/routes/admin/videos'
import { adminContentRoutes } from '@/api/routes/admin/content'
import { adminUserRoutes } from '@/api/routes/admin/users'
import { adminAnalyticsRoutes } from '@/api/routes/admin/analytics'
import { adminCrawlerRoutes } from '@/api/routes/admin/crawler'
import { adminCacheRoutes } from '@/api/routes/admin/cache'
import { adminMigrationRoutes } from '@/api/routes/admin/migration'
import { adminPerformanceRoutes } from '@/api/routes/admin/performance'
import { adminSiteConfigRoutes } from '@/api/routes/admin/siteConfig'
import { adminCrawlerSitesRoutes } from '@/api/routes/admin/crawlerSites'
import { setupMetrics } from '@/api/plugins/metrics'
import { userRoutes } from '@/api/routes/users'
import { danmakuRoutes } from '@/api/routes/danmaku'
import { registerVerifyWorker } from '@/api/workers/verifyWorker'
import { registerCrawlerWorker } from '@/api/workers/crawlerWorker'
import { registerCrawlerScheduler } from '@/api/workers/crawlerScheduler'
import { registerMaintenanceWorker } from '@/api/workers/maintenanceWorker'
import { registerMaintenanceScheduler } from '@/api/workers/maintenanceScheduler'
import { adminStagingRoutes } from '@/api/routes/admin/staging'
import { VerifyService } from '@/api/services/VerifyService'
import { db } from '@/api/lib/postgres'

async function start() {
  const fastify = Fastify({
    logger: { level: process.env.NODE_ENV === 'test' ? 'silent' : 'info' },
  })

  await fastify.register(cors, {
    origin: (origin, cb) => {
      // 生产环境：只允许配置的 APP_URL
      // 开发环境：允许所有 localhost（任意端口）
      const appUrl = process.env.NEXT_PUBLIC_APP_URL
      if (!origin) return cb(null, true)          // 非浏览器请求（curl 等）
      if (appUrl && origin === appUrl) return cb(null, true)
      if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true)
      cb(new Error('Not allowed by CORS'), false)
    },
    credentials: true,
  })

  await fastify.register(cookie, {
    secret: process.env.COOKIE_SECRET ?? 'dev-cookie-secret-replace-in-production',
  })

  await fastify.register(multipart, { limits: { fileSize: 2 * 1024 * 1024 } })

  setupAuthenticate(fastify)
  setupMetrics(fastify)

  await fastify.register(authRoutes, { prefix: '/v1' })
  await fastify.register(videoRoutes, { prefix: '/v1' })
  await fastify.register(sourceRoutes, { prefix: '/v1' })
  await fastify.register(searchRoutes, { prefix: '/v1' })
  await fastify.register(subtitleRoutes, { prefix: '/v1' })
  await fastify.register(adminVideoRoutes, { prefix: '/v1' })
  await fastify.register(adminContentRoutes, { prefix: '/v1' })
  await fastify.register(adminUserRoutes, { prefix: '/v1' })
  await fastify.register(adminAnalyticsRoutes, { prefix: '/v1' })
  await fastify.register(adminCrawlerRoutes, { prefix: '/v1' })
  await fastify.register(userRoutes, { prefix: '/v1' })
  await fastify.register(danmakuRoutes, { prefix: '/v1' })
  await fastify.register(adminCacheRoutes, { prefix: '/v1' })
  await fastify.register(adminMigrationRoutes, { prefix: '/v1' })
  await fastify.register(adminPerformanceRoutes, { prefix: '/v1' })
  await fastify.register(adminSiteConfigRoutes, { prefix: '/v1' })
  await fastify.register(adminCrawlerSitesRoutes, { prefix: '/v1' })
  await fastify.register(adminStagingRoutes, { prefix: '/v1' })

  registerVerifyWorker()
  registerCrawlerWorker()
  registerMaintenanceWorker()

  const schedulerEnabled = process.env.CRAWLER_SCHEDULER_ENABLED === 'true'
  if (schedulerEnabled) {
    registerCrawlerScheduler()
  } else {
    process.stderr.write('[crawler-scheduler] disabled (set CRAWLER_SCHEDULER_ENABLED=true to enable)\n')
  }

  const maintenanceSchedulerEnabled = process.env.MAINTENANCE_SCHEDULER_ENABLED === 'true'
  if (maintenanceSchedulerEnabled) {
    registerMaintenanceScheduler()
  } else {
    process.stderr.write('[maintenance-scheduler] disabled (set MAINTENANCE_SCHEDULER_ENABLED=true to enable)\n')
  }

  // 链接存活定时扫描：每 24h 将所有活跃 sources 批量入队 verify-queue
  // 仅在 VERIFY_SCHEDULER_ENABLED=true 时启用（默认关闭，避免开发环境误发大量 HEAD 请求）
  const verifySchedulerEnabled = process.env.VERIFY_SCHEDULER_ENABLED === 'true'
  if (verifySchedulerEnabled) {
    const verifyService = new VerifyService(db)
    const VERIFY_INTERVAL_MS = 24 * 60 * 60 * 1000  // 24h
    // 启动后延迟 5min 再执行首次扫描，避免与服务启动争抢资源
    setTimeout(() => {
      void verifyService.scheduleAllActiveVerification()
      setInterval(() => {
        void verifyService.scheduleAllActiveVerification()
      }, VERIFY_INTERVAL_MS)
    }, 5 * 60 * 1000)
    process.stderr.write('[verify-scheduler] enabled — first scan in 5 min, then every 24h\n')
  } else {
    process.stderr.write('[verify-scheduler] disabled (set VERIFY_SCHEDULER_ENABLED=true to enable)\n')
  }

  fastify.get('/v1/health', async (_request, reply) => {
    return reply.send({ status: 'ok', timestamp: new Date().toISOString() })
  })

  const port = Number(process.env.PORT) || 4000
  await fastify.listen({ port, host: '0.0.0.0' })
}

start().catch((err: unknown) => {
  process.stderr.write(`Failed to start API server: ${String(err)}\n`)
  process.exit(1)
})

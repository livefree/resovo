import crypto from 'node:crypto'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import multipart from '@fastify/multipart'

import { createFastifyLoggerOptions } from '@/api/lib/logger'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import { authRoutes } from '@/api/routes/auth'
import { videoRoutes } from '@/api/routes/videos'
import { sourceRoutes } from '@/api/routes/sources'
import { searchRoutes } from '@/api/routes/search'
import { subtitleRoutes } from '@/api/routes/subtitles'
import { adminVideoRoutes } from '@/api/routes/admin/videos'
import { adminVideoImagesRoutes } from '@/api/routes/admin/videoImages'
import { adminVideoSourcesRoutes } from '@/api/routes/admin/videoSources'
import { adminContentRoutes } from '@/api/routes/admin/content'
import { adminUserRoutes } from '@/api/routes/admin/users'
import { adminAnalyticsRoutes } from '@/api/routes/admin/analytics'
import { adminCrawlerRoutes } from '@/api/routes/admin/crawler'
import { adminCacheRoutes } from '@/api/routes/admin/cache'
import { adminMigrationRoutes } from '@/api/routes/admin/migration'
import { adminPerformanceRoutes } from '@/api/routes/admin/performance'
import { adminSiteConfigRoutes } from '@/api/routes/admin/siteConfig'
import { adminCrawlerSitesRoutes } from '@/api/routes/admin/crawlerSites'
import { adminCrawlerDashboardRoutes } from '@/api/routes/admin/crawlerDashboard'
import { adminDashboardRoutes } from '@/api/routes/admin/dashboard'
import { setupMetrics } from '@/api/plugins/metrics'
import { userRoutes } from '@/api/routes/users'
import { danmakuRoutes } from '@/api/routes/danmaku'
import { registerVerifyWorker } from '@/api/workers/verifyWorker'
import { registerCrawlerWorker } from '@/api/workers/crawlerWorker'
import { registerCrawlerScheduler } from '@/api/workers/crawlerScheduler'
import { registerMaintenanceWorker } from '@/api/workers/maintenanceWorker'
import { registerMaintenanceScheduler } from '@/api/workers/maintenanceScheduler'
import { registerEnrichmentWorker } from '@/api/workers/enrichmentWorker'
import { registerImageHealthWorker } from '@/api/workers/imageHealthWorker'
import { registerBlurhashWorker } from '@/api/workers/imageBlurhashWorker'
import { registerBackfillWorker } from '@/api/workers/imageBackfillWorker'
import { adminStagingRoutes } from '@/api/routes/admin/staging'
import { adminModerationRoutes } from '@/api/routes/admin/moderation'
import { adminReviewLabelsRoutes } from '@/api/routes/admin/reviewLabels'
import { feedbackRoutes } from '@/api/routes/feedback'
import { adminDesignTokenRoutes } from '@/api/routes/admin/design-tokens'
import { internalImageBrokenRoutes } from '@/api/routes/internal/image-broken'
import { internalClientLogRoutes } from '@/api/routes/internal/client-log'
import { adminImageHealthRoutes } from '@/api/routes/admin/image-health'
import { bannerRoutes } from '@/api/routes/banners'
import { adminBannerRoutes } from '@/api/routes/admin/banners'
import { homeRoutes } from '@/api/routes/home'
import { adminMediaRoutes } from '@/api/routes/admin/media'
import { adminHomeModulesRoutes } from '@/api/routes/admin/home-modules'
import { adminVideoMergesRoutes } from '@/api/routes/admin/video-merges'
import { adminSourcesMatrixRoutes } from '@/api/routes/admin/sources-matrix'
import { registerDataTableRoutes } from '@/api/routes/admin/_datatable'
import { adminUserSubmissionsRoutes } from '@/api/routes/admin/userSubmissions'
import { adminAuditRoutes } from '@/api/routes/admin/audit'
import { adminFilterPresetRoutes } from '@/api/routes/admin/filter-presets'
import { adminWebhookRoutes } from '@/api/routes/admin/webhook'
// CHG-SN-8-FUP-SHELL-NOTIFICATIONS-EP-A / ADR-147：admin shell notification hub MVP
import { adminNotificationRoutes } from '@/api/routes/admin/notifications'
import { adminSystemJobsRoutes } from '@/api/routes/admin/system-jobs'
// CW1-E-EP / ADR-152：admin shell topbar 后台事件铃铛端点
import { adminSystemBackgroundEventsRoutes } from '@/api/routes/admin/systemBackgroundEvents'
import { VerifyService } from '@/api/services/VerifyService'
import { db } from '@/api/lib/postgres'

/**
 * 解析 TRUSTED_PROXY_IPS 环境变量为 trustProxy 白名单。
 * CHG-SN-5-PRE-01-C-D（DEBT-SN-4-05-B）：未配置时默认 false（不信任任何 XFF），
 * 防止 IP 欺骗绕过 feedback.ts rate-limit。
 *
 * 生产部署须设置为反向代理（nginx / cloudflare）的实际出口 IP，CSV 列表。
 * 例：TRUSTED_PROXY_IPS=127.0.0.1,::1,172.20.0.1
 */
function parseTrustedProxies(): string[] | false {
  const raw = process.env.TRUSTED_PROXY_IPS?.trim()
  if (!raw) return false
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean)
  return list.length > 0 ? list : false
}

async function start() {
  const fastify = Fastify({
    logger: createFastifyLoggerOptions(),
    genReqId: () => crypto.randomUUID(),
    // INFRA-14 F5：把 Fastify 自动注入的 reqId 字段重命名为项目约定的 request_id，
    // 让 route 内 request.log.error/warn/info(...) 都自动带 request_id 顶层字段
    requestIdLogLabel: 'request_id',
    // CHG-SN-5-PRE-01-D（DEBT-SN-4-05-B）：仅信任白名单上游解析 X-Forwarded-For；
    // 默认 false 时 request.ip = socket.remoteAddress，XFF 全部忽略，rate-limit 不可被欺骗绕过
    trustProxy: parseTrustedProxies(),
  })

  // access log: 每个响应输出含 duration_ms / status / method / url；
  // request_id 由 pino requestIdLogLabel 自动注入到 child logger（INFRA-14 F5），
  // 手动写会冗余，直接交给 pino base
  fastify.addHook('onResponse', (request, reply, done) => {
    request.log.info({
      method: request.method,
      url: request.url.split('?')[0],
      status: reply.statusCode,
      duration_ms: Math.round(reply.elapsedTime),
    }, 'access')
    done()
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

  // INFRA-16 F2：把全局 fastify-cors 抛出的 'Not allowed by CORS' Error 映射为 HTTP 403
  // + FORBIDDEN_ORIGIN，对齐 client-log 5 分支契约。其他错误继续走 fastify 默认行为
  // （statusCode-bearing errors / zod 校验 / 路由级 reply.code(...) 等不受影响）
  fastify.setErrorHandler((error, request, reply) => {
    if (error.message === 'Not allowed by CORS') {
      return reply.code(403).send({
        error: { code: 'FORBIDDEN_ORIGIN', message: 'Origin not allowed', status: 403 },
      })
    }
    reply.send(error)
  })

  await fastify.register(cookie, {
    secret: process.env.COOKIE_SECRET ?? 'dev-cookie-secret-replace-in-production',
  })

  // IMG-06: 全局 multipart 上限 5MB（兼容图片上传 POST /admin/media/images）
  // 各 route 按需在 service 层收紧（例：SubtitleService.validateFile 仍守 2MB）
  await fastify.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } })

  setupAuthenticate(fastify)
  setupMetrics(fastify)

  await fastify.register(authRoutes, { prefix: '/v1' })
  await fastify.register(videoRoutes, { prefix: '/v1' })
  await fastify.register(sourceRoutes, { prefix: '/v1' })
  await fastify.register(searchRoutes, { prefix: '/v1' })
  await fastify.register(subtitleRoutes, { prefix: '/v1' })
  await fastify.register(adminVideoRoutes, { prefix: '/v1' })
  await fastify.register(adminVideoImagesRoutes, { prefix: '/v1' })
  await fastify.register(adminVideoSourcesRoutes, { prefix: '/v1' })
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
  await fastify.register(registerDataTableRoutes, { prefix: '/v1' })
  await fastify.register(adminCrawlerDashboardRoutes, { prefix: '/v1' })
  await fastify.register(adminDashboardRoutes, { prefix: '/v1' })
  await fastify.register(adminStagingRoutes, { prefix: '/v1' })
  await fastify.register(adminModerationRoutes, { prefix: '/v1' })
  await fastify.register(adminReviewLabelsRoutes, { prefix: '/v1' })
  await fastify.register(feedbackRoutes, { prefix: '/v1' })
  await fastify.register(adminDesignTokenRoutes, { prefix: '/v1' })
  await fastify.register(internalImageBrokenRoutes, { prefix: '/v1' })
  await fastify.register(internalClientLogRoutes, { prefix: '/v1' })
  await fastify.register(adminImageHealthRoutes, { prefix: '/v1' })
  await fastify.register(bannerRoutes, { prefix: '/v1' })
  await fastify.register(adminBannerRoutes, { prefix: '/v1' })
  await fastify.register(adminMediaRoutes, { prefix: '/v1' })
  await fastify.register(homeRoutes, { prefix: '/v1' })
  await fastify.register(adminHomeModulesRoutes, { prefix: '/v1' })
  await fastify.register(adminVideoMergesRoutes, { prefix: '/v1' })
  await fastify.register(adminSourcesMatrixRoutes, { prefix: '/v1' })
  await fastify.register(adminUserSubmissionsRoutes, { prefix: '/v1' })
  await fastify.register(adminAuditRoutes, { prefix: '/v1' })
  await fastify.register(adminFilterPresetRoutes, { prefix: '/v1' })
  await fastify.register(adminWebhookRoutes, { prefix: '/v1' })
  // CHG-SN-8-FUP-SHELL-NOTIFICATIONS-EP-A / ADR-147：admin shell notification hub MVP
  await fastify.register(adminNotificationRoutes, { prefix: '/v1' })
  await fastify.register(adminSystemJobsRoutes, { prefix: '/v1' })
  // CW1-E-EP / ADR-152：admin shell topbar 后台事件铃铛端点
  await fastify.register(adminSystemBackgroundEventsRoutes, { prefix: '/v1' })

  registerVerifyWorker()
  registerCrawlerWorker()
  registerMaintenanceWorker()
  registerEnrichmentWorker()
  registerImageHealthWorker()
  registerBlurhashWorker()
  registerBackfillWorker()

  const schedulerEnabled = process.env.CRAWLER_SCHEDULER_ENABLED === 'true'
  if (schedulerEnabled) {
    registerCrawlerScheduler()
  } else {
    fastify.log.info({ worker: 'crawler-scheduler' }, 'disabled (set CRAWLER_SCHEDULER_ENABLED=true to enable)')
  }

  // CHG-393: 改为 opt-out（默认启用）；设 MAINTENANCE_SCHEDULER_ENABLED=false 可在开发环境关闭
  const maintenanceSchedulerEnabled = process.env.MAINTENANCE_SCHEDULER_ENABLED !== 'false'
  if (maintenanceSchedulerEnabled) {
    registerMaintenanceScheduler()
  } else {
    fastify.log.info({ worker: 'maintenance-scheduler' }, 'disabled (MAINTENANCE_SCHEDULER_ENABLED=false)')
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
    fastify.log.info({ worker: 'verify-scheduler' }, 'enabled — first scan in 5 min, then every 24h')
  } else {
    fastify.log.info({ worker: 'verify-scheduler' }, 'disabled (set VERIFY_SCHEDULER_ENABLED=true to enable)')
  }

  fastify.get('/v1/health', async (_request, reply) => {
    return reply.send({ status: 'ok', timestamp: new Date().toISOString() })
  })

  const port = Number(process.env.PORT) || 4000
  await fastify.listen({ port, host: '0.0.0.0' })
}

start().catch((err: unknown) => {
  // createLogger 之前的崩溃路径：fallback 到 stderr
  process.stderr.write(`Failed to start API server: ${String(err)}\n`)
  process.exit(1)
})

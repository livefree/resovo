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
import { setupMetrics } from '@/api/plugins/metrics'
import { userRoutes } from '@/api/routes/users'
import { danmakuRoutes } from '@/api/routes/danmaku'
import { registerVerifyWorker } from '@/api/workers/verifyWorker'

async function start() {
  const fastify = Fastify({
    logger: { level: process.env.NODE_ENV === 'test' ? 'silent' : 'info' },
  })

  await fastify.register(cors, {
    origin: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
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

  registerVerifyWorker()

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

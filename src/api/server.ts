import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'

import { setupAuthenticate } from '@/api/plugins/authenticate'
import { authRoutes } from '@/api/routes/auth'
import { videoRoutes } from '@/api/routes/videos'
import { sourceRoutes } from '@/api/routes/sources'

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

  setupAuthenticate(fastify)

  await fastify.register(authRoutes, { prefix: '/v1' })
  await fastify.register(videoRoutes, { prefix: '/v1' })
  await fastify.register(sourceRoutes, { prefix: '/v1' })

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

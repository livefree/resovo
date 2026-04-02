/**
 * authenticate.ts — Fastify 认证插件
 *
 * 使用方式：在 server.ts 启动时调用 setupAuthenticate(fastify)
 * 之后可在路由中使用：
 *   preHandler: [fastify.authenticate]
 *   preHandler: [fastify.optionalAuthenticate]
 *   preHandler: [fastify.authenticate, fastify.requireRole(['admin'])]
 *
 * ADR-003: Access token 15 分钟，Refresh token HttpOnly Cookie
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

import { redis } from '@/api/lib/redis'
import { verifyAccessToken, blacklistKey } from '@/api/lib/auth'
import type { UserRole } from '@/types'

// ── 类型扩展 ─────────────────────────────────────────────────────

export interface RequestUser {
  userId: string
  role: UserRole
}

declare module 'fastify' {
  interface FastifyRequest {
    user: RequestUser | null
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    optionalAuthenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    requireRole: (
      roles: UserRole[]
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

// ── 内部工具 ─────────────────────────────────────────────────────

function extractBearerToken(request: FastifyRequest): string | null {
  const auth = request.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return null
  return auth.slice(7)
}

async function resolveUser(token: string): Promise<RequestUser | null> {
  let payload: ReturnType<typeof verifyAccessToken>
  try {
    payload = verifyAccessToken(token)
  } catch {
    return null
  }

  // 防御性黑名单检查：Redis 不可用时降级放行（JWT 已验证）
  try {
    const blocked = await redis.get(blacklistKey(token))
    if (blocked) return null
  } catch {
    // Redis down — 记录警告，降级放行
    process.stderr.write('[auth] Redis blacklist check failed, skipping\n')
  }

  return { userId: payload.userId, role: payload.role }
}

// ── 认证处理器 ───────────────────────────────────────────────────

async function authenticateHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const token = extractBearerToken(request)
  if (!token) {
    return reply.code(401).send({
      error: { code: 'UNAUTHORIZED', message: '需要登录', status: 401 },
    })
  }
  const user = await resolveUser(token)
  if (!user) {
    return reply.code(401).send({
      error: { code: 'UNAUTHORIZED', message: 'Token 无效或已过期', status: 401 },
    })
  }
  request.user = user
}

async function optionalAuthenticateHandler(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const token = extractBearerToken(request)
  if (!token) {
    request.user = null
    return
  }
  request.user = await resolveUser(token)
}

function requireRoleHandler(roles: UserRole[]) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.user) {
      return reply.code(401).send({
        error: { code: 'UNAUTHORIZED', message: '需要登录', status: 401 },
      })
    }
    if (!roles.includes(request.user.role)) {
      return reply.code(403).send({
        error: { code: 'FORBIDDEN', message: '权限不足', status: 403 },
      })
    }
  }
}

// ── 注册到 Fastify 实例 ───────────────────────────────────────────

export function setupAuthenticate(fastify: FastifyInstance): void {
  fastify.decorateRequest('user', null)
  fastify.decorate('authenticate', authenticateHandler)
  fastify.decorate('optionalAuthenticate', optionalAuthenticateHandler)
  fastify.decorate('requireRole', requireRoleHandler)
}

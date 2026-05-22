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

// CHG-SN-8-FUP-USERS-ROLE-INV-EP / ADR-139 D-139-7：role_changed_at 缓存 key
const ROLE_CHANGED_CACHE_KEY = (userId: string) => `user:rca:${userId}`

// 三态结果：ok（放行 + user）/ invalid（401 UNAUTHORIZED）/ role_changed（401 ROLE_CHANGED）
export type ResolveResult =
  | { readonly kind: 'ok'; readonly user: RequestUser }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'role_changed' }

async function resolveUser(token: string): Promise<ResolveResult> {
  let payload: ReturnType<typeof verifyAccessToken>
  try {
    payload = verifyAccessToken(token)
  } catch {
    return { kind: 'invalid' }
  }

  // ADR-139 D-139-7：并行查 blacklist + role_changed_at（与现有 blacklist 同 Redis O(1)）
  let blocked: string | null = null
  let roleChangedAtIso: string | null = null
  try {
    [blocked, roleChangedAtIso] = await Promise.all([
      redis.get(blacklistKey(token)),
      redis.get(ROLE_CHANGED_CACHE_KEY(payload.userId)),
    ])
  } catch {
    // Redis down — 记录警告，降级放行（与现有 blacklist 一致；ADR-139 R-139-1 缓解）
    process.stderr.write('[auth] Redis check failed, skipping (blacklist + role_changed)\n')
    return { kind: 'ok', user: { userId: payload.userId, role: payload.role } }
  }

  if (blocked) return { kind: 'invalid' }

  // ADR-139 D-139-7：token.iat (秒) vs role_changed_at (ISO ms 转秒)
  // cache miss (key 不存在) → 放行（TTL 与 access token 生命周期对齐；ADR-139 §D-139-7 默认策略）
  if (roleChangedAtIso) {
    const roleChangedSec = Math.floor(new Date(roleChangedAtIso).getTime() / 1000)
    if (payload.iat < roleChangedSec) {
      return { kind: 'role_changed' }
    }
  }

  return { kind: 'ok', user: { userId: payload.userId, role: payload.role } }
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
  const result = await resolveUser(token)
  if (result.kind === 'role_changed') {
    // ADR-139 D-139-2：前端 interceptor 识别此 code 后跳过 silent refresh，强制 logout
    return reply.code(401).send({
      error: { code: 'ROLE_CHANGED', message: '您的权限已变更，请重新登录', status: 401 },
    })
  }
  if (result.kind === 'invalid') {
    return reply.code(401).send({
      error: { code: 'UNAUTHORIZED', message: 'Token 无效或已过期', status: 401 },
    })
  }
  request.user = result.user
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
  const result = await resolveUser(token)
  // 可选认证：invalid / role_changed 都视为未登录（不返回错误，request.user = null）
  request.user = result.kind === 'ok' ? result.user : null
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

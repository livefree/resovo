/**
 * client-log.ts — 浏览器端结构化日志接收端点（INFRA-10）
 * POST /v1/internal/client-log
 *
 * 行为：
 *   - dev: 匿名可发；prod: 仅登录用户（fastify.authenticate）
 *   - origin 白名单：dev 任意 localhost；prod 仅 NEXT_PUBLIC_APP_URL；非浏览器请求（curl）放行
 *   - IP 限速：60 rpm 内存桶（429 显式返回，区别于 image-broken 静默 204）
 *   - body：单批 ≤ 100 条（zod, 400）+ 整体 ≤ 64KB（fastify bodyLimit, 413）
 *   - 落地：用 createLogger({ service: 'client' }) 独立 logger 写 stdout，
 *     由 dev.mjs 现有分流（service:'client' → logs/client/<date>.ndjson, INFRA-07）自动落盘
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createLogger } from '@/api/lib/logger'

// ── 常量 ───────────────────────────────────────────────────────────

const IP_WINDOW_MS = 60_000
const IP_LIMIT = 60
const MAX_BATCH = 100
const MAX_BODY_BYTES = 64 * 1024

// ── IP 限速（内存，进程级）─────────────────────────────────────────

const ipCallMap = new Map<string, { count: number; resetAt: number }>()

function checkIpLimit(ip: string): boolean {
  const now = Date.now()
  const entry = ipCallMap.get(ip)
  if (!entry || now >= entry.resetAt) {
    ipCallMap.set(ip, { count: 1, resetAt: now + IP_WINDOW_MS })
    return true
  }
  entry.count++
  return entry.count <= IP_LIMIT
}

// ── Origin 白名单 ─────────────────────────────────────────────────

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true  // 非浏览器请求（curl / 服务端调用）放行，与现有 cors 策略一致
  if (process.env.NODE_ENV === 'production') {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    return appUrl !== undefined && origin === appUrl
  }
  return /^http:\/\/localhost(:\d+)?$/.test(origin)
}

// ── Schema ────────────────────────────────────────────────────────

const EntrySchema = z.object({
  ts: z.string(),
  level: z.enum(['info', 'warn', 'error']),
  msg: z.string().max(2048),
  ctx: z.record(z.unknown()).optional(),
})

const BodySchema = z.object({
  entries: z.array(EntrySchema).min(1).max(MAX_BATCH),
})

// ── Logger 实例 ────────────────────────────────────────────────────
// 独立 createLogger({ service: 'client' })：避免 pino base/child 覆盖行为不确定，
// 让 dev.mjs 第 189 行 enriched.service === 'client' 分流逻辑直接生效

const clientLog = createLogger({ service: 'client' })

// ── Route ─────────────────────────────────────────────────────────

export async function internalClientLogRoutes(fastify: FastifyInstance) {
  // 鉴权策略按环境切换：prod 必须登录，dev 全开
  const requireAuth = process.env.NODE_ENV === 'production'
  const preHandler = requireAuth ? [fastify.authenticate] : []

  fastify.post(
    '/internal/client-log',
    { preHandler, bodyLimit: MAX_BODY_BYTES },
    async (request, reply) => {
      // ① Origin 白名单
      if (!isOriginAllowed(request.headers.origin)) {
        return reply.code(403).send({
          error: { code: 'FORBIDDEN_ORIGIN', message: 'Origin not allowed', status: 403 },
        })
      }

      // ② IP 限速
      if (!checkIpLimit(request.ip)) {
        return reply.code(429).send({
          error: { code: 'RATE_LIMITED', message: 'Too many requests', status: 429 },
        })
      }

      // ③ Body 校验
      const parsed = BodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message ?? 'Invalid request body',
            status: 400,
          },
        })
      }

      // ④ 落地：每条 entry 写一行 ndjson 到 service:'client' logger
      const { entries } = parsed.data
      for (const entry of entries) {
        clientLog[entry.level](
          {
            client_ts: entry.ts,
            ctx: entry.ctx,
            request_id: request.id,
            source_ip: request.ip,
          },
          entry.msg,
        )
      }

      return reply.code(200).send({ accepted: entries.length })
    },
  )
}

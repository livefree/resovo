// INFRA-08: 统一 logger 模块（本地 stub 实现）
// TODO INFRA-09: 类型 / 序列化器 / redact 表迁移到 @resovo/logger 后，本文件改为 thin re-export

import pino from 'pino'
import type Bull from 'bull'
import type { FastifyLoggerOptions } from 'fastify'
import type { PinoLoggerOptions } from 'fastify/types/logger'

// ── 类型 ─────────────────────────────────────────────────────────

export type ServiceName =
  | 'api'
  | `worker:${string}`
  | 'script'
  | 'client'

export interface LoggerOptions {
  service: ServiceName
  level?: string
}

// ── PII redact 表（INFRA-09 移至 @resovo/logger/redact.ts）────────

// 覆盖 11 个 PII 字段在顶层 + 一级嵌套 + headers 容器路径
// INFRA-14 F4：补 set-cookie / url.query（pino 最小样本验证缺失会泄露）
const REDACT_PATHS: string[] = [
  'authorization',
  'cookie',
  'set-cookie',
  'password',
  'token',
  'refreshToken',
  'accessToken',
  'email',
  'phone',
  'ip',
  'url.query',
  '*.authorization',
  '*.cookie',
  '*.set-cookie',
  '*.password',
  '*.token',
  '*.refreshToken',
  '*.accessToken',
  '*.email',
  '*.phone',
  '*.ip',
  '*.url.query',
  'headers.set-cookie',
  'req.url.query',
]

// ── 序列化器（INFRA-09 移至 @resovo/logger/serializers.ts）──────────
// 禁止透传原始 req/res/headers 对象（复核 #7 硬规则）

function serializeReq(req: { id?: string; method?: string; url?: string }) {
  return {
    request_id: req.id,
    method: req.method,
    // 只保留 pathname，去掉 query（避免 query 泄露 PII）
    url: req.url?.split('?')[0],
  }
}

function serializeErr(err: Error & { statusCode?: number }) {
  return {
    type: err.constructor?.name ?? 'Error',
    message: err.message,
    stack: err.stack ?? '',
    ...(err.statusCode ? { statusCode: err.statusCode } : {}),
  }
}

// ── Level 计算（INFRA-09 移至 @resovo/logger/levels.ts）─────────────

function computeLevel(env: string | undefined): string {
  if (env === 'test') return 'silent'
  if (env === 'development') return 'debug'
  return 'info'
}

// ── createFastifyLoggerOptions ────────────────────────────────────
// 配置对象形式传给 Fastify({ logger: ... })，避免 pino.Logger 实例
// 导致 Fastify 泛型 Logger 过于具体而造成下游类型不兼容

export function createFastifyLoggerOptions(): FastifyLoggerOptions & PinoLoggerOptions {
  return {
    level: computeLevel(process.env.NODE_ENV),
    base: { service: 'api' },
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: {
      req: serializeReq,
      err: serializeErr,
    },
    redact: {
      paths: REDACT_PATHS,
      censor: '<redacted>',
    },
  }
}

// ── createLogger（供 workers 直接使用）──────────────────────────────

export function createLogger(opts: LoggerOptions): pino.Logger {
  const level = opts.level ?? computeLevel(process.env.NODE_ENV)

  return pino({
    level,
    base: { service: opts.service },
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: {
      req: serializeReq,
      err: serializeErr,
    },
    redact: {
      paths: REDACT_PATHS,
      censor: '<redacted>',
    },
  })
}

// ── 派生器 ────────────────────────────────────────────────────────

/** request 上下文派生：绑定 request_id / method / url */
export function withRequest(
  logger: pino.Logger,
  req: { id?: string; method?: string; url?: string },
): pino.Logger {
  return logger.child({
    request_id: req.id,
    method: req.method,
    url: req.url?.split('?')[0],
  })
}

/** job 上下文派生：绑定 job_id */
export function withJob<T>(
  logger: pino.Logger,
  job: Bull.Job<T>,
): pino.Logger {
  return logger.child({ job_id: String(job.id) })
}

// ── 单例 baseLogger（供 workers 使用）────────────────────────────

export const baseLogger = createLogger({ service: 'api' })

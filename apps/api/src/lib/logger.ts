// INFRA-08: 统一 logger 模块（createLogger / withRequest / withJob 实现保留此处，决策 7）
// INFRA-09: 类型 / 序列化器 / redact 表已迁移到 @resovo/logger
// INFRA-12: createLogger 实现迁入 @resovo/logger（监测期满后执行）

import pino from 'pino'
import type Bull from 'bull'
import type { FastifyLoggerOptions } from 'fastify'
import type { PinoLoggerOptions } from 'fastify/types/logger'
import {
  serializeReq,
  serializeErr,
  REDACT_PATHS,
  computeLevel,
} from '@resovo/logger'

export type { ServiceName, LoggerOptions, LogContext, LogBase } from '@resovo/logger'

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
      paths: [...REDACT_PATHS],
      censor: '<redacted>',
    },
  }
}

// ── createLogger（供 workers 直接使用）──────────────────────────────

export function createLogger(opts: { service: string; level?: string }): pino.Logger {
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
      paths: [...REDACT_PATHS],
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

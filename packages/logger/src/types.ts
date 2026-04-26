import type pino from 'pino'

export type ServiceName =
  | 'api'
  | `worker:${string}`
  | 'script'
  | 'client'

/** Runtime array for validation / zod schemas */
export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const

export type LogLevel = typeof LOG_LEVELS[number]

/** Fields for logger.child() call context (request / job scope) */
export interface LogContext extends Record<string, unknown> {
  request_id?: string
  job_id?: string
  worker?: string
}

/** Base binding applied at logger creation (not child context) */
export interface LogBase {
  service: ServiceName
}

export interface LoggerOptions {
  service: ServiceName
  level?: LogLevel | 'silent'
}

/** Re-export pino.Logger for consumers that need the type without importing pino directly */
export type Logger = pino.Logger

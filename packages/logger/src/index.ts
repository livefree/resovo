// Types
export type {
  ServiceName,
  LogLevel,
  LogContext,
  LogBase,
  LoggerOptions,
  Logger,
} from './types'
export { LOG_LEVELS } from './types'

// Serializers
export type { SerializedReq, SerializedErr } from './serializers'
export { serializeReq, serializeErr } from './serializers'

// Redact
export { REDACT_PATHS, withRedactPaths } from './redact'

// Levels
export { computeLevel, formatPretty } from './levels'

// NOTE: createLogger implementation is NOT exported in the first phase (决策 7).
// Each app (api / web-next / server) keeps its own createLogger in lib/logger.ts.
// Migration to @resovo/logger/createLogger is tracked in INFRA-12.

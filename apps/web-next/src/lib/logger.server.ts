/**
 * logger.server.ts — web-next 服务端结构化 logger（INFRA-10）
 *
 * 用途：Next.js server component / route handler / middleware 写结构化日志。
 * 实现：复用 @resovo/logger 的 serializers/redact/levels（首期不导出 createLogger，
 * 按 INFRA-09 决策 7 各 app 各自实现），照 apps/api/src/lib/logger.ts 模板。
 *
 * 当前 INFRA-10 范围内 web-next server 端无需迁移调用，本文件作预备入口；
 * INFRA-12 实现下沉时可统一切到 @resovo/logger/createLogger。
 */

import pino from 'pino'
import { serializeReq, serializeErr, REDACT_PATHS, computeLevel } from '@resovo/logger'

export function createWebNextLogger(): pino.Logger {
  return pino({
    level: computeLevel(process.env.NODE_ENV),
    base: { service: 'web-next' },
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: { req: serializeReq, err: serializeErr },
    redact: { paths: [...REDACT_PATHS], censor: '<redacted>' },
  })
}

export const serverLogger = createWebNextLogger()

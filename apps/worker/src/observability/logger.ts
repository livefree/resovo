import pino from 'pino'
import { randomUUID } from 'node:crypto'
import { computeLevel, REDACT_PATHS } from '@resovo/logger'
import { config } from '../config'

const root = pino({
  level: process.env.LOG_LEVEL ?? computeLevel(process.env.NODE_ENV),
  redact: { paths: [...REDACT_PATHS], censor: '<redacted>' },
  base: { service: `worker:source-health`, instanceId: config.workerInstanceId },
})

export function jobLogger(jobName: string): pino.Logger {
  const requestId = `worker:${randomUUID()}`
  return root.child({ jobName, requestId })
}

export { root as baseLogger }

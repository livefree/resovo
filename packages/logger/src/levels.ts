/** Map pino numeric level to string name */
function pinoLevelStr(level: number): string {
  if (level <= 10) return 'trace'
  if (level <= 20) return 'debug'
  if (level <= 30) return 'info'
  if (level <= 40) return 'warn'
  if (level <= 50) return 'error'
  return 'fatal'
}

export function computeLevel(env: string | undefined): string {
  if (env === 'test') return 'silent'
  if (env === 'development') return 'debug'
  return 'info'
}

// ── ANSI pretty formatter（决策 6：自实现替代 pino-pretty，dev only）────────

const LEVEL_COLORS: Record<string, string> = {
  trace: '\x1b[90m',
  debug: '\x1b[36m',
  info:  '\x1b[32m',
  warn:  '\x1b[33m',
  error: '\x1b[31m',
  fatal: '\x1b[35m',
}
const RESET = '\x1b[0m'
const DIM   = '\x1b[2m'

/**
 * Format a pino log record into a single human-readable line with ANSI color.
 * Only call in dev/pretty mode. In production, write raw ndjson.
 */
export function formatPretty(record: Record<string, unknown>): string {
  const { level, time, service, msg, ...ctx } = record
  const levelStr = typeof level === 'number' ? pinoLevelStr(level) : String(level ?? 'info')
  const color = LEVEL_COLORS[levelStr] ?? ''
  const ts = time
    ? new Date(typeof time === 'string' ? time : Number(time)).toISOString().slice(11, 23)
    : ''
  const svc = service ? ` ${DIM}${String(service)}${RESET}${color}` : ''
  const message = msg ? String(msg) : ''
  const ctxKeys = Object.keys(ctx)
  const extra = ctxKeys.length > 0 ? `  ${DIM}${JSON.stringify(ctx)}${RESET}` : ''
  return `${color}[${ts}] ${levelStr.toUpperCase().padEnd(5)}${svc}: ${message}${extra}${RESET}`
}

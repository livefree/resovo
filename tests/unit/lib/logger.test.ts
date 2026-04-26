import { describe, it, expect } from 'vitest'
import pino from 'pino'
import { Writable } from 'node:stream'
import {
  REDACT_PATHS,
  withRedactPaths,
  serializeReq,
  serializeErr,
  computeLevel,
  formatPretty,
  LOG_LEVELS,
} from '@resovo/logger'

// ── REDACT_PATHS ──────────────────────────────────────────────────

describe('REDACT_PATHS', () => {
  const PII_FIELDS = [
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
  ] as const

  it('covers all 11 PII fields at top level', () => {
    for (const field of PII_FIELDS) {
      expect(REDACT_PATHS).toContain(field)
    }
  })

  it('covers all 11 PII fields at nested level (*.field)', () => {
    for (const field of PII_FIELDS) {
      expect(REDACT_PATHS).toContain(`*.${field}`)
    }
  })

  it('includes headers.set-cookie path', () => {
    expect(REDACT_PATHS).toContain('headers.set-cookie')
  })

  it('includes req.url.query path', () => {
    expect(REDACT_PATHS).toContain('req.url.query')
  })
})

describe('withRedactPaths', () => {
  it('merges extra paths with base REDACT_PATHS', () => {
    const extra = ['internal_token', 'session_id']
    const merged = withRedactPaths(extra)
    expect(merged).toContain('authorization')
    expect(merged).toContain('internal_token')
    expect(merged).toContain('session_id')
  })

  it('does not mutate REDACT_PATHS', () => {
    const before = REDACT_PATHS.length
    withRedactPaths(['extra_field'])
    expect(REDACT_PATHS.length).toBe(before)
  })
})

// ── serializeReq ──────────────────────────────────────────────────

describe('serializeReq', () => {
  it('removes query string from url', () => {
    const result = serializeReq({ id: 'req-1', method: 'GET', url: '/api/foo?password=SECRET' })
    expect(result.url).toBe('/api/foo')
    expect(result.request_id).toBe('req-1')
    expect(result.method).toBe('GET')
  })

  it('returns empty string for query-only url', () => {
    const result = serializeReq({ url: '?foo=bar' })
    expect(result.url).toBe('')
  })

  it('returns empty string when url is undefined', () => {
    const result = serializeReq({ id: 'req-2', method: 'POST' })
    expect(result.url).toBe('')
  })

  it('preserves pathname without query', () => {
    const result = serializeReq({ url: '/api/videos' })
    expect(result.url).toBe('/api/videos')
  })

  it('handles url with empty path before query', () => {
    const result = serializeReq({ url: '' })
    expect(result.url).toBe('')
  })
})

// ── serializeErr ──────────────────────────────────────────────────

describe('serializeErr', () => {
  it('serializes a plain Error', () => {
    const err = new Error('something went wrong')
    const result = serializeErr(err)
    expect(result.type).toBe('Error')
    expect(result.message).toBe('something went wrong')
    expect(typeof result.stack).toBe('string')
    expect(result.statusCode).toBeUndefined()
  })

  it('includes statusCode when present', () => {
    const err = Object.assign(new Error('not found'), { statusCode: 404 })
    const result = serializeErr(err)
    expect(result.statusCode).toBe(404)
  })

  it('uses constructor name for subclasses', () => {
    class CustomError extends Error {}
    const err = new CustomError('custom')
    expect(serializeErr(err).type).toBe('CustomError')
  })
})

// ── computeLevel ──────────────────────────────────────────────────

describe('computeLevel', () => {
  it('returns silent for test env', () => {
    expect(computeLevel('test')).toBe('silent')
  })

  it('returns debug for development env', () => {
    expect(computeLevel('development')).toBe('debug')
  })

  it('returns info for production env', () => {
    expect(computeLevel('production')).toBe('info')
  })

  it('returns info for undefined env', () => {
    expect(computeLevel(undefined)).toBe('info')
  })
})

// ── LOG_LEVELS ────────────────────────────────────────────────────

describe('LOG_LEVELS', () => {
  it('contains standard pino levels', () => {
    expect(LOG_LEVELS).toContain('trace')
    expect(LOG_LEVELS).toContain('debug')
    expect(LOG_LEVELS).toContain('info')
    expect(LOG_LEVELS).toContain('warn')
    expect(LOG_LEVELS).toContain('error')
    expect(LOG_LEVELS).toContain('fatal')
  })
})

// ── formatPretty ──────────────────────────────────────────────────

describe('formatPretty', () => {
  it('returns a non-empty string', () => {
    const out = formatPretty({ level: 30, time: Date.now(), msg: 'hello', service: 'api' })
    expect(typeof out).toBe('string')
    expect(out.length).toBeGreaterThan(0)
  })

  it('includes the message', () => {
    const out = formatPretty({ level: 30, msg: 'test message' })
    expect(out).toContain('test message')
  })

  it('includes INFO for level 30', () => {
    const out = formatPretty({ level: 30, msg: 'x' })
    expect(out).toContain('INFO')
  })

  it('includes WARN for level 40', () => {
    const out = formatPretty({ level: 40, msg: 'x' })
    expect(out).toContain('WARN')
  })

  it('includes ERROR for level 50', () => {
    const out = formatPretty({ level: 50, msg: 'x' })
    expect(out).toContain('ERROR')
  })

  it('handles numeric time', () => {
    const now = Date.now()
    const out = formatPretty({ level: 20, time: now, msg: 'debug msg' })
    expect(out).toContain('DEBUG')
  })

  it('includes context fields as JSON', () => {
    const out = formatPretty({ level: 30, msg: 'ctx test', request_id: 'abc-123' })
    expect(out).toContain('abc-123')
  })
})

// ── pino integration redact behavior ──────────────────────────────
// INFRA-15 F2: 行为级单测——验证 REDACT_PATHS + pino 实际写日志后
// secret 原文不出现 + 字段值 === '<redacted>'。路径表存在 ≠ 语法生效，
// 历史教训：headers.set-cookie / url.query 泄露正是行为测试发现的。

const SECRET = 'PINO_SECRET_TOKEN_XYZ'

function captureLog(fn: (logger: pino.Logger) => void): { raw: string; obj: Record<string, unknown> } {
  const chunks: string[] = []
  const stream = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(String(chunk))
      cb()
    },
  })
  const logger = pino(
    { redact: { paths: [...REDACT_PATHS], censor: '<redacted>' } },
    stream,
  )
  fn(logger)
  const raw = chunks.join('')
  return { raw, obj: JSON.parse(raw) as Record<string, unknown> }
}

describe('pino integration redact behavior', () => {
  it('redacts all 11 PII fields at top level', () => {
    const { raw, obj } = captureLog(log => {
      log.info({
        authorization: SECRET,
        cookie: SECRET,
        'set-cookie': SECRET,
        password: SECRET,
        token: SECRET,
        refreshToken: SECRET,
        accessToken: SECRET,
        email: SECRET,
        phone: SECRET,
        ip: SECRET,
      })
    })
    expect(raw).not.toContain(SECRET)
    expect(obj.authorization).toBe('<redacted>')
    expect(obj.cookie).toBe('<redacted>')
    expect(obj['set-cookie']).toBe('<redacted>')
    expect(obj.password).toBe('<redacted>')
    expect(obj.token).toBe('<redacted>')
    expect(obj.refreshToken).toBe('<redacted>')
    expect(obj.accessToken).toBe('<redacted>')
    expect(obj.email).toBe('<redacted>')
    expect(obj.phone).toBe('<redacted>')
    expect(obj.ip).toBe('<redacted>')
  })

  it('redacts nested *.field paths (one level deep)', () => {
    const { raw, obj } = captureLog(log => {
      log.info({
        ctx: {
          password: SECRET,
          token: SECRET,
          authorization: SECRET,
        },
      })
    })
    expect(raw).not.toContain(SECRET)
    const ctx = obj.ctx as Record<string, unknown>
    expect(ctx.password).toBe('<redacted>')
    expect(ctx.token).toBe('<redacted>')
    expect(ctx.authorization).toBe('<redacted>')
  })

  it('redacts headers.set-cookie container path', () => {
    const { raw, obj } = captureLog(log => {
      log.info({ headers: { 'set-cookie': SECRET } })
    })
    expect(raw).not.toContain(SECRET)
    const headers = obj.headers as Record<string, unknown>
    expect(headers['set-cookie']).toBe('<redacted>')
  })

  it('redacts req.url.query container path', () => {
    const { raw, obj } = captureLog(log => {
      log.info({ req: { url: { query: SECRET } } })
    })
    expect(raw).not.toContain(SECRET)
    const req = obj.req as { url: { query: unknown } }
    expect(req.url.query).toBe('<redacted>')
  })

  it('redacts url.query nested path', () => {
    const { raw, obj } = captureLog(log => {
      log.info({ url: { query: SECRET } })
    })
    expect(raw).not.toContain(SECRET)
    const url = obj.url as { query: unknown }
    expect(url.query).toBe('<redacted>')
  })

  it('does not redact non-PII fields with similar names', () => {
    const { raw, obj } = captureLog(log => {
      log.info({
        username: 'alice',
        userId: 42,
        accountType: 'premium',
        msg: 'normal log line',
      })
    })
    expect(raw).toContain('alice')
    expect(obj.username).toBe('alice')
    expect(obj.userId).toBe(42)
    expect(obj.accountType).toBe('premium')
  })
})

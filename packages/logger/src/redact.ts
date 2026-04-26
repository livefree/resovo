/**
 * PII redact paths for pino.  Covers 11 sensitive fields at top-level,
 * one level of nesting (*.field), and common container paths.
 *
 * Hard rule: never put raw req / res / headers into log context.
 * Use serializeReq / serializeErr from serializers.ts instead.
 */
export const REDACT_PATHS = [
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
] as const satisfies readonly string[]

/**
 * Merge base REDACT_PATHS with module-specific extra paths.
 * Use when a service has additional sensitive fields beyond the baseline.
 */
export function withRedactPaths(extra: readonly string[]): string[] {
  return [...REDACT_PATHS, ...extra]
}

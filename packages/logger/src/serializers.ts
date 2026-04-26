/**
 * Serializers for pino. Raw req/res/headers objects MUST NOT be passed directly
 * into log context — always go through these serializers.
 */

export interface SerializedReq {
  [key: string]: unknown
  request_id: string | undefined
  method: string | undefined
  /** Pathname only (no query string). Empty string when req.url is missing or query-only. */
  url: string
}

export interface SerializedErr {
  [key: string]: unknown
  type: string
  message: string
  stack: string
  statusCode?: number
}

export function serializeReq(
  req: { id?: string; method?: string; url?: string },
): SerializedReq {
  const raw = req.url?.split('?')[0] ?? ''
  return {
    request_id: req.id,
    method: req.method,
    url: raw,
  }
}

export function serializeErr(
  err: Error & { statusCode?: number },
): SerializedErr {
  return {
    type: err.constructor?.name ?? 'Error',
    message: err.message,
    stack: err.stack ?? '',
    ...(err.statusCode !== undefined ? { statusCode: err.statusCode } : {}),
  }
}

/**
 * tmdb.ts — TMDb API 客户端（ADR-173）
 *
 * **本期仅含连接测试**（凭证位就绪）；完整富集客户端（媒体匹配/回填）待 TMDb 消费管线立项。
 * 鉴权：API Read Access Token（Bearer，覆盖 v3/v4），不绑 v3 query `api_key`（ADR-173 D-173-2）。
 */

export interface TmdbClientConfig {
  token?: string
  baseUrl?: string
  language?: string
  timeoutMs?: number
}

export interface TmdbTestResult {
  ok: boolean
  latencyMs: number
  error?: string
  authStatus?: 'valid' | 'invalid' | 'not_required'
}

const DEFAULT_BASE = 'https://api.themoviedb.org/3'
const DEFAULT_TIMEOUT_MS = 8000

function summarizeError(err: unknown): string {
  if (err instanceof Error) return err.name === 'TimeoutError' ? '请求超时' : err.message
  return String(err)
}

/**
 * 连接测试（ADR-173 D-173-6）：GET {baseUrl}/authentication，头 Authorization: Bearer <token>。
 * 200=valid / 401=invalid token / 其他非 2xx 不断言 token 有效性。无 token → 无法测试（ok=false）。
 */
export async function testConnection(cfg?: TmdbClientConfig): Promise<TmdbTestResult> {
  const token = cfg?.token
  if (!token) return { ok: false, latencyMs: 0, error: '未配置 API Read Access Token' }

  const base = cfg?.baseUrl || DEFAULT_BASE
  const startedAt = Date.now()
  try {
    const res = await fetch(`${base}/authentication`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(cfg?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    })
    const latencyMs = Date.now() - startedAt
    if (res.ok) return { ok: true, latencyMs, authStatus: 'valid' }
    if (res.status === 401) return { ok: false, latencyMs, authStatus: 'invalid', error: 'Token 无效（401 未授权）' }
    return { ok: false, latencyMs, error: `HTTP ${res.status}` }
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - startedAt, error: summarizeError(err) }
  }
}

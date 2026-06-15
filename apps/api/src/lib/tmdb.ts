/**
 * tmdb.ts — TMDb API 客户端（ADR-173 → ADR-201 §凭证语义）
 *
 * **本期仅含连接测试**（凭证位就绪）；完整富集客户端（媒体匹配/回填）待 TMDb 消费管线立项（META-38）。
 * 鉴权双路（ADR-201 D-201-7）：read_access_token（v4 Bearer，写 Authorization header，首选）
 *   / api_key（v3，写 query ?api_key=，兼容）。Bearer 优先于 api_key；429 视为 provider 暂时不可用（warn，
 *   不标记凭证无效）。两者皆缺 → 无法测试。
 */

export interface TmdbClientConfig {
  /** v4 API Read Access Token，写 Authorization: Bearer（首选）。 */
  readAccessToken?: string
  /** v3 API Key，写 query ?api_key=（兼容）。 */
  apiKey?: string
  baseUrl?: string
  language?: string
  timeoutMs?: number
}

/** 认证方式（ADR-201 22811，由保存字段派生）：Bearer 优先 > api_key > none。 */
export type TmdbAuthMethod = 'bearer' | 'api_key' | 'none'

export interface TmdbTestResult {
  ok: boolean
  latencyMs: number
  error?: string
  authStatus?: 'valid' | 'invalid' | 'not_required'
  /** 本次测试实际采用的认证方式（供测试断言 / 未来 UI 透传，ADR-201 22817 区分 Bearer/API Key）。 */
  authMethod?: TmdbAuthMethod
}

const DEFAULT_BASE = 'https://api.themoviedb.org/3'
const DEFAULT_TIMEOUT_MS = 8000

/** 由配置派生认证方式（Bearer 优先 > api_key > none，ADR-201 22811）。 */
export function resolveTmdbAuthMethod(cfg?: TmdbClientConfig): TmdbAuthMethod {
  if (cfg?.readAccessToken) return 'bearer'
  if (cfg?.apiKey) return 'api_key'
  return 'none'
}

function summarizeError(err: unknown): string {
  if (err instanceof Error) return err.name === 'TimeoutError' ? '请求超时' : err.message
  return String(err)
}

/**
 * 连接测试（ADR-201 §连接测试）：GET {baseUrl}/authentication。
 * Bearer 首选（Authorization: Bearer <read_access_token>）；否则 api_key（query ?api_key=）。
 * 200=valid / 401=invalid token / 429=provider 暂时不可用（warn，不标 invalid）/ 其他非 2xx 不断言。
 * read_access_token 与 api_key 皆缺 → 无法测试（ok=false）。
 */
export async function testConnection(cfg?: TmdbClientConfig): Promise<TmdbTestResult> {
  const authMethod = resolveTmdbAuthMethod(cfg)
  if (authMethod === 'none') {
    return { ok: false, latencyMs: 0, error: '未配置 API Read Access Token 或 API Key', authMethod }
  }

  const base = cfg?.baseUrl || DEFAULT_BASE
  const headers: Record<string, string> = { Accept: 'application/json' }
  let url = `${base}/authentication`
  if (authMethod === 'bearer') {
    headers.Authorization = `Bearer ${cfg!.readAccessToken}`
  } else {
    const sep = url.includes('?') ? '&' : '?'
    url = `${url}${sep}api_key=${encodeURIComponent(cfg!.apiKey ?? '')}`
  }

  const startedAt = Date.now()
  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(cfg?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    })
    const latencyMs = Date.now() - startedAt
    if (res.ok) return { ok: true, latencyMs, authStatus: 'valid', authMethod }
    if (res.status === 401) return { ok: false, latencyMs, authStatus: 'invalid', error: '凭证无效（401 未授权）', authMethod }
    if (res.status === 429) return { ok: false, latencyMs, error: 'TMDb 限流（429），稍后重试', authMethod }
    return { ok: false, latencyMs, error: `HTTP ${res.status}`, authMethod }
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - startedAt, error: summarizeError(err), authMethod }
  }
}

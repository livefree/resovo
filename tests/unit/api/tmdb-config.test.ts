/**
 * tests/unit/api/tmdb-config.test.ts —
 * ADR-201 §凭证语义 loadTmdbClientConfig 薄封装单测（META-37-B，对齐 bangumi-config 范式）
 *
 * 覆盖：read_access_token/api_key/baseUrl/language 映射（仅注入有值字段）/ Bearer+api_key 并存 /
 *       缺行 legacy KV tmdb_api_key→apiKey（不回填 Bearer）/ disabled 行返回空。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { Pool } from 'pg'
import { loadTmdbClientConfig } from '@/api/services/tmdb-config'

interface FakeOpts {
  credRow?: { secrets?: Record<string, unknown>; config?: Record<string, unknown>; enabled?: boolean } | null
  kv?: Record<string, string>
}

function makeDb(opts: FakeOpts): Pool {
  const query = vi.fn(async (text: string) => {
    if (text.includes('FROM api_credentials')) {
      if (!opts.credRow) return { rows: [] }
      return {
        rows: [
          {
            provider: 'tmdb',
            secrets: opts.credRow.secrets ?? {},
            config: opts.credRow.config ?? {},
            enabled: opts.credRow.enabled ?? true,
            last_tested_at: null,
            last_test_ok: null,
            last_test_latency_ms: null,
            last_test_error: null,
            updated_at: '2026-06-14T00:00:00Z',
            updated_by: null,
          },
        ],
      }
    }
    if (text.includes('FROM system_settings')) {
      return { rows: Object.entries(opts.kv ?? {}).map(([key, value]) => ({ key, value })) }
    }
    return { rows: [] }
  })
  return { query } as unknown as Pool
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('loadTmdbClientConfig 薄封装映射（ADR-201 / META-37-B）', () => {
  it('行存在：read_access_token/baseUrl/language 仅注入有值字段', async () => {
    vi.stubEnv('TMDB_READ_ACCESS_TOKEN', '')
    vi.stubEnv('TMDB_API_KEY', '')
    const db = makeDb({
      credRow: { secrets: { read_access_token: 'rat' }, config: { baseUrl: 'https://x/3', language: 'zh-CN' } },
    })
    const cfg = await loadTmdbClientConfig(db)
    expect(cfg).toEqual({ readAccessToken: 'rat', baseUrl: 'https://x/3', language: 'zh-CN' })
  })

  it('Bearer + api_key 并存：两字段都注入（认证优先由消费点 resolveTmdbAuthMethod 派生）', async () => {
    const db = makeDb({ credRow: { secrets: { read_access_token: 'rat', api_key: 'k3' } } })
    const cfg = await loadTmdbClientConfig(db)
    expect(cfg.readAccessToken).toBe('rat')
    expect(cfg.apiKey).toBe('k3')
  })

  it('缺行：legacy KV tmdb_api_key → apiKey（不回填 Bearer readAccessToken，ADR-201 22822）', async () => {
    vi.stubEnv('TMDB_READ_ACCESS_TOKEN', '')
    vi.stubEnv('TMDB_API_KEY', '')
    vi.stubEnv('TMDB_BASE_URL', '')
    vi.stubEnv('TMDB_LANGUAGE', '')
    const db = makeDb({ credRow: null, kv: { tmdb_api_key: 'legacy-key' } })
    const cfg = await loadTmdbClientConfig(db)
    expect(cfg.apiKey).toBe('legacy-key')
    expect(cfg.readAccessToken).toBeUndefined()
  })

  it('旧行兼容：未迁移 secrets.token → readAccessToken（ADR-201 22823 过渡期并存读取）', async () => {
    vi.stubEnv('TMDB_READ_ACCESS_TOKEN', '')
    const db = makeDb({ credRow: { secrets: { token: 'old-bearer' } } })
    const cfg = await loadTmdbClientConfig(db)
    expect(cfg.readAccessToken).toBe('old-bearer')
  })

  it('disabled 行：返回空 cfg（凭证不注入，压过 env）', async () => {
    vi.stubEnv('TMDB_READ_ACCESS_TOKEN', 'env-rat')
    const db = makeDb({ credRow: { secrets: { read_access_token: 'rat' }, enabled: false } })
    const cfg = await loadTmdbClientConfig(db)
    expect(cfg).toEqual({})
  })
})

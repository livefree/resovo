/**
 * tests/unit/api/integration-credentials-config.test.ts —
 * ADR-173 D-173-3 通用化凭证解析 + bangumi-config 薄封装单测（META-26 / Card A2）
 *
 * 覆盖：
 *   - 优先级：api_credentials 行（secrets/config）> 旧 system_settings KV > env
 *   - enabled=false 压过 env 回退
 *   - 缺行 fallback 旧 KV / 全缺 env 回退
 *   - number 字段强转
 *   - loadBangumiClientConfig 映射 token/userAgent/timeoutMs（仅注入有值字段）
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { Pool } from 'pg'
import { getProviderCredentialSpec } from '@resovo/types'
import { loadProviderCredential } from '@/api/services/integration-credentials-config'
import { loadBangumiClientConfig } from '@/api/services/bangumi-config'

interface FakeOpts {
  credRow?: {
    secrets?: Record<string, unknown>
    config?: Record<string, unknown>
    enabled?: boolean
  } | null
  kv?: Record<string, string>
}

function makeDb(opts: FakeOpts): Pool {
  const query = vi.fn(async (text: string) => {
    if (text.includes('FROM api_credentials')) {
      if (!opts.credRow) return { rows: [] }
      return {
        rows: [
          {
            provider: 'bangumi',
            secrets: opts.credRow.secrets ?? {},
            config: opts.credRow.config ?? {},
            enabled: opts.credRow.enabled ?? true,
            last_tested_at: null,
            last_test_ok: null,
            last_test_latency_ms: null,
            last_test_error: null,
            updated_at: '2026-06-13T00:00:00Z',
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

describe('loadProviderCredential（ADR-173 D-173-3）', () => {
  it('行存在且 enabled：返回 secrets/config 字段，env 被行值压过', async () => {
    vi.stubEnv('BANGUMI_API_TOKEN', 'env-token')
    const db = makeDb({ credRow: { secrets: { token: 'row-token' }, config: { userAgent: 'UA/row', timeoutMs: 8000 } } })
    const res = await loadProviderCredential(db, 'bangumi')
    expect(res.enabled).toBe(true)
    expect(res.fields.token).toBe('row-token')
    expect(res.fields.userAgent).toBe('UA/row')
    expect(res.fields.timeoutMs).toBe(8000)
  })

  it('行存在但 enabled=false：压过 env 回退，返回空字段', async () => {
    vi.stubEnv('BANGUMI_API_TOKEN', 'env-token')
    const db = makeDb({ credRow: { secrets: { token: 'row-token' }, enabled: false } })
    const res = await loadProviderCredential(db, 'bangumi')
    expect(res.enabled).toBe(false)
    expect(res.fields).toEqual({})
  })

  it('缺行：fallback 旧 system_settings KV', async () => {
    const db = makeDb({
      credRow: null,
      kv: {
        bangumi_api_token: 'kv-token',
        bangumi_user_agent: 'UA/kv',
        bangumi_api_timeout_ms: '5000',
      },
    })
    const res = await loadProviderCredential(db, 'bangumi')
    expect(res.fields.token).toBe('kv-token')
    expect(res.fields.userAgent).toBe('UA/kv')
    expect(res.fields.timeoutMs).toBe(5000) // number 字段强转
  })

  it('缺行且无 KV：env 回退', async () => {
    vi.stubEnv('BANGUMI_API_TOKEN', 'env-token')
    vi.stubEnv('BANGUMI_API_TIMEOUT_MS', '9000')
    const db = makeDb({ credRow: null, kv: {} })
    const res = await loadProviderCredential(db, 'bangumi')
    expect(res.fields.token).toBe('env-token')
    expect(res.fields.timeoutMs).toBe(9000)
  })

  it('缺行 + 无 KV + 无 env：返回空字段', async () => {
    // 中和 ambient env（.env.local 可能存 BANGUMI_API_TOKEN）
    vi.stubEnv('BANGUMI_API_TOKEN', '')
    vi.stubEnv('BANGUMI_USER_AGENT', '')
    vi.stubEnv('BANGUMI_API_TIMEOUT_MS', '')
    const db = makeDb({ credRow: null, kv: {} })
    const res = await loadProviderCredential(db, 'bangumi')
    expect(res.fields).toEqual({})
  })

  it('行存在但字段缺：单字段 env 回退（行值不全时按字段补）', async () => {
    vi.stubEnv('BANGUMI_USER_AGENT', 'UA/env')
    const db = makeDb({ credRow: { secrets: { token: 'row-token' }, config: {} } })
    const res = await loadProviderCredential(db, 'bangumi')
    expect(res.fields.token).toBe('row-token')
    expect(res.fields.userAgent).toBe('UA/env')
  })
})

describe('loadBangumiClientConfig 薄封装映射', () => {
  it('仅注入有值字段（token/userAgent/timeoutMs）', async () => {
    const db = makeDb({ credRow: { secrets: { token: 't' }, config: { userAgent: 'UA', timeoutMs: 8000 } } })
    const cfg = await loadBangumiClientConfig(db)
    expect(cfg).toEqual({ token: 't', userAgent: 'UA', timeoutMs: 8000 })
  })

  it('无凭证（缺行 + 无 KV + 无 env）：返回空 cfg（由 lib/bangumi 回退默认）', async () => {
    vi.stubEnv('BANGUMI_API_TOKEN', '')
    vi.stubEnv('BANGUMI_USER_AGENT', '')
    vi.stubEnv('BANGUMI_API_TIMEOUT_MS', '')
    const db = makeDb({ credRow: null, kv: {} })
    const cfg = await loadBangumiClientConfig(db)
    expect(cfg).toEqual({})
  })

  it('disabled 行：返回空 cfg（凭证不注入）', async () => {
    vi.stubEnv('BANGUMI_API_TOKEN', 'env-token')
    const db = makeDb({ credRow: { secrets: { token: 'row-token' }, enabled: false } })
    const cfg = await loadBangumiClientConfig(db)
    expect(cfg).toEqual({})
  })
})

describe('tmdb 凭证解析（ADR-201 字段拆分 / META-37-A）', () => {
  it('已迁移行：secrets.read_access_token → fields.read_access_token（Bearer 首选）', async () => {
    const db = makeDb({ credRow: { secrets: { read_access_token: 'rat-row' } } })
    const res = await loadProviderCredential(db, 'tmdb')
    expect(res.fields.read_access_token).toBe('rat-row')
  })

  it('缺行：legacy KV tmdb_api_key → fields.api_key（不回填 Bearer read_access_token，ADR-201 22822）', async () => {
    vi.stubEnv('TMDB_READ_ACCESS_TOKEN', '')
    vi.stubEnv('TMDB_API_KEY', '')
    const db = makeDb({ credRow: null, kv: { tmdb_api_key: 'legacy-key' } })
    const res = await loadProviderCredential(db, 'tmdb')
    expect(res.fields.api_key).toBe('legacy-key')
    expect(res.fields.read_access_token).toBeUndefined() // Bearer 无 legacy KV 来源
  })

  it('旧行兼容：未迁移 secrets.token → fields.read_access_token（ADR-201 22823 过渡期并存读取）', async () => {
    vi.stubEnv('TMDB_READ_ACCESS_TOKEN', '')
    // migration 116 未跑 / 回滚：行内仍是旧 secrets.token，须仍可读为 Bearer
    const db = makeDb({ credRow: { secrets: { token: 'old-bearer' } } })
    const res = await loadProviderCredential(db, 'tmdb')
    expect(res.fields.read_access_token).toBe('old-bearer')
  })

  it('新 key 优先旧 key：secrets 同时有 read_access_token + token → 取新', async () => {
    const db = makeDb({ credRow: { secrets: { read_access_token: 'new-rat', token: 'old' } } })
    const res = await loadProviderCredential(db, 'tmdb')
    expect(res.fields.read_access_token).toBe('new-rat')
  })
})

describe('tmdb 凭证契约守卫（ADR-201 §凭证语义 / META-37-A）', () => {
  it('spec 含 read_access_token + api_key 两 secret 字段，不含旧 token', () => {
    const tmdb = getProviderCredentialSpec('tmdb')!
    const keys = tmdb.fields.map((f) => f.key)
    expect(keys).toContain('read_access_token')
    expect(keys).toContain('api_key')
    expect(keys).not.toContain('token') // 旧单字段已拆，防回归
    expect(tmdb.fields.find((f) => f.key === 'read_access_token')?.secret).toBe(true)
    expect(tmdb.fields.find((f) => f.key === 'api_key')?.secret).toBe(true)
  })
})

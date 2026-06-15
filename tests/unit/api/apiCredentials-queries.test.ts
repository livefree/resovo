/**
 * tests/unit/api/apiCredentials-queries.test.ts —
 * ADR-173 api_credentials 写查询单测（META-27 / Card B1）
 *
 * 覆盖：upsert JSONB `||` 合并 SQL 形态 + 参数 / updateTestStatus 仅 UPDATE / list 映射。
 */
import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import {
  listApiCredentialRows,
  upsertApiCredential,
  updateApiCredentialTestStatus,
  normalizeRowSecrets,
} from '@/api/db/queries/apiCredentials'

function makeDb(rows: unknown[] = []) {
  const query = vi.fn(async (_sql: string, _params?: unknown[]) => ({ rows }))
  return { db: { query } as unknown as Pool, query }
}

/** 取第 N 次 query 调用的 [sql, params]（断言已调用，规避 noUncheckedIndexedAccess）。 */
function callOf(query: ReturnType<typeof vi.fn>, i = 0): [string, unknown[]] {
  const call = query.mock.calls[i]
  if (!call) throw new Error(`query 未被调用 ${i}`)
  return [call[0] as string, (call[1] ?? []) as unknown[]]
}

describe('upsertApiCredential（ADR-173 D-173-4 JSONB 合并）', () => {
  it('ON CONFLICT 用 `||` 顶层合并 secrets/config（不误清同源未提交字段）', async () => {
    const { db, query } = makeDb()
    await upsertApiCredential(db, {
      provider: 'bangumi',
      secrets: { token: 'new-tok' },
      config: { userAgent: 'UA/x' },
      updatedBy: 'admin-1',
    })
    const [sql, params] = callOf(query)
    expect(sql).toContain('ON CONFLICT (provider) DO UPDATE')
    expect(sql).toContain('(api_credentials.secrets - $6::text[]) || $2::jsonb')
    expect(sql).toContain('api_credentials.config  || $3::jsonb')
    expect(params[0]).toBe('bangumi')
    expect(JSON.parse(params[1] as string)).toEqual({ token: 'new-tok' })
    expect(JSON.parse(params[2] as string)).toEqual({ userAgent: 'UA/x' })
    expect(params[4]).toBe('admin-1')
  })

  it('enabled 省略 → COALESCE 保持原值（参数为 null）', async () => {
    const { db, query } = makeDb()
    await upsertApiCredential(db, { provider: 'tmdb', secrets: { token: 't' }, updatedBy: null })
    const [sql, params] = callOf(query)
    expect(sql).toContain('COALESCE($4, api_credentials.enabled)')
    expect(params[3]).toBeNull()
    expect(JSON.parse(params[2] as string)).toEqual({}) // config 缺省空对象 → 不动
    expect(params[5]).toEqual([]) // dropSecretKeys 省略 → 空数组（不删任何 key）
  })

  it('dropSecretKeys → 合并前 `secrets - $6::text[]` 删旧 key（固化迁移，ADR-201 22823）', async () => {
    const { db, query } = makeDb()
    await upsertApiCredential(db, {
      provider: 'tmdb',
      secrets: { read_access_token: 'rat' },
      dropSecretKeys: ['token'],
      updatedBy: 'admin-1',
    })
    const [sql, params] = callOf(query)
    expect(sql).toContain('(api_credentials.secrets - $6::text[]) || $2::jsonb')
    expect(params[5]).toEqual(['token'])
  })
})

describe('updateApiCredentialTestStatus（ADR-173 D-173-5）', () => {
  it('仅 UPDATE 已存行（不 INSERT），写 last_test_* + NOW()', async () => {
    const { db, query } = makeDb()
    await updateApiCredentialTestStatus(db, { provider: 'bangumi', ok: true, latencyMs: 123, error: null })
    const [sql, params] = callOf(query)
    expect(sql).toContain('UPDATE api_credentials')
    expect(sql).not.toContain('INSERT')
    expect(sql).toContain('last_tested_at = NOW()')
    expect(params).toEqual(['bangumi', true, 123, null])
  })
})

describe('listApiCredentialRows', () => {
  it('映射 snake→camel（含 JSONB secrets/config + 测试状态）', async () => {
    const { db } = makeDb([
      {
        provider: 'bangumi',
        secrets: { token: 'x' },
        config: { timeoutMs: 8000 },
        enabled: true,
        last_tested_at: '2026-06-13T00:00:00Z',
        last_test_ok: true,
        last_test_latency_ms: 200,
        last_test_error: null,
        updated_at: '2026-06-13T00:00:00Z',
        updated_by: 'admin-1',
      },
    ])
    const rows = await listApiCredentialRows(db)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      provider: 'bangumi',
      secrets: { token: 'x' },
      config: { timeoutMs: 8000 },
      enabled: true,
      lastTestOk: true,
      lastTestLatencyMs: 200,
      updatedBy: 'admin-1',
    })
  })
})

describe('normalizeRowSecrets（ADR-201 22823 行内旧 secret key 兼容）', () => {
  it('tmdb 旧行 secrets.token → read_access_token（旧 key 剔除）', () => {
    expect(normalizeRowSecrets('tmdb', { token: 'old' })).toEqual({ read_access_token: 'old' })
  })
  it('新 key 已有非空值 → 保留新值，旧 key 剔除（迁移优先）', () => {
    expect(normalizeRowSecrets('tmdb', { token: 'old', read_access_token: 'new' })).toEqual({
      read_access_token: 'new',
    })
  })
  it('新 key 空串 → 用旧值回填', () => {
    expect(normalizeRowSecrets('tmdb', { token: 'old', read_access_token: '' })).toEqual({
      read_access_token: 'old',
    })
  })
  it('无旧 key 命中 → 原引用返回（零拷贝）', () => {
    const input = { read_access_token: 'rat' }
    expect(normalizeRowSecrets('tmdb', input)).toBe(input)
  })
  it('无映射 provider（bangumi）→ 原样返回', () => {
    const input = { token: 't' }
    expect(normalizeRowSecrets('bangumi', input)).toBe(input)
  })
})

/**
 * tests/unit/api/externalFetchLog.test.ts
 * CHG-EXT-RES-STORE-A（ADR-188 D-188-2/3/4/7）：
 *   - external_fetch_log queries：insertFetchLog 参数化 + 默认值 / queryFetchLog 动态 WHERE 分页 clamp
 *     / aggregateFetchLog 分桶映射 + avg 取整 / deleteFetchLogBefore rowCount
 *   - provider registry（packages/types EXTERNAL_PROVIDERS）不变量
 */

import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import {
  insertFetchLog,
  queryFetchLog,
  aggregateFetchLog,
  deleteFetchLogBefore,
  type FetchLogInput,
} from '@/api/db/queries/external-fetch-log'
import {
  EXTERNAL_PROVIDERS,
  getExternalProvider,
  PROVIDER_KEYS,
  ACQUISITION_METHODS,
  PROVIDER_CAPABILITIES,
} from '@resovo/types'

function makeInput(overrides: Partial<FetchLogInput> = {}): FetchLogInput {
  return {
    provider: 'douban',
    operation: 'search',
    method: 'scrape',
    status: 'ok',
    ...overrides,
  }
}

describe('insertFetchLog', () => {
  it('参数化 INSERT，9 列顺序正确', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 })
    const db = { query } as unknown as Pool
    await insertFetchLog(
      db,
      makeInput({ source: 'enrich_worker', target: '流浪地球', itemCount: 3, durationMs: 842, error: null }),
    )
    const [sql, params] = query.mock.calls[0]
    expect(String(sql)).toContain('INSERT INTO external_data.external_fetch_log')
    expect(params).toEqual(['douban', 'search', 'scrape', 'ok', 'enrich_worker', '流浪地球', 3, 842, null])
  })

  it('可选字段缺省：source/target/durationMs/error → null，itemCount → 0', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 })
    const db = { query } as unknown as Pool
    await insertFetchLog(db, makeInput())
    const params = query.mock.calls[0][1] as unknown[]
    expect(params[4]).toBe(null) // source
    expect(params[5]).toBe(null) // target
    expect(params[6]).toBe(0) // item_count
    expect(params[7]).toBe(null) // duration_ms
    expect(params[8]).toBe(null) // error
  })
})

describe('queryFetchLog', () => {
  it('仅 provider：WHERE 单条件 + LIMIT/OFFSET clamp（默认 50/0）', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ count: '12' }] })
      .mockResolvedValueOnce({ rows: [] })
    const db = { query } as unknown as Pool
    const page = await queryFetchLog(db, { provider: 'douban' })

    const totalCall = query.mock.calls[0]
    expect(String(totalCall[0])).toContain('WHERE provider = $1')
    expect(totalCall[1]).toEqual(['douban'])

    const rowsCall = query.mock.calls[1]
    expect(String(rowsCall[0])).toContain('LIMIT $2 OFFSET $3')
    expect(rowsCall[1]).toEqual(['douban', 50, 0])
    expect(page.total).toBe(12)
  })

  it('全过滤：operation/method/status/since 顺序进 WHERE + 参数对齐', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ count: '3' }] })
      .mockResolvedValueOnce({ rows: [] })
    const db = { query } as unknown as Pool
    await queryFetchLog(db, {
      provider: 'douban',
      operation: 'collection',
      method: 'scrape',
      status: 'fail',
      since: '2026-06-07T00:00:00Z',
      limit: 200, // 超上限 → clamp 100
      offset: 5,
    })
    const rowsCall = query.mock.calls[1]
    const sql = String(rowsCall[0])
    expect(sql).toContain('operation = $2')
    expect(sql).toContain('method = $3')
    expect(sql).toContain('status = $4')
    expect(sql).toContain('created_at >= $5')
    expect(sql).toContain('LIMIT $6 OFFSET $7')
    expect(rowsCall[1]).toEqual(['douban', 'collection', 'scrape', 'fail', '2026-06-07T00:00:00Z', 100, 5])
  })

  it('行映射 snake → camelCase', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({
        rows: [{
          id: '7', provider: 'douban', operation: 'detail', method: 'scrape', status: 'ok',
          source: 'enrich_worker', target: '26266893', item_count: 1, duration_ms: 503,
          error: null, created_at: '2026-06-07T10:00:00Z',
        }],
      })
    const db = { query } as unknown as Pool
    const page = await queryFetchLog(db, { provider: 'douban' })
    expect(page.rows[0]).toMatchObject({ id: '7', itemCount: 1, durationMs: 503, createdAt: '2026-06-07T10:00:00Z' })
  })
})

describe('aggregateFetchLog', () => {
  it('总计 + operation/method 分桶映射 + avg 取整', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ total: '10', ok: '8', fail: '1', timeout: '1', avg_ms: '842.6' }] })
      .mockResolvedValueOnce({ rows: [{ key: 'search', total: '6', ok: '5', fail: '1', timeout: '0' }] })
      .mockResolvedValueOnce({ rows: [{ key: 'scrape', total: '10', ok: '8', fail: '1', timeout: '1' }] })
    const db = { query } as unknown as Pool
    const agg = await aggregateFetchLog(db, 'douban', '2026-06-06T00:00:00Z')
    expect(agg).toMatchObject({ total: 10, ok: 8, fail: 1, timeout: 1, avgDurationMs: 843 })
    expect(agg.byOperation[0]).toEqual({ key: 'search', total: 6, ok: 5, fail: 1, timeout: 0 })
    expect(agg.byMethod[0]).toEqual({ key: 'scrape', total: 10, ok: 8, fail: 1, timeout: 1 })
    // 三查询均带 provider + since 参数
    for (const call of query.mock.calls) expect(call[1]).toEqual(['douban', '2026-06-06T00:00:00Z'])
  })

  it('空数据：avg 为 null → avgDurationMs null，桶为空数组', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ total: '0', ok: '0', fail: '0', timeout: '0', avg_ms: null }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
    const db = { query } as unknown as Pool
    const agg = await aggregateFetchLog(db, 'douban', '2026-06-06T00:00:00Z')
    expect(agg.total).toBe(0)
    expect(agg.avgDurationMs).toBeNull()
    expect(agg.byOperation).toEqual([])
  })
})

describe('deleteFetchLogBefore', () => {
  it('参数化 DELETE 早于 cutoff + 返回删除行数', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 42 })
    const db = { query } as unknown as Pool
    const n = await deleteFetchLogBefore(db, '2026-05-08T00:00:00Z')
    const [sql, params] = query.mock.calls[0]
    expect(String(sql)).toContain('DELETE FROM external_data.external_fetch_log WHERE created_at < $1')
    expect(params).toEqual(['2026-05-08T00:00:00Z'])
    expect(n).toBe(42)
  })
})

describe('provider registry（ADR-188 D-188-2）', () => {
  it('豆瓣 active，acquisition offline+scrape，capabilities 含 detail/search/collection', () => {
    const douban = getExternalProvider('douban')
    expect(douban?.status).toBe('active')
    expect(douban?.acquisition).toEqual(['offline', 'scrape'])
    expect(douban?.capabilities).toEqual(expect.arrayContaining(['detail', 'search', 'collection', 'comments', 'celebrity']))
  })

  it('planned provider（bangumi/imdb/tmdb）capabilities 留空待调研，status=planned', () => {
    for (const key of ['bangumi', 'imdb', 'tmdb'] as const) {
      const p = getExternalProvider(key)
      expect(p?.status).toBe('planned')
      expect(p?.capabilities).toEqual([])
    }
  })

  it('未知 key → undefined；registry 覆盖全部 PROVIDER_KEYS', () => {
    expect(getExternalProvider('netflix')).toBeUndefined()
    expect(EXTERNAL_PROVIDERS.map((p) => p.key).sort()).toEqual([...PROVIDER_KEYS].sort())
  })

  it('capabilities/acquisition 值域不越 SSOT const', () => {
    for (const p of EXTERNAL_PROVIDERS) {
      for (const c of p.capabilities) expect(PROVIDER_CAPABILITIES).toContain(c)
      for (const a of p.acquisition) expect(ACQUISITION_METHODS).toContain(a)
    }
  })
})

/**
 * tests/unit/api/crawler-runs-queries.test.ts — sub1-EXTEND
 *
 * crawlerRuns.listRuns 5 类新参数 SQL + values 单元测试：
 *   - idPrefix: id::text LIKE prefix%
 *   - siteCountMin / siteCountMax: enqueued_site_count BETWEEN
 *   - createdAtFrom / createdAtTo: created_at 日期范围（to 含当日全天）
 *   + 多参数组合 SQL 拼接 / 占位符递增正确
 *
 * 范式参考：tests/unit/api/home-queries.test.ts（mock pg Pool + 不 mock queries 模块）
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listRuns } from '@/api/db/queries/crawlerRuns'
import type { Pool } from 'pg'

const mockQuery = vi.fn()
const mockPool = { query: mockQuery, connect: vi.fn() } as unknown as Pool

beforeEach(() => {
  mockQuery.mockReset()
  // listRuns 用 Promise.all 调 2 次 query（dataResult + countResult）
  mockQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ total: '0' }] })
})

describe('crawlerRuns.listRuns (sub1-EXTEND 5 类新参数)', () => {
  it('#1 idPrefix → SQL 包含 id::text LIKE / values 含 lowercased prefix + %', async () => {
    await listRuns(mockPool, { idPrefix: 'ABC12345' })
    const calls = mockQuery.mock.calls
    expect(calls.length).toBe(2)
    const [dataSql, dataValues] = calls[0]
    expect(dataSql).toContain('id::text LIKE $1')
    expect(dataValues[0]).toBe('abc12345%')
  })

  it('#2 siteCountMin → SQL 包含 enqueued_site_count >= / value 数字', async () => {
    await listRuns(mockPool, { siteCountMin: 5 })
    const [dataSql, dataValues] = mockQuery.mock.calls[0]
    expect(dataSql).toContain('enqueued_site_count >= $1')
    expect(dataValues[0]).toBe(5)
  })

  it('#3 siteCountMax → SQL 包含 enqueued_site_count <= / value 数字', async () => {
    await listRuns(mockPool, { siteCountMax: 100 })
    const [dataSql, dataValues] = mockQuery.mock.calls[0]
    expect(dataSql).toContain('enqueued_site_count <= $1')
    expect(dataValues[0]).toBe(100)
  })

  it('#4 createdAtFrom → SQL 包含 created_at >= $X::date / value ISO date', async () => {
    await listRuns(mockPool, { createdAtFrom: '2026-05-01' })
    const [dataSql, dataValues] = mockQuery.mock.calls[0]
    expect(dataSql).toContain('created_at >= $1::date')
    expect(dataValues[0]).toBe('2026-05-01')
  })

  it('#5 createdAtTo → SQL 包含 created_at < ($X::date + INTERVAL 1 day) / 包含 to 当日全天', async () => {
    await listRuns(mockPool, { createdAtTo: '2026-05-24' })
    const [dataSql, dataValues] = mockQuery.mock.calls[0]
    expect(dataSql).toMatch(/created_at < \(\$1::date \+ INTERVAL '1 day'\)/)
    expect(dataValues[0]).toBe('2026-05-24')
  })

  it('#6 多参数组合 → SQL 占位符递增 + values 顺序对齐', async () => {
    await listRuns(mockPool, {
      status: ['running'],
      idPrefix: 'abc',
      siteCountMin: 1,
      createdAtFrom: '2026-05-01',
      createdAtTo: '2026-05-24',
    })
    const [dataSql, dataValues] = mockQuery.mock.calls[0]
    // 顺序对应 listRuns 函数中条件添加顺序：status / triggerType / idPrefix / siteCountMin / siteCountMax / from / to
    expect(dataSql).toContain('status = ANY($1::text[])')
    expect(dataSql).toContain('id::text LIKE $2')
    expect(dataSql).toContain('enqueued_site_count >= $3')
    expect(dataSql).toContain('created_at >= $4::date')
    expect(dataSql).toMatch(/created_at < \(\$5::date \+ INTERVAL '1 day'\)/)
    // LIMIT / OFFSET 占位符 6 / 7
    expect(dataSql).toContain('LIMIT $6 OFFSET $7')
    expect(dataValues[0]).toEqual(['running'])
    expect(dataValues[1]).toBe('abc%')
    expect(dataValues[2]).toBe(1)
    expect(dataValues[3]).toBe('2026-05-01')
    expect(dataValues[4]).toBe('2026-05-24')
  })

  it('#7 空参数 → WHERE 不渲染 / SQL 不含 WHERE', async () => {
    await listRuns(mockPool, {})
    const [dataSql] = mockQuery.mock.calls[0]
    expect(dataSql).not.toContain('WHERE')
  })

  it('#8 idPrefix 空字符串 → 跳过 / 不进 WHERE', async () => {
    await listRuns(mockPool, { idPrefix: '' })
    const [dataSql] = mockQuery.mock.calls[0]
    expect(dataSql).not.toContain('id::text LIKE')
  })
})

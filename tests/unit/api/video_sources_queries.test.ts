/**
 * tests/unit/api/video_sources_queries.test.ts
 * CHG-SN-5-PRE-01-C：toggleVideoSource 乐观锁 query 层
 *
 * 覆盖：
 *   - 行不存在 / soft-deleted → 返回 null（ROLLBACK）
 *   - 无 expectedUpdatedAt → 直接 UPDATE 成功（ETag 字段无关时向后兼容）
 *   - expectedUpdatedAt 匹配 → UPDATE 成功
 *   - expectedUpdatedAt 不匹配 → 抛 STATE_CONFLICT 409（ROLLBACK，is_active 未变）
 *   - 异常路径 → ROLLBACK + 释放 client
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { toggleVideoSource } from '@/api/db/queries/video_sources'
import { AppError } from '@/api/lib/errors'

interface QueryCall {
  text: string
  values?: unknown[]
}

function makeClient(plan: {
  selectRow?: { id: string; updated_at: string; deleted_at: string | null } | null
  updateRow?: { id: string; is_active: boolean; updated_at: string } | null
}) {
  const calls: QueryCall[] = []
  const query = vi.fn((...args: unknown[]) => {
    const sql = String(args[0] ?? '')
    const values = args[1] as unknown[] | undefined
    calls.push({ text: sql, values })
    if (sql.includes('SELECT id, updated_at, deleted_at')) {
      const row = plan.selectRow
      return Promise.resolve({ rows: row ? [row] : [], rowCount: row ? 1 : 0 })
    }
    if (sql.includes('UPDATE video_sources')) {
      const row = plan.updateRow
      return Promise.resolve({ rows: row ? [row] : [], rowCount: row ? 1 : 0 })
    }
    // BEGIN / COMMIT / ROLLBACK
    return Promise.resolve({ rows: [], rowCount: 0 })
  })
  const release = vi.fn()
  return { client: { query, release }, calls, query, release }
}

function makePool(client: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> }) {
  return {
    connect: vi.fn().mockResolvedValue(client),
  } as unknown as import('pg').Pool
}

describe('toggleVideoSource — 乐观锁 query 层', () => {
  beforeEach(() => vi.clearAllMocks())

  it('行不存在 → 返回 null + ROLLBACK + release', async () => {
    const harness = makeClient({ selectRow: null })
    const pool = makePool(harness.client)
    const result = await toggleVideoSource(pool, { sourceId: 's-missing', isActive: false })
    expect(result).toBeNull()
    expect(harness.calls.map((c) => c.text.match(/^\s*(BEGIN|SELECT|UPDATE|COMMIT|ROLLBACK)/)?.[1])).toEqual([
      'BEGIN',
      'SELECT',
      'ROLLBACK',
    ])
    expect(harness.release).toHaveBeenCalled()
  })

  it('soft-deleted 行 → 返回 null + ROLLBACK', async () => {
    const harness = makeClient({
      selectRow: { id: 's1', updated_at: '2026-05-06T00:00:00Z', deleted_at: '2026-05-06T01:00:00Z' },
    })
    const pool = makePool(harness.client)
    const result = await toggleVideoSource(pool, { sourceId: 's1', isActive: false })
    expect(result).toBeNull()
    const updateCall = harness.calls.find((c) => c.text.includes('UPDATE video_sources'))
    expect(updateCall).toBeUndefined()
  })

  it('无 expectedUpdatedAt → 直接 UPDATE 成功', async () => {
    const harness = makeClient({
      selectRow: { id: 's1', updated_at: '2026-05-06T00:00:00Z', deleted_at: null },
      updateRow: { id: 's1', is_active: false, updated_at: '2026-05-06T00:00:01Z' },
    })
    const pool = makePool(harness.client)
    const result = await toggleVideoSource(pool, { sourceId: 's1', isActive: false })
    expect(result).toEqual({ id: 's1', is_active: false, updated_at: '2026-05-06T00:00:01Z' })
    const ops = harness.calls.map((c) => c.text.match(/^\s*(BEGIN|SELECT|UPDATE|COMMIT|ROLLBACK)/)?.[1])
    expect(ops).toEqual(['BEGIN', 'SELECT', 'UPDATE', 'COMMIT'])
  })

  it('expectedUpdatedAt 匹配 → UPDATE 成功', async () => {
    const harness = makeClient({
      selectRow: { id: 's1', updated_at: '2026-05-06T00:00:00.000Z', deleted_at: null },
      updateRow: { id: 's1', is_active: true, updated_at: '2026-05-06T00:00:01Z' },
    })
    const pool = makePool(harness.client)
    const result = await toggleVideoSource(pool, {
      sourceId: 's1',
      isActive: true,
      expectedUpdatedAt: '2026-05-06T00:00:00Z',
    })
    expect(result?.is_active).toBe(true)
  })

  it('expectedUpdatedAt 不匹配 → 抛 STATE_CONFLICT 409 + ROLLBACK + UPDATE 未触发', async () => {
    const harness = makeClient({
      selectRow: { id: 's1', updated_at: '2026-05-06T00:00:00Z', deleted_at: null },
    })
    const pool = makePool(harness.client)
    await expect(
      toggleVideoSource(pool, {
        sourceId: 's1',
        isActive: false,
        expectedUpdatedAt: '2026-05-05T00:00:00Z', // stale
      }),
    ).rejects.toBeInstanceOf(AppError)
    const ops = harness.calls.map((c) => c.text.match(/^\s*(BEGIN|SELECT|UPDATE|COMMIT|ROLLBACK)/)?.[1])
    expect(ops).toEqual(['BEGIN', 'SELECT', 'ROLLBACK'])
    expect(harness.release).toHaveBeenCalled()
  })

  it('SELECT 阶段抛错 → ROLLBACK + release + 异常透传', async () => {
    const release = vi.fn()
    const query = vi.fn((sql: string) => {
      if (sql === 'BEGIN') return Promise.resolve({ rows: [] })
      if (sql.includes('SELECT')) return Promise.reject(new Error('connection lost'))
      if (sql === 'ROLLBACK') return Promise.resolve({ rows: [] })
      return Promise.resolve({ rows: [] })
    })
    const pool = { connect: vi.fn().mockResolvedValue({ query, release }) } as unknown as import('pg').Pool
    await expect(toggleVideoSource(pool, { sourceId: 's1', isActive: false })).rejects.toThrow('connection lost')
    expect(query).toHaveBeenCalledWith('ROLLBACK')
    expect(release).toHaveBeenCalled()
  })
})

/**
 * users-sort.test.ts — CHG-261
 * 验证 listAdminUsers 服务端排序逻辑（白名单 / 方向回退 / 无效字段回退）
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listAdminUsers } from '@/api/db/queries/users'
import type { Pool } from 'pg'

function makePool(rows: unknown[] = []): Pool {
  return {
    query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }),
  } as unknown as Pool
}

describe('listAdminUsers — server-side sort (CHG-261)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('defaults to created_at DESC when no sortField', async () => {
    const pool = makePool()
    await listAdminUsers(pool, { page: 1, limit: 20 })
    const sql = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(sql).toContain('ORDER BY created_at DESC')
  })

  it('sorts by username ASC when sortField=username&sortDir=asc', async () => {
    const pool = makePool()
    await listAdminUsers(pool, { page: 1, limit: 20, sortField: 'username', sortDir: 'asc' })
    const sql = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(sql).toContain('ORDER BY username ASC')
  })

  it('sorts by email DESC when sortField=email&sortDir=desc', async () => {
    const pool = makePool()
    await listAdminUsers(pool, { page: 1, limit: 20, sortField: 'email', sortDir: 'desc' })
    const sql = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(sql).toContain('ORDER BY email DESC')
  })

  it('maps status column to banned_at', async () => {
    const pool = makePool()
    await listAdminUsers(pool, { page: 1, limit: 20, sortField: 'status', sortDir: 'asc' })
    const sql = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(sql).toContain('ORDER BY banned_at ASC')
  })

  it('falls back to created_at DESC on invalid sortField', async () => {
    const pool = makePool()
    await listAdminUsers(pool, { page: 1, limit: 20, sortField: 'hacked; DROP TABLE', sortDir: 'asc' })
    const sql = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(sql).toContain('ORDER BY created_at DESC')
    expect(sql).not.toContain('hacked')
  })
})

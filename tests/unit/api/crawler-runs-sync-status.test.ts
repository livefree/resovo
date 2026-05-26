/**
 * crawler-runs-sync-status.test.ts — CHG-SN-9-CW1-CW2-HOTFIX-A Step 1
 *
 * 覆盖 `syncRunStatusFromTasks` SQL 形态守卫：
 *   - RETURNING 子查询从 crawler_tasks 取首个 task 的 source_site（修复 commit d2728a30
 *     引入的 `r.site_key` 不存在列回归）
 *   - row 解析仍返回 SyncRunStatusResult.siteKey（非空 / null 两态）
 *
 * Mock 模式参考：crawlerTimeline.test.ts（不 mock queries 模块本身，mock pg Pool）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncRunStatusFromTasks } from '@/api/db/queries/crawlerRuns'
import type { Pool } from 'pg'

const mockQuery = vi.fn()
const mockPool = { query: mockQuery, connect: vi.fn() } as unknown as Pool

beforeEach(() => {
  vi.clearAllMocks()
})

describe('crawlerRuns.syncRunStatusFromTasks — HOTFIX-A Step 1', () => {
  it('#1 SQL RETURNING 不再直接引用 r.site_key（防回归 commit d2728a30）', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await syncRunStatusFromTasks(mockPool, 'run-id-1')
    const [sql] = mockQuery.mock.calls[0] as [string]
    // 修复后：RETURNING 只能引用 crawler_runs 已有列 + 子查询 alias，禁止 r.site_key
    expect(sql).not.toMatch(/RETURNING[^;]*r\.site_key/i)
  })

  it('#2 SQL RETURNING 子查询从 crawler_tasks 取 source_site AS site_key', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await syncRunStatusFromTasks(mockPool, 'run-id-2')
    const [sql] = mockQuery.mock.calls[0] as [string]
    expect(sql).toMatch(/SELECT\s+source_site\s+FROM\s+crawler_tasks/i)
    expect(sql).toMatch(/AS\s+site_key/i)
    // 子查询用 scheduled_at ASC LIMIT 1（首个 task 的 site_key 作为 run 代表）
    expect(sql).toMatch(/ORDER\s+BY\s+scheduled_at\s+ASC\s+LIMIT\s+1/i)
  })

  it('#3 子查询返回有值 → siteKey 非空', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ status: 'success', site_key: 'site-alpha', summary: { total: 3 } }],
    })
    const result = await syncRunStatusFromTasks(mockPool, 'run-id-3')
    expect(result).not.toBeNull()
    expect(result!.siteKey).toBe('site-alpha')
    expect(result!.status).toBe('success')
  })

  it('#4 子查询无匹配 task → siteKey 为 null（无 task 关联的 run 边界）', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ status: 'queued', site_key: null, summary: { total: 0 } }],
    })
    const result = await syncRunStatusFromTasks(mockPool, 'run-id-4')
    expect(result).not.toBeNull()
    expect(result!.siteKey).toBeNull()
  })

  it('#5 run id 不存在 → 返回 null（UPDATE WHERE 0 行）', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const result = await syncRunStatusFromTasks(mockPool, 'nonexistent-run-id')
    expect(result).toBeNull()
  })
})

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

  // ── CHG-SN-9-CW1-CW2-HOTFIX-B Step 1：孤儿 run（0 task）转态 ────────
  it('HOTFIX-B #1 SQL CASE 含 "a.total = 0 AND control_status IN (cancelling, cancelled)" → cancelled', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await syncRunStatusFromTasks(mockPool, 'orphan-run-1')
    const [sql] = mockQuery.mock.calls[0] as [string]
    // 修复后 SQL 必含针对 0-task + cancelling/cancelled 的提前终态化 case
    expect(sql).toMatch(/WHEN\s+a\.total\s*=\s*0\s+AND\s+r\.control_status\s+IN\s*\(\s*'cancelling',\s*'cancelled'\s*\)\s+THEN\s+'cancelled'/i)
  })

  it('HOTFIX-B #2 SQL CASE 含 "a.total = 0 AND control_status IN (pausing, paused)" → paused', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await syncRunStatusFromTasks(mockPool, 'orphan-run-2')
    const [sql] = mockQuery.mock.calls[0] as [string]
    expect(sql).toMatch(/WHEN\s+a\.total\s*=\s*0\s+AND\s+r\.control_status\s+IN\s*\(\s*'pausing',\s*'paused'\s*\)\s+THEN\s+'paused'/i)
  })

  it('HOTFIX-B #3 SQL 保留兜底 "a.total = 0 THEN r.status"（control_status=active 不变）', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await syncRunStatusFromTasks(mockPool, 'orphan-run-3')
    const [sql] = mockQuery.mock.calls[0] as [string]
    // 兜底 case 必须保留（control_status='active' 时维持 r.status，避免误改非 cancel 路径上的 0-task run）
    expect(sql).toMatch(/WHEN\s+a\.total\s*=\s*0\s+THEN\s+r\.status/i)
    // 验证短路顺序：兜底 case 出现在精确 case 之后（PostgreSQL CASE 短路第一个 match）
    const cancellingIdx = sql.search(/WHEN\s+a\.total\s*=\s*0\s+AND\s+r\.control_status\s+IN\s*\(\s*'cancelling'/i)
    const fallbackIdx = sql.search(/WHEN\s+a\.total\s*=\s*0\s+THEN\s+r\.status/i)
    expect(cancellingIdx).toBeGreaterThan(-1)
    expect(fallbackIdx).toBeGreaterThan(cancellingIdx)
  })
})

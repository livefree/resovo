/**
 * tests/unit/api/admin-sources-sql.test.ts — ADMIN-13
 *
 * 直接测 listAdminSources 生成的 SQL，验证站点字段已切到行级
 * `COALESCE(s.source_site_key, v.site_key)`：
 * - filter 条件
 * - ORDER BY（sortField=site_key）
 * - 返回字段 site_key
 *
 * 防止回归到 audit §1.3 A 所述"后台 /admin/sources 仍使用 v.site_key"
 */

import { describe, it, expect, vi } from 'vitest'

describe('listAdminSources — ADMIN-13 行级站点字段切换', () => {
  function makeMockDb() {
    const query = vi.fn<
      (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>
    >()
    // 第 1 次 call = SELECT rows；第 2 次 call = SELECT COUNT
    query.mockResolvedValueOnce({ rows: [] })
    query.mockResolvedValueOnce({ rows: [{ count: '0' }] })
    return { query } as unknown as import('pg').Pool
  }

  it('filter.siteKey 条件使用 COALESCE(s.source_site_key, v.site_key)（不再用 v.site_key = $N）', async () => {
    const { listAdminSources } = await import('@/api/db/queries/sources')
    const db = makeMockDb()

    await listAdminSources(db, {
      siteKey: 'bfzym3u8',
      page: 1,
      limit: 20,
    })

    const query = (db as unknown as { query: ReturnType<typeof vi.fn> }).query
    const countCall = query.mock.calls.find(
      (c: unknown[]) =>
        typeof c[0] === 'string' &&
        (c[0] as string).toUpperCase().includes('SELECT COUNT'),
    )
    expect(countCall).toBeTruthy()
    const countSql = countCall![0] as string
    expect(countSql).toContain('COALESCE(s.source_site_key, v.site_key) = $')
    // 绝不能再用纯 v.site_key = $N 作为 filter
    expect(countSql).not.toMatch(/v\.site_key\s*=\s*\$\d+/)
  })

  it('sortField=site_key 时 ORDER BY 使用 COALESCE（不再按 v.site_key 单列排序）', async () => {
    const { listAdminSources } = await import('@/api/db/queries/sources')
    const db = makeMockDb()

    await listAdminSources(db, {
      sortField: 'site_key',
      sortDir: 'asc',
      page: 1,
      limit: 20,
    })

    const query = (db as unknown as { query: ReturnType<typeof vi.fn> }).query
    const rowsCall = query.mock.calls.find(
      (c: unknown[]) =>
        typeof c[0] === 'string' &&
        (c[0] as string).toUpperCase().includes('ORDER BY'),
    )
    expect(rowsCall).toBeTruthy()
    const rowsSql = rowsCall![0] as string
    expect(rowsSql).toMatch(/ORDER BY COALESCE\(s\.source_site_key, v\.site_key\)\s+ASC/)
  })

  it('SELECT 返回字段 site_key 为 COALESCE(s.source_site_key, v.site_key)（审核区消费行级站点）', async () => {
    const { listAdminSources } = await import('@/api/db/queries/sources')
    const db = makeMockDb()

    await listAdminSources(db, { page: 1, limit: 20 })

    const query = (db as unknown as { query: ReturnType<typeof vi.fn> }).query
    const rowsCall = query.mock.calls.find(
      (c: unknown[]) =>
        typeof c[0] === 'string' &&
        (c[0] as string).toUpperCase().includes('FROM VIDEO_SOURCES'),
    )
    expect(rowsCall).toBeTruthy()
    const rowsSql = rowsCall![0] as string
    expect(rowsSql).toContain('COALESCE(s.source_site_key, v.site_key) AS site_key')
    // 绝不能保留老式返回 v.site_key AS site_key
    expect(rowsSql).not.toMatch(/v\.site_key\s+AS\s+site_key/i)
  })
})

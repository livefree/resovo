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

  // ── CHG-368-B-FOLLOWUP-CONTENT-SOURCE-ROW ─────────────────────────────────

  it('SELECT LEFT JOIN source_line_aliases (source_site_key, source_name) PK 复合匹配（透传 codename 到 LinesPanel）', async () => {
    const { listAdminSources } = await import('@/api/db/queries/sources')
    const db = makeMockDb()

    await listAdminSources(db, { page: 1, limit: 20 })

    const query = (db as unknown as { query: ReturnType<typeof vi.fn> }).query
    const rowsCall = query.mock.calls.find(
      (c: unknown[]) =>
        typeof c[0] === 'string' &&
        (c[0] as string).toUpperCase().includes('FROM VIDEO_SOURCES'),
    )
    const rowsSql = rowsCall![0] as string
    // LEFT JOIN 复合 PK 匹配（避免笛卡尔积 / 索引设计 4 步核验步 3-4 driving 列 = (site_key, source_name) PK）
    expect(rowsSql).toMatch(/LEFT JOIN source_line_aliases sla[\s\S]*?ON s\.source_site_key = sla\.source_site_key[\s\S]*?AND s\.source_name = sla\.source_name/)
    // SELECT 返回 codename + retired_at（让 ContentSourceRow 携带 Layer B 字段到 LinesPanel）
    expect(rowsSql).toContain('sla.codename AS codename')
    expect(rowsSql).toContain('sla.retired_at AS retired_at')
  })

  it('LEFT JOIN source_line_aliases 不加 retired_at IS NULL 谓词（需透传 retired 状态到 UI / 不能过滤已退役行）', async () => {
    const { listAdminSources } = await import('@/api/db/queries/sources')
    const db = makeMockDb()

    await listAdminSources(db, { page: 1, limit: 20 })

    const query = (db as unknown as { query: ReturnType<typeof vi.fn> }).query
    const rowsCall = query.mock.calls.find(
      (c: unknown[]) =>
        typeof c[0] === 'string' &&
        (c[0] as string).toUpperCase().includes('LEFT JOIN SOURCE_LINE_ALIASES'),
    )
    const rowsSql = rowsCall![0] as string
    // JOIN ON 子句不含 sla.retired_at IS NULL（让 retired_at 透传到 SELECT / UI 决定显示 opacity）
    // 注意：本路径与 sources-matrix.ts findActiveSourcesWithSignalsByVideoId 路径设计目的不同
    //   - 该路径过滤"在役行"用于前台 effective_score 排序（需 sla.retired_at IS NULL）
    //   - 本 listAdminSources 用于后台审核 UI 展示退役状态（不能过滤）
    const joinSection = rowsSql.match(/LEFT JOIN source_line_aliases[\s\S]*?WHERE/)?.[0] ?? ''
    expect(joinSection).not.toMatch(/sla\.retired_at\s+IS\s+NULL/i)
  })
})

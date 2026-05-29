/**
 * admin-source-lines-view.test.ts — CHG-SN-9-LINES-VIEW-UNIFY
 *
 * 直接测 listAllSourceLines 生成的 SQL，验证：
 *   - FROM video_sources LEFT JOIN source_line_aliases（不是反过来 / 防漏 unassigned 行）
 *   - JOIN ON (source_site_key, source_name) 复合 PK 匹配
 *   - SELECT 含 sla.display_name / codename / priority / retired_at / auto_retired / updated_at
 *   - 聚合 video_count / active_count / episode_count
 *   - WHERE vs.deleted_at IS NULL + source_site_key IS NOT NULL
 */
import { describe, it, expect, vi } from 'vitest'

describe('listAllSourceLines — CHG-SN-9-LINES-VIEW-UNIFY SQL contract', () => {
  function makeMockDb() {
    const query = vi.fn<
      (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>
    >()
    query.mockResolvedValue({ rows: [] })
    return { query } as unknown as import('pg').Pool
  }

  it('SQL FROM video_sources LEFT JOIN source_line_aliases（含 unassigned 行）', async () => {
    const { listAllSourceLines } = await import('@/api/db/queries/sources-matrix')
    const db = makeMockDb()
    await listAllSourceLines(db)

    const query = (db as unknown as { query: ReturnType<typeof vi.fn> }).query
    const sql = query.mock.calls[0][0] as string

    expect(sql).toMatch(/FROM video_sources vs/)
    expect(sql).toMatch(/LEFT JOIN source_line_aliases sla/)
    // JOIN ON 复合 PK
    expect(sql).toMatch(/ON vs\.source_site_key = sla\.source_site_key/)
    expect(sql).toMatch(/AND vs\.source_name = sla\.source_name/)
  })

  it('SELECT 含 sla.* alias 字段（display_name / codename / priority / retired_at / auto_retired / updated_at）', async () => {
    const { listAllSourceLines } = await import('@/api/db/queries/sources-matrix')
    const db = makeMockDb()
    await listAllSourceLines(db)

    const sql = (db as unknown as { query: ReturnType<typeof vi.fn> }).query.mock.calls[0][0] as string
    expect(sql).toContain('sla.display_name')
    expect(sql).toContain('sla.codename')
    expect(sql).toContain('sla.priority')
    expect(sql).toContain('sla.retired_at')
    expect(sql).toContain('sla.auto_retired')
    expect(sql).toContain('sla.updated_at AS sla_updated_at')
  })

  it('SELECT 含聚合 video_count / active_count / episode_count', async () => {
    const { listAllSourceLines } = await import('@/api/db/queries/sources-matrix')
    const db = makeMockDb()
    await listAllSourceLines(db)

    const sql = (db as unknown as { query: ReturnType<typeof vi.fn> }).query.mock.calls[0][0] as string
    expect(sql).toMatch(/COUNT\(DISTINCT vs\.video_id\)::TEXT AS video_count/)
    expect(sql).toMatch(/COUNT\(\*\) FILTER \(WHERE vs\.is_active = true\)::TEXT AS active_count/)
    expect(sql).toMatch(/COUNT\(\*\)::TEXT AS episode_count/)
  })

  it('WHERE vs.deleted_at IS NULL + source_site_key IS NOT NULL（软删 + 防空 site_key 行）', async () => {
    const { listAllSourceLines } = await import('@/api/db/queries/sources-matrix')
    const db = makeMockDb()
    await listAllSourceLines(db)

    const sql = (db as unknown as { query: ReturnType<typeof vi.fn> }).query.mock.calls[0][0] as string
    expect(sql).toContain('vs.deleted_at IS NULL')
    expect(sql).toContain('vs.source_site_key IS NOT NULL')
  })

  it('GROUP BY 含 vs.source_site_key + vs.source_name + sla.* 全字段', async () => {
    const { listAllSourceLines } = await import('@/api/db/queries/sources-matrix')
    const db = makeMockDb()
    await listAllSourceLines(db)

    const sql = (db as unknown as { query: ReturnType<typeof vi.fn> }).query.mock.calls[0][0] as string
    expect(sql).toMatch(/GROUP BY[\s\S]*vs\.source_site_key/)
    expect(sql).toMatch(/GROUP BY[\s\S]*vs\.source_name/)
    expect(sql).toMatch(/GROUP BY[\s\S]*sla\.display_name/)
    expect(sql).toMatch(/GROUP BY[\s\S]*sla\.codename/)
    expect(sql).toMatch(/GROUP BY[\s\S]*sla\.retired_at/)
  })

  it('row mapping：未分配行 displayName fallback 到 source_name / priority=0 / autoRetired=false / assignedAt=null', async () => {
    const { listAllSourceLines } = await import('@/api/db/queries/sources-matrix')
    const db = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            // unassigned 行（sla LEFT JOIN 无匹配 / 所有 sla.* 为 null）
            source_site_key: 'site_a',
            source_name: 'lineA',
            display_name: null,
            codename: null,
            priority: null,
            retired_at: null,
            auto_retired: null,
            sla_updated_at: null,
            video_count: '5',
            active_count: '12',
            episode_count: '15',
          },
        ],
      }),
    } as unknown as import('pg').Pool

    const result = await listAllSourceLines(db)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      sourceSiteKey: 'site_a',
      sourceName: 'lineA',
      displayName: 'lineA',  // fallback 到 source_name
      codename: null,
      priority: 0,            // 未分配时 0
      retiredAt: null,
      autoRetired: false,     // 未分配时 false
      assignedAt: null,       // 用于 UI 区分 unassigned
      videoCount: 5,
      activeCount: 12,
      episodeCount: 15,
    })
  })

  it('row mapping：已分配行字段全透传', async () => {
    const { listAllSourceLines } = await import('@/api/db/queries/sources-matrix')
    const db = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            source_site_key: 'site_b',
            source_name: 'lineB',
            display_name: '泰山线路',
            codename: '泰山-2',
            priority: 75,
            retired_at: null,
            auto_retired: false,
            sla_updated_at: '2026-05-28T00:00:00Z',
            video_count: '10',
            active_count: '20',
            episode_count: '30',
          },
        ],
      }),
    } as unknown as import('pg').Pool

    const result = await listAllSourceLines(db)
    expect(result[0]).toMatchObject({
      displayName: '泰山线路',
      codename: '泰山-2',
      priority: 75,
      autoRetired: false,
      assignedAt: '2026-05-28T00:00:00Z',
    })
  })
})

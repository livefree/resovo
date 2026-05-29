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

  // FIX-3：FULL OUTER JOIN 范式（防 alias-only 孤儿行消失）

  it('SQL FULL OUTER JOIN：vs_agg subquery + source_line_aliases（保 alias-only 行 / Codex 3rd FIX）', async () => {
    const { listAllSourceLines } = await import('@/api/db/queries/sources-matrix')
    const db = makeMockDb()
    await listAllSourceLines(db)

    const query = (db as unknown as { query: ReturnType<typeof vi.fn> }).query
    const sql = query.mock.calls[0][0] as string

    expect(sql).toMatch(/FROM\s*\([\s\S]*?\)\s*vs_agg/)  // subquery aliased vs_agg
    expect(sql).toMatch(/FULL OUTER JOIN source_line_aliases sla/)
    expect(sql).toMatch(/ON vs_agg\.source_site_key = sla\.source_site_key/)
    expect(sql).toMatch(/AND vs_agg\.source_name = sla\.source_name/)
    // 防回归到旧 LEFT JOIN 范式
    expect(sql).not.toMatch(/FROM video_sources vs\s+LEFT JOIN source_line_aliases/)
  })

  it('SELECT COALESCE 处理 alias-only 行的 site_key/source_name + 0 默认值', async () => {
    const { listAllSourceLines } = await import('@/api/db/queries/sources-matrix')
    const db = makeMockDb()
    await listAllSourceLines(db)

    const sql = (db as unknown as { query: ReturnType<typeof vi.fn> }).query.mock.calls[0][0] as string
    expect(sql).toMatch(/COALESCE\(vs_agg\.source_site_key, sla\.source_site_key\) AS source_site_key/)
    expect(sql).toMatch(/COALESCE\(vs_agg\.source_name, sla\.source_name\) AS source_name/)
    expect(sql).toMatch(/COALESCE\(vs_agg\.video_count, '0'\) AS video_count/)
    expect(sql).toMatch(/COALESCE\(vs_agg\.active_count, '0'\) AS active_count/)
    expect(sql).toMatch(/COALESCE\(vs_agg\.episode_count, '0'\) AS episode_count/)
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

  it('vs_agg subquery 含聚合 video_count / active_count / episode_count + WHERE deleted_at + site_key IS NOT NULL', async () => {
    const { listAllSourceLines } = await import('@/api/db/queries/sources-matrix')
    const db = makeMockDb()
    await listAllSourceLines(db)

    const sql = (db as unknown as { query: ReturnType<typeof vi.fn> }).query.mock.calls[0][0] as string
    expect(sql).toMatch(/COUNT\(DISTINCT video_id\)::TEXT AS video_count/)
    expect(sql).toMatch(/COUNT\(\*\) FILTER \(WHERE is_active = true\)::TEXT AS active_count/)
    expect(sql).toMatch(/COUNT\(\*\)::TEXT AS episode_count/)
    expect(sql).toContain('deleted_at IS NULL')
    expect(sql).toContain('source_site_key IS NOT NULL')
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

  it('row mapping：alias-only 孤儿行（FIX-3 / 退役 / cooling）→ videoCount=0 + assignedAt 非 null（Codex 3rd FIX）', async () => {
    const { listAllSourceLines } = await import('@/api/db/queries/sources-matrix')
    const db = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            // alias-only 行：vs_agg.* 全 null（COALESCE 兜底）+ sla 退役行存在
            source_site_key: 'site_b',
            source_name: 'lineB-retired',
            display_name: '已退役线路',
            codename: '泰山-2',
            priority: 50,
            retired_at: '2026-04-01T00:00:00Z',
            auto_retired: false,
            sla_updated_at: '2026-04-01T00:00:00Z',
            video_count: '0',
            active_count: '0',
            episode_count: '0',
          },
        ],
      }),
    } as unknown as import('pg').Pool

    const result = await listAllSourceLines(db)
    expect(result[0]).toEqual({
      sourceSiteKey: 'site_b',
      sourceName: 'lineB-retired',
      displayName: '已退役线路',
      codename: '泰山-2',
      priority: 50,
      retiredAt: '2026-04-01T00:00:00Z',
      autoRetired: false,
      assignedAt: '2026-04-01T00:00:00Z',
      videoCount: 0,    // 孤儿 / 无关联视频
      activeCount: 0,
      episodeCount: 0,
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

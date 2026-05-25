/**
 * sources-matrix.test.ts — CHG-SN-5-11
 *
 * 覆盖：
 *   - getVideoGroupStats: 统计聚合
 *   - listVideoGroups: 分页 + segment 过滤 + keyword 过滤
 *   - getVideoMatrix: 线路×集数矩阵 + 别名合并
 *   - listLineAliases: 返回全列表
 *   - upsertLineAlias: INSERT ON CONFLICT DO UPDATE
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'
import {
  getVideoGroupStats,
  listVideoGroups,
  getVideoMatrix,
  listLineAliases,
  upsertLineAlias,
} from '@/api/db/queries/sources-matrix'

// ── Mock pool ─────────────────────────────────────────────────────

function makePool(rows: Record<string, unknown>[], rowsB?: Record<string, unknown>[]): Pool {
  let callCount = 0
  return {
    query: vi.fn().mockImplementation(() => {
      callCount++
      const isSecond = callCount === 2
      return Promise.resolve({ rows: isSecond && rowsB !== undefined ? rowsB : rows })
    }),
  } as unknown as Pool
}

// ── getVideoGroupStats ────────────────────────────────────────────

describe('getVideoGroupStats', () => {
  it('converts string counts to numbers', async () => {
    const db = makePool([{ total: '50', active: '30', dead: '10', orphan: '5' }])
    const stats = await getVideoGroupStats(db)
    expect(stats.total).toBe(50)
    expect(stats.active).toBe(30)
    expect(stats.dead).toBe(10)
    expect(stats.orphan).toBe(5)
  })

  it('returns zeros when no rows returned', async () => {
    const db = makePool([{}])
    const stats = await getVideoGroupStats(db)
    expect(stats.total).toBe(0)
    expect(stats.active).toBe(0)
    expect(stats.dead).toBe(0)
    expect(stats.orphan).toBe(0)
  })
})

// ── listVideoGroups ───────────────────────────────────────────────

describe('listVideoGroups', () => {
  const VIDEO_ROW = {
    video_id: 'v1',
    title: '测试视频',
    short_id: 'abc',
    type: 'series',
    year: 2024,
    cover_url: null,
    line_count: '2',
    source_count: '5',
    probe_status: 'ok,ok',
    render_status: 'partial',
    updated_at: '2026-01-01T00:00:00Z',
  }

  // CHG-SN-5-11-PATCH-2 P0-2：queries 层不再 aggregate，返回 raw status 数组；
  // aggregateSignal 业务逻辑由 Service 层执行（sources-matrix-service.test.ts 覆盖）。

  it('returns paginated raw data with default params', async () => {
    const db = makePool([{ cnt: '1' }], [VIDEO_ROW])
    const result = await listVideoGroups(db, {})
    expect(result.total).toBe(1)
    expect(result.page).toBe(1)
    expect(result.limit).toBe(20)
    expect(result.data).toHaveLength(1)
    expect(result.data[0].videoId).toBe('v1')
    expect(result.data[0].lineCount).toBe(2)
    expect(result.data[0].sourceCount).toBe(5)
  })

  it('splits comma-joined probe_status into raw array (queries 层不 aggregate)', async () => {
    const db = makePool([{ cnt: '1' }], [{ ...VIDEO_ROW, probe_status: 'ok,dead,partial', render_status: 'ok' }])
    const result = await listVideoGroups(db, {})
    expect(result.data[0].probeStatuses).toEqual(['ok', 'dead', 'partial'])
    expect(result.data[0].renderStatuses).toEqual(['ok'])
  })

  it('empty probe_status → empty raw array', async () => {
    const db = makePool([{ cnt: '1' }], [{ ...VIDEO_ROW, probe_status: '', render_status: '' }])
    const result = await listVideoGroups(db, {})
    expect(result.data[0].probeStatuses).toEqual([])
    expect(result.data[0].renderStatuses).toEqual([])
  })

  it('respects page + limit params', async () => {
    const db = makePool([{ cnt: '100' }], [])
    const result = await listVideoGroups(db, { page: 3, limit: 10 })
    expect(result.page).toBe(3)
    expect(result.limit).toBe(10)
    expect(result.total).toBe(100)
  })

  it('clamps limit to 1–100', async () => {
    const db = makePool([{ cnt: '0' }], [])
    const result = await listVideoGroups(db, { limit: 9999 })
    expect(result.limit).toBe(100)
    const db2 = makePool([{ cnt: '0' }], [])
    const result2 = await listVideoGroups(db2, { limit: 0 })
    expect(result2.limit).toBe(1)
  })

  it('returns empty data when count is zero', async () => {
    const db = makePool([{ cnt: '0' }], [])
    const result = await listVideoGroups(db, {})
    expect(result.total).toBe(0)
    expect(result.data).toHaveLength(0)
  })

  // HOTFIX-PATCH-2A §1-BUG-1（2026-05-25）：sortField + sortDir SQL ORDER BY 透传单测
  it('sortField=video sortDir=asc → ORDER BY v.title ASC', async () => {
    const db = makePool([{ cnt: '0' }], [])
    await listVideoGroups(db, { sortField: 'video', sortDir: 'asc' })
    const dataCall = (db.query as ReturnType<typeof vi.fn>).mock.calls[1]
    expect(dataCall[0]).toContain('ORDER BY v.title ASC')
  })

  it('sortField=lineCount sortDir=desc → ORDER BY line_count DESC', async () => {
    const db = makePool([{ cnt: '0' }], [])
    await listVideoGroups(db, { sortField: 'lineCount', sortDir: 'desc' })
    const dataCall = (db.query as ReturnType<typeof vi.fn>).mock.calls[1]
    expect(dataCall[0]).toContain('ORDER BY line_count DESC')
  })

  it('sortField=sourceCount → ORDER BY source_count', async () => {
    const db = makePool([{ cnt: '0' }], [])
    await listVideoGroups(db, { sortField: 'sourceCount', sortDir: 'asc' })
    const dataCall = (db.query as ReturnType<typeof vi.fn>).mock.calls[1]
    expect(dataCall[0]).toContain('ORDER BY source_count ASC')
  })

  it('未传 sortField → fallback ORDER BY MAX(vs.updated_at) DESC', async () => {
    const db = makePool([{ cnt: '0' }], [])
    await listVideoGroups(db, {})
    const dataCall = (db.query as ReturnType<typeof vi.fn>).mock.calls[1]
    expect(dataCall[0]).toContain('ORDER BY MAX(vs.updated_at) DESC')
  })

  // HOTFIX-PATCH-2A §2-EXT-1/2（2026-05-25）：probeStatus / renderStatus enum filter SQL 透传
  it('probeStatus=[ok,dead] → 注入 EXISTS ANY($::TEXT[])', async () => {
    const db = makePool([{ cnt: '0' }], [])
    await listVideoGroups(db, { probeStatus: ['ok', 'dead'] })
    const countCall = (db.query as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(countCall[0]).toContain('vs3.probe_status = ANY(')
    expect(countCall[1]).toContainEqual(['ok', 'dead'])
  })

  it('renderStatus=[partial] → 注入 EXISTS ANY($::TEXT[])', async () => {
    const db = makePool([{ cnt: '0' }], [])
    await listVideoGroups(db, { renderStatus: ['partial'] })
    const dataCall = (db.query as ReturnType<typeof vi.fn>).mock.calls[1]
    expect(dataCall[0]).toContain('vs4.render_status = ANY(')
    expect(dataCall[1]).toContainEqual(['partial'])
  })

  it('空数组 probeStatus → 不注入 WHERE', async () => {
    const db = makePool([{ cnt: '0' }], [])
    await listVideoGroups(db, { probeStatus: [] })
    const dataCall = (db.query as ReturnType<typeof vi.fn>).mock.calls[1]
    expect(dataCall[0]).not.toContain('vs3.probe_status')
  })

  // HOTFIX-PATCH-2A §1-BUG-3（2026-05-25）：updatedAt 日期范围 HAVING 子句
  it('updatedAtFrom + updatedAtTo → HAVING MAX(vs.updated_at) 范围（含到日 +1 天）', async () => {
    const db = makePool([{ cnt: '0' }], [])
    await listVideoGroups(db, { updatedAtFrom: '2026-05-01', updatedAtTo: '2026-05-25' })
    const countCall = (db.query as ReturnType<typeof vi.fn>).mock.calls[0]
    // count 走嵌套子查询（HAVING 路径）
    expect(countCall[0]).toContain('SELECT v.id FROM videos v')
    expect(countCall[0]).toContain('HAVING')
    expect(countCall[0]).toContain('MAX(vs.updated_at) >= $')
    expect(countCall[0]).toContain("MAX(vs.updated_at) < ($")
    expect(countCall[0]).toContain("INTERVAL '1 day'")
    expect(countCall[1]).toContain('2026-05-01')
    expect(countCall[1]).toContain('2026-05-25')
  })

  it('无 updatedAt range → count 保留 COUNT(DISTINCT v.id) 原路径（性能优势）', async () => {
    const db = makePool([{ cnt: '0' }], [])
    await listVideoGroups(db, {})
    const countCall = (db.query as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(countCall[0]).toContain('SELECT COUNT(DISTINCT v.id)')
    expect(countCall[0]).not.toContain('HAVING')
  })

  // HOTFIX-PATCH-2B（2026-05-25）：siteKey 数组 ANY() SQL 透传单测
  it('siteKey=[bilibili,youku] → EXISTS ANY($::TEXT[])', async () => {
    const db = makePool([{ cnt: '0' }], [])
    await listVideoGroups(db, { siteKey: ['bilibili', 'youku'] })
    const countCall = (db.query as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(countCall[0]).toContain('COALESCE(vs2.source_site_key, v.site_key) = ANY(')
    expect(countCall[1]).toContainEqual(['bilibili', 'youku'])
  })

  it('空数组 siteKey → 不注入 EXISTS', async () => {
    const db = makePool([{ cnt: '0' }], [])
    await listVideoGroups(db, { siteKey: [] })
    const dataCall = (db.query as ReturnType<typeof vi.fn>).mock.calls[1]
    expect(dataCall[0]).not.toContain('vs2.source_site_key')
  })
})

// ── getVideoMatrix ────────────────────────────────────────────────

describe('getVideoMatrix', () => {
  it('groups episodes by line key', async () => {
    const db = makePool([
      {
        episode_number: 1,
        source_id: 's1',
        source_url: 'https://example.com/1',
        probe_status: 'ok',
        render_status: 'ok',
        is_active: true,
        source_site_key: 'bilibili',
        source_name: '线路1',
        display_name: null,
      },
      {
        episode_number: 2,
        source_id: 's2',
        source_url: 'https://example.com/2',
        probe_status: 'dead',
        render_status: 'dead',
        is_active: false,
        source_site_key: 'bilibili',
        source_name: '线路1',
        display_name: '哔哩哔哩主线',
      },
      {
        episode_number: 1,
        source_id: 's3',
        source_url: 'https://youku.com/1',
        probe_status: 'ok',
        render_status: 'partial',
        is_active: true,
        source_site_key: 'youku',
        source_name: '线路2',
        display_name: null,
      },
    ])
    const lines = await getVideoMatrix(db, 'v1')
    expect(lines).toHaveLength(2)

    const bilibili = lines.find((l) => l.sourceSiteKey === 'bilibili')
    expect(bilibili?.sourceName).toBe('线路1')
    expect(bilibili?.displayName).toBe('哔哩哔哩主线')
    expect(bilibili?.episodes).toHaveLength(2)

    const youku = lines.find((l) => l.sourceSiteKey === 'youku')
    expect(youku?.sourceName).toBe('线路2')
    expect(youku?.episodes).toHaveLength(1)
    expect(youku?.episodes[0].renderStatus).toBe('partial')
  })

  it('returns empty array when no sources', async () => {
    const db = makePool([])
    const lines = await getVideoMatrix(db, 'v1')
    expect(lines).toHaveLength(0)
  })
})

// ── listLineAliases ───────────────────────────────────────────────

describe('listLineAliases', () => {
  it('maps DB rows to SourceLineAlias objects', async () => {
    const db = makePool([
      { source_site_key: 'bilibili', source_name: '线路1', display_name: '哔哩主线', updated_at: '2026-01-01T00:00:00Z' },
      { source_site_key: 'youku',    source_name: '线路2', display_name: '优酷备用', updated_at: '2026-01-02T00:00:00Z' },
    ])
    const aliases = await listLineAliases(db)
    expect(aliases).toHaveLength(2)
    expect(aliases[0].sourceSiteKey).toBe('bilibili')
    expect(aliases[0].displayName).toBe('哔哩主线')
    expect(aliases[1].sourceName).toBe('线路2')
  })

  it('returns empty array when no aliases', async () => {
    const db = makePool([])
    const aliases = await listLineAliases(db)
    expect(aliases).toHaveLength(0)
  })
})

// ── upsertLineAlias ───────────────────────────────────────────────

describe('upsertLineAlias', () => {
  it('executes upsert and returns saved alias', async () => {
    const returnRow = {
      source_site_key: 'bilibili',
      source_name: '线路1',
      display_name: '哔哩哔哩主线',
      updated_at: '2026-05-12T00:00:00Z',
    }
    const db = makePool([returnRow])
    const result = await upsertLineAlias(db, 'bilibili', '线路1', '哔哩哔哩主线', 'actor-uuid')
    expect(result.sourceSiteKey).toBe('bilibili')
    expect(result.sourceName).toBe('线路1')
    expect(result.displayName).toBe('哔哩哔哩主线')
    expect(result.updatedAt).toBe('2026-05-12T00:00:00Z')

    const mockQuery = db.query as ReturnType<typeof vi.fn>
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain('ON CONFLICT')
    expect(params[0]).toBe('bilibili')
    expect(params[1]).toBe('线路1')
    expect(params[2]).toBe('哔哩哔哩主线')
    expect(params[3]).toBe('actor-uuid')
  })
})

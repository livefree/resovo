/**
 * sources-matrix.test.ts — CHG-SN-5-11
 *
 * 覆盖：
 *   - getVideoGroupStats: 统计聚合
 *   - listVideoGroups: 分页 + quickFilters/lowQuality 过滤 + keyword 过滤（CHG-VSR-5-B：segment 已删）
 *   - getVideoMatrix: 线路×集数矩阵 + 别名合并
 *   - listLineAliases: 返回全列表
 *   - upsertLineAlias: INSERT ON CONFLICT DO UPDATE
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'
// CHG-VSR-3 / ADR-117 AMENDMENT 3（D-117-VSR3-7）：queries 拆 4 文件，import 路径同步迁移
import {
  getVideoGroupStats,
  listVideoGroups,
} from '@/api/db/queries/sources-matrix'
import { getVideoMatrix } from '@/api/db/queries/video-matrix'
import {
  listLineAliases,
  upsertLineAlias,
} from '@/api/db/queries/source-line-aliases'

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
    // HOTFIX-PATCH-2B-FIX1（2026-05-25）：cell 显示该行跨的站点列表
    site_keys: 'bilibili,youku',
    // CHG-VSR-3 派生列（bigint COUNT 经 node-pg 回传为 string / 布尔/浮点原样）
    active_source_count: '3',
    disabled_count: '2',
    connect_fail_count: '1',
    render_fail_count: '0',
    pending_probe_count: '1',
    quality_coverage: 0.8,
    latency_median_ms: 150.5,
    quality_highest: '1080P',
    needs_source: false,
    is_published: true,
    last_checked_at: '2026-01-02T00:00:00Z',
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

  // HOTFIX-PATCH-2B-FIX1（2026-05-25）：siteKeys cell 显示字段派生
  it('site_keys SQL STRING_AGG → siteKeys 数组派生（升序去重）', async () => {
    const db = makePool([{ cnt: '1' }], [{ ...VIDEO_ROW, site_keys: 'bilibili,iqiyi,youku' }])
    const result = await listVideoGroups(db, {})
    expect(result.data[0].siteKeys).toEqual(['bilibili', 'iqiyi', 'youku'])
  })

  it('null site_keys → 空 siteKeys 数组', async () => {
    const db = makePool([{ cnt: '1' }], [{ ...VIDEO_ROW, site_keys: null }])
    const result = await listVideoGroups(db, {})
    expect(result.data[0].siteKeys).toEqual([])
  })

  it('SQL SELECT 包含 STRING_AGG DISTINCT site_keys（含 COALESCE 双源）', async () => {
    const db = makePool([{ cnt: '0' }], [])
    await listVideoGroups(db, {})
    const dataCall = (db.query as ReturnType<typeof vi.fn>).mock.calls[1]
    expect(dataCall[0]).toContain('STRING_AGG(DISTINCT COALESCE(vs.source_site_key, v.site_key)')
    expect(dataCall[0]).toContain('AS site_keys')
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
  it('executes upsert and returns saved alias (CHG-368-B-A2a: wrapper 委派到 upsertLineAliasFull / params 顺序变更)', async () => {
    const returnRow = {
      source_site_key: 'bilibili',
      source_name: '线路1',
      display_name: '哔哩哔哩主线',
      codename: null,
      priority: 0,
      retired_at: null,
      auto_retired: false,
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
    // -A2a 新 params 顺序：[siteKey, name, displayName, codename, priority, updatedBy, codenameProvided, priorityProvided]
    expect(params[0]).toBe('bilibili')
    expect(params[1]).toBe('线路1')
    expect(params[2]).toBe('哔哩哔哩主线')
    expect(params[3]).toBeNull()           // codename 未提供
    expect(params[4]).toBeNull()           // priority 未提供
    expect(params[5]).toBe('actor-uuid')   // updatedBy 位置变更
    expect(params[6]).toBe(false)          // codenameProvided flag
    expect(params[7]).toBe(false)          // priorityProvided flag
  })
})

// ── CHG-VSR-3 / ADR-117 AMENDMENT 3：派生列 + KPI② + quickFilters + sortField ──

describe('CHG-VSR-3 listVideoGroups 派生列（D-117-VSR3-1..3）', () => {
  const VIDEO_ROW = {
    video_id: 'v1', title: 't', short_id: 'abc', type: 'series', year: 2024, cover_url: null,
    line_count: '2', source_count: '5', probe_status: 'ok', render_status: 'ok',
    updated_at: '2026-01-01T00:00:00Z', site_keys: 'bilibili',
    active_source_count: '3', disabled_count: '2', connect_fail_count: '1',
    render_fail_count: '0', pending_probe_count: '1', quality_coverage: 0.8,
    latency_median_ms: 150.5, quality_highest: '1080P', needs_source: false,
    is_published: true, last_checked_at: '2026-01-02T00:00:00Z',
  }

  it('派生列映射：active/disabled/connect_fail/render_fail/pending + 质量 + 覆盖率 + 延迟中位 + needs_source', async () => {
    const db = makePool([{ cnt: '1' }], [VIDEO_ROW])
    const r = (await listVideoGroups(db, {})).data[0]
    expect(r.activeSourceCount).toBe(3)
    expect(r.disabledCount).toBe(2)
    expect(r.connectFailCount).toBe(1)
    expect(r.renderFailCount).toBe(0)
    expect(r.pendingProbeCount).toBe(1)
    expect(r.qualityCoverage).toBeCloseTo(0.8)
    expect(r.latencyMedianMs).toBe(151) // Math.round(150.5)
    expect(r.qualityHighest).toBe('1080P')
    expect(r.needsSource).toBe(false)
    expect(r.isPublished).toBe(true)
    expect(r.lastCheckedAt).toBe('2026-01-02T00:00:00Z')
  })

  it('quality_highest=null → 质量未知（不并入低质量）', async () => {
    const db = makePool([{ cnt: '1' }], [{ ...VIDEO_ROW, quality_highest: null, latency_median_ms: null }])
    const r = (await listVideoGroups(db, {})).data[0]
    expect(r.qualityHighest).toBeNull()
    expect(r.latencyMedianMs).toBeNull()
  })

  it('SQL SELECT 含派生 FILTER + percentile_cont 覆盖率 + 质量 CASE（COALESCE 回退口径）+ is_published GROUP BY', async () => {
    const db = makePool([{ cnt: '0' }], [])
    await listVideoGroups(db, {})
    const sql = (db.query as ReturnType<typeof vi.fn>).mock.calls[1][0] as string
    expect(sql).toContain('FILTER (WHERE vs.is_active = true) AS active_source_count')
    expect(sql).toContain('FILTER (WHERE vs.is_active = false) AS disabled_count')
    expect(sql).toContain("FILTER (WHERE vs.probe_status = 'dead') AS connect_fail_count")
    expect(sql).toContain("FILTER (WHERE vs.render_status = 'dead') AS render_fail_count")
    expect(sql).toContain("FILTER (WHERE vs.probe_status = 'pending') AS pending_probe_count")
    expect(sql).toContain('percentile_cont(0.5) WITHIN GROUP (ORDER BY vs.latency_ms)')
    expect(sql).toContain('FILTER (WHERE vs.quality_detected IS NOT NULL)')
    // QUALITY_RANK_EXPR 回退口径：COALESCE(quality_detected, quality)（勿照搬 pickHighestQuality）
    expect(sql).toContain('COALESCE(vs.quality_detected, vs.quality)')
    expect(sql).toContain('AS quality_highest')
    expect(sql).toContain('AS needs_source')
    expect(sql).toContain('GROUP BY v.id, mc.year, mc.cover_url, v.is_published')
  })
})

describe('CHG-VSR-3 listVideoGroups quickFilters（D-117-VSR3-5 / WHERE EXISTS）', () => {
  const sqlOf = (db: Pool, callIdx: number) =>
    (db.query as ReturnType<typeof vi.fn>).mock.calls[callIdx][0] as string

  it('has_abnormal → EXISTS (probe=dead OR render=dead)', async () => {
    const db = makePool([{ cnt: '0' }], [])
    await listVideoGroups(db, { quickFilters: ['has_abnormal'] })
    expect(sqlOf(db, 0)).toContain("(vs5.probe_status = 'dead' OR vs5.render_status = 'dead')")
  })

  it('pending_probe → EXISTS (probe=pending)', async () => {
    const db = makePool([{ cnt: '0' }], [])
    await listVideoGroups(db, { quickFilters: ['pending_probe'] })
    expect(sqlOf(db, 0)).toContain("vs6.probe_status = 'pending'")
  })

  it('needs_source → NOT EXISTS (可播源)', async () => {
    const db = makePool([{ cnt: '0' }], [])
    await listVideoGroups(db, { quickFilters: ['needs_source'] })
    const sql = sqlOf(db, 0)
    expect(sql).toContain('NOT EXISTS')
    expect(sql).toContain("vs7.is_active AND vs7.probe_status <> 'dead' AND vs7.render_status <> 'dead'")
  })

  it('low_quality（含已知质量 AND 无源 rank>=4）+ COALESCE 回退口径', async () => {
    const db = makePool([{ cnt: '0' }], [])
    await listVideoGroups(db, { quickFilters: ['low_quality'] })
    const sql = sqlOf(db, 0)
    expect(sql).toContain('COALESCE(vs8.quality_detected, vs8.quality) IS NOT NULL')
    expect(sql).toContain('NOT EXISTS')
    expect(sql).toContain('>= 4')
  })

  it('lowQuality=true 与 quickFilters low_quality OR 合流：单份谓词不双 push', async () => {
    const db = makePool([{ cnt: '0' }], [])
    await listVideoGroups(db, { lowQuality: true, quickFilters: ['low_quality'] })
    const sql = sqlOf(db, 0)
    expect((sql.match(/vs9\.video_id/g) ?? []).length).toBe(1)
  })

  it('lowQuality=false 且无 quickFilters → 不注入低质量谓词', async () => {
    const db = makePool([{ cnt: '0' }], [])
    await listVideoGroups(db, { lowQuality: false })
    expect(sqlOf(db, 1)).not.toContain('vs9')
  })

  it('多 quickFilters 可组合 AND（has_abnormal + needs_source 共存）', async () => {
    const db = makePool([{ cnt: '0' }], [])
    await listVideoGroups(db, { quickFilters: ['has_abnormal', 'needs_source'] })
    const sql = sqlOf(db, 0)
    expect(sql).toContain('vs5.probe_status')
    expect(sql).toContain('vs7.is_active')
  })
})

describe('CHG-VSR-3 listVideoGroups sortField 扩展（D-117-VSR3-6 / SELECT 别名）', () => {
  const dataSql = (db: Pool) => (db.query as ReturnType<typeof vi.fn>).mock.calls[1][0] as string

  it('sortField=activeSources → ORDER BY active_source_count', async () => {
    const db = makePool([{ cnt: '0' }], [])
    await listVideoGroups(db, { sortField: 'activeSources', sortDir: 'desc' })
    expect(dataSql(db)).toContain('ORDER BY active_source_count DESC')
  })

  it('sortField=quality → ORDER BY quality_rank_max', async () => {
    const db = makePool([{ cnt: '0' }], [])
    await listVideoGroups(db, { sortField: 'quality', sortDir: 'asc' })
    expect(dataSql(db)).toContain('ORDER BY quality_rank_max ASC')
  })

  it('sortField=lastChecked → ORDER BY last_checked_sort（真实 timestamptz，时序安全 / Codex FIX）', async () => {
    const db = makePool([{ cnt: '0' }], [])
    await listVideoGroups(db, { sortField: 'lastChecked', sortDir: 'desc' })
    const sql = dataSql(db)
    expect(sql).toContain('ORDER BY last_checked_sort DESC')
    // 不得以 ::TEXT 的 last_checked_at 排序（文本字典序非时序安全）
    expect(sql).not.toContain('ORDER BY last_checked_at')
  })

  it('lastCheckedFrom + lastCheckedTo → HAVING MAX(vs.last_probed_at) 范围（含到日 +1 天）', async () => {
    const db = makePool([{ cnt: '0' }], [])
    await listVideoGroups(db, { lastCheckedFrom: '2026-05-01', lastCheckedTo: '2026-05-25' })
    const countSql = (db.query as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(countSql).toContain('HAVING')
    expect(countSql).toContain('MAX(vs.last_probed_at) >= $')
    expect(countSql).toContain('MAX(vs.last_probed_at) < ($')
    expect(countSql).toContain("INTERVAL '1 day'")
  })
})

describe('CHG-VSR-3 getVideoGroupStats KPI②（D-117-VSR3-4 / per-video 子查询 + COUNT FILTER）', () => {
  it('SQL = per-video 子查询 g + 外层 ①(保留) + ②(新增) COUNT FILTER', async () => {
    const db = makePool([{}])
    await getVideoGroupStats(db)
    const sql = (db.query as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    // ①口径保留（source_check_status 维度，逐值回归基线）
    expect(sql).toContain("FILTER (WHERE g.source_check_status IN ('ok', 'partial'))")
    expect(sql).toContain("FILTER (WHERE g.source_check_status = 'all_dead')")
    expect(sql).toContain("g.source_check_status = 'all_dead' AND g.is_published = false")
    // ②新增（探测/质量维度）
    expect(sql).toContain('FILTER (WHERE g.has_abnormal)')
    expect(sql).toContain('FILTER (WHERE g.needs_source)')
    expect(sql).toContain('FILTER (WHERE g.has_pending)')
    expect(sql).toContain('FILTER (WHERE g.quality_rank_max < 4)')
    // 禁①②同层双算 → per-video 子查询
    expect(sql).toContain('bool_or')
    expect(sql).toContain('GROUP BY v.id, v.source_check_status, v.is_published')
  })

  it('映射②维度字段 + ①等价回归（旧 4 字段逐值正确）', async () => {
    const db = makePool([{
      total: '10', active: '6', dead: '2', orphan: '1',
      abnormal: '3', needs_source: '2', pending_probe: '4', low_quality: '1',
    }])
    const stats = await getVideoGroupStats(db)
    // ①等价回归
    expect(stats.total).toBe(10)
    expect(stats.active).toBe(6)
    expect(stats.dead).toBe(2)
    expect(stats.orphan).toBe(1)
    // ②新增
    expect(stats.abnormal).toBe(3)
    expect(stats.needsSource).toBe(2)
    expect(stats.pendingProbe).toBe(4)
    expect(stats.lowQuality).toBe(1)
  })
})

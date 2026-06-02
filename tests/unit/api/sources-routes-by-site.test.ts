/**
 * sources-routes-by-site.test.ts — CHG-SN-7-REDO-01-E
 *
 * 覆盖（ADR-117 AMENDMENT 2026-05-19 row 6 端点）：
 *   - listRoutesBySite query：STRING_AGG 拼接 raw 状态 + AVG 延迟 + COUNT FILTER active
 *   - SourcesMatrixService.listRoutesBySite：raw → SourceRouteBySite worst 状态派生
 *   - aggregateSignal 复用（worst 规则）
 *   - 空 / null 边界：avg_latency_ms null / probe_statuses null（空集 → 'pending'）
 *   - 别名 LEFT JOIN null → displayName null
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'
// CHG-VSR-3 / ADR-117 AMENDMENT 3（D-117-VSR3-7）：routes-by-site 查询迁至 source-routes.ts
import { listRoutesBySite } from '@/api/db/queries/source-routes'
import { SourcesMatrixService, aggregateSignal } from '@/api/services/SourcesMatrixService'

function makePool(rows: Record<string, unknown>[]): Pool {
  return {
    query: vi.fn().mockResolvedValue({ rows }),
  } as unknown as Pool
}

describe('listRoutesBySite (query)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('1. 单线路 + 全 ok 状态 → STRING_AGG 拼 "ok"', async () => {
    const pool = makePool([
      {
        source_site_key: 'jszyapi',
        source_name: '线路1',
        display_name: 'JSZY 主线',
        probe_statuses: 'ok',
        render_statuses: 'ok',
        avg_latency_ms: '120.5',
        source_count: '5',
        active_count: '5',
        last_probed_at: '2026-05-19T10:00:00Z',
      },
    ])
    const result = await listRoutesBySite(pool, 'jszyapi')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      sourceSiteKey: 'jszyapi',
      sourceName: '线路1',
      displayName: 'JSZY 主线',
      probeStatuses: ['ok'],
      renderStatuses: ['ok'],
      avgLatencyMs: 121,
      sourceCount: 5,
      activeCount: 5,
      lastProbedAt: '2026-05-19T10:00:00Z',
    })
  })

  it('2. 混合状态：STRING_AGG "ok,partial,dead" → split 3 元素', async () => {
    const pool = makePool([
      {
        source_site_key: 'jszyapi',
        source_name: '线路2',
        display_name: null,
        probe_statuses: 'ok,partial,dead',
        render_statuses: 'ok,dead',
        avg_latency_ms: null,
        source_count: '8',
        active_count: '6',
        last_probed_at: null,
      },
    ])
    const result = await listRoutesBySite(pool, 'jszyapi')
    expect(result[0].probeStatuses).toEqual(['ok', 'partial', 'dead'])
    expect(result[0].renderStatuses).toEqual(['ok', 'dead'])
    expect(result[0].displayName).toBeNull()
    expect(result[0].avgLatencyMs).toBeNull()
    expect(result[0].lastProbedAt).toBeNull()
  })

  it('3. 空 statuses（null）→ split 为 []', async () => {
    const pool = makePool([
      {
        source_site_key: 'jszyapi',
        source_name: '线路3',
        display_name: null,
        probe_statuses: null,
        render_statuses: null,
        avg_latency_ms: null,
        source_count: '0',
        active_count: '0',
        last_probed_at: null,
      },
    ])
    const result = await listRoutesBySite(pool, 'jszyapi')
    expect(result[0].probeStatuses).toEqual([])
    expect(result[0].renderStatuses).toEqual([])
  })

  it('4. SQL 参数化 + 软删除过滤 / GROUP BY 包含 COALESCE 和 source_name', async () => {
    const pool = makePool([])
    await listRoutesBySite(pool, 'tested-key')
    const queryFn = pool.query as unknown as ReturnType<typeof vi.fn>
    const [sql, params] = queryFn.mock.calls[0]
    expect(params).toEqual(['tested-key'])
    expect(sql).toContain('vs.deleted_at IS NULL')
    expect(sql).toContain('COALESCE(vs.source_site_key, v.site_key)')
    expect(sql).toContain('STRING_AGG(DISTINCT vs.probe_status')
    expect(sql).toContain('LEFT JOIN source_line_aliases')
  })

  it('5. AVG 延迟四舍五入到整数 ms', async () => {
    const pool = makePool([
      {
        source_site_key: 'k',
        source_name: 'n',
        display_name: null,
        probe_statuses: 'ok',
        render_statuses: 'ok',
        avg_latency_ms: '237.49',
        source_count: '1',
        active_count: '1',
        last_probed_at: null,
      },
    ])
    const result = await listRoutesBySite(pool, 'k')
    expect(result[0].avgLatencyMs).toBe(237)
  })
})

describe('aggregateSignal (worst 派生 / ADR-117 既有规则复用)', () => {
  it('6. 空数组 → pending', () => {
    expect(aggregateSignal([])).toBe('pending')
  })
  it('7. 全 ok → ok', () => {
    expect(aggregateSignal(['ok', 'ok'])).toBe('ok')
  })
  it('8. 全 dead → dead', () => {
    expect(aggregateSignal(['dead', 'dead'])).toBe('dead')
  })
  it('9. 含 ok 或 partial → partial（容忍未全 dead）', () => {
    expect(aggregateSignal(['ok', 'dead'])).toBe('partial')
    expect(aggregateSignal(['partial', 'dead'])).toBe('partial')
    expect(aggregateSignal(['ok', 'partial', 'dead'])).toBe('partial')
  })
  it('10. 全 pending → pending', () => {
    expect(aggregateSignal(['pending', 'pending'])).toBe('pending')
  })
})

describe('SourcesMatrixService.listRoutesBySite', () => {
  it('11. raw STRING_AGG → service 派生 probeStatus/renderStatus worst', async () => {
    const pool = makePool([
      {
        source_site_key: 'jszyapi',
        source_name: '线路1',
        display_name: 'JSZY',
        probe_statuses: 'ok,partial',
        render_statuses: 'ok,ok',
        avg_latency_ms: '100',
        source_count: '3',
        active_count: '3',
        last_probed_at: '2026-05-19T10:00:00Z',
      },
    ])
    const svc = new SourcesMatrixService(pool)
    const result = await svc.listRoutesBySite('jszyapi')
    expect(result).toHaveLength(1)
    expect(result[0].probeStatus).toBe('partial')  // ok+partial → partial
    expect(result[0].renderStatus).toBe('ok')      // 全 ok → ok
    expect(result[0].displayName).toBe('JSZY')
    expect(result[0].avgLatencyMs).toBe(100)
    expect(result[0].sourceCount).toBe(3)
    expect(result[0].activeCount).toBe(3)
  })

  it('12. 多行返回 + 全 dead → renderStatus dead', async () => {
    const pool = makePool([
      {
        source_site_key: 'k',
        source_name: '线路A',
        display_name: null,
        probe_statuses: 'dead,dead',
        render_statuses: 'dead',
        avg_latency_ms: null,
        source_count: '2',
        active_count: '0',
        last_probed_at: null,
      },
      {
        source_site_key: 'k',
        source_name: '线路B',
        display_name: null,
        probe_statuses: 'ok',
        render_statuses: 'partial',
        avg_latency_ms: '50',
        source_count: '1',
        active_count: '1',
        last_probed_at: '2026-05-19T11:00:00Z',
      },
    ])
    const svc = new SourcesMatrixService(pool)
    const result = await svc.listRoutesBySite('k')
    expect(result).toHaveLength(2)
    expect(result[0].sourceName).toBe('线路A')
    expect(result[0].probeStatus).toBe('dead')
    expect(result[0].renderStatus).toBe('dead')
    expect(result[1].sourceName).toBe('线路B')
    expect(result[1].probeStatus).toBe('ok')
    expect(result[1].renderStatus).toBe('partial')
  })

  it('13. 空线路集 → 空数组（不抛错）', async () => {
    const pool = makePool([])
    const svc = new SourcesMatrixService(pool)
    const result = await svc.listRoutesBySite('non-existent-key')
    expect(result).toEqual([])
  })
})

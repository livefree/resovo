/**
 * aggregate.test.ts — groupSourcesByLine 单测（FIX-B Stage D）
 * ≥ 8 case 覆盖聚合键、状态规则、排序、中位数、质量、hostname
 */
import { describe, it, expect } from 'vitest'
import { groupSourcesByLine } from '../../../../../../packages/admin-ui/src/components/composite/lines-panel/aggregate'
import type { RawSourceRow } from '../../../../../../packages/admin-ui/src/components/composite/lines-panel/lines-panel.types'

// ── 工厂 ─────────────────────────────────────────────────────────────────────

function row(overrides: Partial<RawSourceRow> & { id: string }): RawSourceRow {
  // 用 'in' 而非 '??' 判断字段是否被显式传入，避免 null ?? default = default 问题
  return {
    id: overrides.id,
    source_site_key: 'source_site_key' in overrides ? overrides.source_site_key : 'site_a',
    source_name: overrides.source_name ?? 'LineA',
    source_url: overrides.source_url ?? 'https://cdn.example.com/v.m3u8',
    episode_number: 'episode_number' in overrides ? overrides.episode_number : 1,
    is_active: overrides.is_active ?? true,
    probe_status: overrides.probe_status ?? 'ok',
    render_status: overrides.render_status ?? 'ok',
    latency_ms: 'latency_ms' in overrides ? overrides.latency_ms : null,
    updated_at: overrides.updated_at ?? '2026-01-01T00:00:00Z',
    quality_detected: 'quality_detected' in overrides ? overrides.quality_detected : null,
    hostname: 'hostname' in overrides ? overrides.hostname : null,
    // CHG-368-B-C-UI / ADR-164：codename / retired_at 透传（optional / 未传时不放入）
    ...('codename' in overrides ? { codename: overrides.codename } : {}),
    ...('retired_at' in overrides ? { retired_at: overrides.retired_at } : {}),
  }
}

// ── Case 1：空输入 → 空数组 ───────────────────────────────────────────────────

describe('Case 1 — 空输入', () => {
  it('空数组 → 返回 []', () => {
    expect(groupSourcesByLine([])).toEqual([])
  })
})

// ── Case 2：单行 → 1 条 LineAggregate ────────────────────────────────────────

describe('Case 2 — 单行聚合', () => {
  it('单行 → 1 线路，episodes[0] 字段正确映射', () => {
    const result = groupSourcesByLine([
      row({ id: 'ep1', episode_number: 3, is_active: true, probe_status: 'ok', render_status: 'dead', latency_ms: 120 }),
    ])
    expect(result).toHaveLength(1)
    const line = result[0]
    expect(line.key).toBe('site_a|LineA')
    expect(line.siteKey).toBe('site_a')
    expect(line.lineName).toBe('LineA')
    expect(line.totalEpisodes).toBe(1)
    expect(line.activeCount).toBe(1)
    expect(line.probeAggregate).toBe('ok')
    expect(line.renderAggregate).toBe('dead')
    expect(line.latencyMedianMs).toBe(120)
    expect(line.episodes[0].id).toBe('ep1')
    expect(line.episodes[0].episodeNumber).toBe(3)
  })
})

// ── Case 3：null siteKey → fallback 'unknown' ─────────────────────────────────

describe('Case 3 — null siteKey fallback', () => {
  it('source_site_key=null → key 含 "unknown|"', () => {
    const result = groupSourcesByLine([
      row({ id: 'x1', source_site_key: null }),
    ])
    expect(result[0].key).toBe('unknown|LineA')
    expect(result[0].siteKey).toBe('unknown')
  })
})

// ── Case 4：状态聚合规则 ──────────────────────────────────────────────────────

describe('Case 4 — 状态聚合规则', () => {
  it('全 ok → probeAggregate=ok', () => {
    const result = groupSourcesByLine([
      row({ id: 'a', probe_status: 'ok' }),
      row({ id: 'b', probe_status: 'ok' }),
    ])
    expect(result[0].probeAggregate).toBe('ok')
  })

  it('含 ok 不全 ok → partial', () => {
    const result = groupSourcesByLine([
      row({ id: 'a', probe_status: 'ok' }),
      row({ id: 'b', probe_status: 'dead' }),
    ])
    expect(result[0].probeAggregate).toBe('partial')
  })

  it('全 dead → dead', () => {
    const result = groupSourcesByLine([
      row({ id: 'a', probe_status: 'dead' }),
      row({ id: 'b', probe_status: 'dead' }),
    ])
    expect(result[0].probeAggregate).toBe('dead')
  })

  it('全 pending → pending', () => {
    const result = groupSourcesByLine([
      row({ id: 'a', probe_status: 'pending' }),
      row({ id: 'b', probe_status: 'pending' }),
    ])
    expect(result[0].probeAggregate).toBe('pending')
  })

  it('混合 dead + pending（无 ok）→ unknown', () => {
    const result = groupSourcesByLine([
      row({ id: 'a', probe_status: 'dead' }),
      row({ id: 'b', probe_status: 'pending' }),
    ])
    expect(result[0].probeAggregate).toBe('unknown')
  })

  it('未知 status 字符串 → unknown', () => {
    const result = groupSourcesByLine([
      row({ id: 'a', probe_status: 'error_xyz' }),
    ])
    expect(result[0].probeAggregate).toBe('unknown')
  })
})

// ── Case 5：episodes 按 episodeNumber asc 排序，null last ─────────────────────

describe('Case 5 — episodes 排序', () => {
  it('episodeNumber asc，null 排最后', () => {
    const result = groupSourcesByLine([
      row({ id: 'ep5', episode_number: 5 }),
      row({ id: 'ep1', episode_number: 1 }),
      row({ id: 'epNull', episode_number: null }),
      row({ id: 'ep3', episode_number: 3 }),
    ])
    const ids = result[0].episodes.map(e => e.id)
    expect(ids).toEqual(['ep1', 'ep3', 'ep5', 'epNull'])
  })
})

// ── Case 6：latencyMedianMs — 仅活跃集，奇偶数均正确 ───────────────────────────

describe('Case 6 — latencyMedianMs', () => {
  it('奇数活跃集 → 中间值', () => {
    const result = groupSourcesByLine([
      row({ id: 'a', is_active: true, latency_ms: 100 }),
      row({ id: 'b', is_active: true, latency_ms: 300 }),
      row({ id: 'c', is_active: true, latency_ms: 200 }),
    ])
    expect(result[0].latencyMedianMs).toBe(200)
  })

  it('偶数活跃集 → 中间两值平均（取整）', () => {
    const result = groupSourcesByLine([
      row({ id: 'a', is_active: true, latency_ms: 100 }),
      row({ id: 'b', is_active: true, latency_ms: 300 }),
    ])
    expect(result[0].latencyMedianMs).toBe(200)
  })

  it('非活跃集 latency 不纳入计算', () => {
    const result = groupSourcesByLine([
      row({ id: 'a', is_active: true, latency_ms: 100 }),
      row({ id: 'b', is_active: false, latency_ms: 9999 }),
    ])
    expect(result[0].latencyMedianMs).toBe(100)
  })

  it('无活跃集 latency → null', () => {
    const result = groupSourcesByLine([
      row({ id: 'a', is_active: false, latency_ms: 100 }),
    ])
    expect(result[0].latencyMedianMs).toBeNull()
  })
})

// ── Case 7：qualityHighest — ResolutionTier 真源 ──────────────────────────────

describe('Case 7 — qualityHighest', () => {
  it('取最高质量（4K > 1080P）', () => {
    const result = groupSourcesByLine([
      row({ id: 'a', quality_detected: '1080P' }),
      row({ id: 'b', quality_detected: '4K' }),
    ])
    expect(result[0].qualityHighest).toBe('4K')
  })

  it('无效质量字符串 → null', () => {
    const result = groupSourcesByLine([
      row({ id: 'a', quality_detected: 'unknown_quality' }),
    ])
    expect(result[0].qualityHighest).toBeNull()
  })

  it('质量均为 null → qualityHighest null', () => {
    const result = groupSourcesByLine([
      row({ id: 'a', quality_detected: null }),
    ])
    expect(result[0].qualityHighest).toBeNull()
  })
})

// ── Case 8：hostname 解析 ────────────────────────────────────────────────────

describe('Case 8 — hostname', () => {
  it('从 source_url 解析 hostname', () => {
    const result = groupSourcesByLine([
      row({ id: 'a', source_url: 'https://cdn.example.com/v.m3u8', hostname: null }),
    ])
    expect(result[0].hostname).toBe('cdn.example.com')
  })

  it('RawSourceRow.hostname 优先于 URL 解析', () => {
    const result = groupSourcesByLine([
      row({ id: 'a', source_url: 'https://cdn.example.com/v.m3u8', hostname: 'override.host' }),
    ])
    expect(result[0].hostname).toBe('override.host')
  })

  it('无效 URL → hostname null', () => {
    const result = groupSourcesByLine([
      row({ id: 'a', source_url: 'not-a-url', hostname: null }),
    ])
    expect(result[0].hostname).toBeNull()
  })
})

// ── Case 9：多线路默认排序 ────────────────────────────────────────────────────

describe('Case 9 — 默认排序 activeCount desc → probeAggregate → lineName asc', () => {
  it('activeCount 更多的线路排前面', () => {
    const result = groupSourcesByLine([
      row({ id: 'a', source_name: 'LineX', is_active: false }),
      row({ id: 'b', source_name: 'LineY', is_active: true }),
    ])
    expect(result[0].lineName).toBe('LineY')
    expect(result[1].lineName).toBe('LineX')
  })

  it('activeCount 相同时，probeAggregate ok 排前（ok < partial）', () => {
    const result = groupSourcesByLine([
      row({ id: 'a1', source_name: 'LinePartial', probe_status: 'partial' }),
      row({ id: 'b1', source_name: 'LineOk', probe_status: 'ok' }),
    ])
    expect(result[0].lineName).toBe('LineOk')
  })
})

// ── Case 10：自定义 sortLines ────────────────────────────────────────────────

describe('Case 10 — 自定义 sortLines', () => {
  it('传入自定义排序函数覆盖默认', () => {
    const result = groupSourcesByLine(
      [
        row({ id: 'a', source_name: 'LineA' }),
        row({ id: 'b', source_name: 'LineB' }),
      ],
      { sortLines: (a, b) => b.lineName.localeCompare(a.lineName) },
    )
    expect(result[0].lineName).toBe('LineB')
    expect(result[1].lineName).toBe('LineA')
  })
})


// ── CHG-368-B-C-UI / ADR-164 D-164-2 + D-164-4：codename + retiredAt 透传 ──

describe('CHG-368-B-C-UI — codename + retiredAt 透传（ADR-164）', () => {
  it('单行含 codename + retired_at → LineAggregate.codename / retiredAt 正确映射', () => {
    const result = groupSourcesByLine([
      row({
        id: 'a1',
        codename: '泰山-2',
        retired_at: null,
      }),
    ])
    expect(result[0].codename).toBe('泰山-2')
    expect(result[0].retiredAt).toBeNull()
  })

  it('单行 retired_at 非 NULL → LineAggregate.retiredAt 透传时间戳', () => {
    const result = groupSourcesByLine([
      row({
        id: 'r1',
        codename: '华山',
        retired_at: '2026-04-01T00:00:00Z',
      }),
    ])
    expect(result[0].codename).toBe('华山')
    expect(result[0].retiredAt).toBe('2026-04-01T00:00:00Z')
  })

  it('多行同 (siteKey, sourceName) → 取首行 codename / retiredAt（行间一致 invariant）', () => {
    // 同 (site_a, LineA) 复合 PK 下 source_line_aliases 1:N 反向 join 出
    // 行 a/b 必然有相同 codename / retired_at（DB invariant）。即使测试 fixture 故意
    // 让 b 行 codename 不同，groupSourcesByLine 应取首行（a）。
    const result = groupSourcesByLine([
      row({ id: 'a', codename: '泰山', retired_at: null }),
      row({ id: 'b', codename: '峨眉', retired_at: null, episode_number: 2 }),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].codename).toBe('泰山')  // 首行
  })

  it('无 codename / retired_at 字段（RawSourceRow optional 默认 undefined）→ LineAggregate null', () => {
    // 既有 11 字段 raw row（无新 2 optional）→ LineAggregate codename / retiredAt = null
    const result = groupSourcesByLine([row({ id: 'legacy' })])
    expect(result[0].codename).toBeNull()
    expect(result[0].retiredAt).toBeNull()
  })
})

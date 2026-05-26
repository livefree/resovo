/**
 * crawlerTimeline.test.ts — ADR-153 落地单测
 *
 * 覆盖：
 *   §8 #1  multi-lane：同站 3 task → rn≤3，按 rn ASC
 *   §8 #2  site LIMIT 语义（R-153-2）：限站数而非 bar 总数
 *   §8 #3  lane 间排序：running 站排前（site_ord）
 *   §8 #4  status 4 态：paused→neutral / cancelled→neutral / timeout→danger / failed→danger / done→ok
 *   §8 #5  D-153-4 pending 起点：scheduled_at 锚 + GREATEST clamp → JS clamp → startPct ≥ 0
 *   §8 #6  health CTE：3 done / 2 failed → health=60
 *   §8 #7  health N+1 消除：db.query 仅调用 1 次
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock DB ───────────────────────────────────────────────────────
const mockQuery = vi.fn()
const mockDb = { query: mockQuery }

vi.mock('@/api/lib/postgres', () => ({ db: mockDb }))
vi.mock('@/api/lib/elasticsearch', () => ({ es: {} }))
vi.mock('@/api/lib/config', () => ({
  config: { DATABASE_URL: 'postgres://test' },
}))

// ── Helpers ───────────────────────────────────────────────────────

function makeRawRow(overrides: {
  source_site?: string
  site_name?: string
  status?: string
  health?: string
  scheduledAgo?: number   // 距 now 多少 ms
  startedAgo?: number     // 距 now 多少 ms；undefined = pending（未 start）
  finishedAgo?: number    // 距 now 多少 ms；undefined = running
  videosUpserted?: number
}) {
  const now = Date.now()
  const scheduledAt = new Date(now - (overrides.scheduledAgo ?? 30 * 60_000))
  const startedAt = overrides.startedAgo != null ? new Date(now - overrides.startedAgo) : scheduledAt
  const finishedAt = overrides.finishedAgo != null ? new Date(now - overrides.finishedAgo) : new Date(now)

  return {
    source_site: overrides.source_site ?? 'site-a',
    site_name: overrides.site_name ?? 'Site A',
    scheduled_at: scheduledAt,
    started_at: startedAt,
    effective_end: finishedAt,
    status: overrides.status ?? 'done',
    result: overrides.videosUpserted != null ? { videosUpserted: overrides.videosUpserted } : null,
    health: overrides.health ?? '80',
  }
}

// ── getCrawlerTimeline import ─────────────────────────────────────
// 动态 import：每次 test 清 cache 后重新 import（避免模块缓存污染）

describe('crawlerTimeline.getCrawlerTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('#1 multi-lane：同站 3 task → rows 含 3 条，各字段 siteKey 一致', async () => {
    const { getCrawlerTimeline } = await import('@/api/db/queries/crawlerTimeline')

    mockQuery.mockResolvedValueOnce({
      rows: [
        makeRawRow({ source_site: 'site-a', status: 'done', startedAgo: 600_000, finishedAgo: 300_000 }),
        makeRawRow({ source_site: 'site-a', status: 'done', startedAgo: 1200_000, finishedAgo: 900_000 }),
        makeRawRow({ source_site: 'site-a', status: 'failed', startedAgo: 1800_000, finishedAgo: 1500_000 }),
      ],
    })

    const result = await getCrawlerTimeline(mockDb as never, '1h')
    expect(result.rows).toHaveLength(3)
    expect(result.rows.every((r) => r.siteKey === 'site-a')).toBe(true)
  })

  it('#2 site LIMIT 语义（R-153-2）：db.query 第 2 参数传 safeLimit，第 3 参数传 LANE_LIMIT', async () => {
    const { getCrawlerTimeline } = await import('@/api/db/queries/crawlerTimeline')

    mockQuery.mockResolvedValueOnce({ rows: [] })

    await getCrawlerTimeline(mockDb as never, '1h', 5)

    expect(mockQuery).toHaveBeenCalledTimes(1)
    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]]
    // $2 = site limit = 5, $3 = LANE_LIMIT = 3
    expect(params[1]).toBe(5)
    expect(params[2]).toBe(3)
  })

  it('#3 lane 间排序：rows 顺序由 SQL 决定（db.query 调用 1 次，不在 JS 层重排）', async () => {
    const { getCrawlerTimeline } = await import('@/api/db/queries/crawlerTimeline')

    const runningRow = makeRawRow({ source_site: 'site-running', status: 'running', startedAgo: 60_000, health: '90' })
    const doneRow = makeRawRow({ source_site: 'site-done', status: 'done', startedAgo: 600_000, health: '70' })

    mockQuery.mockResolvedValueOnce({ rows: [runningRow, doneRow] })

    const result = await getCrawlerTimeline(mockDb as never, '1h')

    // 顺序由 SQL 排序决定，JS 层保序
    expect(result.rows[0].siteKey).toBe('site-running')
    expect(result.rows[1].siteKey).toBe('site-done')
    // 只调了 1 次 query（N+1 消除 #7）
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  describe('#4 status 4 态映射', () => {
    const cases: Array<[string, 'ok' | 'warn' | 'danger' | 'neutral']> = [
      ['done', 'ok'],
      ['running', 'ok'],
      ['failed', 'danger'],
      ['timeout', 'danger'],   // R-153-3 修复
      ['paused', 'neutral'],
      ['cancelled', 'neutral'],
    ]

    for (const [rawStatus, expected] of cases) {
      it(`status '${rawStatus}' → '${expected}'`, async () => {
        const { getCrawlerTimeline } = await import('@/api/db/queries/crawlerTimeline')
        mockQuery.mockResolvedValueOnce({
          rows: [makeRawRow({ status: rawStatus, startedAgo: 600_000, finishedAgo: 300_000 })],
        })
        const result = await getCrawlerTimeline(mockDb as never, '1h')
        expect(result.rows[0].status).toBe(expected)
      })
    }
  })

  it('#5 D-153-4 pending 起点：startPct ≥ 0（JS clamp 保证，不出负值）', async () => {
    const { getCrawlerTimeline } = await import('@/api/db/queries/crawlerTimeline')

    // 模拟 GREATEST clamp 已在 SQL 处理：started_at = rangeStart（窗口左侧）
    const now = Date.now()
    const rangeMs = 60 * 60_000 // 1h
    const row = {
      ...makeRawRow({ source_site: 'site-pending', status: 'running' }),
      started_at: new Date(now - rangeMs),   // 恰好在窗口左侧
      effective_end: new Date(now),
      scheduled_at: new Date(now - rangeMs),
    }

    mockQuery.mockResolvedValueOnce({ rows: [row] })

    const result = await getCrawlerTimeline(mockDb as never, '1h')
    expect(result.rows[0].startPct).toBeGreaterThanOrEqual(0)
    expect(result.rows[0].startPct).toBeLessThanOrEqual(1)
  })

  it('#6 health CTE：health 字段被正确解析为 number', async () => {
    const { getCrawlerTimeline } = await import('@/api/db/queries/crawlerTimeline')

    mockQuery.mockResolvedValueOnce({
      rows: [makeRawRow({ health: '60', startedAgo: 600_000, finishedAgo: 300_000 })],
    })

    const result = await getCrawlerTimeline(mockDb as never, '1h')
    expect(result.rows[0].health).toBe(60)
    expect(typeof result.rows[0].health).toBe('number')
  })

  it('#7 health N+1 消除：无论几站，db.query 仅调用 1 次', async () => {
    const { getCrawlerTimeline } = await import('@/api/db/queries/crawlerTimeline')

    mockQuery.mockResolvedValueOnce({
      rows: [
        makeRawRow({ source_site: 'site-a', health: '80', startedAgo: 600_000, finishedAgo: 300_000 }),
        makeRawRow({ source_site: 'site-b', health: '60', startedAgo: 700_000, finishedAgo: 400_000 }),
        makeRawRow({ source_site: 'site-c', health: '40', startedAgo: 800_000, finishedAgo: 500_000 }),
      ],
    })

    await getCrawlerTimeline(mockDb as never, '1h')

    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  it('SQL 包含 TIMELINE_SQL_V2 关键结构（GREATEST COALESCE + site_rank CTE + health_cte CTE）', async () => {
    const { getCrawlerTimeline } = await import('@/api/db/queries/crawlerTimeline')

    mockQuery.mockResolvedValueOnce({ rows: [] })

    await getCrawlerTimeline(mockDb as never, '1h')

    const [sql] = mockQuery.mock.calls[0] as [string]
    // D-153-4：GREATEST clamp
    expect(sql).toContain('GREATEST(COALESCE(')
    // D-153-1：site_rank CTE
    expect(sql).toMatch(/site_rank\s+AS\s+\(/i)
    // D-153-6：health_cte CTE
    expect(sql).toMatch(/health_cte\s+AS\s+\(/i)
    // D-153-2：paused/cancelled 在 status IN
    expect(sql).toContain("'paused'")
    expect(sql).toContain("'cancelled'")
    expect(sql).toContain("'timeout'")
    // R-153-2：WHERE site_ord <= $2 AND rn <= $3
    expect(sql).toMatch(/site_ord\s*<=\s*\$2/i)
    expect(sql).toMatch(/rt\.rn\s*<=\s*\$3/i)
  })

  it('rangeStart + rangeEnd 以 UTC ISO 8601 返回（D-153-5 防回归）', async () => {
    const { getCrawlerTimeline } = await import('@/api/db/queries/crawlerTimeline')

    mockQuery.mockResolvedValueOnce({ rows: [] })

    const result = await getCrawlerTimeline(mockDb as never, '30m')

    // ISO 8601 UTC 格式：末尾有 Z
    expect(result.rangeStart).toMatch(/Z$/)
    expect(result.rangeEnd).toMatch(/Z$/)
    expect(result.ticks.every((t) => t.endsWith('Z'))).toBe(true)
  })

  // ── CHG-SN-9-CW1-CW2-HOTFIX-A Step 2：WHERE + status pending fix ─────────
  it('HOTFIX-A #1 WHERE 字段改用 COALESCE(finished_at, NOW())：早于左端 scheduled 但窗口内 finished 的 task 可见', async () => {
    const { getCrawlerTimeline } = await import('@/api/db/queries/crawlerTimeline')

    mockQuery.mockResolvedValueOnce({ rows: [] })

    await getCrawlerTimeline(mockDb as never, '1h')

    const [sql] = mockQuery.mock.calls[0] as [string]
    // 修复后 WHERE 不再用 scheduled_at >= NOW() - interval（会切掉早 scheduled 但仍在窗口的 task）
    expect(sql).not.toMatch(/ct\.scheduled_at\s*>=\s*NOW\(\)\s*-\s*\$1::interval/i)
    // 改用 COALESCE(finished_at, NOW()) >= NOW() - interval
    expect(sql).toMatch(/COALESCE\(ct\.finished_at,\s*NOW\(\)\)\s*>=\s*NOW\(\)\s*-\s*\$1::interval/i)
  })

  it('HOTFIX-A #2 status 白名单含 pending：刚 enqueue 未启动的 task 可见（对齐 ADR-153 §5）', async () => {
    const { getCrawlerTimeline } = await import('@/api/db/queries/crawlerTimeline')

    mockQuery.mockResolvedValueOnce({ rows: [] })

    await getCrawlerTimeline(mockDb as never, '1h')

    const [sql] = mockQuery.mock.calls[0] as [string]
    expect(sql).toContain("'pending'")
    // status IN (...) 子句完整含 pending（防 status check 重写时漏掉）
    expect(sql).toMatch(/status\s+IN\s*\([^)]*'pending'[^)]*\)/i)
  })

  it('HOTFIX-A #3 pending 状态 task → statusToCategory 归为 warn（既不 ok 也不 neutral）', async () => {
    const { getCrawlerTimeline } = await import('@/api/db/queries/crawlerTimeline')

    mockQuery.mockResolvedValueOnce({
      rows: [makeRawRow({ status: 'pending', startedAgo: 60_000, finishedAgo: 30_000 })],
    })

    const result = await getCrawlerTimeline(mockDb as never, '1h')
    // statusToCategory 当前对未列举的 raw status 默认归 warn（fallthrough 黄色），
    // pending 视为"已排队等待执行"的中间态，呈黄色提示用户有积压
    expect(result.rows[0].status).toBe('warn')
  })

  // ── ADR-155 D-155-4 / EP-1B1：站点 limit 解锁 ──────────────────
  it('EP-1B1 #1 safeLimit 上限 50：limit=100 → params[1] cap 在 50', async () => {
    const { getCrawlerTimeline } = await import('@/api/db/queries/crawlerTimeline')

    mockQuery.mockResolvedValueOnce({ rows: [] })

    await getCrawlerTimeline(mockDb as never, '1h', 100)

    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]]
    expect(params[1]).toBe(50)
  })

  it('EP-1B1 #2 safeLimit 下限 1：limit=0 / 负数 → cap 在 1', async () => {
    const { getCrawlerTimeline } = await import('@/api/db/queries/crawlerTimeline')

    mockQuery.mockResolvedValueOnce({ rows: [] })

    await getCrawlerTimeline(mockDb as never, '1h', 0)

    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]]
    expect(params[1]).toBe(1)
  })

  it('EP-1B1 #3 safeLimit 中间值穿透：limit=20 → params[1] = 20', async () => {
    const { getCrawlerTimeline } = await import('@/api/db/queries/crawlerTimeline')

    mockQuery.mockResolvedValueOnce({ rows: [] })

    await getCrawlerTimeline(mockDb as never, '1h', 20)

    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]]
    expect(params[1]).toBe(20)
  })
})

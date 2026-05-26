/**
 * CrawlerTimelineCard.test.tsx — ADR-153 落地前端单测（CW2-B-EP）
 *
 * 覆盖：
 *   §8 #8   neutral status bar → background: var(--fg-muted)
 *   §8 #9   multi-lane：3 row 同 siteKey → 1 site 行 + 3 bar（top 值递增）
 *   §8 #10  range select 切换 → getCrawlerTimeline 带新 range 调用
 *   §8 #11  paused/frozen → setInterval 不触发（5s 内无 refetch）
 *   §8 #12  tick 时区：UTC ISO mock → formatLocalHm 输出本地 HH:MM（非空）
 */

import { beforeEach, describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'

// ── hoisted mocks ─────────────────────────────────────────────────
const getCrawlerTimelineMock = vi.fn()

vi.mock('../../../../../../apps/server-next/src/lib/crawler/api', () => ({
  getCrawlerTimeline: (...args: unknown[]) => getCrawlerTimelineMock(...args),
}))

vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    // AdminSelect：简化 mock，渲染 select element 并触发 onChange
    AdminSelect: ({
      options,
      value,
      onChange,
      'data-testid': testId,
      'aria-label': ariaLabel,
    }: {
      options: { value: string; label: string }[]
      value: string | null
      onChange: (v: string | null) => void
      'data-testid'?: string
      'aria-label'?: string
    }) => (
      <select
        data-testid={testId ?? 'admin-select'}
        aria-label={ariaLabel}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    ),
  }
})

import { CrawlerTimelineCard } from '../../../../../../apps/server-next/src/app/admin/crawler/_client/CrawlerTimelineCard'
import type { CrawlerTimelineResponse } from '../../../../../../apps/server-next/src/lib/crawler/api'

// ── fixtures ──────────────────────────────────────────────────────

function makeTimeline(rows: Partial<CrawlerTimelineResponse['rows'][0]>[] = []): CrawlerTimelineResponse {
  return {
    rangeStart: new Date(Date.now() - 60 * 60_000).toISOString(),
    rangeEnd: new Date().toISOString(),
    ticks: [
      new Date(Date.now() - 60 * 60_000).toISOString(),
      new Date(Date.now() - 30 * 60_000).toISOString(),
      new Date().toISOString(),
    ],
    rows: rows.map((r) => ({
      siteKey: 'site-a',
      siteName: 'Site A',
      health: 80,
      startPct: 0.2,
      widthPct: 0.3,
      durationSeconds: 120,
      videoCount: 10,
      status: 'ok' as const,
      last: new Date().toISOString(),
      ...r,
    })),
  }
}

const DEFAULT_PROPS = {
  frozen: false,
  paused: false,
  onPauseToggle: vi.fn(),
}

// ── Tests ─────────────────────────────────────────────────────────

describe('CrawlerTimelineCard — ADR-153 §8', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    // 默认返回空 timeline
    getCrawlerTimelineMock.mockResolvedValue(makeTimeline())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('#8 neutral status bar → background: var(--fg-muted)', async () => {
    const timeline = makeTimeline([
      { siteKey: 'site-paused', siteName: 'Paused', status: 'neutral', startPct: 0.1, widthPct: 0.5 },
    ])
    getCrawlerTimelineMock.mockResolvedValue(timeline)

    await act(async () => {
      render(<CrawlerTimelineCard {...DEFAULT_PROPS} fallbackData={timeline} />)
      await vi.advanceTimersByTimeAsync(100)
    })

    const bar = document.querySelector('[data-bar-status="neutral"]') as HTMLElement | null
    expect(bar).toBeTruthy()
    expect(bar?.style.background).toBe('var(--fg-muted)')
  })

  it('#9 multi-lane：3 row 同 siteKey → 1 TRACK 容器 + 3 bar（top 值递增）', async () => {
    const timeline = makeTimeline([
      { siteKey: 'site-multi', siteName: 'Multi Lane', status: 'ok',   startPct: 0.1, widthPct: 0.4 },
      { siteKey: 'site-multi', siteName: 'Multi Lane', status: 'warn', startPct: 0.5, widthPct: 0.3 },
      { siteKey: 'site-multi', siteName: 'Multi Lane', status: 'danger', startPct: 0.0, widthPct: 0.2 },
    ])
    getCrawlerTimelineMock.mockResolvedValue(timeline)

    await act(async () => {
      render(<CrawlerTimelineCard {...DEFAULT_PROPS} fallbackData={timeline} />)
      await vi.advanceTimersByTimeAsync(100)
    })

    // 1 个 TRACK 容器
    const tracks = document.querySelectorAll('[data-track][data-site-key="site-multi"]')
    expect(tracks).toHaveLength(1)

    // 3 个 bar
    const bars = document.querySelectorAll('[data-bar-lane]')
    expect(bars).toHaveLength(3)

    // top 值递增（BAR_H=6, LANE_GAP=2 → 0, 8, 16）
    const tops = Array.from(bars).map((b) => Number((b as HTMLElement).style.top.replace('px', '')))
    expect(tops[0]).toBe(0)
    expect(tops[1]).toBe(8)   // 6 + 2
    expect(tops[2]).toBe(16)  // (6 + 2) * 2
  })

  it('#10 range select 切換 → getCrawlerTimeline 带新 range 调用', async () => {
    getCrawlerTimelineMock.mockResolvedValue(makeTimeline())

    await act(async () => {
      render(<CrawlerTimelineCard {...DEFAULT_PROPS} />)
      // 推进足够短的时间让初始 fetch Promise 结算，但不触发 5s interval
      await vi.advanceTimersByTimeAsync(100)
    })

    getCrawlerTimelineMock.mockClear()
    getCrawlerTimelineMock.mockResolvedValue(makeTimeline())

    const select = screen.getByTestId('crawler-timeline-range-select')
    await act(async () => {
      fireEvent.change(select, { target: { value: '2h' } })
      // 让 range useEffect 的 fetch Promise 结算
      await vi.advanceTimersByTimeAsync(100)
    })

    expect(getCrawlerTimelineMock).toHaveBeenCalledWith(
      expect.objectContaining({ range: '2h' }),
    )
  })

  it('#11 paused=true → 5s 定时器不触发（无额外 getCrawlerTimeline 调用）', async () => {
    getCrawlerTimelineMock.mockResolvedValue(makeTimeline())

    await act(async () => {
      render(<CrawlerTimelineCard {...DEFAULT_PROPS} paused={true} />)
      await vi.advanceTimersByTimeAsync(100)
    })

    const callCount = getCrawlerTimelineMock.mock.calls.length
    // 推进 10s（超过 5s interval）
    await act(async () => {
      vi.advanceTimersByTime(10_000)
    })

    // 无额外调用
    expect(getCrawlerTimelineMock.mock.calls.length).toBe(callCount)
  })

  it('#11b frozen=true → 5s 定时器不触发', async () => {
    getCrawlerTimelineMock.mockResolvedValue(makeTimeline())

    await act(async () => {
      render(<CrawlerTimelineCard {...DEFAULT_PROPS} frozen={true} />)
      await vi.advanceTimersByTimeAsync(100)
    })

    const callCount = getCrawlerTimelineMock.mock.calls.length
    await act(async () => {
      vi.advanceTimersByTime(10_000)
    })

    expect(getCrawlerTimelineMock.mock.calls.length).toBe(callCount)
  })

  it('#12 tick 时区：UTC ISO → formatLocalHm 输出本地 HH:MM（非空/非 —）', async () => {
    const nowIso = new Date().toISOString()
    const timeline = makeTimeline([{ status: 'ok', startPct: 0, widthPct: 0.5 }])
    // 用已知 UTC ISO 替换 ticks
    const timedTimeline = { ...timeline, ticks: [nowIso, nowIso, nowIso] }
    getCrawlerTimelineMock.mockResolvedValue(timedTimeline)

    await act(async () => {
      render(<CrawlerTimelineCard {...DEFAULT_PROPS} fallbackData={timedTimeline} />)
      await vi.advanceTimersByTimeAsync(100)
    })

    // tick 格式化后不是原始 ISO 字符串（已转换为本地 HH:MM 格式）
    // 检查 tick row 中存在格式化后的时间
    const tickRow = document.querySelector('[data-tick-row]')
    expect(tickRow).toBeTruthy()
    const tickTexts = Array.from(tickRow!.querySelectorAll('span')).map((s) => s.textContent)
    // 本地时间不含 'T' 和 'Z'（ISO 原始字符串包含这些）
    expect(tickTexts.some((t) => t && !t.includes('T') && !t.includes('Z') && t !== '—')).toBe(true)
  })

  it('rows 为空 → 显示"当前时间窗内无采集活动"', async () => {
    getCrawlerTimelineMock.mockResolvedValue(makeTimeline([]))

    await act(async () => {
      render(<CrawlerTimelineCard {...DEFAULT_PROPS} />)
      await vi.advanceTimersByTimeAsync(100)
    })

    expect(screen.queryByTestId('crawler-timeline-empty')).toBeTruthy()
  })

  it('pause toggle 按钮点击 → onPauseToggle 回调', async () => {
    const onPauseToggle = vi.fn()
    getCrawlerTimelineMock.mockResolvedValue(makeTimeline())

    await act(async () => {
      render(<CrawlerTimelineCard {...DEFAULT_PROPS} onPauseToggle={onPauseToggle} />)
      await vi.advanceTimersByTimeAsync(100)
    })

    const btn = screen.getByTestId('crawler-timeline-pause-toggle')
    fireEvent.click(btn)
    expect(onPauseToggle).toHaveBeenCalledTimes(1)
  })

  // ── ADR-155 D-155-4 / EP-1B1：站点 limit 解锁 ──────────────────
  it('EP-1B1 #1: limit select 可见 + 默认 8 站 → 初始 getCrawlerTimeline 带 limit=8', async () => {
    getCrawlerTimelineMock.mockResolvedValue(makeTimeline())

    await act(async () => {
      render(<CrawlerTimelineCard {...DEFAULT_PROPS} />)
      await vi.advanceTimersByTimeAsync(100)
    })

    // limit select 渲染
    expect(screen.getByTestId('crawler-timeline-limit-select')).not.toBeNull()
    // 初始 fetch limit=8（默认）
    expect(getCrawlerTimelineMock).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 8 }),
    )
  })
})

/**
 * card-size-fetch.test.ts — CARD-SIZE-SSR / ADR-214 D-214-6/9（SEQ-20260622-03 Phase 2）
 *
 * 覆盖 server-only 取数 + :root CSS 变量生成：
 * - fetchCardSizeSettings：成功（URL + revalidate 60）/ 非 2xx 降级 / 抛错降级 / 空 data 降级
 * - buildCardSizeRootCss：网格档出 cols+gap / scroll 档出 w+gap / 无档位×单位倒置变量
 * - 降级值 == CARD_SIZE_DEFAULTS（D-214-5 兜底真源一致）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CARD_SIZE_DEFAULTS, type CardSizeSettings } from '@resovo/types'

// logger.server mock — 避免 pino 输出 + 断言降级 warn 调用（非空 catch 守则）
vi.mock('../../../../apps/web-next/src/lib/logger.server', () => ({
  serverLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

import {
  fetchCardSizeSettings,
  buildCardSizeRootCss,
  CARD_SIZE_REVALIDATE_SECONDS,
} from '../../../../apps/web-next/src/lib/server/card-size-fetch'
import { serverLogger } from '../../../../apps/web-next/src/lib/logger.server'

const mockWarn = serverLogger.warn as unknown as ReturnType<typeof vi.fn>

const SAMPLE: CardSizeSettings[] = [
  { id: 'r1', sizeClass: 'standard', desktopColumns: 6, cardWidthPx: null, gapPx: 20, settings: {}, updatedAt: '2026-06-22T00:00:00Z' },
  { id: 'r2', sizeClass: 'compact', desktopColumns: 4, cardWidthPx: null, gapPx: 10, settings: {}, updatedAt: '2026-06-22T00:00:00Z' },
  { id: 'r3', sizeClass: 'scroll', desktopColumns: null, cardWidthPx: 200, gapPx: 14, settings: {}, updatedAt: '2026-06-22T00:00:00Z' },
]

describe('fetchCardSizeSettings — D-214-6/9 取数 + 降级', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    mockWarn.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('成功 → 返回 body.data（URL /card-sizes + revalidate 60，无 warn）', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: SAMPLE }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const rows = await fetchCardSizeSettings()

    expect(rows).toHaveLength(3)
    expect(rows[0]!.sizeClass).toBe('standard')
    expect(mockWarn).not.toHaveBeenCalled()
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toMatch(/\/card-sizes$/)
    expect(init).toMatchObject({ next: { revalidate: CARD_SIZE_REVALIDATE_SECONDS } })
    expect(CARD_SIZE_REVALIDATE_SECONDS).toBeLessThanOrEqual(60)
  })

  it('非 2xx → 降级 CARD_SIZE_DEFAULTS（warn 一次，非空 catch）', async () => {
    fetchMock.mockResolvedValueOnce(new Response('err', { status: 503 }))

    const rows = await fetchCardSizeSettings()

    expect(rows.map((r) => r.sizeClass)).toEqual(['standard', 'compact', 'scroll'])
    expect(rows.find((r) => r.sizeClass === 'standard')!.desktopColumns).toBe(
      CARD_SIZE_DEFAULTS.standard.desktopColumns,
    )
    expect(rows.find((r) => r.sizeClass === 'scroll')!.cardWidthPx).toBe(
      CARD_SIZE_DEFAULTS.scroll.cardWidthPx,
    )
    expect(mockWarn).toHaveBeenCalledTimes(1)
  })

  it('fetch 抛错 → 降级 CARD_SIZE_DEFAULTS（warn 一次）', async () => {
    fetchMock.mockRejectedValueOnce(new Error('econnrefused'))

    const rows = await fetchCardSizeSettings()

    expect(rows).toHaveLength(3)
    expect(rows.find((r) => r.sizeClass === 'compact')!.gapPx).toBe(CARD_SIZE_DEFAULTS.compact.gapPx)
    expect(mockWarn).toHaveBeenCalledTimes(1)
  })

  it('空 data → 降级 CARD_SIZE_DEFAULTS（warn 一次）', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const rows = await fetchCardSizeSettings()

    expect(rows).toHaveLength(3)
    expect(mockWarn).toHaveBeenCalledTimes(1)
  })
})

describe('buildCardSizeRootCss — 档位×单位派生（D-214-4/6）', () => {
  it('网格档出 cols+gap、scroll 出 w+gap，且无倒置变量', () => {
    const css = buildCardSizeRootCss(SAMPLE)

    expect(css.startsWith(':root{')).toBe(true)
    // 网格档：cols + gap，不含 width
    expect(css).toContain('--card-cols-standard-desktop: 6')
    expect(css).toContain('--card-gap-standard: 20px')
    expect(css).not.toContain('--card-w-standard')
    expect(css).toContain('--card-cols-compact-desktop: 4')
    expect(css).toContain('--card-gap-compact: 10px')
    // scroll 档：width + gap，不含 cols
    expect(css).toContain('--card-w-scroll: 200px')
    expect(css).toContain('--card-gap-scroll: 14px')
    expect(css).not.toContain('--card-cols-scroll')
  })

  it('降级 defaults → 变量值与 CARD_SIZE_DEFAULTS 一致（D-214-5）', () => {
    // 触发降级路径取得合成行，再生成 CSS
    const defaultsRows: CardSizeSettings[] = [
      { id: 'd1', sizeClass: 'standard', desktopColumns: CARD_SIZE_DEFAULTS.standard.desktopColumns, cardWidthPx: null, gapPx: CARD_SIZE_DEFAULTS.standard.gapPx, settings: {}, updatedAt: '' },
      { id: 'd2', sizeClass: 'scroll', desktopColumns: null, cardWidthPx: CARD_SIZE_DEFAULTS.scroll.cardWidthPx, gapPx: CARD_SIZE_DEFAULTS.scroll.gapPx, settings: {}, updatedAt: '' },
    ]
    const css = buildCardSizeRootCss(defaultsRows)

    expect(css).toContain(`--card-cols-standard-desktop: ${CARD_SIZE_DEFAULTS.standard.desktopColumns}`)
    expect(css).toContain(`--card-w-scroll: ${CARD_SIZE_DEFAULTS.scroll.cardWidthPx}px`)
  })
})

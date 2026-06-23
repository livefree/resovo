/**
 * card-size-fetch.test.ts — CARD-SIZE-SSR / ADR-214 D-214-6/9 + Amendment A1 D-214-A1-1
 *
 * 覆盖 server-only 取数 + :root CSS 变量生成（Amendment A1：单位统一为卡宽，standard size-driven）：
 * - fetchCardSizeSettings：成功（URL + revalidate 60）/ 非 2xx 降级 / 抛错降级 / 空 data 降级
 * - buildCardSizeRootCss：全档出 `--card-w-{class}`+gap（standard/scroll）/ desktopColumns 护栏非空才出 cols / 无倒置
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

// Amendment A1：2 档、单位统一为卡宽（standard size-driven / scroll 横滚）；desktopColumns 本轮 null
const SAMPLE: CardSizeSettings[] = [
  { id: 'r1', sizeClass: 'standard', desktopColumns: null, cardWidthPx: 220, gapPx: 20, settings: {}, updatedAt: '2026-06-23T00:00:00Z' },
  { id: 'r3', sizeClass: 'scroll', desktopColumns: null, cardWidthPx: 200, gapPx: 14, settings: {}, updatedAt: '2026-06-23T00:00:00Z' },
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

    expect(rows).toHaveLength(2)
    expect(rows[0]!.sizeClass).toBe('standard')
    expect(mockWarn).not.toHaveBeenCalled()
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toMatch(/\/card-sizes$/)
    expect(init).toMatchObject({ next: { revalidate: CARD_SIZE_REVALIDATE_SECONDS } })
    expect(CARD_SIZE_REVALIDATE_SECONDS).toBeLessThanOrEqual(60)
  })

  it('非 2xx → 降级 CARD_SIZE_DEFAULTS（2 档 standard/scroll，warn 一次）', async () => {
    fetchMock.mockResolvedValueOnce(new Response('err', { status: 503 }))

    const rows = await fetchCardSizeSettings()

    expect(rows.map((r) => r.sizeClass)).toEqual(['standard', 'scroll'])
    expect(rows.find((r) => r.sizeClass === 'standard')!.cardWidthPx).toBe(
      CARD_SIZE_DEFAULTS.standard.cardWidthPx,
    )
    expect(rows.find((r) => r.sizeClass === 'scroll')!.cardWidthPx).toBe(
      CARD_SIZE_DEFAULTS.scroll.cardWidthPx,
    )
    expect(mockWarn).toHaveBeenCalledTimes(1)
  })

  it('fetch 抛错 → 降级 CARD_SIZE_DEFAULTS（warn 一次）', async () => {
    fetchMock.mockRejectedValueOnce(new Error('econnrefused'))

    const rows = await fetchCardSizeSettings()

    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.sizeClass === 'standard')!.gapPx).toBe(CARD_SIZE_DEFAULTS.standard.gapPx)
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

    expect(rows).toHaveLength(2)
    expect(mockWarn).toHaveBeenCalledTimes(1)
  })
})

describe('buildCardSizeRootCss — 按字段非空派生（D-214-A1-1：单位统一为卡宽）', () => {
  it('standard/scroll 出 --card-w+gap、本轮无 cols（desktopColumns 全 null）', () => {
    const css = buildCardSizeRootCss(SAMPLE)

    expect(css.startsWith(':root{')).toBe(true)
    // standard size-driven：出卡宽 + gap，不出列数
    expect(css).toContain('--card-w-standard: 220px')
    expect(css).toContain('--card-gap-standard: 20px')
    expect(css).not.toContain('--card-cols-standard-desktop')
    // scroll：卡宽 + gap，不含 cols
    expect(css).toContain('--card-w-scroll: 200px')
    expect(css).toContain('--card-gap-scroll: 14px')
    expect(css).not.toContain('--card-cols-scroll')
  })

  it('desktopColumns 护栏非空时附加出 --card-cols-{class}-desktop（派生分支覆盖）', () => {
    const withGuard: CardSizeSettings[] = [
      { id: 'g1', sizeClass: 'standard', desktopColumns: 6, cardWidthPx: 220, gapPx: 16, settings: {}, updatedAt: '' },
    ]
    const css = buildCardSizeRootCss(withGuard)
    expect(css).toContain('--card-w-standard: 220px')
    expect(css).toContain('--card-cols-standard-desktop: 6')
  })

  it('降级 defaults → 变量值与 CARD_SIZE_DEFAULTS 一致（D-214-5）', () => {
    const defaultsRows: CardSizeSettings[] = [
      { id: 'd1', sizeClass: 'standard', desktopColumns: CARD_SIZE_DEFAULTS.standard.desktopColumns, cardWidthPx: CARD_SIZE_DEFAULTS.standard.cardWidthPx, gapPx: CARD_SIZE_DEFAULTS.standard.gapPx, settings: {}, updatedAt: '' },
      { id: 'd2', sizeClass: 'scroll', desktopColumns: null, cardWidthPx: CARD_SIZE_DEFAULTS.scroll.cardWidthPx, gapPx: CARD_SIZE_DEFAULTS.scroll.gapPx, settings: {}, updatedAt: '' },
    ]
    const css = buildCardSizeRootCss(defaultsRows)

    expect(css).toContain(`--card-w-standard: ${CARD_SIZE_DEFAULTS.standard.cardWidthPx}px`)
    expect(css).toContain(`--card-w-scroll: ${CARD_SIZE_DEFAULTS.scroll.cardWidthPx}px`)
  })
})

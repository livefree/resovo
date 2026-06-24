/**
 * card-size-fetch.test.ts — CARD-SIZE-SSR / ADR-214 D-214-6/9 + Amendment A2 D-214-A2-1/7
 *
 * 覆盖 server-only 取数 + :root CSS 变量生成（Amendment A2：单一全局卡宽，全站统一）：
 * - fetchCardSizeSettings：成功（URL + revalidate 60）/ 非 2xx 降级 / 抛错降级 / 空 data 降级
 * - buildCardSizeRootCss：单行全局出单一 `--card-w` + `--card-gap`（无档位后缀、无列数变量）
 * - 降级值 == CARD_SIZE_DEFAULTS.global（D-214-5 兜底真源一致）
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

// Amendment A2：单行全局，全站统一卡宽（网格 + 横滚共用 --card-w / --card-gap）
const SAMPLE: CardSizeSettings[] = [
  { id: 'r1', sizeClass: 'global', cardWidthPx: 220, gapPx: 20, settings: {}, updatedAt: '2026-06-23T00:00:00Z' },
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

    expect(rows).toHaveLength(1)
    expect(rows[0]!.sizeClass).toBe('global')
    expect(mockWarn).not.toHaveBeenCalled()
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toMatch(/\/card-sizes$/)
    expect(init).toMatchObject({ next: { revalidate: CARD_SIZE_REVALIDATE_SECONDS } })
    expect(CARD_SIZE_REVALIDATE_SECONDS).toBeLessThanOrEqual(60)
  })

  it('非 2xx → 降级 CARD_SIZE_DEFAULTS（单行 global，warn 一次）', async () => {
    fetchMock.mockResolvedValueOnce(new Response('err', { status: 503 }))

    const rows = await fetchCardSizeSettings()

    expect(rows.map((r) => r.sizeClass)).toEqual(['global'])
    expect(rows[0]!.cardWidthPx).toBe(CARD_SIZE_DEFAULTS.global.cardWidthPx)
    expect(mockWarn).toHaveBeenCalledTimes(1)
  })

  it('fetch 抛错 → 降级 CARD_SIZE_DEFAULTS（warn 一次）', async () => {
    fetchMock.mockRejectedValueOnce(new Error('econnrefused'))

    const rows = await fetchCardSizeSettings()

    expect(rows).toHaveLength(1)
    expect(rows[0]!.gapPx).toBe(CARD_SIZE_DEFAULTS.global.gapPx)
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

    expect(rows).toHaveLength(1)
    expect(mockWarn).toHaveBeenCalledTimes(1)
  })
})

describe('buildCardSizeRootCss — 单一全局变量（D-214-A2-1/7）', () => {
  it('单行全局出 --card-w + --card-gap（无档位后缀、无列数变量）', () => {
    const css = buildCardSizeRootCss(SAMPLE)

    expect(css.startsWith(':root{')).toBe(true)
    expect(css).toContain('--card-w: 220px')
    expect(css).toContain('--card-gap: 20px')
    // A2 无分档后缀变量、无列数概念
    expect(css).not.toContain('--card-w-standard')
    expect(css).not.toContain('--card-w-scroll')
    expect(css).not.toContain('--card-cols')
  })

  it('cardWidthPx 为 null 时不出 --card-w，仍出 --card-gap（派生分支覆盖）', () => {
    const nullWidth: CardSizeSettings[] = [
      { id: 'n1', sizeClass: 'global', cardWidthPx: null, gapPx: 16, settings: {}, updatedAt: '' },
    ]
    const css = buildCardSizeRootCss(nullWidth)
    expect(css).not.toContain('--card-w:')
    expect(css).toContain('--card-gap: 16px')
  })

  it('降级 defaults → 变量值与 CARD_SIZE_DEFAULTS.global 一致（D-214-5）', () => {
    const defaultsRows: CardSizeSettings[] = [
      { id: 'd1', sizeClass: 'global', cardWidthPx: CARD_SIZE_DEFAULTS.global.cardWidthPx, gapPx: CARD_SIZE_DEFAULTS.global.gapPx, settings: {}, updatedAt: '' },
    ]
    const css = buildCardSizeRootCss(defaultsRows)

    expect(css).toContain(`--card-w: ${CARD_SIZE_DEFAULTS.global.cardWidthPx}px`)
    expect(css).toContain(`--card-gap: ${CARD_SIZE_DEFAULTS.global.gapPx}px`)
  })
})

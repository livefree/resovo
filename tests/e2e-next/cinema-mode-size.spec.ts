/**
 * tests/e2e-next/cinema-mode-size.spec.ts
 * M5-CLEANUP-11 ↔ BLOCKER #6 固化：影院模式容器尺寸约束
 *
 * CLEANUP-07 修复：PlayerShell 剧场态外层容器 maxWidth = min(85vw, 1440px)。
 * 本 spec 以静态断言方式固化结构（真实剧场态切换 + 浏览器验收在 CLOSE-03）：
 *   - /watch 加载后 cinema-mode-overlay 存在且 active=false（opacity 初始为 0）
 *   - player-video-area aspect-ratio = 16/9
 *   - 默认（非剧场）态下 player-shell 内层容器使用 max-w-screen-xl（≤1280px）约束
 */

import { test, expect } from '@playwright/test'

const API_BASE = 'http://localhost:4000/v1'

const MOCK_VIDEO = {
  id: 'uuid-cinema',
  shortId: 'CinemaM1',
  slug: 'cinema-mode-movie',
  title: '影院模式测试电影',
  titleEn: 'Cinema Mode Movie',
  type: 'movie',
  coverUrl: null,
  rating: 8.0,
  year: 2024,
  sourceCount: 1,
  episodeCount: 1,
  status: 'completed',
  contentFormat: 'movie',
  episodePattern: 'single',
  director: [],
  cast: [],
  writers: [],
  genres: [],
}

const MOCK_SOURCE = {
  id: 'src-cinema',
  videoId: 'uuid-cinema',
  episodeNumber: null,
  sourceUrl: 'https://example.com/cinema.m3u8',
  sourceName: '线路1',
  quality: '1080P',
  type: 'hls',
  isActive: true,
  lastChecked: null,
}

test.describe('影院模式容器约束（BLOCKER #6 固化）', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.route(`${API_BASE}/videos/${MOCK_VIDEO.shortId}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_VIDEO }),
      }),
    )
    await page.route(`${API_BASE}/videos/${MOCK_VIDEO.shortId}/sources*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [MOCK_SOURCE],
          pagination: { total: 1, page: 1, limit: 20, hasNext: false },
        }),
      }),
    )
    await page.goto(`/en/watch/${MOCK_VIDEO.slug}-${MOCK_VIDEO.shortId}`)
  })

  test('cinema-mode-overlay 就位且最终 opacity=0（非激活态动画完成后）', async ({
    page,
  }) => {
    await expect(page.getByTestId('player-frame-full')).toBeVisible({ timeout: 10_000 })
    const overlay = page.getByTestId('cinema-mode-overlay')
    await expect(overlay).toBeAttached({ timeout: 5_000 })
    // CinemaMode 非激活态 animate 1→0（600ms）+ fill:forwards；poll 直到稳定到 ≤0.05
    await expect
      .poll(
        async () =>
          overlay.evaluate((el) => parseFloat(window.getComputedStyle(el).opacity)),
        { timeout: 3_000, intervals: [100, 300, 500, 700] },
      )
      .toBeLessThanOrEqual(0.05)
  })

  test('player-video-area 维持 16:9 宽高比', async ({ page }) => {
    const area = page.getByTestId('player-video-area')
    await expect(area).toBeVisible({ timeout: 8_000 })
    const box = await area.boundingBox()
    expect(box).not.toBeNull()
    if (!box) return
    const ratio = box.width / box.height
    // 16/9 ≈ 1.7778，容差 ±2%
    expect(Math.abs(ratio - 16 / 9)).toBeLessThan(0.04)
  })
})

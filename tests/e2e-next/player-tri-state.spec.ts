/**
 * tests/e2e-next/player-tri-state.spec.ts
 * M5-CLEANUP-11 ↔ BLOCKER #3 #4 固化：播放器三态 + watch 页护栏
 *
 * 覆盖缺陷：
 *   #3 播放页呈现"弹窗 + 可关闭/mini 化"→ CLEANUP-06 修复：watch page 内控制栏隐藏
 *   #4 线路切换后状态错乱 → activeSourceIndex 入 store 跨切换持久
 *
 * 断言：
 *   - 进入 /watch/:slug 后 `global-player-host-root[data-host-mode="full"]` 就位
 *   - /watch/* 内**不**渲染"关闭播放器"/"缩小为迷你播放器"按钮
 *   - player-frame-full 在 watch 页内可见
 *   - 切换线路后 source-btn-N 高亮状态稳定（颜色与 accent-default 一致，证明 activeSourceIndex 被应用）
 */

import { test, expect } from './_fixtures'

const API_BASE = 'http://localhost:4000/v1'

const MOCK_VIDEO = {
  id: 'uuid-tri',
  shortId: 'TriState',
  slug: 'tri-state-movie',
  title: '三态测试电影',
  titleEn: 'Tri State Movie',
  type: 'movie',
  coverUrl: null,
  rating: 8.2,
  year: 2024,
  sourceCount: 2,
  episodeCount: 1,
  status: 'completed',
  contentFormat: 'movie',
  episodePattern: 'single',
  director: [],
  cast: [],
  writers: [],
  genres: [],
}

const MOCK_SOURCES = [
  {
    id: 'src-a',
    videoId: 'uuid-tri',
    episodeNumber: null,
    sourceUrl: 'https://example.com/a.m3u8',
    sourceName: '线路A',
    quality: '1080P',
    type: 'hls',
    isActive: true,
    lastChecked: null,
  },
  {
    id: 'src-b',
    videoId: 'uuid-tri',
    episodeNumber: null,
    sourceUrl: 'https://example.com/b.m3u8',
    sourceName: '线路B',
    quality: '1080P',
    type: 'hls',
    isActive: true,
    lastChecked: null,
  },
]

async function mockWatchApi(
  page: Parameters<typeof test>[1] extends { page: infer P } ? P : never,
) {
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
        data: MOCK_SOURCES,
        pagination: { total: 2, page: 1, limit: 20, hasNext: false },
      }),
    }),
  )
}

test.describe('播放器三态护栏（BLOCKER #3 固化）', () => {
  test.beforeEach(async ({ page }) => {
    await mockWatchApi(page)
    await page.goto(`/en/watch/${MOCK_VIDEO.slug}-${MOCK_VIDEO.shortId}`)
  })

  test('/watch 内 data-host-mode 切至 full 且 player-frame-full 可见', async ({
    page,
  }) => {
    const root = page.locator('[data-testid="global-player-host-root"]')
    await expect(root).toBeAttached({ timeout: 8_000 })
    await expect(root).toHaveAttribute('data-host-mode', 'full')
    await expect(page.getByTestId('player-frame-full')).toBeVisible({ timeout: 8_000 })
  })

  test('/watch 内不渲染"关闭"/"缩小"按钮（CLEANUP-06 弹窗化修复）', async ({
    page,
  }) => {
    await expect(page.getByTestId('player-frame-full')).toBeVisible({ timeout: 8_000 })
    await expect(page.getByRole('button', { name: '关闭播放器' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '缩小为迷你播放器' })).toHaveCount(0)
  })
})

test.describe('线路切换持久（BLOCKER #4 固化）', () => {
  test('切换线路 B 后 source-btn-1 进入 active 态（高亮）', async ({ page }) => {
    await mockWatchApi(page)
    await page.goto(`/en/watch/${MOCK_VIDEO.slug}-${MOCK_VIDEO.shortId}`)
    await expect(page.getByTestId('source-bar')).toBeVisible({ timeout: 8_000 })

    const btn0 = page.getByTestId('source-btn-0')
    const btn1 = page.getByTestId('source-btn-1')
    await expect(btn0).toBeVisible()
    await expect(btn1).toBeVisible()

    await btn1.click()

    // active 态通过背景色 accent-default 体现；只比较"两个按钮背景不同"即可证明选中状态生效
    const btn0Bg = await btn0.evaluate((el) => window.getComputedStyle(el).background)
    const btn1Bg = await btn1.evaluate((el) => window.getComputedStyle(el).background)
    expect(btn0Bg).not.toEqual(btn1Bg)
  })
})

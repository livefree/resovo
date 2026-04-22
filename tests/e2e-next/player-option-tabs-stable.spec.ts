/**
 * tests/e2e-next/player-option-tabs-stable.spec.ts
 * M5-CLEANUP-11 ↔ BLOCKER #5 固化：选集 / 线路 tab 始终同时存在
 *
 * 覆盖缺陷：多集 + 多线路场景下，选集 tab 与线路 tab 必须同时渲染，
 * 切换 tab 内容区更新但两个 tab 按钮本身不消失（PlayerShell L207-238）。
 */

import { test, expect } from '@playwright/test'

const API_BASE = 'http://localhost:4000/v1'

const MOCK_ANIME = {
  id: 'uuid-tabs',
  shortId: 'TabsTest',
  slug: 'tabs-stable-anime',
  title: 'Tab 稳定性动漫',
  titleEn: 'Tabs Stable Anime',
  type: 'anime',
  coverUrl: null,
  rating: 8.5,
  year: 2024,
  sourceCount: 2,
  episodeCount: 12,
  status: 'ongoing',
  contentFormat: 'episodic',
  episodePattern: 'multi',
  director: [],
  cast: [],
  writers: [],
  genres: [],
}

const MOCK_SOURCES = [
  {
    id: 'src-1',
    videoId: 'uuid-tabs',
    episodeNumber: null,
    sourceUrl: 'https://example.com/1.m3u8',
    sourceName: '主线路',
    quality: '1080P',
    type: 'hls',
    isActive: true,
    lastChecked: null,
  },
  {
    id: 'src-2',
    videoId: 'uuid-tabs',
    episodeNumber: null,
    sourceUrl: 'https://example.com/2.m3u8',
    sourceName: '备用线路',
    quality: '720P',
    type: 'hls',
    isActive: true,
    lastChecked: null,
  },
]

test.describe('选集 / 线路 tab 稳定（BLOCKER #5 固化）', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`${API_BASE}/videos/${MOCK_ANIME.shortId}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_ANIME }),
      }),
    )
    await page.route(`${API_BASE}/videos/${MOCK_ANIME.shortId}/sources*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: MOCK_SOURCES,
          pagination: { total: 2, page: 1, limit: 20, hasNext: false },
        }),
      }),
    )
    await page.goto(`/en/watch/${MOCK_ANIME.slug}-${MOCK_ANIME.shortId}`)
  })

  test('多集 + 多线路：两个 tab 按钮同时可见', async ({ page }) => {
    await expect(page.getByTestId('player-selection-panel')).toBeVisible({ timeout: 8_000 })
    await expect(page.getByTestId('player-tab-episodes')).toBeVisible()
    await expect(page.getByTestId('player-tab-sources')).toBeVisible()
  })

  test('切到线路 tab 后，选集 tab 仍在 DOM 中（不卸载）', async ({ page }) => {
    await expect(page.getByTestId('player-selection-panel')).toBeVisible({ timeout: 8_000 })
    await page.getByTestId('player-tab-sources').click()
    // 内容区切换：source-bar 应出现
    await expect(page.getByTestId('source-bar')).toBeVisible()
    // 但选集 tab button 本身仍可见（稳定性）
    await expect(page.getByTestId('player-tab-episodes')).toBeVisible()
    // 回切选集 → 选集格子恢复
    await page.getByTestId('player-tab-episodes').click()
    await expect(page.getByTestId('side-episode-1')).toBeVisible()
  })
})

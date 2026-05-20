/**
 * lines-aggregate-display.spec.ts
 * CHG-SN-4-FIX-B 黄金路径：LinesPanel 按线路聚合显示
 *
 * FIX-B 修复点：原平铺行 → 按 (source_site_key, source_name) 聚合为 LineAggregate[]，
 * 共享组件 packages/admin-ui LinesPanel 消费，compact density。
 */

import { test, expect } from '@playwright/test'
import {
  setModeratorCookies,
  installModerationMocks,
  freshState,
  makeQueueRow,
  API_BASE,
} from './_helpers'

const VIDEO_ID = 'vid-fix-b-01'

/** 3 条源：2 条属于 site_a|线A，1 条属于 site_b|线B */
const MOCK_SOURCES = [
  {
    id: 'src-1',
    source_site_key: 'site_a',
    source_name: '线A',
    source_url: 'https://cdn.site-a.com/ep1.m3u8',
    episode_number: 1,
    is_active: true,
    probe_status: 'ok',
    render_status: 'ok',
    latency_ms: 120,
    updated_at: '2026-05-20T00:00:00Z',
    video_title: 'FIX-B 聚合测试',
  },
  {
    id: 'src-2',
    source_site_key: 'site_a',
    source_name: '线A',
    source_url: 'https://cdn.site-a.com/ep2.m3u8',
    episode_number: 2,
    is_active: false,
    probe_status: 'dead',
    render_status: 'dead',
    latency_ms: null,
    updated_at: '2026-05-20T00:00:00Z',
    video_title: 'FIX-B 聚合测试',
  },
  {
    id: 'src-3',
    source_site_key: 'site_b',
    source_name: '线B',
    source_url: 'https://cdn.site-b.com/ep1.m3u8',
    episode_number: 1,
    is_active: true,
    probe_status: 'ok',
    render_status: 'ok',
    latency_ms: 80,
    updated_at: '2026-05-20T00:00:00Z',
    video_title: 'FIX-B 聚合测试',
  },
]

test.describe('FIX-B 黄金路径：LinesPanel 线路聚合显示', () => {
  test.beforeEach(async ({ context, page }) => {
    await setModeratorCookies(context)
    const state = freshState({
      pending: [makeQueueRow({ id: VIDEO_ID, title: 'FIX-B 聚合测试', episodeCount: 2 })],
    })
    await installModerationMocks(page, state)

    // 覆盖 GET /admin/sources?videoId=... → 返回 3 条源
    await page.route(`${API_BASE}/admin/sources*`, async (route) => {
      if (route.request().method() !== 'GET') { await route.continue(); return }
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_SOURCES, total: MOCK_SOURCES.length, page: 1, limit: 100 }),
      })
    })

    await page.goto('/admin/moderation')
    await expect(page.getByTestId('moderation-split')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('FIX-B 聚合测试').first()).toBeVisible()
  })

  test('3 条源聚合为 2 条线路行（data-line-row）', async ({ page }) => {
    // 等待 LinesPanel 加载完成（线路行出现）
    await expect(page.locator('[data-line-row]').first()).toBeVisible({ timeout: 8000 })
    const lineRows = page.locator('[data-line-row]')
    await expect(lineRows).toHaveCount(2)
  })

  test('线路行包含正确的线路 key（site_a|线A / site_b|线B）', async ({ page }) => {
    await expect(page.locator('[data-line-row]').first()).toBeVisible({ timeout: 8000 })
    await expect(page.locator('[data-line-key="site_a|线A"]')).toBeVisible()
    await expect(page.locator('[data-line-key="site_b|线B"]')).toBeVisible()
  })

  test('点击线路行 → 集数列表展开（data-episode-row 可见）', async ({ page }) => {
    await expect(page.locator('[data-line-row]').first()).toBeVisible({ timeout: 8000 })

    // 线路行内含"展开"按钮（aria role 或 expand 按钮），点击展开
    const lineRow = page.locator('[data-line-key="site_a|线A"]').first()
    await lineRow.locator('button').first().click()  // 展开按钮

    // 集数行出现
    await expect(page.locator('[data-episode-row]').first()).toBeVisible({ timeout: 3000 })
  })
})

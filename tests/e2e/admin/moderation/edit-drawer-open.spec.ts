/**
 * edit-drawer-open.spec.ts
 * CHG-SN-4-FIX-A 黄金路径：点击"打开视频编辑" → VideoEditDrawer 弹出
 *
 * FIX-A 修复点：视频编辑跳转改为 Drawer 内嵌（原跳外部页面），
 * DecisionCard 的 BarSignal 样式删除。
 */

import { test, expect } from '@playwright/test'
import {
  setModeratorCookies,
  installModerationMocks,
  freshState,
  makeQueueRow,
  API_BASE,
} from './_helpers'

const VIDEO_ID = 'vid-fix-a-01'

/** 最小化 VideoAdminDetail mock，满足 videoToForm 字段解析 */
function makeVideoDetail(id: string) {
  return {
    id,
    short_id: 'fa01',
    title: 'FIX-A 测试视频',
    title_en: null,
    cover_url: null,
    type: 'movie' as const,
    year: 2026,
    is_published: false,
    source_count: '0',
    visibility_status: 'internal',
    review_status: 'pending_review',
    created_at: '2026-05-20T00:00:00Z',
    updated_at: '2026-05-20T00:00:00Z',
    douban_status: 'pending',
    description: null,
    genres: [],
    country: 'CN',
    episode_count: 1,
    status: 'active',
    rating: null,
    director: [],
    cast: [],
    writers: [],
    douban_id: null,
    meta_score: 80,
    source_check_status: 'ok',
  }
}

test.describe('FIX-A 黄金路径：视频编辑 Drawer 弹出', () => {
  test('点击"打开视频编辑"按钮 → VideoEditDrawer 以 open 状态渲染', async ({ context, page }) => {
    await setModeratorCookies(context)
    const state = freshState({
      pending: [makeQueueRow({ id: VIDEO_ID, title: 'FIX-A 测试视频' })],
    })
    await installModerationMocks(page, state)

    // 追加 GET /admin/videos/:id mock（VideoEditDrawer 的 getVideo 调用）
    await page.route(`${API_BASE}/admin/videos/${VIDEO_ID}`, async (route) => {
      if (route.request().method() !== 'GET') { await route.continue(); return }
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: makeVideoDetail(VIDEO_ID) }),
      })
    })

    await page.goto('/admin/moderation')
    await expect(page.getByTestId('moderation-split')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('FIX-A 测试视频').first()).toBeVisible()

    // PendingCenter 的"打开视频编辑"按钮（aria-label="打开视频编辑"）
    await page.getByRole('button', { name: '打开视频编辑' }).first().click()

    // VideoEditDrawer 打开后 data-testid="data-video-edit-drawer" 可见
    await expect(page.getByTestId('data-video-edit-drawer')).toBeVisible({ timeout: 5000 })
  })

  test('VideoEditDrawer 包含"取消"按钮，点击后关闭', async ({ context, page }) => {
    await setModeratorCookies(context)
    const state = freshState({
      pending: [makeQueueRow({ id: VIDEO_ID, title: 'FIX-A 测试视频' })],
    })
    await installModerationMocks(page, state)
    await page.route(`${API_BASE}/admin/videos/${VIDEO_ID}`, async (route) => {
      if (route.request().method() !== 'GET') { await route.continue(); return }
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: makeVideoDetail(VIDEO_ID) }),
      })
    })

    await page.goto('/admin/moderation')
    await expect(page.getByTestId('moderation-split')).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: '打开视频编辑' }).first().click()
    await expect(page.getByTestId('data-video-edit-drawer')).toBeVisible({ timeout: 5000 })

    // 关闭 Drawer
    await page.getByRole('button', { name: '关闭' }).click()
    await expect(page.getByTestId('data-video-edit-drawer')).not.toBeVisible()
  })
})

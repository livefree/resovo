/**
 * right-pane-tabs.spec.ts
 * CHG-SN-4-FIX-C 黄金路径：右栏三 Tab 切换（详情/历史/类似）
 *
 * FIX-C 修复点：右栏从静态详情展示 → 三 Tab segment（detail/history/similar），
 * sessionStorage 持久化选中 Tab（key: admin.moderation.rightTab.v1）。
 */

import { test, expect } from '@playwright/test'
import {
  setModeratorCookies,
  installModerationMocks,
  freshState,
  makeQueueRow,
  API_BASE,
} from './_helpers'

const VIDEO_ID = 'vid-fix-c-01'

test.describe('FIX-C 黄金路径：右栏三 Tab 切换', () => {
  test.beforeEach(async ({ context, page }) => {
    await setModeratorCookies(context)
    const state = freshState({
      pending: [makeQueueRow({ id: VIDEO_ID, title: 'FIX-C Tab 测试视频' })],
    })
    await installModerationMocks(page, state)

    // 追加 audit-log mock（历史 Tab 需要）
    await page.route(`${API_BASE}/admin/moderation/${VIDEO_ID}/audit-log*`, async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'log-1',
              actorId: 'user-1',
              actorUsername: 'mod01',
              actionType: 'video.approve',
              targetKind: 'video',
              targetId: VIDEO_ID,
              beforeJsonb: null,
              afterJsonb: null,
              requestId: null,
              createdAt: '2026-05-20T10:00:00Z',
            },
          ],
          pagination: { total: 1, page: 1, limit: 20, hasNext: false },
        }),
      })
    })

    await page.goto('/admin/moderation')
    await expect(page.getByTestId('moderation-split')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('FIX-C Tab 测试视频').first()).toBeVisible()
  })

  test('默认显示"详情" Tab（aria-selected=true）', async ({ page }) => {
    // RightPane 的 tablist（aria-label="详情/历史/类似"）
    const tablist = page.getByRole('tablist', { name: '详情/历史/类似' })
    await expect(tablist).toBeVisible({ timeout: 5000 })

    const detailTab = tablist.getByRole('tab', { name: '详情' })
    await expect(detailTab).toHaveAttribute('aria-selected', 'true')
  })

  test('点击"历史" Tab → 切换为 active，审核记录显示', async ({ page }) => {
    const tablist = page.getByRole('tablist', { name: '详情/历史/类似' })
    await expect(tablist).toBeVisible({ timeout: 5000 })

    await tablist.getByRole('tab', { name: '历史' }).click()
    await expect(tablist.getByRole('tab', { name: '历史' })).toHaveAttribute('aria-selected', 'true')
    await expect(tablist.getByRole('tab', { name: '详情' })).toHaveAttribute('aria-selected', 'false')

    // 历史 Tab 内容：audit log 中的 "通过" 动作应显示
    await expect(page.getByText('通过').first()).toBeVisible({ timeout: 5000 })
  })

  test('点击"类似" Tab → 显示占位文案', async ({ page }) => {
    const tablist = page.getByRole('tablist', { name: '详情/历史/类似' })
    await expect(tablist).toBeVisible({ timeout: 5000 })

    await tablist.getByRole('tab', { name: '类似' }).click()
    await expect(tablist.getByRole('tab', { name: '类似' })).toHaveAttribute('aria-selected', 'true')

    // CHG-E2E-GATE-AUDIT-C 契约对齐：TabSimilar 已真实化（CHG-SN-8-04-VIEW / ADR-137 /
    // CHG-VIR-9-C identity），原 M-SN-5 占位文案退役；_helpers mock similar 端点空结果
    // → EmptyState「未找到类似视频」
    await expect(page.getByText('未找到类似视频')).toBeVisible({ timeout: 3000 })
  })

  test('Tab 切换持久化到 sessionStorage', async ({ page }) => {
    const tablist = page.getByRole('tablist', { name: '详情/历史/类似' })
    await expect(tablist).toBeVisible({ timeout: 5000 })

    await tablist.getByRole('tab', { name: '历史' }).click()

    // sessionStorage 中应保存 "history"
    const stored = await page.evaluate(() =>
      window.sessionStorage.getItem('admin.moderation.rightTab.v1')
    )
    expect(stored).toBe('history')
  })
})

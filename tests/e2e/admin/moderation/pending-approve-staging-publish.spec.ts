/**
 * pending-approve-staging-publish.spec.ts
 * CHG-SN-4-10-C / plan v1.4 §11.1：黄金路径正向
 *
 * 待审核 → 通过 → 进入 staging → 发布上架
 */

import { test, expect } from '@playwright/test'
import { setModeratorCookies, installModerationMocks, freshState, makeQueueRow, findWrites } from './_helpers'

test.describe('moderation 黄金路径：approve → staging → publish', () => {
  test('单条审核通过 → 进入 staging → 手动发布上架', async ({ context, page }) => {
    await setModeratorCookies(context)
    const VIDEO_ID = 'vid-mod-golden-01'
    const state = freshState({ pending: [makeQueueRow({ id: VIDEO_ID, title: '黄金路径正向用例' })] })
    await installModerationMocks(page, state)

    // 1. 进入审核台 → 默认 pending tab
    await page.goto('/admin/moderation')
    await expect(page.getByTestId('moderation-split')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('黄金路径正向用例').first()).toBeVisible()

    // 2. 点击"通过"按钮 → 触发 POST /admin/videos/:id/review
    const approveReq = page.waitForRequest(
      (r) => r.url().includes(`/admin/videos/${VIDEO_ID}/review`) && r.method() === 'POST',
    )
    await page.getByRole('button', { name: '通过视频' }).click()
    await approveReq

    // 3. mock 后 pending 列表为空 → 视频已迁到 staging
    await expect.poll(() => state.pending.length).toBe(0)
    await expect.poll(() => state.staging.length).toBe(1)
    expect(state.staging[0].reviewStatus).toBe('approved')

    // 4. 切到 staging tab → 看到该视频
    await page.getByRole('button', { name: '待发布', exact: true }).first().click()
    await page.waitForURL(/tab=staging/)
    await expect(page.getByText('黄金路径正向用例').first()).toBeVisible({ timeout: 5000 })

    // 5. 触发发布（模拟点击发布按钮 → POST /admin/staging/:id/publish）
    //    StagingTabContent 的"发布上架"按钮文案见 i18n.staging.publishOne = '↑ 发布上架'
    const publishReq = page.waitForRequest(
      (r) => r.url().includes(`/admin/staging/${VIDEO_ID}/publish`) && r.method() === 'POST',
    )
    await page.getByRole('button', { name: /发布上架/ }).first().click()
    await publishReq

    // 6. 状态：is_published=true / visibilityStatus=public
    await expect.poll(() => state.staging[0]?.isPublished).toBe(true)
    expect(state.staging[0].visibilityStatus).toBe('public')

    // 7. 写操作 spy：1 review approve + 1 publish
    expect(findWrites(state, (w) => w.path.endsWith(`/${VIDEO_ID}/review`)).length).toBe(1)
    expect(findWrites(state, (w) => w.path.endsWith(`/${VIDEO_ID}/publish`)).length).toBe(1)
  })
})

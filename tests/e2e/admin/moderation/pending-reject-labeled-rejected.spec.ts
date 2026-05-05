/**
 * pending-reject-labeled-rejected.spec.ts
 * CHG-SN-4-10-C / plan v1.4 §11.1：黄金路径反向
 *
 * 待审核 → 拒绝（选预设标签 + 附言）→ 已拒绝列表展示 → 重新审核
 */

import { test, expect } from '@playwright/test'
import { setModeratorCookies, installModerationMocks, freshState, makeQueueRow, findWrites } from './_helpers'

test.describe('moderation 黄金路径：reject → rejected → reopen', () => {
  test('拒绝（标签 + 附言）→ 已拒绝列表 → 重新审核回 pending', async ({ context, page }) => {
    await setModeratorCookies(context)
    const VIDEO_ID = 'vid-mod-reject-01'
    const state = freshState({ pending: [makeQueueRow({ id: VIDEO_ID, title: '待拒绝测试视频' })] })
    await installModerationMocks(page, state)

    await page.goto('/admin/moderation')
    await expect(page.getByTestId('moderation-split')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('待拒绝测试视频').first()).toBeVisible()

    // 1. 点击"拒绝视频"按钮 → RejectModal 打开
    await page.getByRole('button', { name: '拒绝视频' }).click()
    await expect(page.locator('[data-reject-modal-form]')).toBeVisible({ timeout: 5000 })

    // 2. 选标签（label_key=porn）+ 填附言 + 提交
    await page.locator('[data-reject-modal-label="porn"]').click()
    await page.locator('[data-reject-modal-reason]').fill('内容不合规')

    const rejectReq = page.waitForRequest(
      (r) => r.url().includes(`/admin/moderation/${VIDEO_ID}/reject-labeled`) && r.method() === 'POST',
    )
    await page.locator('[data-reject-modal-submit]').click()
    await rejectReq

    // 3. mock 后 pending 空、rejected +1
    await expect.poll(() => state.pending.length).toBe(0)
    await expect.poll(() => state.rejected.length).toBe(1)
    expect(state.rejected[0].reviewLabelKey).toBe('porn')
    expect(state.rejected[0].reviewReason).toBe('内容不合规')

    // 4. 切到"已拒绝" tab → 看到该视频
    await page.getByRole('button', { name: /^已拒绝$/, exact: false }).first().click()
    await page.waitForURL(/tab=rejected/)
    await expect(page.getByText('待拒绝测试视频').first()).toBeVisible({ timeout: 5000 })

    // 5. 点击"重新审核"按钮 → POST reopen
    const reopenReq = page.waitForRequest(
      (r) => r.url().includes(`/admin/moderation/${VIDEO_ID}/reopen`) && r.method() === 'POST',
    )
    // RejectedTabContent 的"重新审核"按钮 aria-label = M.aria.rejectedReopen = '重新开审'
    await page.getByRole('button', { name: '重新开审' }).first().click()
    await reopenReq

    // 6. 状态回 pending
    await expect.poll(() => state.rejected.length).toBe(0)
    await expect.poll(() => state.pending.length).toBe(1)
    expect(state.pending[0].reviewStatus).toBe('pending_review')

    // 7. 写操作 spy：1 reject + 1 reopen
    expect(findWrites(state, (w) => w.path.endsWith('/reject-labeled')).length).toBe(1)
    expect(findWrites(state, (w) => w.path.endsWith('/reopen')).length).toBe(1)
  })
})

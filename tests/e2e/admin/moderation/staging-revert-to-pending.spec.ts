/**
 * staging-revert-to-pending.spec.ts
 * CHG-SN-4-10-C / plan v1.4 §11.1：staging → 退回审核（D-01 状态机扩展验证）
 */

import { test, expect } from '@playwright/test'
import { setModeratorCookies, installModerationMocks, freshState, makeQueueRow, findWrites } from './_helpers'

test.describe('moderation 黄金路径：staging → revert → pending', () => {
  test('暂存视频退回审核 → 回到 pending tab', async ({ context, page }) => {
    await setModeratorCookies(context)
    const VIDEO_ID = 'vid-mod-revert-01'
    const state = freshState({
      staging: [makeQueueRow({ id: VIDEO_ID, title: '待退回测试视频', reviewStatus: 'approved', visibilityStatus: 'internal' })],
    })
    await installModerationMocks(page, state)

    // 1. 进 staging 独立页（CHG-SN-7-REDO-04-C：?tab=staging 已迁 /admin/staging，
    //    审核台残留 tab 深链仅做 redirect——直接访问真源页）
    await page.goto('/admin/staging')
    await expect(page.getByText('待退回测试视频').first()).toBeVisible({ timeout: 10000 })

    // 2. 点击行内"退回"按钮（REDO-04-B 文案：退回审核 → 退回）→ POST /admin/staging/:id/revert
    const revertReq = page.waitForRequest(
      (r) => r.url().includes(`/admin/staging/${VIDEO_ID}/revert`) && r.method() === 'POST',
    )
    await page.getByRole('button', { name: '退回', exact: true }).first().click()
    await revertReq

    // 3. mock 后 staging 空，pending +1
    await expect.poll(() => state.staging.length).toBe(0)
    await expect.poll(() => state.pending.length).toBe(1)
    expect(state.pending[0].reviewStatus).toBe('pending_review')
    expect(state.pending[0].isPublished).toBe(false)

    // 4. 写操作 spy：1 revert
    expect(findWrites(state, (w) => w.path.endsWith('/revert')).length).toBe(1)
  })
})

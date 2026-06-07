/**
 * refetch-sources-then-reopen.spec.ts
 * CHG-SN-4-10-C / plan v1.4 §11.1：已拒绝 → 触发补源 → 重新进入待审核
 *
 * 实际流程拆分：
 *   - 触发补源：在 pending tab 的 LinesPanel 点"重新抓取"按钮（POST /admin/videos/:id/refetch-sources）
 *     —— 业务上 admin 在 LinesPanel 看到源失效后触发补源；rejected tab 本身无 refetch 按钮
 *   - reopen 部分已被 pending-reject-labeled-rejected.spec.ts 覆盖
 */

import { test, expect } from '@playwright/test'
import { setModeratorCookies, installModerationMocks, freshState, makeQueueRow, findWrites } from './_helpers'

test.describe('moderation 黄金路径：refetch-sources（LinesPanel 入口）', () => {
  test('LinesPanel 点击重新抓取 → POST refetch-sources 返回 202', async ({ context, page }) => {
    await setModeratorCookies(context)
    const VIDEO_ID = 'vid-mod-refetch-01'
    const state = freshState({
      pending: [makeQueueRow({
        id: VIDEO_ID,
        title: '待补源测试视频',
        sourceCheckStatus: 'all_dead',
        probe: 'dead',
        render: 'dead',
        probeAggregate: { total: 1, ok: 0, state: 'all_dead' },
        renderAggregate: { total: 1, ok: 0, state: 'all_dead' },
      })],
    })
    await installModerationMocks(page, state)

    await page.goto('/admin/moderation')
    await expect(page.getByTestId('moderation-split')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('待补源测试视频').first()).toBeVisible()

    // CHG-E2E-GATE-AUDIT-C 契约对齐：refetch 入口已为 LinesPanel（admin-ui composite）
    // header 的「刷新」按钮（aria-label="刷新线路数据"），原「重新抓取」文案退役；
    // 端点不变（use-source-lines-controller.refetch → POST refetch-sources）
    const refetchReq = page.waitForRequest(
      (r) => r.url().includes(`/admin/videos/${VIDEO_ID}/refetch-sources`) && r.method() === 'POST',
    )
    await page.getByRole('button', { name: '刷新线路数据' }).first().click()
    const refetchResp = await refetchReq

    // POST refetch-sources 返回 202（plan §3.0.5 video.refetch_sources 端点契约）
    expect((await refetchResp.response())?.status()).toBe(202)

    // 写操作 spy：1 refetch-sources
    expect(findWrites(state, (w) => w.path.endsWith('/refetch-sources')).length).toBe(1)
  })
})

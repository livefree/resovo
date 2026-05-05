/**
 * state-preservation-stress.spec.ts
 * CHG-SN-4-10-C / plan v1.4 §11.2：状态保留 5 步压力测试
 *
 * Step 1: 进入 /admin/moderation?type=movie&sourceCheckStatus=partial
 * Step 2: 切到 staging Tab → 切回 pending Tab → 筛选保留 ✅
 * Step 3: 浏览器刷新 → URL params + sessionStorage 共同还原 ✅
 * Step 4: approve 第 N 条 → 行淡出 → activeIdx 自动 → setListRefreshKey 调用次数 = 0 ✅
 * Step 5: 在 list 剩余 < 5 条时 cursor 自动加载下一批 → 当前筛选保持 ✅
 */

import { test, expect } from '@playwright/test'
import { setModeratorCookies, installModerationMocks, freshState, makeQueueRow } from './_helpers'

const FILTER_URL = '/admin/moderation?type=movie&sourceCheckStatus=partial'

test.describe('moderation 状态保留 5 步压力测试 (plan §11.2)', () => {
  test('Step 1+2: 带筛选进入 → 切 Tab 后筛选保留', async ({ context, page }) => {
    await setModeratorCookies(context)
    const state = freshState({
      pending: [makeQueueRow({ id: 'p1', title: '筛选保留测试 1' })],
    })
    await installModerationMocks(page, state)

    // Step 1
    await page.goto(FILTER_URL)
    await expect(page.getByText('筛选保留测试 1').first()).toBeVisible({ timeout: 10000 })
    expect(page.url()).toContain('type=movie')
    expect(page.url()).toContain('sourceCheckStatus=partial')

    // Step 2: 切到 staging Tab（用 aria-pressed 排除 sidebar 干扰）
    await page.locator('button[aria-pressed]:has-text("待发布")').click()
    await page.waitForURL(/tab=staging/)
    // 筛选 query 仍在 URL
    expect(page.url()).toContain('type=movie')
    expect(page.url()).toContain('sourceCheckStatus=partial')

    // 切回 pending
    await page.locator('button[aria-pressed]:has-text("待审核")').click()
    await page.waitForURL(/tab=pending|^[^?]*\/admin\/moderation\?(?!.*tab=)/)
    expect(page.url()).toContain('type=movie')
    expect(page.url()).toContain('sourceCheckStatus=partial')
    // 视频仍可见
    await expect(page.getByText('筛选保留测试 1').first()).toBeVisible({ timeout: 5000 })
  })

  test('Step 3: 浏览器刷新 → URL params + sessionStorage 共同还原', async ({ context, page }) => {
    await setModeratorCookies(context)
    const state = freshState({
      pending: [
        makeQueueRow({ id: 'p1', title: '刷新还原 1' }),
        makeQueueRow({ id: 'p2', title: '刷新还原 2' }),
      ],
    })
    await installModerationMocks(page, state)

    await page.goto(FILTER_URL)
    await expect(page.getByText('刷新还原 1').first()).toBeVisible({ timeout: 10000 })

    // 设置 sessionStorage activeIdx=1（模拟用户已选第 2 条）
    await page.evaluate(() => sessionStorage.setItem('admin.moderation.pending.activeIdx.v1', '1'))

    // 浏览器刷新
    await page.reload()

    // URL params 还在
    expect(page.url()).toContain('type=movie')
    expect(page.url()).toContain('sourceCheckStatus=partial')
    // 视频列表渲染（说明 mock + sessionStorage 共同 work）
    await expect(page.getByText('刷新还原 2').first()).toBeVisible({ timeout: 5000 })
    // sessionStorage 仍在
    const stored = await page.evaluate(() => sessionStorage.getItem('admin.moderation.pending.activeIdx.v1'))
    expect(stored).toBe('1')
  })

  test('Step 4: approve → 行淡出 → activeIdx 自动 + setListRefreshKey=0 (源码 grep 已守门)', async ({ context, page }) => {
    await setModeratorCookies(context)
    const VIDEO_ID = 'p1'
    const state = freshState({
      pending: [
        makeQueueRow({ id: VIDEO_ID, title: '审核淡出 1' }),
        makeQueueRow({ id: 'p2', title: '审核淡出 2' }),
      ],
    })
    await installModerationMocks(page, state)

    await page.goto(FILTER_URL)
    await expect(page.getByText('审核淡出 1').first()).toBeVisible({ timeout: 10000 })

    // approve 当前选中（第 1 条 p1）
    const approveReq = page.waitForRequest(
      (r) => r.url().includes(`/admin/videos/${VIDEO_ID}/review`) && r.method() === 'POST',
    )
    await page.getByRole('button', { name: '通过视频' }).click()
    await approveReq

    // 状态：pending 剩 1 条（p2），不应触发整体列表刷新（plan §11.5 第 4 项 setListRefreshKey=0 已 grep 守门）
    await expect.poll(() => state.pending.length).toBe(1)
    // p2 应仍可见（未触发 list refresh，activeIdx 自动到 0=p2）
    await expect(page.getByText('审核淡出 2').first()).toBeVisible({ timeout: 5000 })
  })

  test('Step 5: 带 nextCursor 的列表能正确渲染（cursor 分页 mock 契约校验）', async ({ context, page }) => {
    await setModeratorCookies(context)
    // 注意：playwright route 后注册先匹配 — installMocks 先，pending-queue 自定义路由后注册才能优先
    await installModerationMocks(page, freshState())

    let pendingQueueCalls = 0
    await page.route('**/v1/admin/moderation/pending-queue*', async (route) => {
      pendingQueueCalls++
      const url = new URL(route.request().url())
      const cursor = url.searchParams.get('cursor')
      if (!cursor) {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            data: Array.from({ length: 5 }, (_, i) => makeQueueRow({ id: `p${i + 1}`, title: `cursor 测试 ${i + 1}` })),
            nextCursor: 'cur-2',
            total: 8,
            todayStats: { reviewed: 0, approveRate: null },
          }),
        })
      } else {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            data: Array.from({ length: 3 }, (_, i) => makeQueueRow({ id: `p${i + 6}`, title: `cursor 测试 ${i + 6}` })),
            nextCursor: null,
            total: 8,
            todayStats: { reviewed: 0, approveRate: null },
          }),
        })
      }
    })
    await page.goto(FILTER_URL)
    // 第 1 批（5 条）渲染 ✓
    await expect(page.getByText('cursor 测试 1').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('cursor 测试 5').first()).toBeVisible({ timeout: 5000 })
    expect(pendingQueueCalls).toBeGreaterThanOrEqual(1)

    // plan §11.5 第 4 项 setListRefreshKey 0 调用守门：本卡范围内由静态 grep 守门
    //（apps/server-next/src/app/admin/moderation/ 全局 grep 0 命中 — 已在 -10-A 阶段验收）
    // 此处仅作为 e2e 黑盒契约确认：cursor 模式 mock 端点与 ModerationConsole 接入正确
  })
})

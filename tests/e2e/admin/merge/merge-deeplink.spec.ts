/**
 * tests/e2e/admin/merge/merge-deeplink.spec.ts
 * CHG-VIR-13 系列收口硬前置 ②（13-WS ⑤ 登记）：merge 工作台深链升级映射回归
 *
 * 覆盖（13-WS deriveWorkspace 升级映射 + 13-C2 records 双子视图）：
 *   1. 无参数 → 默认 candidates + Segment 4 区渲染
 *   2. ?candidate_a&candidate_b → mode=merge 推导（工作区渲染）
 *   3. ?ids=csv → mode=merge（batch 形态）
 *   4. ?split=<id> → mode=split（拆分工作台 + 自动加载）
 *   5. ?tab=merged → mode=records（旧深链升级映射）
 *   6. records 双子视图：操作时间线 ↔ 决策记录切换（13-C2）
 *
 * 前提：apps/server-next 运行于 localhost:3003（admin-next-chromium project 注入 baseURL）
 * API：page.route 全量拦截（不依赖真实后端）；认证：cookie 注入（dashboard.spec 同范式）
 */

import { test, expect, type BrowserContext, type Page } from '@playwright/test'

const API_BASE = 'http://localhost:4000/v1'

const VID_A = '11111111-1111-1111-1111-111111111111'
const VID_B = '22222222-2222-2222-2222-222222222222'

async function setAdminCookies(context: BrowserContext) {
  await context.addCookies([
    { name: 'refresh_token', value: 'mock-admin-rt', domain: 'localhost', path: '/', httpOnly: true, secure: false, sameSite: 'Strict' },
    { name: 'user_role', value: 'admin', domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Strict' },
  ])
}

/** merge 页全 API mock（候选 / audit / decisions / videos 搜索 / 线路矩阵 / 拆分建议）。
 *  注意：playwright URL glob 中 `?` 是单字符通配符 → query 端点用 RegExp 锚定；
 *  另设 catch-all 兜底（先注册 = 最后匹配）拦截 admin-shell 等旁路请求，
 *  防 mock cookie 打真实 :4000 → 401 → 前端跳 /login（CHG-VSR-PRE-2 既见模式）。 */
async function installMergeMocks(page: Page) {
  const empty = { data: [], total: 0, page: 1, limit: 20 }
  const json = (body: unknown) => ({ contentType: 'application/json', body: JSON.stringify(body) })

  // catch-all 兜底（最先注册 → 最后匹配）：未显式 mock 的 /v1/** 一律 200 空包络
  await page.route(`${API_BASE}/**`, (route) => route.fulfill(json(empty)))

  await page.route(new RegExp('/v1/admin/video-merges/candidates(\\?|$)'), (route) =>
    route.fulfill(json({ ...empty, source: 'identity' })))
  await page.route(new RegExp('/v1/admin/video-merges/audit(\\?|$)'), (route) =>
    route.fulfill(json(empty)))
  await page.route(new RegExp('/v1/admin/identity-decisions(\\?|$)'), (route) =>
    route.fulfill(json(empty)))
  // VideoPicker fetcher / 深链成员预填（按 q 返回对应行）
  await page.route(new RegExp('/v1/admin/videos\\?'), (route) => {
    const url = new URL(route.request().url())
    const q = url.searchParams.get('q') ?? ''
    const rows = [VID_A, VID_B]
      .filter((id) => q === '' || id === q)
      .map((id) => ({
        id, short_id: id.slice(0, 8), title: `E2E 视频 ${id.slice(0, 4)}`, title_en: null,
        type: 'movie', year: 2024, cover_url: null, is_published: false,
      }))
    return route.fulfill(json({ data: rows, total: rows.length, page: 1, limit: 20 }))
  })
  // split 自动加载线路矩阵 + 拆分建议
  await page.route(new RegExp('/v1/admin/sources/video-groups/[^/]+/matrix'), (route) =>
    route.fulfill(json({ data: [] })))
  await page.route(new RegExp('/v1/admin/videos/[^/]+/split-suggestions'), (route) =>
    route.fulfill(json({ data: { videoId: VID_A, suggestible: false, dimension: null, signals: [], groups: [], unassignedLines: [] } })))
}

test.describe('merge 工作台深链升级映射（CHG-VIR-13 系列收口 ②）', () => {
  test.beforeEach(async ({ context, page }) => {
    await setAdminCookies(context)
    await installMergeMocks(page)
  })

  test('1. 无参数 → 默认 candidates + Segment 4 区', async ({ page }) => {
    await page.goto('/admin/merge')
    await expect(page.getByTestId('merge-mode-segment')).toBeVisible()
    // Segment 4 区 labels
    for (const label of ['待审候选', '合并工作区', '拆分工作区', '操作记录']) {
      await expect(page.getByTestId('merge-mode-segment').getByText(label)).toBeVisible()
    }
  })

  test('2. ?candidate_a&candidate_b → mode=merge 工作区 + 成员预填', async ({ page }) => {
    await page.goto(`/admin/merge?candidate_a=${VID_A}&candidate_b=${VID_B}&from=moderation`)
    await expect(page.getByTestId('merge-workspace')).toBeVisible()
    // 深链成员预填（fetch 充实标题）
    await expect(page.getByTestId(`merge-member-${VID_A}`)).toBeVisible()
    await expect(page.getByTestId(`merge-member-${VID_B}`)).toBeVisible()
    // 来源回链栏（13-A1）
    await expect(page.getByTestId('merge-entry-source-bar')).toBeVisible()
  })

  test('3. ?ids=csv → mode=merge（batch 形态升级映射）', async ({ page }) => {
    await page.goto(`/admin/merge?ids=${VID_A},${VID_B}&from=moderation-batch`)
    await expect(page.getByTestId('merge-workspace')).toBeVisible()
    await expect(page.getByTestId('merge-workspace-count')).toContainText('成员')
  })

  test('4. ?split=<id> → mode=split 拆分工作台', async ({ page }) => {
    await page.goto(`/admin/merge?split=${VID_A}&from=videos-split`)
    await expect(page.getByTestId('split-video-picker')).toBeVisible()
  })

  test('5. ?tab=merged → mode=records（旧深链升级映射）', async ({ page }) => {
    await page.goto('/admin/merge?tab=merged')
    await expect(page.getByTestId('records-view-segment')).toBeVisible()
  })

  test('6. records 双子视图切换：操作时间线 ↔ 决策记录（13-C2）', async ({ page }) => {
    await page.goto('/admin/merge?mode=records')
    await expect(page.getByTestId('records-view-segment')).toBeVisible()
    await page.getByTestId('records-view-segment').getByText('决策记录').click()
    await expect(page.getByTestId('merge-decisions-section')).toBeVisible()
    await page.getByTestId('records-view-segment').getByText('操作时间线').click()
    await expect(page.getByTestId('merge-decisions-section')).toHaveCount(0)
  })
})

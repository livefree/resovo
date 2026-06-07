/**
 * tests/e2e/admin/home/home-ops.spec.ts
 *
 * CHG-HOME-E2E-SPEC（SEQ-20260605-05 卡 21）：/admin/home 域金路径
 * （治理方案 §14「后台 /admin/home 有 E2E 覆盖」收口；此前零命中）
 *
 * 覆盖：
 *   A. 画布渲染 + 区块切换/Inspector smoke + settings 保存（端点 #1/#3）
 *   B. 卡片操作金路径：reorder spy / 删除 modal / 发布切换（ADR-104 资源级）
 *   C. 候选池金路径：解释展示（filtered 标灰）/ 应用 #5 / 立即刷新 #7 / 未生成态（端点 #4/#5/#7）
 *   D. Banner 编辑 + 横图警告态（§6 警告级不阻断）
 *
 * 范式：_helpers 基座（shell-mocks + 类型绑定 @resovo/types）；写路径经 state.writes spy 断言。
 */

import { test, expect, type Page } from '@playwright/test'
import {
  setAdminCookies,
  installHomeOpsMocks,
  freshState,
  findWrites,
  makeModule,
  makeCandidate,
  type HomeOpsMockState,
} from './_helpers'

test.describe('/admin/home 金路径', () => {
  let state: HomeOpsMockState

  async function gotoHome(page: Page) {
    await page.goto('/admin/home')
    await expect(page.getByTestId('home-ops-page-header')).toBeVisible()
  }

  async function enterCanvas(page: Page) {
    await page.getByTestId('home-view-toggle-btn').click()
    await expect(page.getByTestId('home-canvas-wrap')).toBeVisible()
  }

  test.beforeEach(async ({ context }) => {
    await setAdminCookies(context)
    state = freshState()
  })

  // ── A. 画布渲染 + 区块切换 / Inspector ────────────────────────────────

  test('画布渲染：7 区块 + 生成时间戳 + 初始 Inspector 空态', async ({ page }) => {
    await installHomeOpsMocks(page, state)
    await gotoHome(page)
    await enterCanvas(page)

    await expect(page.getByTestId('canvas-generated-at')).toBeVisible()
    for (const key of ['banner', 'type_shortcuts', 'featured', 'top10', 'hot_movies', 'hot_series', 'hot_anime']) {
      await expect(page.getByTestId(`canvas-section-${key}`)).toBeVisible()
    }
    await expect(page.getByTestId('inspector-empty')).toBeVisible()
  })

  test('区块切换：点击 hot_movies → Inspector 联动 + settings 回显', async ({ page }) => {
    await installHomeOpsMocks(page, state)
    await gotoHome(page)
    await enterCanvas(page)

    await page.getByTestId('canvas-mode-hot_movies').click()
    await expect(page.getByTestId('section-inspector-hot_movies')).toBeVisible()
    // settings 回显（freshState 默认 displayCount=3 / mode=manual_plus_autofill）
    await expect(page.getByTestId('inspector-display-count').locator('input')).toHaveValue('3')
    await expect(page.getByTestId('inspector-autofill-mode')).toBeVisible()

    // 切换到 featured → Inspector 跟随
    await page.getByTestId('canvas-mode-featured').click()
    await expect(page.getByTestId('section-inspector-featured')).toBeVisible()
  })

  test('Inspector 保存：改 displayCount → PATCH settings spy（端点 #3）', async ({ page }) => {
    await installHomeOpsMocks(page, state)
    await gotoHome(page)
    await enterCanvas(page)

    await page.getByTestId('canvas-mode-hot_movies').click()
    await page.getByTestId('inspector-display-count').locator('input').fill('5')
    await page.getByTestId('inspector-save-btn').click()

    await expect
      .poll(() => findWrites(state, 'PATCH', '/v1/admin/home/sections/hot_movies/settings').length)
      .toBe(1)
    const write = findWrites(state, 'PATCH', '/v1/admin/home/sections/hot_movies/settings')[0]!
    expect((write.body as { displayCount: number }).displayCount).toBe(5)
  })

  // ── B. 卡片操作金路径（list 视图，ADR-104 资源级）──────────────────────

  test('删除：精选模块 → 确认 modal → DELETE spy + 列表移除', async ({ page }) => {
    state.modules = [
      makeModule({ id: 'm-a', slot: 'featured', title: { 'zh-CN': '甲卡' } }),
      makeModule({ id: 'm-b', slot: 'featured', ordering: 1, title: { 'zh-CN': '乙卡' } }),
    ]
    await installHomeOpsMocks(page, state)
    await gotoHome(page)
    await page.getByTestId('home-slot-segment').getByText('精选推荐').click()

    await expect(page.getByTestId('home-module-card-m-a')).toBeVisible()
    await page.getByTestId('home-module-delete-m-a').click()
    await expect(page.getByTestId('home-module-delete-modal')).toBeVisible()
    await page.getByTestId('home-module-delete-confirm').click()

    await expect
      .poll(() => findWrites(state, 'DELETE', '/v1/admin/home-modules/m-a').length)
      .toBe(1)
    await expect(page.getByTestId('home-module-card-m-a')).not.toBeVisible()
    await expect(page.getByTestId('home-module-card-m-b')).toBeVisible()
  })

  test('发布切换：toggle → POST publish-toggle spy + 文案翻转', async ({ page }) => {
    state.modules = [makeModule({ id: 'm-a', slot: 'featured', enabled: true })]
    await installHomeOpsMocks(page, state)
    await gotoHome(page)
    await page.getByTestId('home-slot-segment').getByText('精选推荐').click()

    const toggle = page.getByTestId('home-module-toggle-m-a')
    await expect(toggle).toHaveText('隐藏') // enabled=true → 动作为隐藏
    await toggle.click()

    await expect
      .poll(() => findWrites(state, 'POST', '/v1/admin/home-modules/m-a/publish-toggle').length)
      .toBe(1)
    const write = findWrites(state, 'POST', '/v1/admin/home-modules/m-a/publish-toggle')[0]!
    expect((write.body as { enabled: boolean }).enabled).toBe(false)
  })

  test('拖拽排序：甲卡拖至乙卡 → POST reorder spy（items 序对换）', async ({ page }) => {
    state.modules = [
      makeModule({ id: 'm-a', slot: 'featured', ordering: 0, title: { 'zh-CN': '甲卡' } }),
      makeModule({ id: 'm-b', slot: 'featured', ordering: 1, title: { 'zh-CN': '乙卡' } }),
    ]
    await installHomeOpsMocks(page, state)
    await gotoHome(page)
    await page.getByTestId('home-slot-segment').getByText('精选推荐').click()
    await expect(page.getByTestId('home-module-card-m-b')).toBeVisible()

    // dnd-kit PointerSensor：手动鼠标步进（handle 按下 → 分步移动到目标卡 → 释放）
    const handle = page.getByTestId('home-module-card-m-a').getByLabel('拖拽排序')
    const target = page.getByTestId('home-module-card-m-b')
    const from = await handle.boundingBox()
    const to = await target.boundingBox()
    expect(from && to).toBeTruthy()
    await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2)
    await page.mouse.down()
    await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 8 })
    await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2 + 4, { steps: 2 })
    await page.mouse.up()

    await expect
      .poll(() => findWrites(state, 'POST', '/v1/admin/home-modules/reorder').length)
      .toBe(1)
    const write = findWrites(state, 'POST', '/v1/admin/home-modules/reorder')[0]!
    const items = (write.body as { items: Array<{ id: string; ordering: number }> }).items
    expect(items.map((i) => i.id)).toEqual(['m-b', 'm-a'])
  })

  // ── C. 候选池金路径（端点 #4/#5/#7）───────────────────────────────────

  test('解释展示：候选行渲染 + filtered 条目同列表展示（include_filtered）+ 快照 meta', async ({ page }) => {
    state.pools.set('hot_movies', {
      candidates: [
        makeCandidate('c1', { score: 0.91, rank: 1, origin: 'douban' }),
        makeCandidate('c2', { filtered: true, filterReason: 'not_published', rank: 2 }),
      ],
      snapshotAt: '2026-06-07T00:30:00Z',
      policyVersion: 'hp-v1',
      gaps: [],
    })
    await installHomeOpsMocks(page, state)
    await gotoHome(page)
    await enterCanvas(page)
    await page.getByTestId('canvas-mode-hot_movies').click()

    await expect(page.getByTestId('candidate-pool-hot_movies')).toBeVisible()
    await expect(page.getByTestId('candidate-pool-meta')).toBeVisible()
    await expect(page.getByTestId('candidate-row-c1')).toBeVisible()
    await expect(page.getByTestId('candidate-row-c2')).toBeVisible()
    // filtered 条目不可勾选（仅解释展示，方案 §12 标灰语义）
    await expect(page.getByTestId('candidate-check-c1')).toBeVisible()
    await expect(page.getByTestId('candidate-check-c2')).not.toBeVisible()
  })

  test('应用：勾选候选 → 应用按钮 → POST apply-autofill spy（端点 #5）', async ({ page }) => {
    state.pools.set('hot_movies', {
      candidates: [makeCandidate('c1'), makeCandidate('c3', { rank: 2 })],
      snapshotAt: '2026-06-07T00:30:00Z',
      policyVersion: 'hp-v1',
      gaps: [],
    })
    await installHomeOpsMocks(page, state)
    await gotoHome(page)
    await enterCanvas(page)
    await page.getByTestId('canvas-mode-hot_movies').click()

    const applyBtn = page.getByTestId('candidate-pool-apply-btn')
    await expect(applyBtn).toBeDisabled()
    await page.getByTestId('candidate-check-c1').check()
    await expect(applyBtn).toBeEnabled()
    await applyBtn.click()

    await expect
      .poll(() => findWrites(state, 'POST', '/v1/admin/home/sections/hot_movies/apply-autofill').length)
      .toBe(1)
    const write = findWrites(state, 'POST', '/v1/admin/home/sections/hot_movies/apply-autofill')[0]!
    expect((write.body as { candidateIds: string[] }).candidateIds).toEqual(['c1'])
  })

  test('立即刷新：候选池刷新按钮 → POST refresh-candidates spy（端点 #7）', async ({ page }) => {
    state.pools.set('hot_anime', {
      candidates: [makeCandidate('c9', { origin: 'bangumi' })],
      snapshotAt: '2026-06-07T00:30:00Z',
      policyVersion: 'hp-v1',
      gaps: [],
    })
    await installHomeOpsMocks(page, state)
    await gotoHome(page)
    await enterCanvas(page)
    await page.getByTestId('canvas-mode-hot_anime').click()

    await page.getByTestId('candidate-pool-refresh-btn').click()
    await expect
      .poll(() => findWrites(state, 'POST', '/v1/admin/home/sections/hot_anime/refresh-candidates').length)
      .toBe(1)
  })

  test('快照未生成态：snapshotAt null → 未生成提示（200 非 404 语义）', async ({ page }) => {
    // state.pools 不含 hot_series → 端点 #4 返回空数组 + snapshotAt null
    await installHomeOpsMocks(page, state)
    await gotoHome(page)
    await enterCanvas(page)
    await page.getByTestId('canvas-mode-hot_series').click()

    await expect(page.getByTestId('candidate-pool-no-snapshot')).toBeVisible()
  })

  // ── D. Banner 编辑 + 横图警告态（§6 警告级不阻断）──────────────────────

  test('Banner 创建 drawer：横图探测失败警告 + 提交不被阻断（POST spy）', async ({ page }) => {
    await installHomeOpsMocks(page, state)
    // 横图探测目标域整体拦截 abort → Image onerror → probe failed（§6.6 风险提醒态）
    await page.route('https://img.e2e.test/**', (route) => route.abort())
    await gotoHome(page)

    // 默认 banner tab → BannerOpsSection
    await expect(page.getByTestId('banner-ops-section')).toBeVisible()
    await page.getByTestId('banner-create-btn').click()
    await expect(page.getByTestId('banner-drawer')).toBeVisible()

    await page.getByTestId('banner-title-zh').locator('input').fill('E2E 横幅')
    await page.getByTestId('banner-image-url').locator('input').fill('https://img.e2e.test/banner.png')
    await page.getByTestId('banner-link-target').locator('input').fill('https://promo.e2e.test/page')

    // 探测失败警告（600ms 防抖后出现；警告级——submit 仍可用）
    await expect(page.getByTestId('banner-image-probe-failed')).toBeVisible()
    const submit = page.getByTestId('banner-drawer-submit')
    await expect(submit).toBeEnabled()
    await submit.click()

    await expect
      .poll(() => findWrites(state, 'POST', '/v1/admin/banners').length)
      .toBe(1)
  })
})

/**
 * tests/e2e/admin/home/home-draft-publish.spec.ts
 *
 * CHG-HOME-DRAFT-PUBLISH-B（ADR-185 / SEQ-20260605-05 Phase 4 卡 25）：
 * 画布草稿生命周期 + 发布确认金路径
 *
 * 覆盖：
 *   A. 草稿态进入：已有草稿 → chip + 发布/丢弃按钮 + preview draft=true 叠加
 *   B. 发布：确认 modal（摘要 + 备注）→ POST /admin/home/publish spy → 回发布态
 *   C. 发布确认横图三类警告标记（ERRATA 移交验收项：探测失败态 + 警告级不阻断）
 *   D. 陈旧提示（D-185-2.2 双信号）+ 发布 409 拒绝路径
 *   E. 丢弃草稿：DELETE spy + 回发布态
 *
 * 范式：_helpers 基座（home-ops.spec 同款；state.draft / staleness / publishBehavior 预置）。
 */

import { test, expect, type Page } from '@playwright/test'
import {
  setAdminCookies,
  installHomeOpsMocks,
  freshState,
  findWrites,
  makeBanner,
  makeDraft,
  makeModule,
  type HomeOpsMockState,
} from './_helpers'

test.describe('/admin/home 草稿生命周期 + 发布', () => {
  let state: HomeOpsMockState

  async function gotoCanvas(page: Page) {
    await page.goto('/admin/home')
    await expect(page.getByTestId('home-ops-page-header')).toBeVisible()
    await page.getByTestId('home-view-toggle-btn').click()
    await expect(page.getByTestId('home-canvas-wrap')).toBeVisible()
  }

  test.beforeEach(async ({ context }) => {
    await setAdminCookies(context)
    state = freshState()
  })

  // ── A. 草稿态进入 ───────────────────────────────────────────────────

  test('已有草稿：chip + 发布/丢弃按钮解锁 + 草稿配置渲染（preview draft=true）', async ({ page }) => {
    state.modules = [makeModule({ id: 'm-pub', slot: 'featured', title: { 'zh-CN': '发布态卡' } })]
    state.draft = makeDraft(state, {
      baseVersionNo: 2,
      config: {
        banners: [...state.banners],
        modules: [makeModule({ id: 'm-draft', slot: 'featured', title: { 'zh-CN': '草稿卡' } })],
        settings: [...makeDraft(state).config.settings],
      },
    })
    await installHomeOpsMocks(page, state)
    await gotoCanvas(page)

    await expect(page.getByTestId('canvas-draft-chip')).toBeVisible()
    await expect(page.getByTestId('canvas-draft-chip')).toContainText('v2')
    await expect(page.getByTestId('canvas-publish-btn')).toBeVisible()
    await expect(page.getByTestId('canvas-discard-draft-btn')).toBeVisible()
    // 画布渲染草稿配置（非发布态行）
    await expect(page.getByTestId('canvas-card-m-draft')).toBeVisible()
    await expect(page.getByTestId('canvas-card-m-pub')).not.toBeVisible()
  })

  test('无草稿：发布/丢弃按钮不出现（发布态预览）', async ({ page }) => {
    await installHomeOpsMocks(page, state)
    await gotoCanvas(page)

    await expect(page.getByTestId('canvas-generated-at')).toBeVisible()
    await expect(page.getByTestId('canvas-draft-chip')).not.toBeVisible()
    await expect(page.getByTestId('canvas-publish-btn')).not.toBeVisible()
  })

  // ── B. 发布金路径 ───────────────────────────────────────────────────

  test('发布：确认 modal 摘要 + 备注 → POST publish spy（body.note）→ 回发布态', async ({ page }) => {
    state.draft = makeDraft(state)
    await installHomeOpsMocks(page, state)
    await gotoCanvas(page)

    await page.getByTestId('canvas-publish-btn').click()
    await expect(page.getByTestId('publish-confirm-modal')).toBeVisible()
    await expect(page.getByTestId('publish-summary')).toContainText('Banner ×1')

    await page.getByTestId('publish-note-input').locator('input').fill('e2e 发布备注')
    await page.getByTestId('publish-confirm-btn').click()

    await expect
      .poll(() => findWrites(state, 'POST', '/v1/admin/home/publish').length)
      .toBe(1)
    const write = findWrites(state, 'POST', '/v1/admin/home/publish')[0]!
    expect((write.body as { note: string }).note).toBe('e2e 发布备注')
    // 发布成功 → 草稿删除 → 回发布态（chip 消失）
    await expect(page.getByTestId('canvas-draft-chip')).not.toBeVisible()
  })

  // ── C. 发布确认横图警告（ERRATA 移交验收项：三类警告之探测失败 + 不阻断）──

  test('发布确认：banner 横图探测失败 → 警告标记 + 确认不被阻断（警告级）', async ({ page }) => {
    state.banners = [makeBanner({ id: 'bn-broken', imageUrl: 'https://img.e2e.test/broken.png' })]
    state.draft = makeDraft(state)
    await installHomeOpsMocks(page, state)
    // 横图探测目标域 abort → Image onerror → probe_failed（BannerImageGuard 同源探测）
    await page.route('https://img.e2e.test/**', (route) => route.abort())
    await gotoCanvas(page)

    await page.getByTestId('canvas-publish-btn').click()
    await expect(page.getByTestId('publish-confirm-modal')).toBeVisible()
    await expect(page.getByTestId('publish-banner-warning-probe_failed')).toBeVisible()

    // 警告级不阻断：确认按钮可用 → POST publish spy
    const confirm = page.getByTestId('publish-confirm-btn')
    await expect(confirm).toBeEnabled()
    await confirm.click()
    await expect
      .poll(() => findWrites(state, 'POST', '/v1/admin/home/publish').length)
      .toBe(1)
  })

  // ── D. 陈旧双信号 + 发布拒绝 ────────────────────────────────────────

  test('草稿陈旧：编辑器显著提示 + modal 内警示 + 发布 409 被拒', async ({ page }) => {
    state.draft = makeDraft(state, { baseVersionNo: 2 })
    state.staleness = {
      stale: true,
      baseMismatch: true,
      tablesNewer: false,
      latestVersionNo: 3,
      tablesMaxUpdatedAt: null,
    }
    state.publishBehavior = 'conflict'
    await installHomeOpsMocks(page, state)
    await gotoCanvas(page)

    // 画布级显著提示（D-185-2.2）
    await expect(page.getByTestId('canvas-draft-stale')).toBeVisible()
    await expect(page.getByTestId('canvas-draft-stale')).toContainText('v3')

    await page.getByTestId('canvas-publish-btn').click()
    await expect(page.getByTestId('publish-stale-warning')).toBeVisible()
    await page.getByTestId('publish-confirm-btn').click()

    await expect
      .poll(() => findWrites(state, 'POST', '/v1/admin/home/publish').length)
      .toBe(1)
    // 409 拒绝 → 草稿保留，chip 仍在
    await expect(page.getByTestId('canvas-draft-chip')).toBeVisible()
  })

  // ── E. 丢弃草稿 ─────────────────────────────────────────────────────

  test('丢弃草稿：DELETE spy → 回发布态（chip/按钮消失）', async ({ page }) => {
    state.draft = makeDraft(state)
    await installHomeOpsMocks(page, state)
    await gotoCanvas(page)

    await expect(page.getByTestId('canvas-draft-chip')).toBeVisible()
    await page.getByTestId('canvas-discard-draft-btn').click()

    await expect
      .poll(() => findWrites(state, 'DELETE', '/v1/admin/home/draft').length)
      .toBe(1)
    await expect(page.getByTestId('canvas-draft-chip')).not.toBeVisible()
    await expect(page.getByTestId('canvas-publish-btn')).not.toBeVisible()
  })
})

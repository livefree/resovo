/**
 * tests/e2e/admin/home/home-versions.spec.ts
 *
 * CHG-HOME-AUDIT-ROLLBACK（ADR-185 / SEQ-20260605-05 Phase 4 卡 26）：
 * 版本历史 + diff 展示 + 回滚金路径
 *
 * 覆盖：
 *   A. 版本列表：source pill / 当前版本标记 / note·时间 meta
 *   B. diff 展示（D-185-4.2 消费端计算：相邻较旧版本两份详情本地比对）
 *   C. 回滚：确认 modal → POST rollback spy → roll-forward 新版本入列 + preview 重拉
 *   D. 最新版本回滚禁用（即当前发布态）
 *
 * 范式：_helpers 基座（state.versions 预置；写路径经 state.writes spy 断言）。
 */

import { test, expect, type Page } from '@playwright/test'
import {
  setAdminCookies,
  installHomeOpsMocks,
  freshState,
  findWrites,
  makeModule,
  makeVersion,
  type HomeOpsMockState,
} from './_helpers'

test.describe('/admin/home 版本历史 + 回滚', () => {
  let state: HomeOpsMockState

  async function gotoVersions(page: Page) {
    await page.goto('/admin/home')
    await expect(page.getByTestId('home-ops-page-header')).toBeVisible()
    await page.getByTestId('home-view-toggle-btn').click()
    await expect(page.getByTestId('home-canvas-wrap')).toBeVisible()
    await page.getByTestId('canvas-versions-btn').click()
    await expect(page.getByTestId('version-history-panel')).toBeVisible()
  }

  test.beforeEach(async ({ context }) => {
    await setAdminCookies(context)
    state = freshState()
  })

  test('版本列表：source pill + 当前版本标记 + note meta（端点 #5 轻量行）', async ({ page }) => {
    state.versions = [
      makeVersion(state, 1),
      makeVersion(state, 2, { source: 'rollback', note: 'rollback to v1' }),
      makeVersion(state, 3, { note: '修复横幅' }),
    ]
    await installHomeOpsMocks(page, state)
    await gotoVersions(page)

    await expect(page.getByTestId('version-row-3')).toBeVisible()
    await expect(page.getByTestId('version-source-3')).toContainText('v3 · 发布')
    await expect(page.getByTestId('version-source-2')).toContainText('v2 · 回滚')
    await expect(page.getByTestId('version-row-3')).toContainText('当前版本')
    await expect(page.getByTestId('version-row-3')).toContainText('修复横幅')
    await expect(page.getByTestId('version-row-2')).toContainText('rollback to v1')
  })

  test('diff 展示：对比上一版 → 详情两份取数 + section 粒度差异行（D-185-4.2）', async ({ page }) => {
    const v1 = makeVersion(state, 1)
    state.modules = [makeModule({ id: 'm-new', slot: 'hot_movies', title: { 'zh-CN': '新增卡' } })]
    const v2 = makeVersion(state, 2)
    state.versions = [v1, v2]
    await installHomeOpsMocks(page, state)
    await gotoVersions(page)

    await page.getByTestId('version-diff-btn-2').click()
    await expect(page.getByTestId('version-diff-line-2-hot_movies')).toBeVisible()
    await expect(page.getByTestId('version-diff-line-2-hot_movies')).toContainText('+1 新增')
  })

  test('回滚金路径：确认 modal → POST spy → roll-forward 新版本入列（端点 #7）', async ({ page }) => {
    state.versions = [makeVersion(state, 1, { note: '初版' }), makeVersion(state, 2)]
    await installHomeOpsMocks(page, state)
    await gotoVersions(page)

    await page.getByTestId('version-rollback-btn-1').click()
    await expect(page.getByTestId('rollback-confirm-modal')).toBeVisible()
    await page.getByTestId('rollback-confirm-btn').click()

    await expect
      .poll(() => findWrites(state, 'POST', '/v1/admin/home/versions/1/rollback').length)
      .toBe(1)
    // roll-forward：新版本 v3 入列（source=rollback）+ 列表重拉
    await expect(page.getByTestId('version-row-3')).toBeVisible()
    await expect(page.getByTestId('version-source-3')).toContainText('v3 · 回滚')
    await expect(page.getByTestId('version-row-3')).toContainText('当前版本')
  })

  test('最新版本回滚禁用（即当前发布态）；最旧版本无对比按钮', async ({ page }) => {
    state.versions = [makeVersion(state, 1), makeVersion(state, 2)]
    await installHomeOpsMocks(page, state)
    await gotoVersions(page)

    await expect(page.getByTestId('version-rollback-btn-2')).toBeDisabled()
    await expect(page.getByTestId('version-rollback-btn-1')).toBeEnabled()
    await expect(page.getByTestId('version-diff-btn-1')).not.toBeVisible()
  })

  test('空版本链：冷启动语义提示（D-185-1.5）', async ({ page }) => {
    await installHomeOpsMocks(page, state)
    await gotoVersions(page)
    await expect(page.getByTestId('version-history-panel')).toContainText('暂无发布版本')
  })
})

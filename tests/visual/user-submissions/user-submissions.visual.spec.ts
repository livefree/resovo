/**
 * user-submissions.visual.spec.ts
 * CHG-SN-7-MISC-VISUAL-BATCH（REDO-02-F 软门收尾 / 2026-05-23）
 *
 * 涵盖 CHG-SN-7-REDO-02 系列 A0→F 闭合后的 User Submissions Card-list 6 张关键视觉 baseline：
 *   1. submissions-page-header     — REDO-02-C PageHeader（动态 totalPending 副标题）
 *   2. submissions-segment-bad-src — REDO-02-PRE-CARD-PRIMITIVE-A Segment 4 类（pill + badge）默认 bad_source
 *   3. submissions-segment-processed — Segment 切换 processed Tab（已处理 / 三态 status pill）
 *   4. submission-card-first       — SubmissionCard 单卡（visual icon + metadata quote + 3 actions）
 *   5. submissions-pagination      — 分页 footer（上一页 / 当前页 / 下一页）
 *   6. submissions-empty-state     — 空数据 EmptyState（segment + description 文案分支）
 *
 * 运行方式（PLAYWRIGHT_VISUAL=1 env gate 保护，默认不参与 test:e2e）：
 *   npm run test:visual:update -- tests/visual/user-submissions/user-submissions.visual.spec.ts
 *
 * 前置（baseline 首次 capture）：
 *   1. 起 server-next dev server（:3003）+ apps/api dev server（:3001）
 *   2. 登录态：tests/visual/.auth/admin.json（已存）
 *   3. dev 数据库需有 user_submissions ≥ 6 条（覆盖 bad_source/wish_list/metadata_correction/processed 4 类）
 *      含至少 1 条 metadata_correction（可触发 quote block 渲染）
 *      processed segment 至少 1 条（用于 #3 baseline）
 *      可选：1 个空 segment（如 wish_list 0 条）用于 #6 baseline
 *   4. 首跑产出 baseline PNG 后入库（PR 内人工 review）
 */

import { test, expect } from '@playwright/test'

test.use({ storageState: 'tests/visual/.auth/admin.json' })

// ── 辅助：等待 user-submissions 页加载 ───────────────────────────────────

async function waitForSubmissionsPage(page: import('@playwright/test').Page) {
  await page.goto('/admin/user-submissions')
  await page.waitForSelector('[data-user-submissions-client]', { timeout: 15000 })
  await page.waitForSelector('[data-testid="user-submissions-segment"]', { timeout: 10000 })
  // 等列表 / empty / error 首屏稳定
  await page.waitForTimeout(800)
}

// ── 1: PageHeader（动态副标题 totalPending）─────────────────────────────

test('submissions — page header', async ({ page }) => {
  await waitForSubmissionsPage(page)
  await expect(page.locator('[data-testid="user-submissions-page-header"]')).toHaveScreenshot(
    'submissions-page-header.png',
  )
})

// ── 2: Segment 4 Tab（默认 bad_source 选中）─────────────────────────────

test('submissions — segment bad_source default', async ({ page }) => {
  await waitForSubmissionsPage(page)
  await expect(page.locator('[data-testid="user-submissions-segment"]')).toHaveScreenshot(
    'submissions-segment-bad-src.png',
  )
})

// ── 3: Segment 切换 processed Tab ───────────────────────────────────────

test('submissions — segment processed active', async ({ page }) => {
  await waitForSubmissionsPage(page)
  // Segment 内 button role=tab, name=已处理
  await page.getByRole('tab', { name: /已处理/ }).click({ timeout: 5000 })
  await page.waitForTimeout(800) // 切换 segment 触发 fetch
  await expect(page.locator('[data-testid="user-submissions-segment"]')).toHaveScreenshot(
    'submissions-segment-processed.png',
  )
})

// ── 4: SubmissionCard 首卡（含 metadata quote + 3 actions）──────────────

test('submissions — first card', async ({ page }) => {
  await waitForSubmissionsPage(page)
  // SubmissionCard testid prefix `submission-card-`；取第一张
  const firstCard = page.locator('[data-testid^="submission-card-"]').first()
  await firstCard.waitFor({ timeout: 5000 }).catch(() => {})
  await expect(firstCard).toHaveScreenshot('submission-card-first.png')
})

// ── 5: 分页 footer（仅当 total > PAGE_LIMIT 时渲染）─────────────────────

test('submissions — pagination footer', async ({ page }) => {
  await waitForSubmissionsPage(page)
  const pagination = page.locator('[data-testid="submissions-pagination"]')
  if ((await pagination.count()) === 0) {
    // 总数不足以触发分页时跳过本 case（baseline 不入库）
    test.skip(true, 'total ≤ PAGE_LIMIT；dev DB 无足够数据触发分页 footer')
  }
  await expect(pagination).toHaveScreenshot('submissions-pagination.png')
})

// ── 6: EmptyState（segment 切到 0 条投稿）───────────────────────────────

test('submissions — empty state', async ({ page }) => {
  await waitForSubmissionsPage(page)
  // 优先取 wish_list（dev DB 大概率空）
  await page.getByRole('tab', { name: /求片/ }).click({ timeout: 5000 })
  await page.waitForTimeout(800)
  const cards = await page.locator('[data-testid^="submission-card-"]').count()
  if (cards > 0) {
    // 求片 segment 有数据时切到 metadata_correction 兜底
    await page.getByRole('tab', { name: /元数据纠错/ }).click({ timeout: 5000 })
    await page.waitForTimeout(800)
    const cards2 = await page.locator('[data-testid^="submission-card-"]').count()
    if (cards2 > 0) {
      test.skip(true, 'dev DB 所有 segment 均有数据；无法触发 EmptyState baseline')
    }
  }
  await expect(page.locator('[data-user-submissions-client]')).toHaveScreenshot(
    'submissions-empty-state.png',
  )
})

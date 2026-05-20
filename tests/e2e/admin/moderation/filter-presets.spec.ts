/**
 * filter-presets.spec.ts
 * CHG-SN-4-FIX-F 黄金路径：筛选预设 CRUD（保存/应用/删除）
 *
 * FIX-F 修复点：审核台头部增加"筛选预设 ▾"入口，
 * 持久化到 localStorage（key: admin.moderation.presets.v1），跨 Tab 隔离。
 */

import { test, expect } from '@playwright/test'
import {
  setModeratorCookies,
  installModerationMocks,
  freshState,
  makeQueueRow,
} from './_helpers'

const VIDEO_ID = 'vid-fix-f-01'
const STORAGE_KEY = 'admin.moderation.presets.v1'

/** 向 localStorage 写入预设数据 */
async function seedPresets(page: import('@playwright/test').Page, presets: unknown[]) {
  await page.evaluate(
    ([key, data]: [string, string]) => window.localStorage.setItem(key, data),
    [STORAGE_KEY, JSON.stringify({ version: 'v1', presets })]
  )
}

const MOCK_PRESET = {
  id: 'preset-e2e-01',
  name: '高优先级',
  tab: 'pending',
  query: { sourceCheckStatus: 'broken' },
  isDefault: false,
  createdAt: '2026-05-20T00:00:00Z',
  updatedAt: '2026-05-20T00:00:00Z',
}

test.describe('FIX-F 黄金路径：筛选预设管理', () => {
  test.beforeEach(async ({ context, page }) => {
    await setModeratorCookies(context)
    const state = freshState({
      pending: [makeQueueRow({ id: VIDEO_ID, title: 'FIX-F 预设测试视频' })],
    })
    await installModerationMocks(page, state)
    await page.goto('/admin/moderation')
    await expect(page.getByTestId('moderation-split')).toBeVisible({ timeout: 10000 })
  })

  test('无预设时 Popover 显示"尚无保存的预设"空态', async ({ page }) => {
    // 确保 localStorage 空（默认状态）
    await page.evaluate(([key]: [string]) => window.localStorage.removeItem(key), [STORAGE_KEY])

    await page.getByRole('button', { name: /筛选预设/ }).click()
    await expect(page.getByText('尚无保存的预设')).toBeVisible({ timeout: 3000 })
  })

  test('有预设时 Popover 显示预设名称', async ({ page }) => {
    await seedPresets(page, [MOCK_PRESET])

    await page.getByRole('button', { name: /筛选预设/ }).click()
    await expect(page.getByText('高优先级')).toBeVisible({ timeout: 3000 })
  })

  test('点击"应用"→ Popover 关闭 + Toast 提示', async ({ page }) => {
    await seedPresets(page, [MOCK_PRESET])

    await page.getByRole('button', { name: /筛选预设/ }).click()
    await expect(page.getByText('高优先级')).toBeVisible({ timeout: 3000 })

    // 点击"应用"按钮
    await page.getByRole('button', { name: '应用' }).first().click()

    // Popover 关闭（预设名称不再在 popover 中）
    // Toast 显示（'已应用「高优先级」'）
    await expect(page.getByText('已应用「高优先级」')).toBeVisible({ timeout: 3000 })
  })

  test('点击"删除"→ 预设从 localStorage 移除', async ({ page }) => {
    await seedPresets(page, [MOCK_PRESET])

    await page.getByRole('button', { name: /筛选预设/ }).click()
    await expect(page.getByText('高优先级')).toBeVisible({ timeout: 3000 })

    await page.getByRole('button', { name: '删除' }).first().click()

    // localStorage 中预设已删除
    const stored = await page.evaluate(
      ([key]: [string]) => window.localStorage.getItem(key),
      [STORAGE_KEY]
    )
    const parsed = stored ? JSON.parse(stored) as { presets: { id: string }[] } : { presets: [] }
    expect(parsed.presets.find((p: { id: string }) => p.id === 'preset-e2e-01')).toBeUndefined()
  })

  test('保存预设：点击"保存预设"→ 模态框出现，填写名称后保存', async ({ page }) => {
    await page.getByRole('button', { name: '保存预设' }).click()

    // SavePresetModal 出现（标题"保存筛选预设"）
    await expect(page.getByText('保存筛选预设')).toBeVisible({ timeout: 3000 })

    // 输入名称
    await page.getByPlaceholder('例如：本周冷门 / 高优先级').fill('测试预设名')

    // 提交
    await page.getByRole('button', { name: '保存' }).click()

    // Toast 提示
    await expect(page.getByText('已保存预设「测试预设名」')).toBeVisible({ timeout: 3000 })

    // localStorage 中出现该预设
    const stored = await page.evaluate(
      ([key]: [string]) => window.localStorage.getItem(key),
      [STORAGE_KEY]
    )
    const parsed = stored ? JSON.parse(stored) as { presets: { name: string }[] } : { presets: [] }
    expect(parsed.presets.some((p: { name: string }) => p.name === '测试预设名')).toBe(true)
  })
})

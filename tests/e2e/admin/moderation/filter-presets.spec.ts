/**
 * filter-presets.spec.ts
 * CHG-SN-4-FIX-F 黄金路径：筛选预设 CRUD（保存/应用/删除）
 *
 * FIX-F 修复点：审核台头部增加"筛选预设 ▾"入口。
 *
 * CHG-E2E-GATE-AUDIT-C 契约对齐：预设已迁 DB 主源（ADR-144 /
 * CHG-SN-8-FUP-PRESET-TEAM-EP-B，`/admin/filter-presets` 4 端点），
 * localStorage 仅 offline fallback 且 fetch 成功后被 DB 数据覆盖——
 * 原 localStorage 种数/断言路径结构性失效，改为 _helpers mock 端点喂数 + 写操作 spy。
 */

import { test, expect } from '@playwright/test'
import {
  setModeratorCookies,
  installModerationMocks,
  freshState,
  makeQueueRow,
  makeFilterPreset,
  findWrites,
  type MockState,
} from './_helpers'

const VIDEO_ID = 'vid-fix-f-01'

const MOCK_PRESET = makeFilterPreset({
  id: 'preset-e2e-01',
  name: '高优先级',
  tab: 'pending',
  // 'broken' 为 ADR-157 规整前旧值，对齐 SourceCheckStatus 4 值
  query: { sourceCheckStatus: 'all_dead' },
})

test.describe('FIX-F 黄金路径：筛选预设管理', () => {
  let state: MockState

  async function setup(page: import('@playwright/test').Page, context: import('@playwright/test').BrowserContext, presets: ReturnType<typeof makeFilterPreset>[]) {
    await setModeratorCookies(context)
    state = freshState({
      pending: [makeQueueRow({ id: VIDEO_ID, title: 'FIX-F 预设测试视频' })],
      filterPresets: presets,
    })
    await installModerationMocks(page, state)
    await page.goto('/admin/moderation')
    await expect(page.getByTestId('moderation-split')).toBeVisible({ timeout: 10000 })
  }

  test('无预设时 Popover 显示"尚无保存的预设"空态', async ({ context, page }) => {
    await setup(page, context, [])

    await page.getByRole('button', { name: /筛选预设/ }).click()
    await expect(page.getByText('尚无保存的预设')).toBeVisible({ timeout: 3000 })
  })

  test('有预设时 Popover 显示预设名称', async ({ context, page }) => {
    await setup(page, context, [MOCK_PRESET])

    await page.getByRole('button', { name: /筛选预设/ }).click()
    await expect(page.getByText('高优先级')).toBeVisible({ timeout: 3000 })
  })

  test('点击"应用"→ Popover 关闭 + Toast 提示', async ({ context, page }) => {
    await setup(page, context, [MOCK_PRESET])

    await page.getByRole('button', { name: /筛选预设/ }).click()
    await expect(page.getByText('高优先级')).toBeVisible({ timeout: 3000 })

    // 点击"应用"按钮
    await page.getByRole('button', { name: '应用' }).first().click()

    // Popover 关闭（预设名称不再在 popover 中）
    // Toast 显示（'已应用「高优先级」'）
    await expect(page.getByText('已应用「高优先级」')).toBeVisible({ timeout: 3000 })
  })

  test('点击"删除"→ DELETE 端点调用 + 预设从列表移除', async ({ context, page }) => {
    await setup(page, context, [MOCK_PRESET])

    await page.getByRole('button', { name: /筛选预设/ }).click()
    await expect(page.getByText('高优先级')).toBeVisible({ timeout: 3000 })

    await page.getByRole('button', { name: '删除' }).first().click()

    // DB 主源：DELETE /admin/filter-presets/:id 调用 + mock state 移除
    await expect.poll(() => findWrites(state, (w) => w.method === 'DELETE' && w.path.endsWith('/preset-e2e-01')).length).toBe(1)
    expect(state.filterPresets.find((p) => p.id === 'preset-e2e-01')).toBeUndefined()
  })

  test('保存预设：点击"保存预设"→ 模态框出现，填写名称后保存', async ({ context, page }) => {
    await setup(page, context, [])

    await page.getByRole('button', { name: '保存预设' }).click()

    // SavePresetModal 出现（标题"保存筛选预设"）
    const modal = page.getByTestId('save-preset-modal')
    await expect(page.getByText('保存筛选预设')).toBeVisible({ timeout: 3000 })

    // 输入名称
    await page.getByPlaceholder('例如：本周冷门 / 高优先级').fill('测试预设名')

    // 提交（限定 modal 范围——页面级 "保存预设" trigger 与 modal 内 "保存" 子串撞名）
    await modal.getByRole('button', { name: '保存', exact: true }).click()

    // Toast 提示
    await expect(page.getByText('已保存预设「测试预设名」')).toBeVisible({ timeout: 3000 })

    // DB 主源：POST /admin/filter-presets 调用 + mock state 出现该预设
    expect(findWrites(state, (w) => w.method === 'POST' && w.path === '/v1/admin/filter-presets').length).toBe(1)
    expect(state.filterPresets.some((p) => p.name === '测试预设名')).toBe(true)
  })
})

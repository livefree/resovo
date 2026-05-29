/**
 * SourceLineAliasesClient.test.tsx — `/admin/source-line-aliases` 主视图单测
 *
 * 任务卡演进：
 *   - CHG-368-B-B / ADR-164 §6：初始视图（仅 source_line_aliases）
 *   - CHG-SN-9-LINES-VIEW-UNIFY：数据源换 listAllSourceLines（含 unassigned + alias-only 孤儿）
 *   - CHG-SN-9-CODENAME-MATRIX：codename 单元格内联点击 + 52 山名预览 grid
 *   - CHG-SN-9-LINES-VIEW-UNIFY-FIX-4（本次 Codex 4th 反馈消化）：stale mock 同步 / SourceLineRow fixture
 *
 * 覆盖 6 case：
 *   1. 渲染基础（PageHeader + DataTable）
 *   2. 字库 KPI 渲染（可用基础名 / 已占用 slots / 冷却中）
 *   3. 已退役行 retire 按钮不渲染（D-164-4 软删语义）
 *   4. 编辑按钮 onClick → Modal 打开 + 字段初始化
 *   5. retire 按钮 → confirm 后调用 API + toast
 *   6. retire confirm 取消 → 不调用 API
 */

import { beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

// CHG-SN-9-LINES-VIEW-UNIFY-FIX-4：mock listAllSourceLines（替代旧 listLineAliases / getCodenamePool）
const listAllSourceLinesMock = vi.fn()
const upsertLineAliasWithFieldsMock = vi.fn()
const retireLineAliasMock = vi.fn()
const toastPushMock = vi.fn()

vi.mock('../../../../../../apps/server-next/src/lib/sources/api', () => ({
  listAllSourceLines: (...args: unknown[]) => listAllSourceLinesMock(...args),
  upsertLineAliasWithFields: (...args: unknown[]) => upsertLineAliasWithFieldsMock(...args),
  retireLineAlias: (...args: unknown[]) => retireLineAliasMock(...args),
}))

vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    useToast: () => ({
      push: (input: unknown) => { toastPushMock(input); return 'tid' },
      dismiss: vi.fn(),
      dismissAll: vi.fn(),
    }),
  }
})

import { SourceLineAliasesClient } from '../../../../../../apps/server-next/src/app/admin/source-line-aliases/_client/SourceLineAliasesClient'

// CHG-SN-9-LINES-VIEW-UNIFY-FIX-4：SourceLineRow fixture（替代旧 SourceLineAlias / 含 assignedAt + 统计字段）
const ROW_ACTIVE = {
  sourceSiteKey: 'bilibili',
  sourceName: '线路1',
  displayName: '哔哩哔哩主线',
  codename: '泰山',
  priority: 50,
  retiredAt: null,
  autoRetired: false,
  assignedAt: '2026-05-28T00:00:00Z',
  videoCount: 10,
  activeCount: 20,
  episodeCount: 25,
} as const

const ROW_RETIRED = {
  ...ROW_ACTIVE,
  sourceName: '线路2',
  displayName: '哔哩哔哩备用线',  // 与 ROW_ACTIVE.displayName 区分，避免 getByText 多元素
  codename: '华山',
  retiredAt: '2026-04-01T00:00:00Z',
  autoRetired: false,
  assignedAt: '2026-04-01T00:00:00Z',
} as const

beforeEach(() => {
  listAllSourceLinesMock.mockReset()
  upsertLineAliasWithFieldsMock.mockReset()
  retireLineAliasMock.mockReset()
  toastPushMock.mockReset()
  listAllSourceLinesMock.mockResolvedValue([ROW_ACTIVE, ROW_RETIRED])
})

describe('SourceLineAliasesClient (CHG-368-B-B → LINES-VIEW-UNIFY → CODENAME-MATRIX)', () => {
  it('1. 渲染基础：PageHeader title + DataTable + 至少 2 行', async () => {
    render(<SourceLineAliasesClient />)
    await waitFor(() => {
      expect(screen.getByText('线路别名管理')).not.toBeNull()
    })
    expect(screen.getByText('哔哩哔哩主线')).not.toBeNull()
    // codename "泰山" 现在显示在单元格 button 内 + 字库 grid 内，会有多个匹配
    expect(screen.getAllByText('泰山').length).toBeGreaterThanOrEqual(1)
  })

  it('2. 字库 KPI 渲染（可用基础名 / 已占用 slots / 冷却中）', async () => {
    render(<SourceLineAliasesClient />)
    await waitFor(() => {
      expect(screen.getByText(/可用基础名/)).not.toBeNull()
    })
    expect(screen.getByText('已占用 slots')).not.toBeNull()
    expect(screen.getByText(/冷却中/)).not.toBeNull()
  })

  it('3. 已退役行 retire 按钮不渲染（D-164-4 软删语义）', async () => {
    render(<SourceLineAliasesClient />)
    await waitFor(() => {
      expect(screen.getByText('哔哩哔哩主线')).not.toBeNull()
    })
    // 在役行：retire-bilibili/线路1 存在
    expect(screen.getByTestId('retire-bilibili/线路1')).not.toBeNull()
    // 已退役行：retire-bilibili/线路2 不存在
    expect(screen.queryByTestId('retire-bilibili/线路2')).toBeNull()
  })

  it('4. 编辑按钮 onClick → Modal 打开 + displayName 字段初始化为当前值', async () => {
    render(<SourceLineAliasesClient />)
    await waitFor(() => {
      expect(screen.getByText('哔哩哔哩主线')).not.toBeNull()
    })
    // assigned 行操作列显 "编辑"（CHG-SN-9-LINES-VIEW-UNIFY 行为 / unassigned 行显 "分配"）
    const editButtons = screen.getAllByRole('button', { name: '编辑' })
    fireEvent.click(editButtons[0]!)
    await waitFor(() => {
      expect(screen.getByText(/编辑别名/)).not.toBeNull()
    })
    const input = screen.getByLabelText(/别名（必填/) as HTMLInputElement
    expect(input.value).toBe('哔哩哔哩主线')
  })

  it('5. retire 按钮 → confirm 后调用 API + 成功 toast', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    retireLineAliasMock.mockResolvedValueOnce({ ...ROW_ACTIVE, retiredAt: '2026-05-28T00:00:00Z' })
    render(<SourceLineAliasesClient />)
    await waitFor(() => {
      expect(screen.getByText('哔哩哔哩主线')).not.toBeNull()
    })
    const retireBtn = screen.getByTestId('retire-bilibili/线路1')
    fireEvent.click(retireBtn)
    await waitFor(() => {
      expect(retireLineAliasMock).toHaveBeenCalledWith('bilibili', '线路1')
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'success', title: '已退役' }),
      )
    })
    confirmSpy.mockRestore()
  })

  it('6. retire confirm 取消 → 不调用 API', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<SourceLineAliasesClient />)
    await waitFor(() => {
      expect(screen.getByText('哔哩哔哩主线')).not.toBeNull()
    })
    const retireBtn = screen.getByTestId('retire-bilibili/线路1')
    fireEvent.click(retireBtn)
    // confirm=false → 不调 API
    expect(retireLineAliasMock).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })
})

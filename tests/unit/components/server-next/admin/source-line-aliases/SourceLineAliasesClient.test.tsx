/**
 * SourceLineAliasesClient.test.tsx — `/admin/source-line-aliases` 主视图单测
 *
 * 任务卡：CHG-368-B-B / ADR-164 §6
 *
 * 覆盖 6 case：
 *   1. 渲染基础（PageHeader + DataTable）
 *   2. codename 池摘要渲染（available / occupied / cooling 三段）
 *   3. 已退役行 retire 按钮不渲染（D-164-4 软删语义）
 *   4. 编辑按钮 onClick → Modal 打开 + 字段初始化
 *   5. retire 按钮 → confirm 后调用 API + toast
 *   6. retire confirm 取消 → 不调用 API
 */

import { beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const listLineAliasesMock = vi.fn()
const getCodenamePoolMock = vi.fn()
const upsertLineAliasWithFieldsMock = vi.fn()
const retireLineAliasMock = vi.fn()
const toastPushMock = vi.fn()

vi.mock('../../../../../../apps/server-next/src/lib/sources/api', () => ({
  listLineAliases: (...args: unknown[]) => listLineAliasesMock(...args),
  upsertLineAliasWithFields: (...args: unknown[]) => upsertLineAliasWithFieldsMock(...args),
  retireLineAlias: (...args: unknown[]) => retireLineAliasMock(...args),
  getCodenamePool: (...args: unknown[]) => getCodenamePoolMock(...args),
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

const ALIAS_ACTIVE = {
  sourceSiteKey: 'bilibili',
  sourceName: '线路1',
  displayName: '哔哩哔哩主线',
  codename: '泰山',
  priority: 50,
  retiredAt: null,
  autoRetired: false,
  updatedAt: '2026-05-28T00:00:00Z',
} as const

const ALIAS_RETIRED = {
  ...ALIAS_ACTIVE,
  sourceName: '线路2',
  displayName: '哔哩哔哩备用线',  // 与 ALIAS_ACTIVE.displayName 区分，避免 getByText 多元素
  codename: '华山',
  retiredAt: '2026-04-01T00:00:00Z',
  autoRetired: false,
} as const

const POOL = {
  available: ['衡山', '嵩山', '恒山'],
  occupied: ['泰山'],
  cooling: ['华山'],
}

beforeEach(() => {
  listLineAliasesMock.mockReset()
  getCodenamePoolMock.mockReset()
  upsertLineAliasWithFieldsMock.mockReset()
  retireLineAliasMock.mockReset()
  toastPushMock.mockReset()
  listLineAliasesMock.mockResolvedValue([ALIAS_ACTIVE, ALIAS_RETIRED])
  getCodenamePoolMock.mockResolvedValue(POOL)
})

describe('SourceLineAliasesClient (CHG-368-B-B / ADR-164 §6)', () => {
  it('1. 渲染基础：PageHeader title + DataTable + 至少 2 行', async () => {
    render(<SourceLineAliasesClient />)
    await waitFor(() => {
      expect(screen.getByText('线路别名管理')).not.toBeNull()
    })
    expect(screen.getByText('哔哩哔哩主线')).not.toBeNull()
    expect(screen.getByText('泰山')).not.toBeNull()
  })

  it('2. codename 池摘要渲染（available 3 / occupied 1 / cooling 1）', async () => {
    render(<SourceLineAliasesClient />)
    await waitFor(() => {
      expect(screen.getByText('可用 codename')).not.toBeNull()
    })
    // 3 个 count 数字应该显示
    expect(screen.getByText('3')).not.toBeNull()  // available
    // 多个 1 可能匹配（occupied + cooling）—— 改用 getAllByText
    const ones = screen.getAllByText('1')
    expect(ones.length).toBeGreaterThanOrEqual(2)
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
    // 找第一个"编辑"按钮（在役行）
    const editButtons = screen.getAllByRole('button', { name: '编辑' })
    fireEvent.click(editButtons[0]!)
    // Modal title 应含 siteKey/sourceName
    await waitFor(() => {
      expect(screen.getByText(/编辑别名/)).not.toBeNull()
    })
    // 别名输入框初始化为当前 displayName
    const input = screen.getByLabelText(/别名（必填/) as HTMLInputElement
    expect(input.value).toBe('哔哩哔哩主线')
  })

  it('5. retire 按钮 → confirm 后调用 API + 成功 toast', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    retireLineAliasMock.mockResolvedValueOnce({ ...ALIAS_ACTIVE, retiredAt: '2026-05-28T00:00:00Z' })
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

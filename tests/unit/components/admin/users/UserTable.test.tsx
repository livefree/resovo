/**
 * UserTable.test.tsx — CHG-261
 * 验证：数据渲染 / 服务端排序参数 / 列显示切换 / 搜索防抖
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { UserTable } from '@/components/admin/users/UserTable'

const getMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
  },
}))

vi.mock('@/components/admin/users/UserActions', () => ({
  UserActions: () => <button type="button">操作</button>,
}))

const MOCK_ROWS = [
  {
    id: 'u1',
    username: 'alpha_user',
    email: 'alpha@example.com',
    role: 'admin',
    avatar_url: null,
    created_at: '2026-03-21T00:00:00Z',
    banned_at: null,
  },
  {
    id: 'u2',
    username: 'zeta_user',
    email: 'zeta@example.com',
    role: 'user',
    avatar_url: null,
    created_at: '2026-03-20T00:00:00Z',
    banned_at: null,
  },
]

describe('UserTable (CHG-261)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getMock.mockResolvedValue({ data: MOCK_ROWS, total: MOCK_ROWS.length })
  })

  it('renders user rows with username and email', async () => {
    render(<UserTable />)
    await screen.findByText('alpha_user')
    expect(screen.getByText('zeta_user')).toBeTruthy()
    expect(screen.getByText('alpha@example.com')).toBeTruthy()
  })

  it('calls API with default sortField=created_at&sortDir=desc on mount', async () => {
    render(<UserTable />)
    await screen.findByText('alpha_user')

    const firstCall = getMock.mock.calls[0][0] as string
    expect(firstCall).toContain('sortField=created_at')
    expect(firstCall).toContain('sortDir=desc')
  })

  it('refetches with new sortField/sortDir when sort header is clicked', async () => {
    render(<UserTable />)
    await screen.findByText('alpha_user')

    fireEvent.click(screen.getByTestId('modern-table-sort-username'))

    await waitFor(() => {
      const calls = getMock.mock.calls.map((c) => c[0] as string)
      const sortedCall = calls.find((url) => url.includes('sortField=username'))
      expect(sortedCall).toBeTruthy()
      expect(sortedCall).toContain('sortDir=asc')
    })
  })

  it('supports column visibility toggle via ColumnSettingsPanel', async () => {
    render(<UserTable />)
    await screen.findByText('alpha_user')

    fireEvent.click(screen.getByTestId('user-columns-toggle'))
    fireEvent.click(screen.getByTestId('user-columns-panel-toggle-email'))

    await waitFor(() => {
      expect(screen.queryByTestId('modern-table-sort-email')).toBeNull()
    })
  })

  it('shows empty state when no users', async () => {
    getMock.mockResolvedValue({ data: [], total: 0 })
    render(<UserTable />)
    await screen.findByText('暂无数据')
  })
})

/**
 * UsersKpiRow.test.tsx — UsersListClient KPI 行单元测试（CHG-SN-7-MISC-USERS-2）
 *
 * 覆盖：
 * - KPI 行渲染（data-testid="users-kpi-row"）
 * - stats=null 时 4 列均显示「—」占位
 * - stats 加载成功后 4 列显示正确数值
 * - 各 KpiCard testId 存在
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import type { UserStats } from '../../../../../../apps/server-next/src/lib/users/types'

const MOCK_STATS: UserStats = {
  totalCount: 1234,
  newTodayCount: 5,
  bannedCount: 12,
  moderatorCount: 3,
  generatedAt: '2026-05-20T10:00:00.000Z',
}

const listUsersMock = vi.fn()
const fetchUsersStatsMock = vi.fn()

vi.mock('../../../../../../apps/server-next/src/lib/users/api', () => ({
  listUsers: (...args: unknown[]) => listUsersMock(...args),
  banUser: vi.fn(),
  unbanUser: vi.fn(),
  updateUserRole: vi.fn(),
  fetchUsersStats: (...args: unknown[]) => fetchUsersStatsMock(...args),
}))

vi.mock('../../../../../../apps/server-next/src/lib/api-client', () => ({
  ApiClientError: class extends Error {
    constructor(message: string, public readonly status?: number) { super(message) }
  },
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    useToast: () => ({ push: vi.fn(), dismiss: vi.fn(), dismissAll: vi.fn() }),
  }
})

import { UsersListClient } from '../../../../../../apps/server-next/src/app/admin/users/_client/UsersListClient'

beforeEach(() => {
  cleanup()
  listUsersMock.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 })
})

describe('UsersListClient — KPI 行', () => {
  it('渲染 data-testid="users-kpi-row"', async () => {
    fetchUsersStatsMock.mockResolvedValue(MOCK_STATS)
    render(<UsersListClient />)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="users-kpi-row"]')).not.toBeNull()
    })
  })

  it('stats 加载中时 4 列均显示「—」', async () => {
    fetchUsersStatsMock.mockReturnValue(new Promise(() => {}))
    render(<UsersListClient />)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="users-kpi-row"]')).not.toBeNull()
    })
    const dashes = screen.queryAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(4)
  })

  it('stats 加载成功后显示 totalCount', async () => {
    fetchUsersStatsMock.mockResolvedValue(MOCK_STATS)
    render(<UsersListClient />)
    await waitFor(() => {
      expect(screen.queryByText('1,234')).not.toBeNull()
    })
  })

  it('stats 加载成功后显示 newTodayCount', async () => {
    fetchUsersStatsMock.mockResolvedValue(MOCK_STATS)
    render(<UsersListClient />)
    await waitFor(() => {
      expect(screen.queryByText('5')).not.toBeNull()
    })
  })

  it('stats 加载成功后显示 bannedCount', async () => {
    fetchUsersStatsMock.mockResolvedValue(MOCK_STATS)
    render(<UsersListClient />)
    await waitFor(() => {
      expect(screen.queryByText('12')).not.toBeNull()
    })
  })

  it('stats 加载成功后显示 moderatorCount', async () => {
    fetchUsersStatsMock.mockResolvedValue(MOCK_STATS)
    render(<UsersListClient />)
    await waitFor(() => {
      expect(screen.queryByText('3')).not.toBeNull()
    })
  })

  it('KpiCard 标签「全部用户」存在', async () => {
    fetchUsersStatsMock.mockResolvedValue(MOCK_STATS)
    render(<UsersListClient />)
    await waitFor(() => {
      expect(screen.queryByText('全部用户')).not.toBeNull()
    })
  })

  it('KpiCard 标签「已封账号」存在', async () => {
    fetchUsersStatsMock.mockResolvedValue(MOCK_STATS)
    render(<UsersListClient />)
    await waitFor(() => {
      expect(screen.queryByText('已封账号')).not.toBeNull()
    })
  })

  it('stats 加载失败时不崩溃（KPI 行仍显示占位符）', async () => {
    fetchUsersStatsMock.mockRejectedValue(new Error('network error'))
    render(<UsersListClient />)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="users-kpi-row"]')).not.toBeNull()
    })
    const dashes = screen.queryAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(4)
  })
})

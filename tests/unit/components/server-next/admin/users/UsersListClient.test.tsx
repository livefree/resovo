/**
 * UsersListClient.test.tsx — UsersListClient CSV 导出测试（CHG-SN-6-23）
 *
 * 覆盖：
 *   1. rows 非空 → 按钮渲染 + enabled
 *   2. rows 空 → disabled
 *   3. 点击 → a.click + filename pattern + Blob 类型
 *
 * 注：UsersListClient 其他功能（filter / role change / ban）由 API/e2e 覆盖；
 * 本 test 文件聚焦 csv-export 接入。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const listUsersMock = vi.fn()

vi.mock('../../../../../../apps/server-next/src/lib/users/api', () => ({
  listUsers: (...args: unknown[]) => listUsersMock(...args),
  banUser: vi.fn(),
  unbanUser: vi.fn(),
  updateUserRole: vi.fn(),
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

const USER_ROW = {
  id: 'u-1',
  username: 'alice',
  email: 'alice@example.com',
  role: 'user' as const,
  avatar_url: null,
  banned_at: null,
  created_at: '2026-05-15T10:00:00Z',
}

const ROW_RES = { data: [USER_ROW], total: 1, page: 1, limit: 20 }
const EMPTY_RES = { data: [], total: 0, page: 1, limit: 20 }

beforeEach(() => {
  listUsersMock.mockReset()
})

describe('UsersListClient — CSV 导出', () => {
  it('1. rows 非空 → 按钮渲染 + enabled', async () => {
    listUsersMock.mockResolvedValueOnce(ROW_RES)
    render(<UsersListClient />)
    await waitFor(() => screen.getByText('alice'))
    const btn = screen.getByTestId('users-export-csv') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
  })

  it('2. rows 空 → 按钮 disabled', async () => {
    listUsersMock.mockResolvedValueOnce(EMPTY_RES)
    render(<UsersListClient />)
    await waitFor(() => screen.getByTestId('users-export-csv'))
    const btn = screen.getByTestId('users-export-csv') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('3. 点击导出 → a.click + filename pattern + Blob 类型', async () => {
    listUsersMock.mockResolvedValueOnce(ROW_RES)
    const clickSpy = vi.fn()
    const downloads: string[] = []
    const createObjectUrlSpy = vi.fn(() => 'blob:fake-url')
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectUrlSpy, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true })
    const origCreate = document.createElement.bind(document)
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag) as HTMLElement
      if (tag === 'a') {
        const anchor = el as HTMLAnchorElement
        anchor.click = clickSpy
        Object.defineProperty(anchor, 'download', {
          set(v: string) { downloads.push(v) },
          configurable: true,
        })
      }
      return el
    })
    try {
      render(<UsersListClient />)
      const btn = await waitFor(() => screen.getByTestId('users-export-csv'))
      fireEvent.click(btn)
      expect(clickSpy).toHaveBeenCalledOnce()
      const blobArg = createObjectUrlSpy.mock.calls[0]?.[0] as Blob
      expect(blobArg).toBeInstanceOf(Blob)
      expect(blobArg.type).toContain('text/csv')
      expect(downloads[0]).toMatch(/^users-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.csv$/)
    } finally {
      createSpy.mockRestore()
    }
  })
})

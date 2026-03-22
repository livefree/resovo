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
    id: 'u2',
    username: 'zeta_user',
    email: 'zeta@example.com',
    role: 'user',
    created_at: '2026-03-20T00:00:00Z',
    banned_at: null,
  },
  {
    id: 'u1',
    username: 'alpha_user',
    email: 'alpha@example.com',
    role: 'admin',
    created_at: '2026-03-21T00:00:00Z',
    banned_at: null,
  },
]

describe('UserTable (CHG-127)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getMock.mockResolvedValue({ data: MOCK_ROWS, total: MOCK_ROWS.length })
  })

  it('applies default sort and supports toggle sort', async () => {
    render(<UserTable />)

    await screen.findByText('alpha_user')

    const rowsDefault = Array.from(document.querySelectorAll('tr[data-testid^="user-row-"]'))
    expect(rowsDefault[0]?.getAttribute('data-testid')).toBe('user-row-u1')

    fireEvent.click(screen.getByTestId('user-sort-created_at'))

    await waitFor(() => {
      const rowsToggled = Array.from(document.querySelectorAll('tr[data-testid^="user-row-"]'))
      expect(rowsToggled[0]?.getAttribute('data-testid')).toBe('user-row-u2')
    })
  })

  it('supports column visibility toggle', async () => {
    render(<UserTable />)
    await screen.findByText('alpha_user')

    fireEvent.click(screen.getByTestId('user-columns-toggle'))
    fireEvent.click(screen.getByTestId('user-column-toggle-email'))

    await waitFor(() => {
      expect(screen.queryByTestId('user-sort-email')).toBeNull()
    })
  })

  it('persists resized width after remount', async () => {
    const { unmount } = render(<UserTable />)
    await screen.findByText('alpha_user')

    const emailHeader = screen.getByTestId('user-sort-email').closest('th')
    expect(emailHeader?.getAttribute('style')).toContain('width: 260px')

    fireEvent.mouseDown(screen.getByTestId('user-resize-email'), { clientX: 100 })
    fireEvent.mouseMove(window, { clientX: 180 })
    fireEvent.mouseUp(window)

    await waitFor(() => {
      expect(emailHeader?.getAttribute('style')).toContain('width: 340px')
    })

    unmount()
    render(<UserTable />)
    await screen.findByText('alpha_user')

    const remountEmailHeader = screen.getByTestId('user-sort-email').closest('th')
    expect(remountEmailHeader?.getAttribute('style')).toContain('width: 340px')
  })
})

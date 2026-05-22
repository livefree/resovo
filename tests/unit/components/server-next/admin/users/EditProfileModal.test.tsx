/**
 * EditProfileModal.test.tsx — admin 编辑用户资料 Modal 单测
 * （CHG-SN-8-FUP-USERS-EDIT-EP / ADR-140）
 *
 * 覆盖：
 *   1. open=true → 3 字段初始填充
 *   2. 仅改 displayName → API 仅含 displayName
 *   3. 清空 displayName → API 含 displayName: null
 *   4. 无变化 → 不调 API + 直接 onClose
 *   5. locale 格式无效 → 内联错误
 *   6. 成功 → toast + onSuccess + onClose
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const updateUserProfileMock = vi.fn()

vi.mock('../../../../../../apps/server-next/src/lib/users/api', () => ({
  updateUserProfile: (...args: unknown[]) => updateUserProfileMock(...args),
}))

vi.mock('../../../../../../apps/server-next/src/lib/api-client', () => {
  class MockApiClientError extends Error {
    constructor(public readonly code: string, message: string, public readonly status: number) {
      super(message)
      this.name = 'ApiClientError'
    }
  }
  return { ApiClientError: MockApiClientError }
})

const toastPushMock = vi.fn()
vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    useToast: () => ({ push: toastPushMock, dismiss: vi.fn(), dismissAll: vi.fn() }),
  }
})

import { EditProfileModal } from '../../../../../../apps/server-next/src/app/admin/users/_client/EditProfileModal'

const USER = { id: 'u-1', username: 'alice', displayName: '旧名', locale: 'en', avatarUrl: null }

beforeEach(() => {
  updateUserProfileMock.mockReset()
  toastPushMock.mockReset()
})

afterEach(() => cleanup())

describe('EditProfileModal', () => {
  it('1. open=true → 3 字段初始填充', () => {
    render(<EditProfileModal open={true} onClose={vi.fn()} user={USER} />)
    const name = document.querySelector('[data-testid="edit-profile-display-name"] input') as HTMLInputElement
    const locale = document.querySelector('[data-testid="edit-profile-locale"] input') as HTMLInputElement
    expect(name.value).toBe('旧名')
    expect(locale.value).toBe('en')
  })

  it('2. 仅改 displayName → API 仅含 displayName', async () => {
    updateUserProfileMock.mockResolvedValue({ id: 'u-1', displayName: '新名', locale: 'en', avatarUrl: null })
    render(<EditProfileModal open={true} onClose={vi.fn()} user={USER} />)
    const name = document.querySelector('[data-testid="edit-profile-display-name"] input') as HTMLInputElement
    fireEvent.change(name, { target: { value: '新名' } })
    fireEvent.click(screen.getByTestId('edit-profile-submit-btn'))

    await waitFor(() => expect(updateUserProfileMock).toHaveBeenCalled())
    expect(updateUserProfileMock).toHaveBeenCalledWith('u-1', { displayName: '新名' })
  })

  it('3. 清空 displayName → API 含 displayName: null', async () => {
    updateUserProfileMock.mockResolvedValue({ id: 'u-1', displayName: null, locale: 'en', avatarUrl: null })
    render(<EditProfileModal open={true} onClose={vi.fn()} user={USER} />)
    const name = document.querySelector('[data-testid="edit-profile-display-name"] input') as HTMLInputElement
    fireEvent.change(name, { target: { value: '' } })
    fireEvent.click(screen.getByTestId('edit-profile-submit-btn'))

    await waitFor(() => expect(updateUserProfileMock).toHaveBeenCalled())
    expect(updateUserProfileMock).toHaveBeenCalledWith('u-1', { displayName: null })
  })

  it('4. 无变化 → 不调 API + 直接 onClose', () => {
    const onClose = vi.fn()
    render(<EditProfileModal open={true} onClose={onClose} user={USER} />)
    fireEvent.click(screen.getByTestId('edit-profile-submit-btn'))
    expect(updateUserProfileMock).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('5. locale 格式无效 → 内联错误', async () => {
    render(<EditProfileModal open={true} onClose={vi.fn()} user={USER} />)
    const locale = document.querySelector('[data-testid="edit-profile-locale"] input') as HTMLInputElement
    fireEvent.change(locale, { target: { value: 'INVALID' } })
    fireEvent.click(screen.getByTestId('edit-profile-submit-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('edit-profile-error').textContent).toContain('Locale')
    })
    expect(updateUserProfileMock).not.toHaveBeenCalled()
  })

  it('6. 成功 → toast success + onSuccess + onClose', async () => {
    updateUserProfileMock.mockResolvedValue({ id: 'u-1', displayName: '新名', locale: 'en', avatarUrl: null })
    const onSuccess = vi.fn()
    const onClose = vi.fn()
    render(<EditProfileModal open={true} onClose={onClose} user={USER} onSuccess={onSuccess} />)
    const name = document.querySelector('[data-testid="edit-profile-display-name"] input') as HTMLInputElement
    fireEvent.change(name, { target: { value: '新名' } })
    fireEvent.click(screen.getByTestId('edit-profile-submit-btn'))

    await waitFor(() => expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({ level: 'success' })))
    expect(onSuccess).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})

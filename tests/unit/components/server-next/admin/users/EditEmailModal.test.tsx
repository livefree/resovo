/**
 * EditEmailModal.test.tsx — admin 改用户邮箱 Modal 单测
 * （CHG-SN-8-FUP-USERS-EDIT-EP / ADR-140）
 *
 * 覆盖：
 *   1. open=false → 不渲染
 *   2. open=true → 初始填入当前邮箱
 *   3. 格式无效 → 内联错误 + 不调 API
 *   4. 同邮箱 → 直接关闭 + 不调 API
 *   5. 成功 → toast + onSuccess + onClose
 *   6. 409 CONFLICT → 内联错误（邮箱已被其他用户）
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const updateUserEmailMock = vi.fn()

vi.mock('../../../../../../apps/server-next/src/lib/users/api', () => ({
  updateUserEmail: (...args: unknown[]) => updateUserEmailMock(...args),
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

import { EditEmailModal } from '../../../../../../apps/server-next/src/app/admin/users/_client/EditEmailModal'
import { ApiClientError } from '../../../../../../apps/server-next/src/lib/api-client'

const USER = { id: 'u-1', username: 'alice', email: 'alice@old.com' }

beforeEach(() => {
  updateUserEmailMock.mockReset()
  toastPushMock.mockReset()
})

afterEach(() => cleanup())

describe('EditEmailModal', () => {
  it('1. open=false → 不渲染', () => {
    render(<EditEmailModal open={false} onClose={vi.fn()} user={USER} />)
    expect(document.querySelector('[data-testid="edit-email-modal"]')).toBeNull()
  })

  it('2. open=true → 初始填入当前邮箱', () => {
    render(<EditEmailModal open={true} onClose={vi.fn()} user={USER} />)
    const input = document.querySelector('[data-testid="edit-email-input"] input') as HTMLInputElement
    expect(input.value).toBe('alice@old.com')
  })

  it('3. 邮箱格式无效 → 内联错误 + 不调 API', async () => {
    render(<EditEmailModal open={true} onClose={vi.fn()} user={USER} />)
    const input = document.querySelector('[data-testid="edit-email-input"] input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'not-an-email' } })
    fireEvent.click(screen.getByTestId('edit-email-submit-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('edit-email-error').textContent).toContain('有效')
    })
    expect(updateUserEmailMock).not.toHaveBeenCalled()
  })

  it('4. 同邮箱 → 直接关闭 + 不调 API', () => {
    const onClose = vi.fn()
    render(<EditEmailModal open={true} onClose={onClose} user={USER} />)
    // 不修改 → submit
    fireEvent.click(screen.getByTestId('edit-email-submit-btn'))
    expect(updateUserEmailMock).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('5. 成功 → toast success + onSuccess + onClose', async () => {
    updateUserEmailMock.mockResolvedValue({ id: 'u-1', email: 'alice@new.com', previousEmail: 'alice@old.com' })
    const onSuccess = vi.fn()
    const onClose = vi.fn()
    render(<EditEmailModal open={true} onClose={onClose} user={USER} onSuccess={onSuccess} />)
    const input = document.querySelector('[data-testid="edit-email-input"] input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'alice@new.com' } })
    fireEvent.click(screen.getByTestId('edit-email-submit-btn'))

    await waitFor(() => expect(updateUserEmailMock).toHaveBeenCalledWith('u-1', 'alice@new.com'))
    await waitFor(() => expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({ level: 'success' })))
    expect(onSuccess).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('6. 409 CONFLICT → 内联错误「邮箱已被其他用户注册」', async () => {
    updateUserEmailMock.mockRejectedValue(new ApiClientError('CONFLICT', '该邮箱已被其他用户注册', 409))
    render(<EditEmailModal open={true} onClose={vi.fn()} user={USER} />)
    const input = document.querySelector('[data-testid="edit-email-input"] input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'taken@x.com' } })
    fireEvent.click(screen.getByTestId('edit-email-submit-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('edit-email-error').textContent).toContain('其他用户')
    })
  })
})

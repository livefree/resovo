/**
 * ResetPasswordModal.test.tsx — admin 重置用户密码 Modal 单测（CHG-SN-8-FUP-USERS-RESET-PWD）
 *
 * 覆盖：
 *   1. open=false → 不渲染（Portal）
 *   2. open=true + 用户 → 渲染目标 + confirm 按钮
 *   3. 点确认 → API 成功 → success 视图（密码 + 复制按钮）
 *   4. API 失败 → 显示错误 + 仍 confirm 视图
 *   5. success 状态点完成 → onClose 触发
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const resetUserPasswordMock = vi.fn()

vi.mock('../../../../../../apps/server-next/src/lib/users/api', () => ({
  resetUserPassword: (...args: unknown[]) => resetUserPasswordMock(...args),
}))

const toastPushMock = vi.fn()
vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    useToast: () => ({ push: toastPushMock, dismiss: vi.fn(), dismissAll: vi.fn() }),
  }
})

import { ResetPasswordModal } from '../../../../../../apps/server-next/src/app/admin/users/_client/ResetPasswordModal'

const USER = { id: 'u-1', username: 'alice', email: 'alice@example.com' }

beforeEach(() => {
  resetUserPasswordMock.mockReset()
  toastPushMock.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('ResetPasswordModal', () => {
  it('1. open=false → 不渲染 modal 内容', () => {
    render(<ResetPasswordModal open={false} onClose={vi.fn()} user={USER} />)
    expect(document.querySelector('[data-testid="reset-pwd-modal"]')).toBeNull()
  })

  it('2. open=true + 用户 → confirm 视图 渲染目标 + 确认按钮', () => {
    render(<ResetPasswordModal open={true} onClose={vi.fn()} user={USER} />)
    expect(screen.getByTestId('reset-pwd-target').textContent).toContain('alice')
    expect(screen.getByTestId('reset-pwd-target').textContent).toContain('alice@example.com')
    expect(screen.getByTestId('reset-pwd-confirm-btn')).not.toBeNull()
    expect(document.querySelector('[data-testid="reset-pwd-result"]')).toBeNull()
  })

  it('3. 点确认 → API 成功 → success 视图（密码 + 复制按钮 + 完成按钮）', async () => {
    resetUserPasswordMock.mockResolvedValue({ newPassword: 'Xy9aBcDeF12g' })
    render(<ResetPasswordModal open={true} onClose={vi.fn()} user={USER} />)

    fireEvent.click(screen.getByTestId('reset-pwd-confirm-btn'))

    await waitFor(() => expect(resetUserPasswordMock).toHaveBeenCalledWith('u-1'))
    await waitFor(() => {
      expect(screen.getByTestId('reset-pwd-value').textContent).toBe('Xy9aBcDeF12g')
    })
    expect(screen.getByTestId('reset-pwd-copy-btn')).not.toBeNull()
    expect(screen.getByTestId('reset-pwd-close-btn')).not.toBeNull()
    expect(document.querySelector('[data-testid="reset-pwd-confirm-btn"]')).toBeNull()
  })

  it('4. API 失败 → 显示错误 + 仍 confirm 视图', async () => {
    resetUserPasswordMock.mockRejectedValue(new Error('网络异常'))
    render(<ResetPasswordModal open={true} onClose={vi.fn()} user={USER} />)

    fireEvent.click(screen.getByTestId('reset-pwd-confirm-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('reset-pwd-error').textContent).toBe('网络异常')
    })
    expect(screen.getByTestId('reset-pwd-confirm-btn')).not.toBeNull()
    expect(document.querySelector('[data-testid="reset-pwd-result"]')).toBeNull()
  })

  it('5. success 状态点完成 → onClose 触发', async () => {
    resetUserPasswordMock.mockResolvedValue({ newPassword: 'AbC123XyZ789' })
    const onClose = vi.fn()
    render(<ResetPasswordModal open={true} onClose={onClose} user={USER} />)

    fireEvent.click(screen.getByTestId('reset-pwd-confirm-btn'))
    await waitFor(() => expect(screen.getByTestId('reset-pwd-close-btn')).not.toBeNull())

    fireEvent.click(screen.getByTestId('reset-pwd-close-btn'))
    expect(onClose).toHaveBeenCalled()
  })
})

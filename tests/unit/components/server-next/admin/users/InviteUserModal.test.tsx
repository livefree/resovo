/**
 * InviteUserModal.test.tsx — 邀请用户 Modal 单元测试（CHG-SN-7-MISC-USERS-1）
 *
 * 覆盖：
 * - open=false → 不渲染表单
 * - open=true → 渲染 data-invite-form
 * - 邮箱为空提交 → 显示「邮箱不能为空」错误
 * - 邮箱格式错误 → 显示「请输入有效的邮箱地址」
 * - 正确邮箱 + role → 调用 onInvite(email, role)
 * - 取消按钮 → 调用 onClose
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { InviteUserModal } from '../../../../../../apps/server-next/src/app/admin/users/_client/InviteUserModal'

beforeEach(() => {
  cleanup()
})

describe('InviteUserModal — open=false', () => {
  it('不渲染表单内容', () => {
    const { container } = render(
      <InviteUserModal open={false} onClose={vi.fn()} onInvite={vi.fn()} />,
    )
    expect(container.querySelector('[data-invite-form]')).toBeNull()
  })
})

describe('InviteUserModal — open=true', () => {
  it('渲染 data-invite-form', () => {
    render(<InviteUserModal open={true} onClose={vi.fn()} onInvite={vi.fn()} />)
    expect(document.querySelector('[data-invite-form]')).not.toBeNull()
  })

  it('标题显示「邀请用户」', () => {
    render(<InviteUserModal open={true} onClose={vi.fn()} onInvite={vi.fn()} />)
    expect(screen.queryByText('邀请用户')).not.toBeNull()
  })

  it('渲染邮箱输入框 + 角色选择器', () => {
    render(<InviteUserModal open={true} onClose={vi.fn()} onInvite={vi.fn()} />)
    expect(screen.queryByTestId('invite-email-input')).not.toBeNull()
    expect(screen.queryByTestId('invite-role-select')).not.toBeNull()
  })
})

describe('InviteUserModal — 表单验证', () => {
  it('邮箱为空提交 → 显示「邮箱不能为空」', async () => {
    const onInvite = vi.fn()
    render(<InviteUserModal open={true} onClose={vi.fn()} onInvite={onInvite} />)

    fireEvent.click(screen.getByTestId('invite-submit-btn'))

    await waitFor(() => {
      expect(screen.queryByTestId('invite-email-error')).not.toBeNull()
      expect(screen.getByTestId('invite-email-error').textContent).toContain('邮箱不能为空')
    })
    expect(onInvite).not.toHaveBeenCalled()
  })

  it('邮箱格式非法 → 显示格式错误', async () => {
    render(<InviteUserModal open={true} onClose={vi.fn()} onInvite={vi.fn()} />)

    // AdminInput testid 在 wrapper div，实际 input 通过 placeholder 定位
    const emailInput = screen.getByPlaceholderText('user@example.com')
    fireEvent.change(emailInput, { target: { value: 'not-an-email' } })
    fireEvent.click(screen.getByTestId('invite-submit-btn'))

    await waitFor(() => {
      const errEl = screen.queryByTestId('invite-email-error')
      expect(errEl).not.toBeNull()
      expect(errEl?.textContent).toContain('有效的邮箱')
    })
  })
})

describe('InviteUserModal — 成功提交', () => {
  it('有效邮箱 + role → 调用 onInvite + 关闭', async () => {
    const onInvite = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(<InviteUserModal open={true} onClose={onClose} onInvite={onInvite} />)

    const emailInput = screen.getByPlaceholderText('user@example.com')
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.click(screen.getByTestId('invite-submit-btn'))

    await waitFor(() => {
      expect(onInvite).toHaveBeenCalledWith('test@example.com', 'user')
    })
    expect(onClose).toHaveBeenCalled()
  })
})

describe('InviteUserModal — 取消', () => {
  it('点击取消 → 调用 onClose', () => {
    const onClose = vi.fn()
    render(<InviteUserModal open={true} onClose={onClose} onInvite={vi.fn()} />)

    fireEvent.click(screen.getByTestId('invite-cancel-btn'))
    expect(onClose).toHaveBeenCalled()
  })
})

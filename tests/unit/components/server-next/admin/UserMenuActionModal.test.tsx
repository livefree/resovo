/**
 * UserMenuActionModal.test.tsx — CHG-SN-8-FUP-USER-MENU
 *
 * 覆盖（5 用例）：
 *  1. type=null → 不渲染主 Modal
 *  2. type=profile → 渲染当前用户信息 + 编辑 disabled
 *  3. type=preferences → 渲染主题切换按钮 + 点击触发 onThemeToggle
 *  4. type=help → 渲染 W1-W5 工作流 + 快捷键 + manual 入口
 *  5. 关闭按钮触发 onClose
 */

import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { UserMenuActionModal } from '../../../../../apps/server-next/src/app/admin/_client/UserMenuActionModal'

const USER = {
  id: 'user-uuid-aaaa',
  displayName: '小李',
  email: 'lee@example.com',
  role: 'admin' as const,
}

describe('UserMenuActionModal (CHG-SN-8-FUP-USER-MENU)', () => {
  it('1. type=null → 不渲染主 Modal 内容', () => {
    render(
      <UserMenuActionModal
        type={null}
        user={USER}
        theme="dark"
        onThemeToggle={() => {}}
        onClose={() => {}}
      />,
    )
    expect(screen.queryByTestId('user-menu-modal-profile')).toBeNull()
    expect(screen.queryByTestId('user-menu-modal-preferences')).toBeNull()
    expect(screen.queryByTestId('user-menu-modal-help')).toBeNull()
  })

  it('2. type=profile → 渲染用户信息 + 编辑 disabled', () => {
    render(
      <UserMenuActionModal
        type="profile"
        user={USER}
        theme="dark"
        onThemeToggle={() => {}}
        onClose={() => {}}
      />,
    )
    expect(screen.getByTestId('user-menu-modal-profile')).not.toBeNull()
    expect(screen.getByText('小李')).not.toBeNull()
    expect(screen.getByText('lee@example.com')).not.toBeNull()
    expect(screen.getByText('管理员 (admin)')).not.toBeNull()
    const editBtn = screen.getByTestId('user-menu-profile-edit') as HTMLButtonElement
    expect(editBtn.disabled).toBe(true)
  })

  it('3. type=preferences → 渲染主题切换按钮 + 点击触发 onThemeToggle', () => {
    const onToggle = vi.fn()
    render(
      <UserMenuActionModal
        type="preferences"
        user={USER}
        theme="dark"
        onThemeToggle={onToggle}
        onClose={() => {}}
      />,
    )
    expect(screen.getByTestId('user-menu-modal-preferences')).not.toBeNull()
    expect(screen.getByText(/深色 \(dark\)/)).not.toBeNull()
    const btn = screen.getByTestId('user-menu-preferences-theme-toggle')
    expect(btn.textContent).toContain('切换为浅色主题')
    fireEvent.click(btn)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('4. type=help → 渲染 W1-W5 工作流 + 快捷键 + manual 入口', () => {
    render(
      <UserMenuActionModal
        type="help"
        user={USER}
        theme="dark"
        onThemeToggle={() => {}}
        onClose={() => {}}
      />,
    )
    expect(screen.getByTestId('user-menu-modal-help')).not.toBeNull()
    expect(screen.getByText(/W1.*采集/)).not.toBeNull()
    expect(screen.getByText(/W5.*首页/)).not.toBeNull()
    expect(screen.getByText(/管理台站/)).not.toBeNull()
    expect(screen.getByText(/通过/)).not.toBeNull()
    expect(screen.getByText(/docs\/manual/)).not.toBeNull()
  })

  it('5. 关闭按钮触发 onClose', () => {
    const onClose = vi.fn()
    render(
      <UserMenuActionModal
        type="profile"
        user={USER}
        theme="dark"
        onThemeToggle={() => {}}
        onClose={onClose}
      />,
    )
    const closeBtn = screen.getByText('关闭')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

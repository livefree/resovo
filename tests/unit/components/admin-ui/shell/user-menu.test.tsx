/**
 * UserMenu 渲染单测（CHG-SN-2-07）
 *
 * 覆盖：6 项菜单按 actions 提供性渲染 / logout 必填 + danger 视觉 /
 * actions callback 触发 + 自动关闭 / avatarText 默认推断 / data-* attribute
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { UserMenu, deriveAvatarText } from '../../../../../packages/admin-ui/src/shell/user-menu'
import type { AdminShellUser, AdminUserActions } from '../../../../../packages/admin-ui/src/shell/types'

afterEach(() => {
  cleanup()
})

const USER: AdminShellUser = {
  id: 'u1',
  displayName: 'Yan Liu',
  email: 'yan@resovo.io',
  role: 'admin',
}

function makeActions(overrides: Partial<AdminUserActions> = {}): AdminUserActions {
  return {
    onLogout: vi.fn(),
    ...overrides,
  }
}

describe('UserMenu — 受控开闭', () => {
  it('open=false → 返 null（不渲染容器）', () => {
    const { container } = render(
      <UserMenu open={false} onOpenChange={vi.fn()} user={USER} actions={makeActions()} />,
    )
    expect(container.querySelector('[data-user-menu]')).toBeNull()
  })

  it('open=true → 渲染容器 + role="menu" + aria-label="用户菜单"', () => {
    const { container } = render(
      <UserMenu open onOpenChange={vi.fn()} user={USER} actions={makeActions()} />,
    )
    const menu = container.querySelector('[data-user-menu]')
    expect(menu?.getAttribute('role')).toBe('menu')
    expect(menu?.getAttribute('aria-label')).toBe('用户菜单')
  })
})

describe('UserMenu — header 渲染', () => {
  it('显示 displayName + email + role 标签（admin → "管理员"）', () => {
    render(<UserMenu open onOpenChange={vi.fn()} user={USER} actions={makeActions()} />)
    expect(screen.getByText('Yan Liu')).toBeTruthy()
    expect(screen.getByText('yan@resovo.io · 管理员')).toBeTruthy()
  })

  it('role=moderator → "审核员"标签', () => {
    render(
      <UserMenu open onOpenChange={vi.fn()} user={{ ...USER, role: 'moderator' }} actions={makeActions()} />,
    )
    expect(screen.getByText('yan@resovo.io · 审核员')).toBeTruthy()
  })

  it('avatarText 显式提供 → 优先使用', () => {
    render(
      <UserMenu open onOpenChange={vi.fn()} user={{ ...USER, avatarText: 'AB' }} actions={makeActions()} />,
    )
    expect(screen.getByText('AB')).toBeTruthy()
  })

  it('avatarText 未提供 → 从 displayName 推断（"Yan Liu" → "YL"）', () => {
    render(<UserMenu open onOpenChange={vi.fn()} user={USER} actions={makeActions()} />)
    expect(screen.getByText('YL')).toBeTruthy()
  })
})

describe('deriveAvatarText — 推断规则', () => {
  it('多词空格分隔 → 首字母大写组合（最多 2 字母）', () => {
    expect(deriveAvatarText('Yan Liu')).toBe('YL')
    expect(deriveAvatarText('Alice Bob Charlie')).toBe('AB')
  })

  it('CJK 字符 / 无空格短词 → 前两字符', () => {
    expect(deriveAvatarText('张三')).toBe('张三')
    expect(deriveAvatarText('Alice')).toBe('Al')
  })

  it('单字符 → 自身', () => {
    expect(deriveAvatarText('A')).toBe('A')
    expect(deriveAvatarText('张')).toBe('张')
  })

  it('空字符串 → "?"', () => {
    expect(deriveAvatarText('')).toBe('?')
    expect(deriveAvatarText('   ')).toBe('?')
  })
})

describe('UserMenu — 6 项菜单按 actions 提供性渲染', () => {
  it('全部 actions 提供 → 渲染 6 项（5 可选 + logout 必填）', () => {
    const actions = makeActions({
      onProfile: vi.fn(),
      onPreferences: vi.fn(),
      onToggleTheme: vi.fn(),
      onHelp: vi.fn(),
      onSwitchAccount: vi.fn(),
    })
    const { container } = render(
      <UserMenu open onOpenChange={vi.fn()} user={USER} actions={actions} />,
    )
    expect(container.querySelectorAll('[data-menu-item]').length).toBe(6)
  })

  it('仅 onLogout（必填）→ 仅渲染 1 项', () => {
    const { container } = render(
      <UserMenu open onOpenChange={vi.fn()} user={USER} actions={makeActions()} />,
    )
    const items = container.querySelectorAll('[data-menu-item]')
    expect(items.length).toBe(1)
    expect(items[0]?.getAttribute('data-menu-item')).toBe('logout')
  })

  it('部分 actions 提供 → 仅渲染对应项 + logout', () => {
    const actions = makeActions({
      onProfile: vi.fn(),
      onToggleTheme: vi.fn(),
    })
    const { container } = render(
      <UserMenu open onOpenChange={vi.fn()} user={USER} actions={actions} />,
    )
    const items = Array.from(container.querySelectorAll('[data-menu-item]')).map((el) => el.getAttribute('data-menu-item'))
    expect(items).toEqual(['profile', 'theme', 'logout'])
  })

  it('logout 项标记 data-menu-item-danger="true"（视觉 is-danger）', () => {
    const { container } = render(
      <UserMenu open onOpenChange={vi.fn()} user={USER} actions={makeActions()} />,
    )
    const logoutBtn = container.querySelector('[data-menu-item="logout"]')
    expect(logoutBtn?.getAttribute('data-menu-item-danger')).toBe('true')
  })

  it('非 logout 项无 data-menu-item-danger', () => {
    const actions = makeActions({ onProfile: vi.fn() })
    const { container } = render(
      <UserMenu open onOpenChange={vi.fn()} user={USER} actions={actions} />,
    )
    const profileBtn = container.querySelector('[data-menu-item="profile"]')
    expect(profileBtn?.getAttribute('data-menu-item-danger')).toBeNull()
  })
})

describe('UserMenu — 菜单项点击触发 callback + 自动关闭', () => {
  it('点击 profile 项 → 触发 onProfile + onOpenChange(false)', () => {
    const onProfile = vi.fn()
    const onOpenChange = vi.fn()
    const actions = makeActions({ onProfile })
    render(<UserMenu open onOpenChange={onOpenChange} user={USER} actions={actions} />)
    screen.getByText('个人资料').click()
    expect(onProfile).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('点击 logout 项 → 触发 onLogout + onOpenChange(false)', () => {
    const onLogout = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <UserMenu open onOpenChange={onOpenChange} user={USER} actions={{ onLogout }} />,
    )
    screen.getByText('登出').click()
    expect(onLogout).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('button 显式 type="button"（防表单内 submit 误触发）', () => {
    const { container } = render(
      <UserMenu open onOpenChange={vi.fn()} user={USER} actions={makeActions()} />,
    )
    const btn = container.querySelector('[data-menu-item]') as HTMLButtonElement
    expect(btn.tagName).toBe('BUTTON')
    expect(btn.getAttribute('type')).toBe('button')
  })
})

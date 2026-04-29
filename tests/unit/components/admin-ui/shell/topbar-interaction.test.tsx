/**
 * Topbar 交互单测（CHG-SN-2-09）
 *
 * 覆盖：5 类回调触发（onOpenCommandPalette / onThemeToggle / onOpenNotifications /
 * onOpenTasks / onOpenSettings）
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { Topbar, type TopbarIcons } from '../../../../../packages/admin-ui/src/shell/topbar'

afterEach(() => {
  cleanup()
})

const ICONS: TopbarIcons = {
  search: <svg data-icon="search" />,
  theme: <svg data-icon="theme" />,
  notifications: <svg data-icon="notifications" />,
  tasks: <svg data-icon="tasks" />,
  settings: <svg data-icon="settings" />,
}

describe('Topbar — 5 类回调触发', () => {
  function makeProps(overrides: Partial<React.ComponentProps<typeof Topbar>> = {}) {
    return {
      crumbs: [{ label: '管理台站', href: '/admin' }],
      theme: 'dark' as const,
      icons: ICONS,
      onOpenCommandPalette: vi.fn(),
      onThemeToggle: vi.fn(),
      onOpenNotifications: vi.fn(),
      onOpenTasks: vi.fn(),
      onOpenSettings: vi.fn(),
      ...overrides,
    }
  }

  it('点击搜索触发器 → onOpenCommandPalette()', () => {
    const props = makeProps()
    const { container } = render(<Topbar {...props} />)
    fireEvent.click(container.querySelector('[data-topbar-search]') as HTMLButtonElement)
    expect(props.onOpenCommandPalette).toHaveBeenCalledTimes(1)
  })

  it('点击主题按钮 → onThemeToggle()', () => {
    const props = makeProps()
    const { container } = render(<Topbar {...props} />)
    fireEvent.click(container.querySelector('[data-topbar-icon-btn="theme"]') as HTMLButtonElement)
    expect(props.onThemeToggle).toHaveBeenCalledTimes(1)
  })

  it('点击任务按钮 → onOpenTasks()', () => {
    const props = makeProps()
    const { container } = render(<Topbar {...props} />)
    fireEvent.click(container.querySelector('[data-topbar-icon-btn="tasks"]') as HTMLButtonElement)
    expect(props.onOpenTasks).toHaveBeenCalledTimes(1)
  })

  it('点击通知按钮 → onOpenNotifications()', () => {
    const props = makeProps()
    const { container } = render(<Topbar {...props} />)
    fireEvent.click(container.querySelector('[data-topbar-icon-btn="notifications"]') as HTMLButtonElement)
    expect(props.onOpenNotifications).toHaveBeenCalledTimes(1)
  })

  it('点击设置按钮 → onOpenSettings()', () => {
    const props = makeProps()
    const { container } = render(<Topbar {...props} />)
    fireEvent.click(container.querySelector('[data-topbar-icon-btn="settings"]') as HTMLButtonElement)
    expect(props.onOpenSettings).toHaveBeenCalledTimes(1)
  })

  it('回调彼此独立（点击 search 不触发 theme，反之亦然）', () => {
    const props = makeProps()
    const { container } = render(<Topbar {...props} />)
    fireEvent.click(container.querySelector('[data-topbar-search]') as HTMLButtonElement)
    expect(props.onOpenCommandPalette).toHaveBeenCalledTimes(1)
    expect(props.onThemeToggle).not.toHaveBeenCalled()
    expect(props.onOpenTasks).not.toHaveBeenCalled()
    expect(props.onOpenNotifications).not.toHaveBeenCalled()
    expect(props.onOpenSettings).not.toHaveBeenCalled()
  })
})

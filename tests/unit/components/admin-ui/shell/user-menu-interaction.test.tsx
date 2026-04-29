/**
 * UserMenu 交互单测（CHG-SN-2-07）
 *
 * 覆盖：focus trap（mount 时 focus 首项 / Tab/Shift+Tab 循环）/ ESC 关闭 /
 * outside-click 关闭 / anchorRef 内点击不关闭
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { useRef } from 'react'
import { render, cleanup, fireEvent, act } from '@testing-library/react'
import { UserMenu } from '../../../../../packages/admin-ui/src/shell/user-menu'
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

function makeFullActions(): AdminUserActions {
  return {
    onProfile: vi.fn(),
    onPreferences: vi.fn(),
    onToggleTheme: vi.fn(),
    onHelp: vi.fn(),
    onSwitchAccount: vi.fn(),
    onLogout: vi.fn(),
  }
}

describe('UserMenu — focus trap', () => {
  it('mount 时 focus 首个菜单项', () => {
    const { container } = render(
      <UserMenu open onOpenChange={vi.fn()} user={USER} actions={makeFullActions()} />,
    )
    const first = container.querySelector('[data-menu-item]') as HTMLButtonElement
    expect(document.activeElement).toBe(first)
  })

  it('Tab 在最后项时循环到首项', () => {
    const { container } = render(
      <UserMenu open onOpenChange={vi.fn()} user={USER} actions={makeFullActions()} />,
    )
    const items = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-menu-item]'))
    const lastItem = items[items.length - 1]
    const firstItem = items[0]
    lastItem?.focus()
    expect(document.activeElement).toBe(lastItem)
    fireEvent.keyDown(lastItem!, { key: 'Tab' })
    expect(document.activeElement).toBe(firstItem)
  })

  it('Shift+Tab 在首项时循环到最后项', () => {
    const { container } = render(
      <UserMenu open onOpenChange={vi.fn()} user={USER} actions={makeFullActions()} />,
    )
    const items = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-menu-item]'))
    const firstItem = items[0]
    const lastItem = items[items.length - 1]
    firstItem?.focus()
    fireEvent.keyDown(firstItem!, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(lastItem)
  })

  it('Tab 中间项时浏览器默认 Tab 行为生效（focus trap 不阻止内部循环）', () => {
    const { container } = render(
      <UserMenu open onOpenChange={vi.fn()} user={USER} actions={makeFullActions()} />,
    )
    const items = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-menu-item]'))
    const middleItem = items[2]
    middleItem?.focus()
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    middleItem?.dispatchEvent(event)
    // 中间项不阻止默认行为（preventDefault 未调用）
    expect(event.defaultPrevented).toBe(false)
  })
})

describe('UserMenu — ESC 关闭', () => {
  it('ESC keydown → onOpenChange(false)', () => {
    const onOpenChange = vi.fn()
    render(<UserMenu open onOpenChange={onOpenChange} user={USER} actions={makeFullActions()} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('其他键 keydown 不触发关闭', () => {
    const onOpenChange = vi.fn()
    render(<UserMenu open onOpenChange={onOpenChange} user={USER} actions={makeFullActions()} />)
    fireEvent.keyDown(document, { key: 'Enter' })
    fireEvent.keyDown(document, { key: 'a' })
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('open=false 时不挂 ESC listener', () => {
    const onOpenChange = vi.fn()
    render(<UserMenu open={false} onOpenChange={onOpenChange} user={USER} actions={makeFullActions()} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})

describe('UserMenu — outside-click 关闭', () => {
  let outsideEl: HTMLDivElement

  beforeEach(() => {
    outsideEl = document.createElement('div')
    outsideEl.id = 'outside'
    document.body.appendChild(outsideEl)
  })

  afterEach(() => {
    outsideEl.remove()
  })

  it('外部 mousedown → onOpenChange(false)', () => {
    const onOpenChange = vi.fn()
    render(<UserMenu open onOpenChange={onOpenChange} user={USER} actions={makeFullActions()} />)
    fireEvent.mouseDown(outsideEl)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('菜单内 mousedown 不触发关闭', () => {
    const onOpenChange = vi.fn()
    const { container } = render(
      <UserMenu open onOpenChange={onOpenChange} user={USER} actions={makeFullActions()} />,
    )
    const menu = container.querySelector('[data-user-menu]') as HTMLElement
    fireEvent.mouseDown(menu)
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('anchorRef 内 mousedown 不触发关闭（避免触发器互斥）', () => {
    const onOpenChange = vi.fn()
    function Probe() {
      const anchorRef = useRef<HTMLButtonElement | null>(null)
      return (
        <>
          <button ref={anchorRef} data-testid="anchor">
            anchor
          </button>
          <UserMenu open onOpenChange={onOpenChange} user={USER} actions={makeFullActions()} anchorRef={anchorRef} />
        </>
      )
    }
    const { getByTestId } = render(<Probe />)
    fireEvent.mouseDown(getByTestId('anchor'))
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('open=false 时不挂 mousedown listener', () => {
    const onOpenChange = vi.fn()
    render(<UserMenu open={false} onOpenChange={onOpenChange} user={USER} actions={makeFullActions()} />)
    fireEvent.mouseDown(outsideEl)
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})

describe('UserMenu — focus trap 焦点门禁（仅菜单内焦点启用 trap）', () => {
  it('焦点在菜单外（document.body）时按 Tab 不被劫持', () => {
    const { container } = render(
      <UserMenu open onOpenChange={vi.fn()} user={USER} actions={makeFullActions()} />,
    )
    // 模拟焦点在菜单外（先 blur 菜单内的首项）
    ;(document.activeElement as HTMLElement | null)?.blur()
    document.body.focus()
    const menu = container.querySelector('[data-user-menu]') as HTMLElement
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    menu.dispatchEvent(event)
    // 焦点门禁不启用 → preventDefault 未调用
    expect(event.defaultPrevented).toBe(false)
  })
})

describe('UserMenu — callback throw 时菜单仍关闭（try/finally 保护）', () => {
  // React 18 事件处理器内 throw 会被 React 内部捕获（不冒泡到 click() 调用方），
  // 但 try/finally 保证 onOpenChange(false) 在 callback 抛错前被调度执行。
  it('actions.onProfile throw → onProfile 已被调用 + onOpenChange(false) 仍执行', () => {
    const onOpenChange = vi.fn()
    const onProfile = vi.fn(() => {
      throw new Error('boom')
    })
    const actions = makeFullActions()
    Object.assign(actions, { onProfile })
    render(<UserMenu open onOpenChange={onOpenChange} user={USER} actions={actions} />)
    const profileBtn = document.querySelector('[data-menu-item="profile"]') as HTMLButtonElement
    // React 在 click handler throw 时输出 error 但不冒泡；spy 仍记录调用
    profileBtn.click()
    expect(onProfile).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('actions.onLogout throw → onLogout 已被调用 + onOpenChange(false) 仍执行', () => {
    const onOpenChange = vi.fn()
    const onLogout = vi.fn(() => {
      throw new Error('logout failed')
    })
    render(
      <UserMenu open onOpenChange={onOpenChange} user={USER} actions={{ onLogout }} />,
    )
    const logoutBtn = document.querySelector('[data-menu-item="logout"]') as HTMLButtonElement
    logoutBtn.click()
    expect(onLogout).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})

describe('UserMenu — listener 卸载清理', () => {
  it('unmount 后 ESC + mousedown 都不再触发', () => {
    const onOpenChange = vi.fn()
    const { unmount } = render(
      <UserMenu open onOpenChange={onOpenChange} user={USER} actions={makeFullActions()} />,
    )
    unmount()
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.mouseDown(document.body)
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('open=true → false 后 listener 卸载（rerender）', () => {
    const onOpenChange = vi.fn()
    const { rerender } = render(
      <UserMenu open onOpenChange={onOpenChange} user={USER} actions={makeFullActions()} />,
    )
    rerender(<UserMenu open={false} onOpenChange={onOpenChange} user={USER} actions={makeFullActions()} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})

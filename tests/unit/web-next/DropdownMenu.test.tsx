import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { DropdownMenu } from '@/components/primitives/dropdown-menu'
import type { DropdownMenuItem } from '@/components/primitives/dropdown-menu'

// ── mocks ──────────────────────────────────────────────────────────────────

// hover 设备开关：hover-intent 仅在 (hover: hover) 匹配时启用
let hoverMatches = false

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('hover: hover') ? hoverMatches : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
})

afterEach(() => {
  hoverMatches = false
  vi.useRealTimers()
})

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string
    children: React.ReactNode
    [k: string]: unknown
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

// ── fixtures ───────────────────────────────────────────────────────────────

const ITEMS: DropdownMenuItem[] = [
  { key: 'a', label: 'Alpha', href: '/a' },
  { key: 'b', label: 'Beta', href: '/b', active: true },
]

function renderMenu(props?: Partial<React.ComponentProps<typeof DropdownMenu>>) {
  return render(
    <DropdownMenu
      testIdPrefix="test-dd"
      items={ITEMS}
      trigger={({ open, toggle }) => (
        <button type="button" data-testid="test-dd-trigger" aria-expanded={open} onClick={toggle}>
          更多
        </button>
      )}
      {...props}
    />,
  )
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('DropdownMenu', () => {
  it('默认收起；toggle 打开后渲染数据驱动的 items', () => {
    renderMenu()
    expect(screen.queryByTestId('test-dd-menu')).toBeNull()

    fireEvent.click(screen.getByTestId('test-dd-trigger'))

    expect(screen.getByTestId('test-dd-menu')).toBeTruthy()
    expect(screen.getByTestId('test-dd-a').getAttribute('href')).toBe('/a')
    expect(screen.getByTestId('test-dd-a').getAttribute('role')).toBe('menuitem')
    expect(screen.getByTestId('test-dd-b').textContent).toBe('Beta')
  })

  it('hover-intent：hover 设备移入 trigger，延时后展开', () => {
    hoverMatches = true
    vi.useFakeTimers()
    const { container } = renderMenu()
    const wrapper = container.firstChild as HTMLElement

    fireEvent.mouseEnter(wrapper)
    expect(screen.queryByTestId('test-dd-menu')).toBeNull() // 延时未到
    act(() => {
      vi.advanceTimersByTime(120)
    })
    expect(screen.getByTestId('test-dd-menu')).toBeTruthy()
  })

  it('几何桥接区：离开 wrapper 排程关闭，移入面板桥接区取消关闭（不收起）', () => {
    hoverMatches = true
    vi.useFakeTimers()
    const { container } = renderMenu()
    const wrapper = container.firstChild as HTMLElement

    fireEvent.mouseEnter(wrapper)
    act(() => {
      vi.advanceTimersByTime(120)
    })
    expect(screen.getByTestId('test-dd-menu')).toBeTruthy()

    fireEvent.mouseLeave(wrapper) // 排程 240ms 关闭
    const bridge = screen.getByTestId('test-dd-menu').parentElement as HTMLElement
    fireEvent.mouseEnter(bridge) // 桥接区 onMouseEnter → clearTimers
    act(() => {
      vi.advanceTimersByTime(400) // 远超 close 延时
    })
    expect(screen.getByTestId('test-dd-menu')).toBeTruthy() // 仍展开
  })

  it('键盘 ArrowDown 打开并聚焦首项', () => {
    vi.useFakeTimers()
    const { container } = renderMenu()
    const wrapper = container.firstChild as HTMLElement

    fireEvent.keyDown(wrapper, { key: 'ArrowDown' })
    expect(screen.getByTestId('test-dd-menu')).toBeTruthy()

    act(() => {
      vi.runAllTimers() // rAF（faked）→ 聚焦首项
    })
    expect(document.activeElement).toBe(screen.getByTestId('test-dd-a'))
  })

  it('菜单内 Esc 关闭并回焦 trigger', () => {
    renderMenu()
    fireEvent.click(screen.getByTestId('test-dd-trigger'))
    const menu = screen.getByTestId('test-dd-menu')

    fireEvent.keyDown(menu, { key: 'Escape' })

    expect(screen.queryByTestId('test-dd-menu')).toBeNull()
    expect(document.activeElement).toBe(screen.getByTestId('test-dd-trigger'))
  })

  it('onOpenChange 随开合回调', () => {
    const onOpenChange = vi.fn()
    renderMenu({ onOpenChange })

    fireEvent.click(screen.getByTestId('test-dd-trigger'))
    expect(onOpenChange).toHaveBeenCalledWith(true)

    fireEvent.click(screen.getByTestId('test-dd-trigger'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})

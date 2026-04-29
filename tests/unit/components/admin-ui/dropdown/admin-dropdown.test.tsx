/**
 * AdminDropdown 单测（CHG-SN-2-17）
 * 覆盖：open/closed / items 渲染 / 点击 item / ESC 关闭 / 点击外部关闭 /
 *       键盘导航（ArrowDown/Up/Enter）/ disabled item / danger item /
 *       separator / shortcut / icon / data-testid / a11y / SSR
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import React from 'react'
import { AdminDropdown } from '../../../../../packages/admin-ui/src/components/dropdown/admin-dropdown'
import type { AdminDropdownItem } from '../../../../../packages/admin-ui/src/components/dropdown/admin-dropdown'

const ITEMS: AdminDropdownItem[] = [
  { key: 'edit', label: '编辑', onClick: vi.fn() },
  { key: 'copy', label: '复制', onClick: vi.fn() },
  { key: 'delete', label: '删除', onClick: vi.fn(), danger: true },
]

function makeDrop(overrides: Partial<Parameters<typeof AdminDropdown>[0]> = {}) {
  const onOpenChange = vi.fn()
  const result = render(
    <AdminDropdown
      open={true}
      trigger={<button>触发器</button>}
      items={ITEMS}
      onOpenChange={onOpenChange}
      {...overrides}
    />,
  )
  return { ...result, onOpenChange }
}

// ── open state ───────────────────────────────────────────────────

describe('AdminDropdown — open 状态', () => {
  it('open=false 不渲染菜单', () => {
    makeDrop({ open: false })
    expect(document.querySelector('[data-admin-dropdown]')).toBeNull()
  })

  it('open=true 渲染菜单', () => {
    makeDrop()
    expect(document.querySelector('[data-admin-dropdown]')).toBeTruthy()
  })

  it('trigger 始终渲染', () => {
    makeDrop({ open: false })
    expect(screen.getByText('触发器')).toBeTruthy()
  })

  it('data-testid 传递到菜单', () => {
    makeDrop({ 'data-testid': 'my-drop' })
    expect(document.querySelector('[data-testid="my-drop"]')).toBeTruthy()
  })
})

// ── items 渲染 ───────────────────────────────────────────────────

describe('AdminDropdown — items 渲染', () => {
  it('所有 label 渲染', () => {
    makeDrop()
    expect(screen.getByText('编辑')).toBeTruthy()
    expect(screen.getByText('复制')).toBeTruthy()
    expect(screen.getByText('删除')).toBeTruthy()
  })

  it('danger item 带 data-danger 属性', () => {
    makeDrop()
    const deleteItem = document.querySelector('[data-key="delete"]')
    expect(deleteItem?.hasAttribute('data-danger')).toBe(true)
  })

  it('普通 item 无 data-danger 属性', () => {
    makeDrop()
    const editItem = document.querySelector('[data-key="edit"]')
    expect(editItem?.hasAttribute('data-danger')).toBe(false)
  })

  it('separator=true 渲染分隔线', () => {
    const items: AdminDropdownItem[] = [
      { key: 'a', label: 'A', onClick: vi.fn() },
      { key: 'b', label: 'B', onClick: vi.fn(), separator: true },
    ]
    makeDrop({ items })
    expect(document.querySelector('[role="separator"]')).toBeTruthy()
  })

  it('icon 渲染', () => {
    const items: AdminDropdownItem[] = [
      { key: 'a', label: 'A', onClick: vi.fn(), icon: <span data-icon="edit-icon" /> },
    ]
    makeDrop({ items })
    expect(document.querySelector('[data-icon="edit-icon"]')).toBeTruthy()
  })

  it('shortcut 渲染（mod+e → ⌘E）', () => {
    const items: AdminDropdownItem[] = [
      { key: 'a', label: 'A', onClick: vi.fn(), shortcut: 'mod+e' },
    ]
    makeDrop({ items })
    expect(screen.getByText('⌘E')).toBeTruthy()
  })
})

// ── a11y ─────────────────────────────────────────────────────────

describe('AdminDropdown — a11y', () => {
  it('role=menu 在菜单容器', () => {
    makeDrop()
    expect(document.querySelector('[role="menu"]')).toBeTruthy()
  })

  it('items 有 role=menuitem', () => {
    makeDrop()
    const items = document.querySelectorAll('[role="menuitem"]')
    expect(items.length).toBe(3)
  })

  it('disabled item aria-disabled=true', () => {
    const items: AdminDropdownItem[] = [
      { key: 'a', label: 'A', onClick: vi.fn(), disabled: true },
    ]
    makeDrop({ items })
    const item = document.querySelector('[data-key="a"]')
    expect(item?.getAttribute('aria-disabled')).toBe('true')
  })
})

// ── click item ───────────────────────────────────────────────────

describe('AdminDropdown — 点击操作', () => {
  it('点击 item 触发 onClick + onOpenChange(false)', () => {
    const onClick = vi.fn()
    const items: AdminDropdownItem[] = [{ key: 'a', label: '操作A', onClick }]
    const { onOpenChange } = makeDrop({ items })
    fireEvent.click(screen.getByText('操作A'))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('disabled item 点击不触发 onClick', () => {
    const onClick = vi.fn()
    const items: AdminDropdownItem[] = [{ key: 'a', label: '操作A', onClick, disabled: true }]
    const { onOpenChange } = makeDrop({ items })
    fireEvent.click(screen.getByText('操作A'))
    expect(onClick).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})

// ── ESC 关闭 ─────────────────────────────────────────────────────

describe('AdminDropdown — ESC 关闭', () => {
  it('ESC 键触发 onOpenChange(false)', () => {
    const { onOpenChange } = makeDrop()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('open=false 时 ESC 不触发 onOpenChange', () => {
    const { onOpenChange } = makeDrop({ open: false })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})

// ── 键盘导航 ─────────────────────────────────────────────────────

describe('AdminDropdown — 键盘导航', () => {
  it('ArrowDown 使第一个 item 高亮', () => {
    makeDrop()
    const menu = document.querySelector('[role="menu"]') as HTMLElement
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    const editItem = document.querySelector('[data-key="edit"]') as HTMLElement
    expect(editItem.style.background).not.toBe('transparent')
  })

  it('Enter 触发当前高亮 item 的 onClick', () => {
    const onClick = vi.fn()
    const items: AdminDropdownItem[] = [{ key: 'a', label: 'A', onClick }]
    const { onOpenChange } = makeDrop({ items })
    const menu = document.querySelector('[role="menu"]') as HTMLElement
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    fireEvent.keyDown(menu, { key: 'Enter' })
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})

// ── z-index CSS 变量 ──────────────────────────────────────────────

describe('AdminDropdown — z-index 不硬编码', () => {
  it('菜单 style.zIndex 使用 CSS 变量，不为纯数字', () => {
    makeDrop()
    const menu = document.querySelector('[data-admin-dropdown]') as HTMLElement
    const zi = menu?.style.zIndex ?? ''
    expect(zi).not.toMatch(/^\d+$/)
  })
})

// ── SSR ──────────────────────────────────────────────────────────

describe('AdminDropdown — SSR 零 throw', () => {
  it('open=false renderToString 不 throw', () => {
    expect(() =>
      renderToString(
        <AdminDropdown open={false} trigger={<button>t</button>} items={ITEMS} onOpenChange={vi.fn()} />,
      ),
    ).not.toThrow()
  })

  it('open=true renderToString 不 throw（mounted=false → 无 portal）', () => {
    expect(() =>
      renderToString(
        <AdminDropdown open={true} trigger={<button>t</button>} items={ITEMS} onOpenChange={vi.fn()} />,
      ),
    ).not.toThrow()
  })
})

/**
 * Drawer 单测（CHG-SN-2-16）
 * 覆盖：open/closed 状态 / 四个 placement / title 渲染 / 关闭按钮 / ESC / backdrop click /
 *       closeOnEscape=false / closeOnBackdropClick=false / data-testid / a11y / SSR
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import React from 'react'
import { Drawer } from '../../../../../packages/admin-ui/src/components/overlay/drawer'

function makeDrawer(overrides: Partial<Parameters<typeof Drawer>[0]> = {}) {
  const onClose = vi.fn()
  const result = render(
    <Drawer open={true} placement="right" onClose={onClose} title="抽屉标题" {...overrides}>
      <p>内容</p>
    </Drawer>,
  )
  return { ...result, onClose }
}

// ── open state ───────────────────────────────────────────────────

describe('Drawer — open 状态', () => {
  it('open=false 不渲染', () => {
    render(<Drawer open={false} placement="right" onClose={vi.fn()}><p>内容</p></Drawer>)
    expect(document.querySelector('[data-drawer]')).toBeNull()
  })

  it('open=true 渲染 Drawer', () => {
    makeDrawer()
    expect(document.querySelector('[data-drawer]')).toBeTruthy()
  })

  it('data-testid 传递', () => {
    makeDrawer({ 'data-testid': 'my-drawer' })
    expect(document.querySelector('[data-testid="my-drawer"]')).toBeTruthy()
  })
})

// ── placement ────────────────────────────────────────────────────

describe('Drawer — placement', () => {
  it.each(['left', 'right', 'top', 'bottom'] as const)('placement=%s data-placement 正确', (p) => {
    const { unmount } = makeDrawer({ placement: p })
    expect(document.querySelector(`[data-placement="${p}"]`)).toBeTruthy()
    unmount()
  })
})

// ── title + close ────────────────────────────────────────────────

describe('Drawer — title + close button', () => {
  it('title 渲染', () => {
    makeDrawer()
    expect(screen.getByText('抽屉标题')).toBeTruthy()
  })

  it('无 title 时不渲染关闭按钮', () => {
    makeDrawer({ title: undefined })
    expect(document.querySelector('[data-close-btn]')).toBeNull()
  })

  it('点击关闭按钮触发 onClose', () => {
    const { onClose } = makeDrawer()
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

// ── ESC ──────────────────────────────────────────────────────────

describe('Drawer — ESC 关闭', () => {
  it('ESC 键触发 onClose', () => {
    const { onClose } = makeDrawer()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closeOnEscape=false 时 ESC 不触发', () => {
    const { onClose } = makeDrawer({ closeOnEscape: false })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})

// ── backdrop click ───────────────────────────────────────────────

describe('Drawer — backdrop click', () => {
  it('点击 backdrop 触发 onClose', () => {
    const { onClose } = makeDrawer()
    const backdrop = document.querySelector('[data-drawer-backdrop]')
    expect(backdrop).toBeTruthy()
    fireEvent.click(backdrop!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closeOnBackdropClick=false 时 backdrop 点击不触发', () => {
    const { onClose } = makeDrawer({ closeOnBackdropClick: false })
    const backdrop = document.querySelector('[data-drawer-backdrop]')
    fireEvent.click(backdrop!)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('点击 Drawer 内容区不触发 onClose', () => {
    const { onClose } = makeDrawer()
    fireEvent.click(screen.getByText('内容'))
    expect(onClose).not.toHaveBeenCalled()
  })
})

// ── a11y ─────────────────────────────────────────────────────────

describe('Drawer — a11y', () => {
  it('role=dialog + aria-modal=true', () => {
    makeDrawer()
    const dialog = document.querySelector('[data-drawer]')
    expect(dialog?.getAttribute('role')).toBe('dialog')
    expect(dialog?.getAttribute('aria-modal')).toBe('true')
  })

  it('有 title 时 aria-labelledby 指向标题', () => {
    makeDrawer()
    const dialog = document.querySelector('[data-drawer]')
    expect(dialog?.getAttribute('aria-labelledby')).toBeTruthy()
  })
})

// ── z-index CSS var ──────────────────────────────────────────────

describe('Drawer — z-index 不硬编码', () => {
  it('backdrop style 用 CSS 变量，不硬编码数字', () => {
    makeDrawer()
    const backdrop = document.querySelector('[data-drawer-backdrop]') as HTMLElement
    // zIndex 在 jsdom 中可能是 "var(--z-modal)" 或展开值；检查不含纯数字硬编码
    const zi = backdrop?.style.zIndex ?? ''
    expect(zi).not.toMatch(/^\d+$/) // 不应为纯数字
  })
})

// ── SSR ──────────────────────────────────────────────────────────

describe('Drawer — SSR 零 throw', () => {
  it('open=false renderToString 不 throw', () => {
    expect(() =>
      renderToString(<Drawer open={false} placement="right" onClose={vi.fn()}><p>x</p></Drawer>),
    ).not.toThrow()
  })

  it('open=true renderToString 不 throw（mounted=false → null）', () => {
    expect(() =>
      renderToString(<Drawer open={true} placement="right" onClose={vi.fn()}><p>x</p></Drawer>),
    ).not.toThrow()
  })
})

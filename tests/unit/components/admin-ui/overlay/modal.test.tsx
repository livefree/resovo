/**
 * Modal 单测（CHG-SN-2-16）
 * 覆盖：open/closed / 三档 size / title / 关闭按钮 / ESC / backdrop click /
 *       closeOnEscape=false / closeOnBackdropClick=false / a11y / SSR
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import React from 'react'
import { Modal } from '../../../../../packages/admin-ui/src/components/overlay/modal'

function makeModal(overrides: Partial<Parameters<typeof Modal>[0]> = {}) {
  const onClose = vi.fn()
  const result = render(
    <Modal open={true} onClose={onClose} title="弹窗标题" {...overrides}>
      <p>弹窗内容</p>
    </Modal>,
  )
  return { ...result, onClose }
}

// ── open state ───────────────────────────────────────────────────

describe('Modal — open 状态', () => {
  it('open=false 不渲染', () => {
    render(<Modal open={false} onClose={vi.fn()}><p>内容</p></Modal>)
    expect(document.querySelector('[data-modal]')).toBeNull()
  })

  it('open=true 渲染 Modal', () => {
    makeModal()
    expect(document.querySelector('[data-modal]')).toBeTruthy()
  })

  it('data-testid 传递', () => {
    makeModal({ 'data-testid': 'my-modal' })
    expect(document.querySelector('[data-testid="my-modal"]')).toBeTruthy()
  })
})

// ── size ─────────────────────────────────────────────────────────

describe('Modal — size', () => {
  it.each(['sm', 'md', 'lg'] as const)('size=%s data-size 正确', (s) => {
    const { unmount } = makeModal({ size: s })
    expect(document.querySelector(`[data-size="${s}"]`)).toBeTruthy()
    unmount()
  })

  it('默认 size=md', () => {
    makeModal({ size: undefined })
    expect(document.querySelector('[data-size="md"]')).toBeTruthy()
  })
})

// ── title + close ────────────────────────────────────────────────

describe('Modal — title + close', () => {
  it('title 渲染', () => {
    makeModal()
    expect(screen.getByText('弹窗标题')).toBeTruthy()
  })

  it('无 title 时不渲染关闭按钮', () => {
    makeModal({ title: undefined })
    expect(document.querySelector('[data-close-btn]')).toBeNull()
  })

  it('点击关闭按钮触发 onClose', () => {
    const { onClose } = makeModal()
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

// ── ESC ──────────────────────────────────────────────────────────

describe('Modal — ESC 关闭', () => {
  it('ESC 键触发 onClose', () => {
    const { onClose } = makeModal()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closeOnEscape=false 时 ESC 不触发', () => {
    const { onClose } = makeModal({ closeOnEscape: false })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})

// ── backdrop click ───────────────────────────────────────────────

describe('Modal — backdrop click', () => {
  it('点击 backdrop 触发 onClose', () => {
    const { onClose } = makeModal()
    const backdrop = document.querySelector('[data-modal-backdrop]')
    expect(backdrop).toBeTruthy()
    fireEvent.click(backdrop!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closeOnBackdropClick=false 时不触发', () => {
    const { onClose } = makeModal({ closeOnBackdropClick: false })
    const backdrop = document.querySelector('[data-modal-backdrop]')
    fireEvent.click(backdrop!)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('点击 Modal 内容区不触发 onClose', () => {
    const { onClose } = makeModal()
    fireEvent.click(screen.getByText('弹窗内容'))
    expect(onClose).not.toHaveBeenCalled()
  })
})

// ── a11y ─────────────────────────────────────────────────────────

describe('Modal — a11y', () => {
  it('role=dialog + aria-modal=true', () => {
    makeModal()
    const dialog = document.querySelector('[data-modal]')
    expect(dialog?.getAttribute('role')).toBe('dialog')
    expect(dialog?.getAttribute('aria-modal')).toBe('true')
  })

  it('有 title 时 aria-labelledby 指向标题', () => {
    makeModal()
    const dialog = document.querySelector('[data-modal]')
    expect(dialog?.getAttribute('aria-labelledby')).toBeTruthy()
  })
})

// ── z-index 不硬编码 ─────────────────────────────────────────────

describe('Modal — z-index 不硬编码', () => {
  it('backdrop style zIndex 不为纯数字', () => {
    makeModal()
    const backdrop = document.querySelector('[data-modal-backdrop]') as HTMLElement
    const zi = backdrop?.style.zIndex ?? ''
    expect(zi).not.toMatch(/^\d+$/)
  })
})

// ── SSR ──────────────────────────────────────────────────────────

describe('Modal — SSR 零 throw', () => {
  it('open=false renderToString 不 throw', () => {
    expect(() =>
      renderToString(<Modal open={false} onClose={vi.fn()}><p>x</p></Modal>),
    ).not.toThrow()
  })

  it('open=true renderToString 不 throw（mounted 门控）', () => {
    expect(() =>
      renderToString(<Modal open={true} onClose={vi.fn()}><p>x</p></Modal>),
    ).not.toThrow()
  })
})

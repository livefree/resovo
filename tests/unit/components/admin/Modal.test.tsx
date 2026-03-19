/**
 * tests/unit/components/admin/Modal.test.tsx
 * CHG-24: Modal open/close、ESC 关闭、遮罩关闭、尺寸
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Modal } from '@/components/admin/Modal'

describe('Modal', () => {
  it('open=false 时不渲染', () => {
    render(<Modal open={false} onClose={vi.fn()} title="测试"><p>内容</p></Modal>)
    expect(screen.queryByTestId('modal-overlay')).toBeNull()
  })

  it('open=true 时渲染标题和内容', () => {
    render(<Modal open onClose={vi.fn()} title="对话框标题"><p>正文内容</p></Modal>)
    expect(screen.getByTestId('modal-title').textContent).toBe('对话框标题')
    expect(screen.getByTestId('modal-body').textContent).toContain('正文内容')
  })

  it('点击关闭按钮调用 onClose', () => {
    const onClose = vi.fn()
    render(<Modal open onClose={onClose} title="测试"><p>内容</p></Modal>)
    fireEvent.click(screen.getByTestId('modal-close-btn'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('点击遮罩层调用 onClose', () => {
    const onClose = vi.fn()
    render(<Modal open onClose={onClose} title="测试"><p>内容</p></Modal>)
    fireEvent.click(screen.getByTestId('modal-overlay'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('点击内容区不关闭（事件不冒泡）', () => {
    const onClose = vi.fn()
    render(<Modal open onClose={onClose} title="测试"><p>内容</p></Modal>)
    fireEvent.click(screen.getByTestId('modal-content'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('ESC 键调用 onClose', () => {
    const onClose = vi.fn()
    render(<Modal open onClose={onClose} title="测试"><p>内容</p></Modal>)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})

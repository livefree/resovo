/**
 * tests/unit/components/admin/ConfirmDialog.test.tsx
 * CHG-24: ConfirmDialog loading 状态、确认/取消回调
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'

const BASE_PROPS = {
  open: true,
  onClose: vi.fn(),
  title: '确认删除',
  description: '此操作不可撤销，确定继续吗？',
  onConfirm: vi.fn(),
}

describe('ConfirmDialog', () => {
  it('渲染标题和描述', () => {
    render(<ConfirmDialog {...BASE_PROPS} />)
    expect(screen.getByTestId('modal-title').textContent).toBe('确认删除')
    expect(screen.getByTestId('confirm-dialog-description').textContent).toContain('不可撤销')
  })

  it('点击确认按钮调用 onConfirm', () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog {...BASE_PROPS} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('点击取消按钮调用 onClose', () => {
    const onClose = vi.fn()
    render(<ConfirmDialog {...BASE_PROPS} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('confirm-dialog-cancel'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('loading=true 时确认按钮 disabled，显示"处理中"', () => {
    render(<ConfirmDialog {...BASE_PROPS} loading />)
    const btn = screen.getByTestId('confirm-dialog-confirm') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.textContent).toContain('处理中')
  })

  it('loading=true 时取消按钮也 disabled', () => {
    render(<ConfirmDialog {...BASE_PROPS} loading />)
    const btn = screen.getByTestId('confirm-dialog-cancel') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('open=false 时不渲染', () => {
    render(<ConfirmDialog {...BASE_PROPS} open={false} />)
    expect(screen.queryByTestId('modal-overlay')).toBeNull()
  })

  it('自定义 confirmText', () => {
    render(<ConfirmDialog {...BASE_PROPS} confirmText="删除" />)
    expect(screen.getByTestId('confirm-dialog-confirm').textContent).toBe('删除')
  })
})

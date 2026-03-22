/**
 * tests/unit/components/admin/content/ReviewModal.test.tsx
 * CHG-29: ReviewModal 通过/驳回按钮状态、驳回理由必填校验
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReviewModal, type ReviewTarget } from '@/components/admin/content/ReviewModal'

const TARGET: ReviewTarget = { id: 'sub-1', type: 'submission', title: '测试视频' }

const BASE_PROPS = {
  open: true,
  target: TARGET,
  onClose: vi.fn(),
  onApprove: vi.fn().mockResolvedValue(undefined),
  onReject: vi.fn().mockResolvedValue(undefined),
}

describe('ReviewModal', () => {
  it('open=false 时不渲染', () => {
    render(<ReviewModal {...BASE_PROPS} open={false} />)
    expect(screen.queryByTestId('review-modal-body')).toBeNull()
  })

  it('target=null 时不渲染', () => {
    render(<ReviewModal {...BASE_PROPS} target={null} />)
    expect(screen.queryByTestId('review-modal-body')).toBeNull()
  })

  it('初始显示"通过"Tab，提交按钮可用', () => {
    render(<ReviewModal {...BASE_PROPS} />)
    expect(screen.getByTestId('review-modal-tab-approve')).toBeTruthy()
    const submitBtn = screen.getByTestId('review-modal-submit') as HTMLButtonElement
    expect(submitBtn.disabled).toBe(false)
    expect(submitBtn.textContent).toContain('通过')
  })

  it('点击"通过"Tab 后 submit 按钮文字为"确认通过"', () => {
    render(<ReviewModal {...BASE_PROPS} />)
    fireEvent.click(screen.getByTestId('review-modal-tab-approve'))
    expect(screen.getByTestId('review-modal-submit').textContent).toContain('通过')
  })

  it('切换到"驳回"Tab 后，submit 按钮初始 disabled（理由为空）', () => {
    render(<ReviewModal {...BASE_PROPS} />)
    fireEvent.click(screen.getByTestId('review-modal-tab-reject'))
    const submitBtn = screen.getByTestId('review-modal-submit') as HTMLButtonElement
    expect(submitBtn.disabled).toBe(true)
    expect(submitBtn.textContent).toContain('驳回')
  })

  it('驳回理由输入后 submit 按钮变可用', () => {
    render(<ReviewModal {...BASE_PROPS} />)
    fireEvent.click(screen.getByTestId('review-modal-tab-reject'))
    fireEvent.change(screen.getByTestId('review-modal-reason-input'), {
      target: { value: '链接无效，无法访问' },
    })
    const submitBtn = screen.getByTestId('review-modal-submit') as HTMLButtonElement
    expect(submitBtn.disabled).toBe(false)
  })

  it('通过 Tab 点击提交调用 onApprove', async () => {
    const onApprove = vi.fn().mockResolvedValue(undefined)
    render(<ReviewModal {...BASE_PROPS} onApprove={onApprove} />)
    fireEvent.click(screen.getByTestId('review-modal-submit'))
    expect(onApprove).toHaveBeenCalledWith('sub-1', 'submission')
  })

  it('驳回 Tab 填写理由后点击提交调用 onReject', async () => {
    const onReject = vi.fn().mockResolvedValue(undefined)
    render(<ReviewModal {...BASE_PROPS} onReject={onReject} />)
    fireEvent.click(screen.getByTestId('review-modal-tab-reject'))
    fireEvent.change(screen.getByTestId('review-modal-reason-input'), {
      target: { value: '链接无效' },
    })
    fireEvent.click(screen.getByTestId('review-modal-submit'))
    expect(onReject).toHaveBeenCalledWith('sub-1', 'submission', '链接无效')
  })
})

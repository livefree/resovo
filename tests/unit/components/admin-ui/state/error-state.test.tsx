/**
 * ErrorState 单测（CHG-SN-2-18）
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { ErrorState } from '../../../../../packages/admin-ui/src/components/state/error-state'

describe('ErrorState — 渲染', () => {
  it('挂载 data-error-state', () => {
    render(<ErrorState error={new Error('加载失败')} />)
    expect(document.querySelector('[data-error-state]')).toBeTruthy()
  })

  it('无 title 时默认显示"加载失败"', () => {
    render(<ErrorState error={new Error('net err')} />)
    expect(screen.getByText('加载失败')).toBeTruthy()
  })

  it('自定义 title 覆盖默认', () => {
    render(<ErrorState error={new Error('net err')} title="请求超时" />)
    expect(screen.getByText('请求超时')).toBeTruthy()
  })

  it('error.message 渲染', () => {
    render(<ErrorState error={new Error('Network Error')} />)
    expect(screen.getByText('Network Error')).toBeTruthy()
  })

  it('无 onRetry 时不渲染重试按钮', () => {
    render(<ErrorState error={new Error('err')} />)
    expect(document.querySelector('[data-retry-btn]')).toBeNull()
  })

  it('有 onRetry 时渲染"重试"按钮并响应点击', () => {
    const onRetry = vi.fn()
    render(<ErrorState error={new Error('err')} onRetry={onRetry} />)
    fireEvent.click(screen.getByText('重试'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('className 传递', () => {
    const { container } = render(<ErrorState error={new Error('x')} className="err-cls" />)
    expect(container.querySelector('.err-cls')).toBeTruthy()
  })
})

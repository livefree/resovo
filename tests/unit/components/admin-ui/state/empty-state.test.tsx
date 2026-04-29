/**
 * EmptyState 单测（CHG-SN-2-18）
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { EmptyState } from '../../../../../packages/admin-ui/src/components/state/empty-state'

describe('EmptyState — 渲染', () => {
  it('挂载 data-empty-state', () => {
    render(<EmptyState />)
    expect(document.querySelector('[data-empty-state]')).toBeTruthy()
  })

  it('无 props 时 title/description/illustration/action 不渲染', () => {
    render(<EmptyState />)
    expect(document.querySelector('[data-empty-title]')).toBeNull()
    expect(document.querySelector('[data-empty-description]')).toBeNull()
    expect(document.querySelector('[data-empty-illustration]')).toBeNull()
    expect(document.querySelector('[data-empty-action]')).toBeNull()
  })

  it('title 渲染', () => {
    render(<EmptyState title="暂无数据" />)
    expect(screen.getByText('暂无数据')).toBeTruthy()
  })

  it('description 渲染', () => {
    render(<EmptyState description="试试添加一条记录" />)
    expect(screen.getByText('试试添加一条记录')).toBeTruthy()
  })

  it('illustration 渲染', () => {
    render(<EmptyState illustration={<span data-ilu="true" />} />)
    expect(document.querySelector('[data-ilu="true"]')).toBeTruthy()
  })

  it('action 按钮渲染并响应点击', () => {
    const onClick = vi.fn()
    render(<EmptyState action={{ label: '新建', onClick }} />)
    fireEvent.click(screen.getByText('新建'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('className 传递', () => {
    const { container } = render(<EmptyState className="my-class" />)
    expect(container.querySelector('.my-class')).toBeTruthy()
  })
})

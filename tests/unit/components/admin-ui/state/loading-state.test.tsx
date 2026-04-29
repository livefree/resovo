/**
 * LoadingState 单测（CHG-SN-2-18）
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { LoadingState } from '../../../../../packages/admin-ui/src/components/state/loading-state'

describe('LoadingState — spinner（默认）', () => {
  it('默认 variant=spinner 渲染', () => {
    render(<LoadingState />)
    const el = document.querySelector('[data-loading-state]')
    expect(el?.getAttribute('data-variant')).toBe('spinner')
  })

  it('渲染 data-spinner', () => {
    render(<LoadingState />)
    expect(document.querySelector('[data-spinner]')).toBeTruthy()
  })

  it('label 渲染', () => {
    render(<LoadingState label="数据加载中…" />)
    expect(screen.getByText('数据加载中…')).toBeTruthy()
  })

  it('无 label 时不渲染 span', () => {
    const { container } = render(<LoadingState />)
    expect(container.querySelector('span')).toBeNull()
  })

  it('aria-busy=true', () => {
    render(<LoadingState />)
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy()
  })
})

describe('LoadingState — skeleton', () => {
  it('variant=skeleton 渲染', () => {
    render(<LoadingState variant="skeleton" />)
    const el = document.querySelector('[data-loading-state]')
    expect(el?.getAttribute('data-variant')).toBe('skeleton')
  })

  it('默认 5 行骨架', () => {
    render(<LoadingState variant="skeleton" />)
    const rows = document.querySelectorAll('[data-skeleton-row]')
    expect(rows.length).toBe(5)
  })

  it('skeletonRows=3 渲染 3 行', () => {
    render(<LoadingState variant="skeleton" skeletonRows={3} />)
    const rows = document.querySelectorAll('[data-skeleton-row]')
    expect(rows.length).toBe(3)
  })

  it('skeletonRows=8 渲染 8 行', () => {
    render(<LoadingState variant="skeleton" skeletonRows={8} />)
    const rows = document.querySelectorAll('[data-skeleton-row]')
    expect(rows.length).toBe(8)
  })

  it('skeleton 不渲染 data-spinner', () => {
    render(<LoadingState variant="skeleton" />)
    expect(document.querySelector('[data-spinner]')).toBeNull()
  })

  it('className 传递', () => {
    const { container } = render(<LoadingState className="load-cls" />)
    expect(container.querySelector('.load-cls')).toBeTruthy()
  })
})

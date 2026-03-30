/**
 * tests/unit/components/shared/DetailPageShell.test.tsx
 * CHG-321: DetailPageShell 结构渲染验证
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DetailPageShell } from '@/components/shared/layout/DetailPageShell'

describe('DetailPageShell', () => {
  it('渲染 header 和 children', () => {
    render(
      <DetailPageShell header={<span>页面标题</span>}>
        <div>主内容</div>
      </DetailPageShell>
    )
    expect(screen.getByTestId('detail-page-shell')).toBeTruthy()
    expect(screen.getByTestId('detail-page-shell-header')).toBeTruthy()
    expect(screen.getByTestId('detail-page-shell-content')).toBeTruthy()
    expect(screen.getByText('页面标题')).toBeTruthy()
    expect(screen.getByText('主内容')).toBeTruthy()
  })

  it('无 sidebar 时不渲染侧边栏', () => {
    render(
      <DetailPageShell header={<span>标题</span>}>
        <div>内容</div>
      </DetailPageShell>
    )
    expect(screen.queryByTestId('detail-page-shell-sidebar')).toBeNull()
  })

  it('有 sidebar 时渲染侧边栏', () => {
    render(
      <DetailPageShell
        header={<span>标题</span>}
        sidebar={<div>侧边栏</div>}
      >
        <div>内容</div>
      </DetailPageShell>
    )
    expect(screen.getByTestId('detail-page-shell-sidebar')).toBeTruthy()
    expect(screen.getByText('侧边栏')).toBeTruthy()
  })

  it('testId prop 覆盖默认 data-testid', () => {
    render(
      <DetailPageShell header={<span>标题</span>} testId="my-detail">
        <div>内容</div>
      </DetailPageShell>
    )
    expect(screen.getByTestId('my-detail')).toBeTruthy()
  })
})

/**
 * tests/unit/components/shared/DetailSection.test.tsx
 * CHG-321: DetailSection 字段渲染验证
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DetailSection } from '@/components/shared/layout/DetailSection'

describe('DetailSection', () => {
  const fields = [
    { label: '标题', value: '测试视频', testId: 'field-title' },
    { label: '状态', value: '已发布', testId: 'field-status' },
  ]

  it('渲染字段 label 和 value', () => {
    render(<DetailSection fields={fields} />)
    expect(screen.getByText('标题')).toBeTruthy()
    expect(screen.getByText('测试视频')).toBeTruthy()
    expect(screen.getByText('状态')).toBeTruthy()
    expect(screen.getByText('已发布')).toBeTruthy()
  })

  it('渲染 section 标题', () => {
    render(<DetailSection title="基本信息" fields={fields} />)
    expect(screen.getByText('基本信息')).toBeTruthy()
  })

  it('渲染 actions 区', () => {
    render(
      <DetailSection
        fields={fields}
        actions={<button>编辑</button>}
      />
    )
    expect(screen.getByRole('button', { name: '编辑' })).toBeTruthy()
  })

  it('value 为 null 时显示占位符 —', () => {
    render(
      <DetailSection
        fields={[{ label: '备注', value: null }]}
      />
    )
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('testId prop 覆盖默认 data-testid', () => {
    render(<DetailSection fields={fields} testId="my-section" />)
    expect(screen.getByTestId('my-section')).toBeTruthy()
  })
})

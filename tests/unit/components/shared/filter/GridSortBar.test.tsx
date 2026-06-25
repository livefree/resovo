/**
 * tests/unit/components/shared/filter/GridSortBar.test.tsx
 * HANDOFF-39：网格排序条 GridSortBar
 *
 * 覆盖：SORT_OPTIONS 3 按钮渲染 / 默认 latest 激活 / 切换写 ?sort= + reset page /
 *       选 DEFAULT_SORT 删 param / 激活态读 ?sort= / 计数 total+totalLabelKey 防御。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GridSortBar } from '@/components/shared/filter/GridSortBar'

const mockPush = vi.fn()
const mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}))

vi.mock('next-intl', () => ({
  // 计数文案 t(key, {count}) → 返回带 count 便于断言
  useTranslations: () => (key: string, values?: { count?: number }) =>
    values?.count !== undefined ? `${key}:${values.count}` : key,
}))

describe('GridSortBar（网格排序条，HANDOFF-39）', () => {
  beforeEach(() => {
    mockPush.mockClear()
    Array.from(mockSearchParams.keys()).forEach((k) => mockSearchParams.delete(k))
  })

  it('渲染排序条 + SORT_OPTIONS 3 按钮', () => {
    render(<GridSortBar />)
    expect(screen.getByTestId('grid-sort-bar')).toBeTruthy()
    expect(screen.getByTestId('sort-latest')).toBeTruthy()
    expect(screen.getByTestId('sort-hot')).toBeTruthy()
    expect(screen.getByTestId('sort-rating')).toBeTruthy()
  })

  it('默认（无 ?sort=）latest 激活', () => {
    render(<GridSortBar />)
    expect(screen.getByTestId('sort-latest').getAttribute('aria-checked')).toBe('true')
    expect(screen.getByTestId('sort-hot').getAttribute('aria-checked')).toBe('false')
  })

  it('点 hot 写 ?sort=hot + 重置 page', () => {
    mockSearchParams.set('page', '2')
    render(<GridSortBar />)
    fireEvent.click(screen.getByTestId('sort-hot'))
    const url = mockPush.mock.calls[0][0] as string
    expect(url).toContain('sort=hot')
    expect(url).not.toContain('page=')
  })

  it('点默认排序 latest 删 sort param（走后端默认）', () => {
    mockSearchParams.set('sort', 'hot')
    render(<GridSortBar />)
    fireEvent.click(screen.getByTestId('sort-latest'))
    const url = mockPush.mock.calls[0][0] as string
    expect(url).not.toContain('sort=')
  })

  it('激活态读 ?sort=', () => {
    mockSearchParams.set('sort', 'rating')
    render(<GridSortBar />)
    expect(screen.getByTestId('sort-rating').getAttribute('aria-checked')).toBe('true')
  })

  it('search 模式：渲染 4 按钮含「相关度」(relevance)', () => {
    render(<GridSortBar mode="search" />)
    expect(screen.getByTestId('sort-relevance')).toBeTruthy()
    expect(screen.getByTestId('sort-latest')).toBeTruthy()
    expect(screen.getByTestId('sort-hot')).toBeTruthy()
    expect(screen.getByTestId('sort-rating')).toBeTruthy()
  })

  it('search 模式：无 ?sort= 默认高亮 relevance（= 后端搜索默认，前后端一致）', () => {
    render(<GridSortBar mode="search" />)
    expect(screen.getByTestId('sort-relevance').getAttribute('aria-checked')).toBe('true')
    expect(screen.getByTestId('sort-latest').getAttribute('aria-checked')).toBe('false')
  })

  it('search 模式：点 latest 显式写 ?sort=latest', () => {
    render(<GridSortBar mode="search" />)
    fireEvent.click(screen.getByTestId('sort-latest'))
    const url = mockPush.mock.calls[0][0] as string
    expect(url).toContain('sort=latest')
  })

  it('search 模式：选 latest 后点回「相关度」删 param 回后端默认（死角消除）', () => {
    mockSearchParams.set('sort', 'latest')
    render(<GridSortBar mode="search" />)
    fireEvent.click(screen.getByTestId('sort-relevance'))
    const url = mockPush.mock.calls[0][0] as string
    expect(url).not.toContain('sort=')
  })

  it('search 模式：有 ?sort= 时正常高亮', () => {
    mockSearchParams.set('sort', 'hot')
    render(<GridSortBar mode="search" />)
    expect(screen.getByTestId('sort-hot').getAttribute('aria-checked')).toBe('true')
  })

  it('total + totalLabelKey 提供时渲染计数', () => {
    render(<GridSortBar total={42} totalLabelKey="filter.countSearch" />)
    const count = screen.getByTestId('grid-sort-count')
    expect(count.textContent).toContain('42')
  })

  it('缺 total 或 totalLabelKey 时不渲染计数（防御 undefined）', () => {
    render(<GridSortBar />)
    expect(screen.queryByTestId('grid-sort-count')).toBeNull()
    render(<GridSortBar total={10} />)
    expect(screen.queryByTestId('grid-sort-count')).toBeNull()
  })
})

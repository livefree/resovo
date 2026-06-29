/**
 * tests/unit/components/shared/filter/GridSortBar.test.tsx
 * HANDOFF-39：网格排序条 GridSortBar
 *
 * 覆盖：SORT_OPTIONS 3 按钮渲染 / 默认 latest 激活 / 切换写 ?sort= + reset page /
 *       选 DEFAULT_SORT 删 param / 激活态读 ?sort= / 计数 total+totalLabelKey 防御 /
 *       方向切换（desc↔asc + ?order= + 箭头标示 + 切排序复位方向 / relevance 非方向性）。
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

  // ── 方向切换（降序/升序 + 箭头标示）─────────────────────────────────
  it('默认激活项（latest desc）渲染降序箭头 ↓', () => {
    render(<GridSortBar />)
    const arrow = screen.getByTestId('sort-arrow-latest')
    expect(arrow.textContent).toBe('↓')
    expect(screen.getByTestId('sort-latest').getAttribute('data-direction')).toBe('desc')
  })

  it('未激活项不渲染方向箭头', () => {
    render(<GridSortBar />)
    expect(screen.queryByTestId('sort-arrow-hot')).toBeNull()
    expect(screen.queryByTestId('sort-arrow-rating')).toBeNull()
  })

  it('点已激活方向性项 → 切 ?order=asc（desc→asc）', () => {
    mockSearchParams.set('sort', 'hot')
    render(<GridSortBar />)
    fireEvent.click(screen.getByTestId('sort-hot'))
    const url = mockPush.mock.calls[0][0] as string
    expect(url).toContain('sort=hot')
    expect(url).toContain('order=asc')
  })

  it('asc 激活态再点 → 删 order 回默认 desc（asc→desc）', () => {
    mockSearchParams.set('sort', 'hot')
    mockSearchParams.set('order', 'asc')
    render(<GridSortBar />)
    fireEvent.click(screen.getByTestId('sort-hot'))
    const url = mockPush.mock.calls[0][0] as string
    expect(url).not.toContain('order=')
  })

  it('asc 激活态渲染升序箭头 ↑', () => {
    mockSearchParams.set('sort', 'rating')
    mockSearchParams.set('order', 'asc')
    render(<GridSortBar />)
    expect(screen.getByTestId('sort-arrow-rating').textContent).toBe('↑')
    expect(screen.getByTestId('sort-rating').getAttribute('data-direction')).toBe('asc')
  })

  it('从 asc 排序切到另一排序 → 方向复位（删 order）', () => {
    mockSearchParams.set('sort', 'hot')
    mockSearchParams.set('order', 'asc')
    render(<GridSortBar />)
    fireEvent.click(screen.getByTestId('sort-rating'))
    const url = mockPush.mock.calls[0][0] as string
    expect(url).toContain('sort=rating')
    expect(url).not.toContain('order=')
  })

  it('category 默认项 latest 升序：sort 仍省略、仅写 ?order=asc', () => {
    render(<GridSortBar />)
    // 无 ?sort= 时 latest 即激活默认项，点击切方向
    fireEvent.click(screen.getByTestId('sort-latest'))
    const url = mockPush.mock.calls[0][0] as string
    expect(url).not.toContain('sort=')
    expect(url).toContain('order=asc')
  })

  it('search 模式 relevance 非方向性：不渲染箭头', () => {
    render(<GridSortBar mode="search" />)
    expect(screen.queryByTestId('sort-arrow-relevance')).toBeNull()
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

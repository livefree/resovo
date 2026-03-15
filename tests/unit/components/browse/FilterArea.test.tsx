/**
 * tests/unit/components/browse/FilterArea.test.tsx
 * BROWSE-01: FilterArea 行内单选逻辑 + URL 参数同步
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterArea } from '@/components/browse/FilterArea'

// ── Mocks ─────────────────────────────────────────────────────────

const mockPush = vi.fn()
const mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      'browse.filter.typeAll':    'All types',
      'browse.filter.countryAll': 'All regions',
      'browse.filter.langAll':    'All subtitles',
      'browse.filter.yearAll':    'All years',
      'browse.filter.ratingAll':  'Any rating',
      'browse.filter.statusAll':  'All status',
      'browse.filter.type':       'Type',
      'browse.filter.country':    'Region',
      'browse.filter.lang':       'Subtitle',
      'browse.filter.year':       'Year',
      'browse.filter.rating':     'Rating',
      'browse.filter.status':     'Status',
      'browse.filter.expand':     'More filters',
      'browse.filter.collapse':   'Collapse',
      'browse.filter.ongoing':    'Airing',
      'browse.filter.completed':  'Completed',
      'browse.filter.rating9':    '9+',
      'browse.filter.rating8':    '8+',
      'browse.filter.rating7':    '7+',
      'browse.filter.rating6':    '6+',
      'nav.catMovie':    'Movies',
      'nav.catSeries':   'Series',
      'nav.catAnime':    'Anime',
      'nav.catVariety':  'Variety',
    }
    return translations[key] ?? key
  },
}))

// ── 测试 ──────────────────────────────────────────────────────────

describe('FilterArea', () => {
  beforeEach(() => {
    mockPush.mockClear()
    Array.from(mockSearchParams.keys()).forEach((k) => mockSearchParams.delete(k))
  })

  it('渲染筛选区域', () => {
    render(<FilterArea />)
    expect(screen.getByTestId('filter-area')).toBeTruthy()
  })

  it('默认显示前 3 行筛选（类型/地区/字幕）', () => {
    render(<FilterArea />)
    expect(screen.getByTestId('filter-type-all')).toBeTruthy()
    expect(screen.getByTestId('filter-country-all')).toBeTruthy()
    expect(screen.getByTestId('filter-lang-all')).toBeTruthy()
    // 年份筛选默认不可见
    expect(screen.queryByTestId('filter-year-all')).toBeNull()
  })

  it('点击展开按钮后显示所有 6 行筛选', () => {
    render(<FilterArea />)
    fireEvent.click(screen.getByTestId('filter-expand'))
    expect(screen.getByTestId('filter-year-all')).toBeTruthy()
    expect(screen.getByTestId('filter-rating_min-all')).toBeTruthy()
    expect(screen.getByTestId('filter-status-all')).toBeTruthy()
  })

  it('点击类型选项后更新 URL 参数', () => {
    render(<FilterArea />)
    fireEvent.click(screen.getByTestId('filter-type-movie'))
    expect(mockPush).toHaveBeenCalledTimes(1)
    const url = mockPush.mock.calls[0][0] as string
    expect(url).toContain('type=movie')
  })

  it('点击"全部"选项后移除 URL 参数', () => {
    mockSearchParams.set('type', 'movie')
    render(<FilterArea />)
    fireEvent.click(screen.getByTestId('filter-type-all'))
    const url = mockPush.mock.calls[0][0] as string
    expect(url).not.toContain('type=')
  })

  it('选择筛选条件后 page 参数被重置', () => {
    mockSearchParams.set('page', '3')
    render(<FilterArea />)
    fireEvent.click(screen.getByTestId('filter-type-anime'))
    const url = mockPush.mock.calls[0][0] as string
    expect(url).not.toContain('page=')
    expect(url).toContain('type=anime')
  })

  it('当前选中的筛选标签 data-testid 正确存在', () => {
    mockSearchParams.set('type', 'movie')
    render(<FilterArea />)
    // 选中状态的按钮存在
    const movieBtn = screen.getByTestId('filter-type-movie')
    expect(movieBtn).toBeTruthy()
    // 非选中按钮也存在（确认行内单选，非互斥隐藏）
    const allBtn = screen.getByTestId('filter-type-all')
    expect(allBtn).toBeTruthy()
  })

  it('可以同时应用多个不同维度的筛选', () => {
    mockSearchParams.set('type', 'anime')
    render(<FilterArea />)
    fireEvent.click(screen.getByTestId('filter-country-JP'))
    const url = mockPush.mock.calls[0][0] as string
    // type 保留，country 新增
    expect(url).toContain('type=anime')
    expect(url).toContain('country=JP')
  })
})

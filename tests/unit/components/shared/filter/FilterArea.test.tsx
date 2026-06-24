/**
 * tests/unit/components/shared/filter/FilterArea.test.tsx
 * HANDOFF-39：统一筛选区共享组件 FilterArea
 *
 * 覆盖：taxonomy 5 维渲染 / type 注入 + 激活态分流（category vs search）/
 *       互斥单选 + reset page / 再点取消 / hiddenDimensions / onTypeChange 回调。
 * @resovo/types（FILTER_TAXONOMY / 枚举 / formatCountryName）用真实实现，仅 mock 框架钩子。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { VideoType } from '@resovo/types'
import { FilterArea } from '@/components/shared/filter/FilterArea'

// ── Mocks ─────────────────────────────────────────────────────────

const mockPush = vi.fn()
const mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
  useParams: () => ({ locale: 'zh-CN' }),
}))

vi.mock('next-intl', () => ({
  // 根命名空间 t：行为测试只关心 testid（用 value），label 返回 key 即可
  useTranslations: () => (key: string) => key,
}))

const TYPE_OPTIONS: readonly VideoType[] = [
  'movie', 'series', 'anime', 'variety', 'documentary',
  'short', 'sports', 'music', 'news', 'kids', 'other',
]

function renderCategory(extra?: Partial<{ activeType: VideoType | null; onTypeChange: (v: VideoType | null) => void }>) {
  return render(
    <FilterArea
      mode="category"
      typeOptions={TYPE_OPTIONS}
      activeType={extra?.activeType ?? null}
      onTypeChange={extra?.onTypeChange}
    />,
  )
}

// ── 测试 ──────────────────────────────────────────────────────────

describe('FilterArea（统一筛选区，HANDOFF-39）', () => {
  beforeEach(() => {
    mockPush.mockClear()
    Array.from(mockSearchParams.keys()).forEach((k) => mockSearchParams.delete(k))
  })

  it('渲染筛选区 + taxonomy 5 维行（type/genre/country/lang/year）', () => {
    render(<FilterArea mode="search" typeOptions={TYPE_OPTIONS} />)
    expect(screen.getByTestId('filter-area')).toBeTruthy()
    expect(screen.getByTestId('filter-type')).toBeTruthy()
    expect(screen.getByTestId('filter-genre')).toBeTruthy()
    expect(screen.getByTestId('filter-country')).toBeTruthy()
    expect(screen.getByTestId('filter-lang')).toBeTruthy()
    expect(screen.getByTestId('filter-year')).toBeTruthy()
  })

  it('type 选项由 typeOptions 注入（11 类型 + 全部）', () => {
    render(<FilterArea mode="search" typeOptions={TYPE_OPTIONS} />)
    expect(screen.getByTestId('filter-type-all')).toBeTruthy()
    expect(screen.getByTestId('filter-type-movie')).toBeTruthy()
    expect(screen.getByTestId('filter-type-variety')).toBeTruthy()
    expect(screen.getByTestId('filter-type-other')).toBeTruthy()
  })

  it('genre/lang/country 选项消费 @resovo/types 枚举（零硬编码）', () => {
    render(<FilterArea mode="search" typeOptions={TYPE_OPTIONS} />)
    expect(screen.getByTestId('filter-genre-action')).toBeTruthy()
    expect(screen.getByTestId('filter-genre-sci_fi')).toBeTruthy()
    expect(screen.getByTestId('filter-lang-国语')).toBeTruthy()
    expect(screen.getByTestId('filter-lang-英语')).toBeTruthy()
    expect(screen.getByTestId('filter-country-CN')).toBeTruthy()
  })

  it('year 维计算生成（含当年）', () => {
    render(<FilterArea mode="search" typeOptions={TYPE_OPTIONS} />)
    const y = new Date().getFullYear()
    expect(screen.getByTestId(`filter-year-${y}`)).toBeTruthy()
  })

  it('hiddenDimensions 隐藏指定维度行', () => {
    render(<FilterArea mode="search" typeOptions={TYPE_OPTIONS} hiddenDimensions={['type', 'year']} />)
    expect(screen.queryByTestId('filter-type')).toBeNull()
    expect(screen.queryByTestId('filter-year')).toBeNull()
    expect(screen.getByTestId('filter-genre')).toBeTruthy()
  })

  // ── URL-param 驱动维度（genre/country/lang/year）─────────────────
  it('点 genre 选项写 URL 参数 + 重置 page', () => {
    mockSearchParams.set('page', '3')
    render(<FilterArea mode="search" typeOptions={TYPE_OPTIONS} />)
    fireEvent.click(screen.getByTestId('filter-genre-action'))
    const url = mockPush.mock.calls[0][0] as string
    expect(url).toContain('genre=action')
    expect(url).not.toContain('page=')
  })

  it('点 lang 选项写音频语音规范词到 URL', () => {
    render(<FilterArea mode="search" typeOptions={TYPE_OPTIONS} />)
    fireEvent.click(screen.getByTestId('filter-lang-粤语'))
    const url = mockPush.mock.calls[0][0] as string
    expect(decodeURIComponent(url)).toContain('lang=粤语')
  })

  it('再点已选维度取消该维度（再点已选项移除 param）', () => {
    mockSearchParams.set('country', 'CN')
    render(<FilterArea mode="search" typeOptions={TYPE_OPTIONS} />)
    fireEvent.click(screen.getByTestId('filter-country-CN'))
    const url = mockPush.mock.calls[0][0] as string
    expect(url).not.toContain('country=')
  })

  // ── type 维 search 模式：走 URL ─────────────────────────────────
  it('search 模式点 type 写 ?type= URL（组件自管）', () => {
    render(<FilterArea mode="search" typeOptions={TYPE_OPTIONS} />)
    fireEvent.click(screen.getByTestId('filter-type-movie'))
    const url = mockPush.mock.calls[0][0] as string
    expect(url).toContain('type=movie')
  })

  it('search 模式 type 激活态读 ?type=', () => {
    mockSearchParams.set('type', 'anime')
    render(<FilterArea mode="search" typeOptions={TYPE_OPTIONS} />)
    expect(screen.getByTestId('filter-type-anime').getAttribute('aria-checked')).toBe('true')
  })

  // ── type 维 category 模式：走回调，不走 URL ─────────────────────
  it('category 模式点 type 触发 onTypeChange(videoType)，不写 URL', () => {
    const onTypeChange = vi.fn()
    renderCategory({ onTypeChange })
    fireEvent.click(screen.getByTestId('filter-type-variety'))
    expect(onTypeChange).toHaveBeenCalledWith('variety')
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('category 模式点「全部」触发 onTypeChange(null)', () => {
    const onTypeChange = vi.fn()
    renderCategory({ activeType: 'movie', onTypeChange })
    fireEvent.click(screen.getByTestId('filter-type-all'))
    expect(onTypeChange).toHaveBeenCalledWith(null)
  })

  it('category 模式 type 激活态读 activeType（受控高亮）', () => {
    renderCategory({ activeType: 'series' })
    expect(screen.getByTestId('filter-type-series').getAttribute('aria-checked')).toBe('true')
    expect(screen.getByTestId('filter-type-movie').getAttribute('aria-checked')).toBe('false')
  })

  it('category 模式非 type 维仍走 URL（genre 写 param）', () => {
    renderCategory({ activeType: 'movie' })
    fireEvent.click(screen.getByTestId('filter-genre-comedy'))
    const url = mockPush.mock.calls[0][0] as string
    expect(url).toContain('genre=comedy')
  })
})

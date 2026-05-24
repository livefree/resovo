/**
 * EP-5-shared 共享 filterContent 原语单测（CHG-SN-9-DT-HEADER-REDESIGN-EP-5-SHARED）
 *
 * 3 原语 50 单测：
 *   - DataTableEnumFilter（single / multi / searchable / disabled / a11y）— 20
 *   - DataTableTextFilter（IME + debounce + Enter + focus persistence）— 15
 *   - DataTableDateRangeFilter（from-to + presets + clear + type / a11y）— 15
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import React, { useState } from 'react'
import {
  DataTableEnumFilter,
  type FilterEnumOption,
} from '../../../../../packages/admin-ui/src/components/data-table/filter-enum'
import { DataTableTextFilter } from '../../../../../packages/admin-ui/src/components/data-table/filter-text'
import {
  DataTableDateRangeFilter,
  type DateRangePreset,
} from '../../../../../packages/admin-ui/src/components/data-table/filter-date-range'

afterEach(() => {
  vi.useRealTimers()
})

// ────────────────────────────────────────────────────────────────────
// DataTableEnumFilter (20 单测)
// ────────────────────────────────────────────────────────────────────

const ENUM_OPTIONS: FilterEnumOption[] = [
  { value: 'movie', label: '电影' },
  { value: 'series', label: '电视剧' },
  { value: 'variety', label: '综艺' },
  { value: 'anime', label: '动漫' },
]

describe('DataTableEnumFilter — 单选模式', () => {
  it('渲染 listbox + 全部 placeholder + 全部 options', () => {
    render(<DataTableEnumFilter options={ENUM_OPTIONS} value={undefined} onChange={() => {}} data-testid="ef" />)
    expect(screen.getByTestId('ef-option-all').textContent).toBe('全部')
    expect(screen.getByTestId('ef-option-movie').textContent).toBe('电影')
    expect(screen.getByTestId('ef-option-series').textContent).toBe('电视剧')
    expect(screen.getByTestId('ef-option-variety').textContent).toBe('综艺')
    expect(screen.getByTestId('ef-option-anime').textContent).toBe('动漫')
  })

  it('value=undefined → 全部 option aria-selected=true', () => {
    render(<DataTableEnumFilter options={ENUM_OPTIONS} value={undefined} onChange={() => {}} data-testid="ef" />)
    expect(screen.getByTestId('ef-option-all').getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('ef-option-movie').getAttribute('aria-selected')).toBe('false')
  })

  it('value=movie → movie option aria-selected=true', () => {
    render(<DataTableEnumFilter options={ENUM_OPTIONS} value="movie" onChange={() => {}} data-testid="ef" />)
    expect(screen.getByTestId('ef-option-movie').getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('ef-option-all').getAttribute('aria-selected')).toBe('false')
  })

  it('点 option → onChange(value)', () => {
    const onChange = vi.fn<(next: string | undefined) => void>()
    render(<DataTableEnumFilter options={ENUM_OPTIONS} value={undefined} onChange={onChange} data-testid="ef" />)
    fireEvent.click(screen.getByTestId('ef-option-series'))
    expect(onChange).toHaveBeenCalledWith('series')
  })

  it('点 "全部" → onChange(undefined)', () => {
    const onChange = vi.fn<(next: string | undefined) => void>()
    render(<DataTableEnumFilter options={ENUM_OPTIONS} value="movie" onChange={onChange} data-testid="ef" />)
    fireEvent.click(screen.getByTestId('ef-option-all'))
    expect(onChange).toHaveBeenCalledWith(undefined)
  })

  it('自定义 placeholder', () => {
    render(
      <DataTableEnumFilter
        options={ENUM_OPTIONS}
        value={undefined}
        onChange={() => {}}
        placeholder="所有类型"
        data-testid="ef"
      />,
    )
    expect(screen.getByTestId('ef-option-all').textContent).toBe('所有类型')
  })

  it('disabled → option button disabled', () => {
    render(
      <DataTableEnumFilter
        options={ENUM_OPTIONS}
        value={undefined}
        onChange={() => {}}
        disabled
        data-testid="ef"
      />,
    )
    expect((screen.getByTestId('ef-option-movie') as HTMLButtonElement).disabled).toBe(true)
  })

  it('searchable=true → 渲染顶部 search input', () => {
    render(
      <DataTableEnumFilter
        options={ENUM_OPTIONS}
        value={undefined}
        onChange={() => {}}
        searchable
        data-testid="ef"
      />,
    )
    expect(screen.getByTestId('ef-search')).toBeTruthy()
  })

  it('search input 过滤 options（按 label）', () => {
    render(
      <DataTableEnumFilter
        options={ENUM_OPTIONS}
        value={undefined}
        onChange={() => {}}
        searchable
        data-testid="ef"
      />,
    )
    fireEvent.change(screen.getByTestId('ef-search'), { target: { value: '电视' } })
    expect(screen.queryByTestId('ef-option-series')).toBeTruthy()
    expect(screen.queryByTestId('ef-option-movie')).toBeNull()
  })

  it('search 无匹配 → 显示"无匹配选项"', () => {
    render(
      <DataTableEnumFilter
        options={ENUM_OPTIONS}
        value={undefined}
        onChange={() => {}}
        searchable
        data-testid="ef"
      />,
    )
    fireEvent.change(screen.getByTestId('ef-search'), { target: { value: 'xxxxxx' } })
    expect(screen.queryByText('无匹配选项')).toBeTruthy()
  })

  it('SSR 零 throw', () => {
    expect(() =>
      renderToString(
        <DataTableEnumFilter options={ENUM_OPTIONS} value={undefined} onChange={() => {}} data-testid="ssr" />,
      ),
    ).not.toThrow()
  })
})

describe('DataTableEnumFilter — 多选模式', () => {
  it('multi=true → 渲染 checkbox 列表 + aria-multiselectable=true', () => {
    render(
      <DataTableEnumFilter
        options={ENUM_OPTIONS}
        value={[]}
        onChange={() => {}}
        multi
        data-testid="ef"
      />,
    )
    const listbox = document.querySelector('[role="listbox"]')
    expect(listbox?.getAttribute('aria-multiselectable')).toBe('true')
    const movieCheckbox = screen.getByLabelText('电影') as HTMLInputElement
    expect(movieCheckbox.type).toBe('checkbox')
  })

  it('value=["movie"] → checkbox checked', () => {
    render(
      <DataTableEnumFilter
        options={ENUM_OPTIONS}
        value={['movie']}
        onChange={() => {}}
        multi
        data-testid="ef"
      />,
    )
    expect((screen.getByLabelText('电影') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('综艺') as HTMLInputElement).checked).toBe(false)
  })

  it('点 checkbox → onChange([...current, value])', () => {
    const onChange = vi.fn<(next: readonly string[]) => void>()
    render(
      <DataTableEnumFilter
        options={ENUM_OPTIONS}
        value={['movie']}
        onChange={onChange}
        multi
        data-testid="ef"
      />,
    )
    fireEvent.click(screen.getByLabelText('综艺'))
    expect(onChange).toHaveBeenCalledWith(['movie', 'variety'])
  })

  it('取消勾选 → onChange 移除该 value', () => {
    const onChange = vi.fn<(next: readonly string[]) => void>()
    render(
      <DataTableEnumFilter
        options={ENUM_OPTIONS}
        value={['movie', 'series']}
        onChange={onChange}
        multi
        data-testid="ef"
      />,
    )
    fireEvent.click(screen.getByLabelText('电影'))
    expect(onChange).toHaveBeenCalledWith(['series'])
  })

  it('selectedCount > 0 → 显示"清除（已选 N）"按钮', () => {
    render(
      <DataTableEnumFilter
        options={ENUM_OPTIONS}
        value={['movie', 'series']}
        onChange={() => {}}
        multi
        data-testid="ef"
      />,
    )
    const clearBtn = screen.getByTestId('ef-clear')
    expect(clearBtn.textContent).toContain('已选 2')
  })

  it('selectedCount=0 → 不渲染清除按钮', () => {
    render(
      <DataTableEnumFilter
        options={ENUM_OPTIONS}
        value={[]}
        onChange={() => {}}
        multi
        data-testid="ef"
      />,
    )
    expect(screen.queryByTestId('ef-clear')).toBeNull()
  })

  it('点清除 → onChange([])', () => {
    const onChange = vi.fn<(next: readonly string[]) => void>()
    render(
      <DataTableEnumFilter
        options={ENUM_OPTIONS}
        value={['movie', 'series']}
        onChange={onChange}
        multi
        data-testid="ef"
      />,
    )
    fireEvent.click(screen.getByTestId('ef-clear'))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('multi + searchable + disabled 组合', () => {
    render(
      <DataTableEnumFilter
        options={ENUM_OPTIONS}
        value={['movie']}
        onChange={() => {}}
        multi
        searchable
        disabled
        data-testid="ef"
      />,
    )
    expect(screen.getByTestId('ef-search')).toBeTruthy()
    expect((screen.getByLabelText('电影') as HTMLInputElement).disabled).toBe(true)
  })

  it('multi 模式 SSR safe', () => {
    expect(() =>
      renderToString(
        <DataTableEnumFilter options={ENUM_OPTIONS} value={['movie']} onChange={() => {}} multi data-testid="ssr" />,
      ),
    ).not.toThrow()
  })
})

// ────────────────────────────────────────────────────────────────────
// DataTableTextFilter (15 单测)
// ────────────────────────────────────────────────────────────────────

describe('DataTableTextFilter', () => {
  it('渲染 input type=text + value + placeholder + aria-label + data-testid', () => {
    render(
      <DataTableTextFilter
        value="hello"
        onChange={() => {}}
        placeholder="过滤..."
        aria-label="过滤标题"
        data-testid="tf"
      />,
    )
    const input = screen.getByTestId('tf') as HTMLInputElement
    expect(input.value).toBe('hello')
    expect(input.placeholder).toBe('过滤...')
    expect(input.type).toBe('text')
    expect(input.getAttribute('aria-label')).toBe('过滤标题')
    expect(input.hasAttribute('data-table-filter-text')).toBe(true)
  })

  it('SSR 零 throw', () => {
    expect(() =>
      renderToString(<DataTableTextFilter value="" onChange={() => {}} data-testid="ssr" />),
    ).not.toThrow()
  })

  it('disabled prop 透传', () => {
    render(<DataTableTextFilter value="" onChange={() => {}} disabled data-testid="tf" />)
    expect((screen.getByTestId('tf') as HTMLInputElement).disabled).toBe(true)
  })

  it('打字后 300ms 内不触发 onChange', () => {
    vi.useFakeTimers()
    const onChange = vi.fn<(next: string) => void>()
    render(<DataTableTextFilter value="" onChange={onChange} data-testid="tf" />)
    fireEvent.change(screen.getByTestId('tf'), { target: { value: 'a' } })
    act(() => vi.advanceTimersByTime(200))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('300ms 后触发 onChange', () => {
    vi.useFakeTimers()
    const onChange = vi.fn<(next: string) => void>()
    render(<DataTableTextFilter value="" onChange={onChange} data-testid="tf" />)
    fireEvent.change(screen.getByTestId('tf'), { target: { value: 'abc' } })
    act(() => vi.advanceTimersByTime(300))
    expect(onChange).toHaveBeenCalledWith('abc')
  })

  it('自定义 debounceMs 生效', () => {
    vi.useFakeTimers()
    const onChange = vi.fn<(next: string) => void>()
    render(<DataTableTextFilter value="" onChange={onChange} debounceMs={500} data-testid="tf" />)
    fireEvent.change(screen.getByTestId('tf'), { target: { value: 'x' } })
    act(() => vi.advanceTimersByTime(400))
    expect(onChange).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(100))
    expect(onChange).toHaveBeenCalledWith('x')
  })

  it('composition 期间不触发 onChange', () => {
    vi.useFakeTimers()
    const onChange = vi.fn<(next: string) => void>()
    render(<DataTableTextFilter value="" onChange={onChange} data-testid="tf" />)
    const input = screen.getByTestId('tf')
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: 'h' } })
    act(() => vi.advanceTimersByTime(500))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('compositionEnd 立即触发 onChange', () => {
    vi.useFakeTimers()
    const onChange = vi.fn<(next: string) => void>()
    render(<DataTableTextFilter value="" onChange={onChange} data-testid="tf" />)
    const input = screen.getByTestId('tf')
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: 'hei' } })
    fireEvent.compositionEnd(input, { target: { value: '黑' } })
    expect(onChange).toHaveBeenCalledWith('黑')
  })

  it('Enter 立即触发 onChange（绕过 debounce）', () => {
    vi.useFakeTimers()
    const onChange = vi.fn<(next: string) => void>()
    render(<DataTableTextFilter value="" onChange={onChange} data-testid="tf" />)
    const input = screen.getByTestId('tf')
    fireEvent.change(input, { target: { value: 'q' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('q')
  })

  it('Enter 在 composition 期间不触发', () => {
    vi.useFakeTimers()
    const onChange = vi.fn<(next: string) => void>()
    render(<DataTableTextFilter value="" onChange={onChange} data-testid="tf" />)
    const input = screen.getByTestId('tf')
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: 'hei' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('受控外部 value 变化 → input value 同步', () => {
    function Wrapper() {
      const [val, setVal] = useState('first')
      return (
        <>
          <button onClick={() => setVal('second')} data-testid="reset">change</button>
          <DataTableTextFilter value={val} onChange={() => {}} data-testid="ctrl" />
        </>
      )
    }
    render(<Wrapper />)
    expect((screen.getByTestId('ctrl') as HTMLInputElement).value).toBe('first')
    fireEvent.click(screen.getByTestId('reset'))
    expect((screen.getByTestId('ctrl') as HTMLInputElement).value).toBe('second')
  })

  it('focus persistence：外部 value 变化时 input 保持 focus', () => {
    function Wrapper() {
      const [val, setVal] = useState('')
      return (
        <>
          <button onClick={() => setVal('outside')} data-testid="ext-set">外部</button>
          <DataTableTextFilter value={val} onChange={() => {}} data-testid="focus-test" />
        </>
      )
    }
    render(<Wrapper />)
    const input = screen.getByTestId('focus-test') as HTMLInputElement
    input.focus()
    expect(document.activeElement).toBe(input)
    fireEvent.click(screen.getByTestId('ext-set'))
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('outside')
  })

  it('focus persistence：光标位置保留（不跳末尾）', () => {
    function Wrapper() {
      const [val, setVal] = useState('hello world')
      return (
        <>
          <button onClick={() => setVal('hello modified')} data-testid="modify">外部</button>
          <DataTableTextFilter value={val} onChange={() => {}} data-testid="cursor" />
        </>
      )
    }
    render(<Wrapper />)
    const input = screen.getByTestId('cursor') as HTMLInputElement
    input.focus()
    input.setSelectionRange(6, 6)
    fireEvent.click(screen.getByTestId('modify'))
    expect(input.value).toBe('hello modified')
    expect(input.selectionStart).toBe(6)
  })

  it('composition 期间外部 value 变化不同步（不打断 IME）', () => {
    function Wrapper() {
      const [val, setVal] = useState('')
      return (
        <>
          <button onClick={() => setVal('outside-during-compose')} data-testid="ext-set">外部</button>
          <DataTableTextFilter value={val} onChange={() => {}} data-testid="ime-protect" />
        </>
      )
    }
    render(<Wrapper />)
    const input = screen.getByTestId('ime-protect') as HTMLInputElement
    input.focus()
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: 'hei' } })
    fireEvent.click(screen.getByTestId('ext-set'))
    // composition 期间 useEffect [value] 不覆盖 DOM
    expect(input.value).toBe('hei')
  })

  it('连续中文"黑客"全程不中断', () => {
    vi.useFakeTimers()
    const onChange = vi.fn<(next: string) => void>()
    render(<DataTableTextFilter value="" onChange={onChange} data-testid="ime" />)
    const input = screen.getByTestId('ime')
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: 'hei' } })
    fireEvent.compositionEnd(input, { target: { value: '黑' } })
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: '黑ke' } })
    fireEvent.compositionEnd(input, { target: { value: '黑客' } })
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenNthCalledWith(1, '黑')
    expect(onChange).toHaveBeenNthCalledWith(2, '黑客')
  })
})

// ────────────────────────────────────────────────────────────────────
// DataTableDateRangeFilter (15 单测)
// ────────────────────────────────────────────────────────────────────

describe('DataTableDateRangeFilter', () => {
  it('渲染 2 个 date input + role="group" + aria-label', () => {
    render(
      <DataTableDateRangeFilter
        value={{}}
        onChange={() => {}}
        aria-label="创建时间"
        data-testid="dr"
      />,
    )
    const group = document.querySelector('[role="group"]')
    expect(group?.getAttribute('aria-label')).toBe('创建时间')
    const fromInput = screen.getByTestId('dr-from') as HTMLInputElement
    const toInput = screen.getByTestId('dr-to') as HTMLInputElement
    expect(fromInput.type).toBe('date')
    expect(toInput.type).toBe('date')
  })

  it('type=datetime-local 透传', () => {
    render(
      <DataTableDateRangeFilter
        value={{}}
        onChange={() => {}}
        type="datetime-local"
        data-testid="dr"
      />,
    )
    expect((screen.getByTestId('dr-from') as HTMLInputElement).type).toBe('datetime-local')
  })

  it('value.from / value.to 透传到 input', () => {
    render(
      <DataTableDateRangeFilter
        value={{ from: '2026-05-01', to: '2026-05-31' }}
        onChange={() => {}}
        data-testid="dr"
      />,
    )
    expect((screen.getByTestId('dr-from') as HTMLInputElement).value).toBe('2026-05-01')
    expect((screen.getByTestId('dr-to') as HTMLInputElement).value).toBe('2026-05-31')
  })

  it('改 from input → onChange({ from, to })', () => {
    const onChange = vi.fn<(next: { from?: string; to?: string }) => void>()
    render(
      <DataTableDateRangeFilter
        value={{ to: '2026-05-31' }}
        onChange={onChange}
        data-testid="dr"
      />,
    )
    fireEvent.change(screen.getByTestId('dr-from'), { target: { value: '2026-05-01' } })
    expect(onChange).toHaveBeenCalledWith({ from: '2026-05-01', to: '2026-05-31' })
  })

  it('改 to input → onChange({ from, to })', () => {
    const onChange = vi.fn<(next: { from?: string; to?: string }) => void>()
    render(
      <DataTableDateRangeFilter
        value={{ from: '2026-05-01' }}
        onChange={onChange}
        data-testid="dr"
      />,
    )
    fireEvent.change(screen.getByTestId('dr-to'), { target: { value: '2026-05-31' } })
    expect(onChange).toHaveBeenCalledWith({ from: '2026-05-01', to: '2026-05-31' })
  })

  it('清空 from input → onChange({ from: undefined, to })', () => {
    const onChange = vi.fn<(next: { from?: string; to?: string }) => void>()
    render(
      <DataTableDateRangeFilter
        value={{ from: '2026-05-01', to: '2026-05-31' }}
        onChange={onChange}
        data-testid="dr"
      />,
    )
    fireEvent.change(screen.getByTestId('dr-from'), { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith({ from: undefined, to: '2026-05-31' })
  })

  it('disabled → 两个 input disabled', () => {
    render(
      <DataTableDateRangeFilter
        value={{}}
        onChange={() => {}}
        disabled
        data-testid="dr"
      />,
    )
    expect((screen.getByTestId('dr-from') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByTestId('dr-to') as HTMLInputElement).disabled).toBe(true)
  })

  it('SSR 零 throw', () => {
    expect(() =>
      renderToString(<DataTableDateRangeFilter value={{}} onChange={() => {}} data-testid="ssr" />),
    ).not.toThrow()
  })
})

describe('DataTableDateRangeFilter — presets', () => {
  const PRESETS: DateRangePreset[] = [
    { label: '近 7 天', from: '2026-05-17' },
    { label: '近 30 天', from: '2026-04-24' },
    { label: '本月', from: '2026-05-01', to: '2026-05-31' },
  ]

  it('presets 提供时 → 渲染 preset 按钮', () => {
    render(
      <DataTableDateRangeFilter
        value={{}}
        onChange={() => {}}
        presets={PRESETS}
        data-testid="dr"
      />,
    )
    expect(screen.getByTestId('dr-preset-近 7 天').textContent).toBe('近 7 天')
    expect(screen.getByTestId('dr-preset-近 30 天').textContent).toBe('近 30 天')
    expect(screen.getByTestId('dr-preset-本月').textContent).toBe('本月')
  })

  it('点 preset → onChange({ from, to })', () => {
    const onChange = vi.fn<(next: { from?: string; to?: string }) => void>()
    render(
      <DataTableDateRangeFilter
        value={{}}
        onChange={onChange}
        presets={PRESETS}
        data-testid="dr"
      />,
    )
    fireEvent.click(screen.getByTestId('dr-preset-本月'))
    expect(onChange).toHaveBeenCalledWith({ from: '2026-05-01', to: '2026-05-31' })
  })

  it('presets 缺省 → 不渲染按钮区', () => {
    render(<DataTableDateRangeFilter value={{}} onChange={() => {}} data-testid="dr" />)
    expect(screen.queryByTestId('dr-preset-近 7 天')).toBeNull()
  })

  it('hasValue=false → 不渲染清除按钮', () => {
    render(
      <DataTableDateRangeFilter value={{}} onChange={() => {}} presets={PRESETS} data-testid="dr" />,
    )
    expect(screen.queryByTestId('dr-clear')).toBeNull()
  })

  it('hasValue=true → 渲染清除按钮', () => {
    render(
      <DataTableDateRangeFilter
        value={{ from: '2026-05-01' }}
        onChange={() => {}}
        presets={PRESETS}
        data-testid="dr"
      />,
    )
    expect(screen.getByTestId('dr-clear')).toBeTruthy()
  })

  it('点清除 → onChange({})', () => {
    const onChange = vi.fn<(next: { from?: string; to?: string }) => void>()
    render(
      <DataTableDateRangeFilter
        value={{ from: '2026-05-01', to: '2026-05-31' }}
        onChange={onChange}
        presets={PRESETS}
        data-testid="dr"
      />,
    )
    fireEvent.click(screen.getByTestId('dr-clear'))
    expect(onChange).toHaveBeenCalledWith({})
  })

  it('disabled → preset / clear 按钮 disabled', () => {
    render(
      <DataTableDateRangeFilter
        value={{ from: '2026-05-01' }}
        onChange={() => {}}
        presets={PRESETS}
        disabled
        data-testid="dr"
      />,
    )
    expect((screen.getByTestId('dr-preset-近 7 天') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('dr-clear') as HTMLButtonElement).disabled).toBe(true)
  })
})

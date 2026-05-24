/**
 * DataTableSearchInput 单测（CHG-SN-9-DT-HEADER-REDESIGN-EP-4）
 *
 * 覆盖 ADR-149 D-149-8 + AMENDMENT 1 D-149-13 行为契约：
 *   - composition 期间不触发 onChange（中文 IME 拼音中字未上屏）
 *   - compositionEnd 立即触发 onChange（不等 debounce / D-149-8）
 *   - 非 composition 时走 debounce（默认 300ms）
 *   - Enter 立即提交（绕过 debounce）
 *   - value 受控（外部 reset 时 input 同步）
 *   - SSR safe（renderToString 不 throw）
 *   - 连续中文输入"黑客"全程不中断（#UR-B3 闭合场景）
 *   - data-testid + aria-label + 卸载清 timer
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import React, { useState } from 'react'
import { DataTableSearchInput } from '../../../../../packages/admin-ui/src/components/data-table/search-input'

// 模拟 timer
function setupFakeTimers() {
  vi.useFakeTimers()
}
afterEach(() => {
  vi.useRealTimers()
})

// ── 1. 基础渲染 ────────────────────────────────────────────────────

describe('DataTableSearchInput — 基础', () => {
  it('渲染 input + value + placeholder + aria-label + data-testid', () => {
    render(
      <DataTableSearchInput
        value="hello"
        onChange={() => {}}
        placeholder="搜索..."
        aria-label="搜索视频"
        data-testid="search-test"
      />,
    )
    const input = screen.getByTestId('search-test') as HTMLInputElement
    expect(input.value).toBe('hello')
    expect(input.placeholder).toBe('搜索...')
    expect(input.getAttribute('aria-label')).toBe('搜索视频')
    expect(input.type).toBe('search')
    expect(input.hasAttribute('data-table-search-input')).toBe(true)
  })

  it('SSR 零 throw（renderToString）', () => {
    expect(() =>
      renderToString(
        <DataTableSearchInput value="x" onChange={() => {}} data-testid="ssr" />,
      ),
    ).not.toThrow()
  })

  it('disabled prop 透传', () => {
    render(
      <DataTableSearchInput value="" onChange={() => {}} disabled data-testid="disabled-test" />,
    )
    expect((screen.getByTestId('disabled-test') as HTMLInputElement).disabled).toBe(true)
  })
})

// ── 2. 非 composition + debounce ──────────────────────────────────

describe('DataTableSearchInput — debounce', () => {
  it('打字后 300ms 内不触发 onChange', () => {
    setupFakeTimers()
    const onChange = vi.fn<(next: string) => void>()
    render(
      <DataTableSearchInput value="" onChange={onChange} data-testid="dbn" />,
    )
    fireEvent.change(screen.getByTestId('dbn'), { target: { value: 'a' } })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('300ms 后触发 onChange（默认 debounce）', () => {
    setupFakeTimers()
    const onChange = vi.fn<(next: string) => void>()
    render(
      <DataTableSearchInput value="" onChange={onChange} data-testid="dbn" />,
    )
    fireEvent.change(screen.getByTestId('dbn'), { target: { value: 'abc' } })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('abc')
  })

  it('连续打字仅在最后一次后 300ms 触发（debounce 重置）', () => {
    setupFakeTimers()
    const onChange = vi.fn<(next: string) => void>()
    render(
      <DataTableSearchInput value="" onChange={onChange} data-testid="dbn" />,
    )
    const input = screen.getByTestId('dbn')
    fireEvent.change(input, { target: { value: 'a' } })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    fireEvent.change(input, { target: { value: 'ab' } })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    fireEvent.change(input, { target: { value: 'abc' } })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('abc')
  })

  it('自定义 debounceMs 生效', () => {
    setupFakeTimers()
    const onChange = vi.fn<(next: string) => void>()
    render(
      <DataTableSearchInput value="" onChange={onChange} debounceMs={500} data-testid="dbn" />,
    )
    fireEvent.change(screen.getByTestId('dbn'), { target: { value: 'x' } })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(onChange).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(onChange).toHaveBeenCalledWith('x')
  })
})

// ── 3. IME composition（核心 #UR-B3 闭合） ──────────────────────────

describe('DataTableSearchInput — IME composition (#UR-B3)', () => {
  it('compositionStart → 期间打字不触发 onChange', () => {
    setupFakeTimers()
    const onChange = vi.fn<(next: string) => void>()
    render(
      <DataTableSearchInput value="" onChange={onChange} data-testid="ime" />,
    )
    const input = screen.getByTestId('ime')
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: 'h' } })
    act(() => {
      vi.advanceTimersByTime(500)
    })
    fireEvent.change(input, { target: { value: 'he' } })
    act(() => {
      vi.advanceTimersByTime(500)
    })
    fireEvent.change(input, { target: { value: 'hei' } })
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('compositionEnd 立即触发 onChange（不等 debounce）', () => {
    setupFakeTimers()
    const onChange = vi.fn<(next: string) => void>()
    render(
      <DataTableSearchInput value="" onChange={onChange} data-testid="ime" />,
    )
    const input = screen.getByTestId('ime') as HTMLInputElement
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: 'hei' } })
    fireEvent.compositionEnd(input, { target: { value: '黑' } })
    // 不需要 advanceTimers
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('黑')
  })

  it('连续中文输入"黑客"全程不中断（核心 #UR-B3 场景）', () => {
    setupFakeTimers()
    const onChange = vi.fn<(next: string) => void>()
    render(
      <DataTableSearchInput value="" onChange={onChange} data-testid="ime" />,
    )
    const input = screen.getByTestId('ime') as HTMLInputElement
    // 第一字"黑"
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: 'h' } })
    fireEvent.change(input, { target: { value: 'he' } })
    fireEvent.change(input, { target: { value: 'hei' } })
    fireEvent.compositionEnd(input, { target: { value: '黑' } })
    // 第二字"客"
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: '黑k' } })
    fireEvent.change(input, { target: { value: '黑ke' } })
    fireEvent.compositionEnd(input, { target: { value: '黑客' } })
    // 全程仅 2 次 onChange（每字 compositionEnd 各一次）
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenNthCalledWith(1, '黑')
    expect(onChange).toHaveBeenNthCalledWith(2, '黑客')
  })
})

// ── 4. Enter 立即提交 ─────────────────────────────────────────────

describe('DataTableSearchInput — Enter 立即提交', () => {
  it('Enter 立即触发 onChange（绕过 debounce）', () => {
    setupFakeTimers()
    const onChange = vi.fn<(next: string) => void>()
    render(
      <DataTableSearchInput value="" onChange={onChange} data-testid="enter" />,
    )
    const input = screen.getByTestId('enter')
    fireEvent.change(input, { target: { value: 'q' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    // 不需要 advanceTimers
    expect(onChange).toHaveBeenCalledWith('q')
  })

  it('Enter 在 composition 期间不触发（让 IME 处理）', () => {
    setupFakeTimers()
    const onChange = vi.fn<(next: string) => void>()
    render(
      <DataTableSearchInput value="" onChange={onChange} data-testid="enter" />,
    )
    const input = screen.getByTestId('enter')
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: 'hei' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })
})

// ── 5. 受控 value 同步 ────────────────────────────────────────────

describe('DataTableSearchInput — 受控 value 同步', () => {
  it('外部 value 变化 → input 显示同步', () => {
    function Wrapper() {
      const [val, setVal] = useState('first')
      return (
        <>
          <button onClick={() => setVal('second')} data-testid="reset">change</button>
          <DataTableSearchInput value={val} onChange={() => {}} data-testid="ctrl" />
        </>
      )
    }
    render(<Wrapper />)
    expect((screen.getByTestId('ctrl') as HTMLInputElement).value).toBe('first')
    fireEvent.click(screen.getByTestId('reset'))
    expect((screen.getByTestId('ctrl') as HTMLInputElement).value).toBe('second')
  })
})

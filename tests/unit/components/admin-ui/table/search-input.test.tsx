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

// ── 6. EP-4-HOTFIX: focus persistence（光标失焦修复） ──────────────────────

describe('DataTableSearchInput — EP-4-HOTFIX focus persistence', () => {
  it('外部 value 变化时 input 保持 focus（不失焦）', () => {
    function Wrapper() {
      const [val, setVal] = useState('')
      return (
        <>
          <button onClick={() => setVal('outside-changed')} data-testid="ext-set">外部 set</button>
          <DataTableSearchInput value={val} onChange={() => {}} data-testid="focus-test" />
        </>
      )
    }
    render(<Wrapper />)
    const input = screen.getByTestId('focus-test') as HTMLInputElement
    input.focus()
    expect(document.activeElement).toBe(input)
    // 外部触发 value 变化（模拟 fetch 完成后 SourcesClient setKeyword）
    fireEvent.click(screen.getByTestId('ext-set'))
    // 关键断言：input 仍然是 focused（修复前会失焦）
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('outside-changed')
  })

  it('用户输入过程中外部 value 变化时光标位置保留（不跳到末尾）', () => {
    function Wrapper() {
      const [val, setVal] = useState('hello world')
      return (
        <>
          <button onClick={() => setVal('hello modified')} data-testid="ext-modify">外部 modify</button>
          <DataTableSearchInput value={val} onChange={() => {}} data-testid="cursor-test" />
        </>
      )
    }
    render(<Wrapper />)
    const input = screen.getByTestId('cursor-test') as HTMLInputElement
    input.focus()
    // 模拟用户把光标放在第 6 位（"hello |world"）
    input.setSelectionRange(6, 6)
    expect(input.selectionStart).toBe(6)
    // 外部 value 变化
    fireEvent.click(screen.getByTestId('ext-modify'))
    // value 已同步，但 selectionStart 保留在 6（不跳末尾）
    expect(input.value).toBe('hello modified')
    expect(input.selectionStart).toBe(6)
  })

  it('selectionStart 超出新 value 长度时被 clamp 到末尾', () => {
    function Wrapper() {
      const [val, setVal] = useState('very long string here')
      return (
        <>
          <button onClick={() => setVal('short')} data-testid="ext-short">外部 shorten</button>
          <DataTableSearchInput value={val} onChange={() => {}} data-testid="clamp-test" />
        </>
      )
    }
    render(<Wrapper />)
    const input = screen.getByTestId('clamp-test') as HTMLInputElement
    input.focus()
    // 用户把光标放在第 15 位
    input.setSelectionRange(15, 15)
    // 外部 value 变短（长度 5）
    fireEvent.click(screen.getByTestId('ext-short'))
    expect(input.value).toBe('short')
    // selectionStart 被 clamp 到 5（新 value 长度）
    expect(input.selectionStart).toBe(5)
  })

  it('input 未 focus 时外部 value 变化不主动 focus（不打扰用户）', () => {
    function Wrapper() {
      const [val, setVal] = useState('')
      return (
        <>
          <button onClick={() => setVal('outside')} data-testid="ext-set">外部 set</button>
          <DataTableSearchInput value={val} onChange={() => {}} data-testid="nofocus-test" />
        </>
      )
    }
    render(<Wrapper />)
    const input = screen.getByTestId('nofocus-test') as HTMLInputElement
    // 不 focus input；activeElement 是 body 或别处
    expect(document.activeElement).not.toBe(input)
    fireEvent.click(screen.getByTestId('ext-set'))
    // input.value 已同步，但 input 仍未 focused
    expect(input.value).toBe('outside')
    expect(document.activeElement).not.toBe(input)
  })

  it('composition 期间外部 value 变化不同步（避免打断 IME 拼音）', () => {
    function Wrapper() {
      const [val, setVal] = useState('')
      return (
        <>
          <button onClick={() => setVal('outside-during-compose')} data-testid="ext-set">外部 set</button>
          <DataTableSearchInput value={val} onChange={() => {}} data-testid="ime-protect" />
        </>
      )
    }
    render(<Wrapper />)
    const input = screen.getByTestId('ime-protect') as HTMLInputElement
    input.focus()
    // 用户开始 IME composition（拼音）
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: 'hei' } })
    // 外部 setKeyword 触发 props.value 变化
    fireEvent.click(screen.getByTestId('ext-set'))
    // 关键：composition 期间 useEffect [value] 不能覆盖 DOM input.value（仍是 'hei'）
    expect(input.value).toBe('hei')
    // composition 结束后用户字才上屏
    fireEvent.compositionEnd(input, { target: { value: '黑' } })
    // 此时 DOM value 已是 '黑'，外部 reset 已被 IME 打断丢弃（用户输入优先）
    expect(input.value).toBe('黑')
  })
})

/**
 * KeyboardShortcuts 组件单测（CHG-SN-2-04）
 *
 * 覆盖：mount 注册 / unmount 清理 / mod 自动映射 / multi-bindings 派发 /
 * allowInInput 拦截 vs 放行 / 首个匹配优先（不级联多触发）/ bindings 变更重新注册
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { KeyboardShortcuts, type ShortcutBinding } from '../../../../../packages/admin-ui/src/shell/keyboard-shortcuts'

afterEach(() => {
  cleanup()
})

function dispatchKeydown(opts: {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  target?: HTMLElement
}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: opts.key,
    metaKey: !!opts.metaKey,
    ctrlKey: !!opts.ctrlKey,
    shiftKey: !!opts.shiftKey,
    altKey: !!opts.altKey,
    bubbles: true,
    cancelable: true,
  })
  ;(opts.target ?? document.body).dispatchEvent(event)
  return event
}

describe('KeyboardShortcuts — mount / unmount', () => {
  it('mount 注册 listener；mod+k 触发对应 handler', () => {
    const handler = vi.fn()
    const bindings: ShortcutBinding[] = [{ id: 'cmd-k', spec: 'mod+k', handler }]
    render(<KeyboardShortcuts bindings={bindings} />)
    dispatchKeydown({ key: 'k', metaKey: true })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('unmount 后 listener 移除；keydown 不再触发', () => {
    const handler = vi.fn()
    const { unmount } = render(<KeyboardShortcuts bindings={[{ id: 'cmd-k', spec: 'mod+k', handler }]} />)
    unmount()
    dispatchKeydown({ key: 'k', metaKey: true })
    expect(handler).toHaveBeenCalledTimes(0)
  })

  it('bindings 数组为空 → 不注册 listener（无副作用）', () => {
    const { unmount } = render(<KeyboardShortcuts bindings={[]} />)
    expect(() => dispatchKeydown({ key: 'k', metaKey: true })).not.toThrow()
    unmount()
  })
})

describe('KeyboardShortcuts — mod 自动映射 metaKey/ctrlKey', () => {
  it('Mac 模拟（metaKey）触发 mod 绑定', () => {
    const handler = vi.fn()
    render(<KeyboardShortcuts bindings={[{ id: 'a', spec: 'mod+k', handler }]} />)
    dispatchKeydown({ key: 'k', metaKey: true })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('非 Mac 模拟（ctrlKey）触发 mod 绑定', () => {
    const handler = vi.fn()
    render(<KeyboardShortcuts bindings={[{ id: 'a', spec: 'mod+k', handler }]} />)
    dispatchKeydown({ key: 'k', ctrlKey: true })
    expect(handler).toHaveBeenCalledTimes(1)
  })
})

describe('KeyboardShortcuts — multi-bindings 派发 + 首个匹配优先', () => {
  it('多 bindings 按 spec 各自匹配', () => {
    const h1 = vi.fn()
    const h2 = vi.fn()
    render(
      <KeyboardShortcuts
        bindings={[
          { id: 'a', spec: 'mod+k', handler: h1 },
          { id: 'b', spec: 'esc', handler: h2 },
        ]}
      />,
    )
    dispatchKeydown({ key: 'k', metaKey: true })
    dispatchKeydown({ key: 'Escape' })
    expect(h1).toHaveBeenCalledTimes(1)
    expect(h2).toHaveBeenCalledTimes(1)
  })

  it('同一 keydown 仅派发首个匹配 binding（避免一键多触发）', () => {
    const h1 = vi.fn()
    const h2 = vi.fn()
    render(
      <KeyboardShortcuts
        bindings={[
          { id: 'a', spec: 'mod+k', handler: h1 },
          { id: 'b', spec: 'mod+k', handler: h2 },  // 重复 spec
        ]}
      />,
    )
    dispatchKeydown({ key: 'k', metaKey: true })
    expect(h1).toHaveBeenCalledTimes(1)
    expect(h2).toHaveBeenCalledTimes(0)
  })
})

describe('KeyboardShortcuts — allowInInput 拦截行为', () => {
  let input: HTMLInputElement
  let textarea: HTMLTextAreaElement
  let editable: HTMLDivElement

  beforeEach(() => {
    input = document.createElement('input')
    input.type = 'text'
    document.body.appendChild(input)
    textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    document.body.appendChild(editable)
  })

  afterEach(() => {
    input.remove()
    textarea.remove()
    editable.remove()
  })

  it('input 聚焦时默认（allowInInput=false）拦截', () => {
    const handler = vi.fn()
    render(<KeyboardShortcuts bindings={[{ id: 'a', spec: 'mod+k', handler }]} />)
    dispatchKeydown({ key: 'k', metaKey: true, target: input })
    expect(handler).toHaveBeenCalledTimes(0)
  })

  it('textarea 聚焦时默认拦截', () => {
    const handler = vi.fn()
    render(<KeyboardShortcuts bindings={[{ id: 'a', spec: 'mod+k', handler }]} />)
    dispatchKeydown({ key: 'k', metaKey: true, target: textarea })
    expect(handler).toHaveBeenCalledTimes(0)
  })

  it('contenteditable 聚焦时默认拦截', () => {
    const handler = vi.fn()
    render(<KeyboardShortcuts bindings={[{ id: 'a', spec: 'mod+k', handler }]} />)
    dispatchKeydown({ key: 'k', metaKey: true, target: editable })
    expect(handler).toHaveBeenCalledTimes(0)
  })

  it('allowInInput=true 时 input 聚焦仍触发', () => {
    const handler = vi.fn()
    render(<KeyboardShortcuts bindings={[{ id: 'a', spec: 'mod+k', handler, allowInInput: true }]} />)
    dispatchKeydown({ key: 'k', metaKey: true, target: input })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('input.type=button/checkbox/radio 不视为输入上下文（仍触发）', () => {
    const buttonInput = document.createElement('input')
    buttonInput.type = 'button'
    document.body.appendChild(buttonInput)
    const handler = vi.fn()
    render(<KeyboardShortcuts bindings={[{ id: 'a', spec: 'mod+k', handler }]} />)
    dispatchKeydown({ key: 'k', metaKey: true, target: buttonInput })
    expect(handler).toHaveBeenCalledTimes(1)
    buttonInput.remove()
  })
})

describe('KeyboardShortcuts — bindings 变更重新注册', () => {
  it('bindings 数组替换后旧 handler 不再触发，新 handler 生效', () => {
    const oldHandler = vi.fn()
    const newHandler = vi.fn()
    const { rerender } = render(
      <KeyboardShortcuts bindings={[{ id: 'a', spec: 'mod+k', handler: oldHandler }]} />,
    )
    rerender(
      <KeyboardShortcuts bindings={[{ id: 'a', spec: 'mod+k', handler: newHandler }]} />,
    )
    dispatchKeydown({ key: 'k', metaKey: true })
    expect(oldHandler).toHaveBeenCalledTimes(0)
    expect(newHandler).toHaveBeenCalledTimes(1)
  })
})

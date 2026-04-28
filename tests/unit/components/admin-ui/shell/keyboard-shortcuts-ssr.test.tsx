/**
 * KeyboardShortcuts SSR 单测（CHG-SN-2-04 范式锁定）
 *
 * 验证 ADR-103a §4.4-2 Edge Runtime 兼容性：
 *   - renderToString 零 throw
 *   - SSR 输出空（KeyboardShortcuts 是无渲染组件，return null）
 *   - 顶层 import 不触发 document/window 访问（即使 jsdom 也用 typeof 防御保 SSR-safe）
 *
 * 沿用 CHG-SN-2-03 ToastViewport SSR 测试范式（shell/index.ts 章法 5：SSR 安全模式）。
 */
import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { KeyboardShortcuts } from '../../../../../packages/admin-ui/src/shell/keyboard-shortcuts'

describe('KeyboardShortcuts — SSR renderToString（ADR-103a §4.4-2）', () => {
  it('空 bindings 数组 renderToString 不抛错', () => {
    expect(() => renderToString(<KeyboardShortcuts bindings={[]} />)).not.toThrow()
  })

  it('非空 bindings 数组 renderToString 不抛错（useEffect 在 SSR 下不执行）', () => {
    const bindings = [
      { id: 'a', spec: 'mod+k', handler: () => {} },
      { id: 'b', spec: 'esc', handler: () => {} },
    ]
    expect(() => renderToString(<KeyboardShortcuts bindings={bindings} />)).not.toThrow()
  })

  it('SSR 输出为空字符串（无渲染组件）', () => {
    const html = renderToString(<KeyboardShortcuts bindings={[]} />)
    expect(html).toBe('')
  })
})

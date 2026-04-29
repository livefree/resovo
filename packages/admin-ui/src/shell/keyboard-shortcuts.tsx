'use client'

/**
 * keyboard-shortcuts.tsx — 全局快捷键监听器组件（ADR-103a §4.1.10）
 *
 * 真源（按优先级）：
 *   - ADR-103a §4.1.10 KeyboardShortcuts 公开 API
 *   - ADR-103a §4.4-2 Edge Runtime 兼容（顶层零 window/document，所有副作用 useEffect 内）
 *   - 设计稿 v2.1 `app/shell.jsx` keydown listener 实践
 *
 * 设计要点：
 *   - 组件无渲染（return null）；纯副作用注册 document keydown listener
 *   - 挂载时 addEventListener；卸载时 removeEventListener；bindings 变更时重新注册（依赖数组）
 *   - mod 自动映射：matchesEvent 内 `event.metaKey || event.ctrlKey`（不依赖 IS_MAC）
 *   - allowInInput=false（默认）时在 input/textarea/contenteditable 聚焦时不触发；
 *     allowInInput=true 时无视聚焦元素仍触发
 *   - 多 bindings 数组按 spec 顺序遍历匹配；首个匹配的 binding handler 被调用后 return 跳出循环
 *     （一次 keydown 仅派发首个匹配 binding；不调用 stopImmediatePropagation / preventDefault — 由消费方 handler 自行决定）
 *   - 不内置任何快捷键；所有 bindings 由消费方（AdminShell / Sidebar / CmdK 等）注入
 *
 * 不做：
 *   - 不持久化绑定
 *   - 不与 React Router 耦合
 *   - 不处理 keyup / keypress（仅 keydown）
 *   - 不实现 chord（双键序列如 G→M）
 */
import { useEffect } from 'react'
import { matchesEvent, parseShortcut } from './platform'

export interface ShortcutBinding {
  readonly id: string
  /** 'mod+k' / 'mod+b' / 'mod+1' / 'mod+,' / 'shift+v' / 'esc' 规范化字符串 */
  readonly spec: string
  readonly handler: (event: KeyboardEvent) => void
  /** 在 input/textarea/contenteditable 聚焦时是否触发；默认 false */
  readonly allowInInput?: boolean
}

export interface KeyboardShortcutsProps {
  readonly bindings: readonly ShortcutBinding[]
}

export function KeyboardShortcuts({ bindings }: KeyboardShortcutsProps) {
  useEffect(() => {
    if (bindings.length === 0) return undefined
    const compiled = bindings.map((binding) => ({
      binding,
      matcher: parseShortcut(binding.spec),
    }))

    function onKeyDown(event: KeyboardEvent): void {
      // 拦截 input/textarea/contenteditable 聚焦时的非允许触发
      const isInputContext = isInputElement(event.target)
      for (const { binding, matcher } of compiled) {
        if (!matchesEvent(matcher, event)) continue
        if (isInputContext && !binding.allowInInput) continue
        binding.handler(event)
        // 一次 keydown 仅派发首个匹配 binding；不调用 stopImmediatePropagation / preventDefault
        // （若需要阻止默认或停止冒泡，由消费方 handler 自行调用）
        return
      }
    }

    // ADR-103a §4.1.10 字面要求：window.addEventListener 在 useEffect 内
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [bindings])

  return null
}

/** 判断 event.target 是否聚焦在 input/textarea/contenteditable 中
 *  HTMLInputElement.type='button|submit|reset|checkbox|radio' 不视为输入上下文（允许快捷键触发） */
function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  const tag = target.tagName.toUpperCase()
  if (tag === 'TEXTAREA') return true
  if (tag === 'INPUT') {
    const type = (target as HTMLInputElement).type.toLowerCase()
    const NON_TEXT_TYPES = new Set(['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'image'])
    return !NON_TEXT_TYPES.has(type)
  }
  // 检测 contenteditable：优先用 isContentEditable（浏览器原生）；jsdom fallback 用属性值
  if (target.isContentEditable) return true
  const contentEditableAttr = target.getAttribute('contenteditable')
  if (contentEditableAttr === 'true' || contentEditableAttr === '') return true
  return false
}

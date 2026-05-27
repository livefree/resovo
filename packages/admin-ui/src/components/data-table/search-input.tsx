'use client'

/**
 * search-input.tsx — DataTable 全文搜索 input 原语（ADR-149 D-149-8 / AMENDMENT 1 D-149-13）
 *
 * 真源：
 *   - ADR-149 D-149-8 IME composition + debounce + Enter 立即提交
 *   - AMENDMENT 1 D-149-13 toolbar.search 槽位"仅 1 search input"白名单首选实装
 *   - #UR-B3 闭合：中文 IME 输入「黑客」全程不中断
 *   - EP-4-HOTFIX：受控 → 半 uncontrolled，避免外部 re-render 让光标失焦
 *
 * 行为契约：
 *   - composition 期间暂停 onChange 传播（IME 拼音状态下用户字未上屏）
 *   - compositionEnd 时立即触发 onChange（不等 debounce）
 *   - 非 composition 时走 debounce（默认 300ms / 避免高频请求）
 *   - Enter 立即提交（绕过 debounce）
 *   - **半 uncontrolled**：DOM 自管 value（defaultValue + ref），props.value 变化时手动 sync
 *     避免受控 input 在外部 re-render 链路中触发的 focus / selection 丢失
 *   - 公开 API 仍然是 value/onChange（保持受控合约 contract）
 *   - SSR safe（mount 前 defaultValue 渲染初始值；ref 副作用在 mount 后）
 *
 * 范式：半 uncontrolled component（DOM 真源 + ref 同步） / 无 portal / 无副作用（除 debounce timer）
 *
 * EP-4-HOTFIX 修复点（vs 原 controlled 模式）：
 *   - 删除 `<input value={localValue}>` 受控 binding
 *   - 改为 `<input defaultValue={value} ref={inputRef}>`
 *   - 外部 props.value 变化时 useEffect 手动 inputRef.current.value = value
 *     并保留 selectionStart/End（用户输入时光标不跳到末尾）
 *   - 删 localValue useState（不再需要 React 重 render input）
 *   - latestValueRef 仍保留（Enter 触发用）
 *
 * 调用方契约（CHG-355 复盘 / 2026-05-27 / arch-reviewer Opus 关键洞察 I2）：
 *   本组件依赖 **DOM 持续挂载**才能保持焦点稳定。
 *   **禁止** 在 search input 的祖先链上做 loading early return 或 conditional unmount
 *   （`if (loading) return <X>; return <SplitPane><SearchInput/></SplitPane>` 这种模式）。
 *   原因：DOM unmount 后 React 重建 input 节点 → 用户光标焦点丢失 / 半 uncontrolled 救不了。
 *   推荐：loading 状态用 SWR 范式（保留旧数据 + 局部 loading 指示器），不切换组件根。
 *   先例：CHG-350 / CHG-350-FIX / CHG-350-FIX-2 三次复发后 CHG-355 在 PendingPaneController.tsx
 *         删除 `if (loading) return <加载中>` early return 根治焦点 bug。
 */
import React, { useCallback, useEffect, useRef } from 'react'

export interface DataTableSearchInputProps {
  /** 受控值（消费方持有 state） */
  readonly value: string
  /** debounce / composition end / Enter 后触发；不是每次按键 */
  readonly onChange: (next: string) => void
  readonly placeholder?: string
  /** debounce 时长（默认 300ms） */
  readonly debounceMs?: number
  readonly 'aria-label'?: string
  readonly 'data-testid'?: string
  /** 紧凑模式（与 AdminInput size='sm' 对齐） */
  readonly size?: 'sm' | 'md'
  /** 自动获取焦点 */
  readonly autoFocus?: boolean
  /** 禁用 */
  readonly disabled?: boolean
}

const SIZE_STYLES: Record<'sm' | 'md', React.CSSProperties> = {
  sm: {
    height: '28px',
    padding: '0 10px',
    fontSize: 'var(--font-size-sm-tight)',
    minWidth: '180px',
  },
  md: {
    height: '32px',
    padding: '0 12px',
    fontSize: 'var(--font-size-sm)',
    minWidth: '200px',
  },
}

const BASE_STYLE: React.CSSProperties = {
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-default)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-default)',
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'border-color var(--duration-fast) var(--easing-ease-out)',
}

export function DataTableSearchInput(props: DataTableSearchInputProps): React.ReactElement {
  const {
    value,
    onChange,
    placeholder,
    debounceMs = 300,
    'aria-label': ariaLabel = '搜索',
    'data-testid': testId,
    size = 'sm',
    autoFocus,
    disabled,
  } = props

  // input DOM ref（半 uncontrolled 模式：DOM 自管 value，避免 React re-render 让 focus/selection 丢失）
  const inputRef = useRef<HTMLInputElement | null>(null)
  // 同步 ref 保留最新值（handleKeyDown Enter 必须读 ref；同步事件链中可靠）
  const latestValueRef = useRef(value)
  const composingRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 用 ref 避免 onChange 引用变化触发回调重建（debounce 闭包稳定）
  const propsRef = useRef({ onChange, debounceMs })
  propsRef.current = { onChange, debounceMs }

  // 外部 props.value 变化 → 手动同步 DOM value（保留 selectionStart/End / focus）
  // EP-4-HOTFIX 核心：不用受控 binding 让 React 重 render input，而是手动 DOM 写入。
  // composition 期间不同步（避免打断 IME 拼音输入）。
  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    if (composingRef.current) return
    if (input.value === value) return
    const isActive = typeof document !== 'undefined' && document.activeElement === input
    const selStart = isActive ? input.selectionStart : null
    const selEnd = isActive ? input.selectionEnd : null
    input.value = value
    latestValueRef.current = value
    // 保持 focus + selection（用户在输入过程中外部 reset 时不让光标跳）
    if (isActive && selStart !== null) {
      // 如果用户在中间编辑，selectionStart 可能超出新 value 长度 → clamp
      const len = value.length
      const safeStart = Math.min(selStart, len)
      const safeEnd = Math.min(selEnd ?? safeStart, len)
      input.setSelectionRange(safeStart, safeEnd)
    }
  }, [value])

  // 卸载时清 debounce timer
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [])

  const clearDebounce = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }, [])

  const fireImmediate = useCallback((next: string) => {
    clearDebounce()
    propsRef.current.onChange(next)
  }, [clearDebounce])

  const scheduleDebounced = useCallback(
    (next: string) => {
      clearDebounce()
      debounceRef.current = setTimeout(() => {
        propsRef.current.onChange(next)
        debounceRef.current = null
      }, propsRef.current.debounceMs)
    },
    [clearDebounce],
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    latestValueRef.current = next  // 立即同步 ref（同步事件链可读 / Enter 触发时可靠）
    // 半 uncontrolled：不调 setLocalValue / React 不重 render input
    // DOM 自动持有 next 值（input 是 uncontrolled）
    if (composingRef.current) {
      // composition 期间不传播（避免拼音中触发请求）
      return
    }
    scheduleDebounced(next)
  }

  const handleCompositionStart = () => {
    composingRef.current = true
    // composition 开始时清掉 pending debounce，防止中间触发
    clearDebounce()
  }

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    composingRef.current = false
    const next = (e.target as HTMLInputElement).value
    latestValueRef.current = next  // 同步 ref
    // composition 完成立即触发（不等 debounce / D-149-8 契约）
    fireImmediate(next)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !composingRef.current) {
      e.preventDefault()
      fireImmediate(latestValueRef.current)
    }
  }

  const style: React.CSSProperties = { ...BASE_STYLE, ...SIZE_STYLES[size] }

  return (
    <input
      ref={inputRef}
      type="search"
      defaultValue={value}
      placeholder={placeholder}
      onChange={handleChange}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel}
      data-testid={testId}
      data-table-search-input
      style={style}
      autoFocus={autoFocus}
      disabled={disabled}
    />
  )
}

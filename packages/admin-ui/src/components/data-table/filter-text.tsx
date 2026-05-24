'use client'

/**
 * filter-text.tsx — 列级 ⋯ filterContent 内的文本过滤原语
 * （ADR-149 D-149-3 + AMENDMENT 1 D-149-15 / EP-5-shared 沉淀）
 *
 * 设计目标：替代消费方各自 `<AdminInput type=text>` boilerplate；与 DataTableSearchInput
 * 共享 IME composition + debounce + 半 uncontrolled + selection 保留 范式（EP-4-HOTFIX
 * 实证可靠），仅 input type 改为 "text"（语义上不是全文搜索，是单列文本过滤）。
 *
 * 行为契约：
 *   - composition 期间暂停 onChange 传播（IME 拼音）
 *   - compositionEnd 立即触发 onChange（不等 debounce）
 *   - 非 composition 时走 debounce（默认 300ms）
 *   - Enter 立即提交（绕过 debounce）
 *   - 半 uncontrolled（DOM 自管 value + ref + selection 保留）— 避免外部 re-render 失焦
 *   - SSR safe（defaultValue 渲染初始值）
 *
 * 公开 API 与 DataTableSearchInput 一致（无 size='md' 区别 / 列级 filterContent 上下文）。
 */
import React, { useCallback, useEffect, useRef } from 'react'

export interface DataTableTextFilterProps {
  readonly value: string
  readonly onChange: (next: string) => void
  readonly placeholder?: string
  readonly debounceMs?: number
  readonly disabled?: boolean
  readonly 'aria-label'?: string
  readonly 'data-testid'?: string
}

const BASE_STYLE: React.CSSProperties = {
  width: '100%',
  height: '28px',
  padding: '0 10px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-default)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-default)',
  fontSize: 'var(--font-size-sm-tight)',
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'border-color var(--duration-fast) var(--easing-ease-out)',
}

export function DataTableTextFilter(props: DataTableTextFilterProps): React.ReactElement {
  const {
    value,
    onChange,
    placeholder,
    debounceMs = 300,
    disabled = false,
    'aria-label': ariaLabel = '过滤',
    'data-testid': testId,
  } = props

  const inputRef = useRef<HTMLInputElement | null>(null)
  const latestValueRef = useRef(value)
  const composingRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const propsRef = useRef({ onChange, debounceMs })
  propsRef.current = { onChange, debounceMs }

  // 外部 value 变化 → 手动同步 DOM value（保 selection / 与 DataTableSearchInput 同范式）
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
    if (isActive && selStart !== null) {
      const len = value.length
      const safeStart = Math.min(selStart, len)
      const safeEnd = Math.min(selEnd ?? safeStart, len)
      input.setSelectionRange(safeStart, safeEnd)
    }
  }, [value])

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

  const fireImmediate = useCallback(
    (next: string) => {
      clearDebounce()
      propsRef.current.onChange(next)
    },
    [clearDebounce],
  )

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
    latestValueRef.current = next
    if (composingRef.current) return
    scheduleDebounced(next)
  }

  const handleCompositionStart = () => {
    composingRef.current = true
    clearDebounce()
  }

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    composingRef.current = false
    const next = (e.target as HTMLInputElement).value
    latestValueRef.current = next
    fireImmediate(next)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !composingRef.current) {
      e.preventDefault()
      fireImmediate(latestValueRef.current)
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={value}
      placeholder={placeholder}
      onChange={handleChange}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel}
      data-testid={testId}
      data-table-filter-text
      style={BASE_STYLE}
      disabled={disabled}
    />
  )
}

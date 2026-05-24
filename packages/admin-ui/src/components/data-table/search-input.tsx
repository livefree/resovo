'use client'

/**
 * search-input.tsx — DataTable 全文搜索 input 原语（ADR-149 D-149-8 / AMENDMENT 1 D-149-13）
 *
 * 真源：
 *   - ADR-149 D-149-8 IME composition + debounce + Enter 立即提交
 *   - AMENDMENT 1 D-149-13 toolbar.search 槽位"仅 1 search input"白名单首选实装
 *   - #UR-B3 闭合：中文 IME 输入「黑客」全程不中断
 *
 * 行为契约：
 *   - composition 期间暂停 onChange 传播（IME 拼音状态下用户字未上屏）
 *   - compositionEnd 时立即触发 onChange（不等 debounce）
 *   - 非 composition 时走 debounce（默认 300ms / 避免高频请求）
 *   - Enter 立即提交（绕过 debounce）
 *   - value 受控（消费方持有 state；外部 reset 时 input 同步）
 *   - SSR safe（无 useEffect 依赖 DOM API；mount 前无差异）
 *
 * 范式：纯 controlled component / 无 portal / 无副作用（除 debounce timer）
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'

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

  // 本地缓冲值：IME composition 期间 / debounce 期间，外部 props.value 不一定同步
  const [localValue, setLocalValue] = useState(value)
  // 同步 ref 保留最新值（handleKeyDown Enter 必须读 ref 而非 closure-captured state
  // 或 DOM value：受控 input 下 React re-render 会重置 DOM value 到 localValue state）
  const latestValueRef = useRef(value)
  const composingRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 用 ref 避免 onChange 引用变化触发回调重建（debounce 闭包稳定）
  const propsRef = useRef({ onChange, debounceMs })
  propsRef.current = { onChange, debounceMs }

  // 外部 value 变化 → 同步 localValue + ref（reset / 受控重写场景）
  useEffect(() => {
    setLocalValue(value)
    latestValueRef.current = value
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
    setLocalValue(next)
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
    setLocalValue(next)
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
      type="search"
      value={localValue}
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

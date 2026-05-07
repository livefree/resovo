'use client'

/**
 * admin-select.tsx — 后台下拉选择器通用原语
 * 真源：reference §4.2 Select（"使用同一 .inp 视觉，仅增加箭头背景"）
 *       CHG-SN-5-PRE-03-D / SEQ-20260506-02 / M-SN-5.5
 *
 * 职责：单选 / 多选 / 搜索 / 异步加载 + 键盘导航（Enter/ArrowUp/ArrowDown/Escape）+ a11y combobox。
 *
 * 不变约束：
 *   - 零业务视图消费
 *   - 不引入 BrandProvider / ThemeProvider
 *   - 零图标库依赖（自绘 chevron SVG）
 *   - Edge Runtime 兼容（typeof document 守卫 portal 渲染）
 *
 * 视觉契约：
 *   - trigger 复用 .inp 视觉（与 AdminInput 同 24/28/32px 高 + 同 padding + 同 border-color 切换逻辑）
 *   - listbox panel：bg-surface-elevated / border-strong / radius-md / shadow-lg / z-admin-dropdown（与 AdminDropdown 共享 z 层级）
 *   - selected option：accent-soft 背景 + accent-default 左边线
 *   - active（键盘高亮）option：bg-surface-hover 背景
 *   - 多选 chip：accent-soft 背景，× 移除按钮
 *
 * a11y：
 *   - role="combobox" + aria-haspopup="listbox" + aria-expanded
 *   - listbox role + aria-multiselectable
 *   - 每个 option role + aria-selected
 *   - 键盘：ArrowDown/Up 移动 active；Enter 选中；Escape 关闭；Tab 关闭并 commit
 */

import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface AdminSelectOption {
  readonly value: string
  readonly label: React.ReactNode
  readonly disabled?: boolean
}

export type AdminSelectSize = 'sm' | 'md' | 'lg'

interface BaseProps {
  readonly options: readonly AdminSelectOption[]
  readonly placeholder?: string
  readonly size?: AdminSelectSize
  readonly disabled?: boolean
  readonly error?: boolean
  readonly searchable?: boolean
  /** 异步加载态（搜索远端时使用；调用方在 onSearch 后控制 loading）*/
  readonly loading?: boolean
  /** 搜索回调（受控搜索词；server-side 异步加载场景）；省略 → 客户端 in-memory 过滤 */
  readonly onSearch?: (query: string) => void
  /** 容器额外 className */
  readonly className?: string
  readonly 'aria-label'?: string
  readonly 'data-testid'?: string
}

interface SingleSelectProps extends BaseProps {
  readonly multiple?: false
  readonly value: string | null
  readonly onChange: (next: string | null) => void
}

interface MultipleSelectProps extends BaseProps {
  readonly multiple: true
  readonly value: readonly string[]
  readonly onChange: (next: readonly string[]) => void
}

export type AdminSelectProps = SingleSelectProps | MultipleSelectProps

const SIZE_HEIGHT: Record<AdminSelectSize, string> = {
  sm: '24px',
  md: '28px',
  lg: '32px',
}

const SIZE_FONT: Record<AdminSelectSize, string> = {
  sm: 'var(--font-size-xs)',
  md: 'var(--font-size-xs)',
  lg: 'var(--font-size-sm)',
}

const TRIGGER_BASE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  background: 'var(--bg-surface)',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  padding: '0 8px 0 var(--input-padding-x, 10px)',
  boxSizing: 'border-box',
  cursor: 'pointer',
  width: '100%',
  textAlign: 'left',
  font: 'inherit',
  color: 'var(--fg-default)',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
}

const PANEL_STYLE: React.CSSProperties = {
  position: 'fixed',
  zIndex: 'var(--z-admin-dropdown)' as React.CSSProperties['zIndex'],
  background: 'var(--bg-surface-elevated)',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'var(--border-strong)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-lg)',
  padding: '4px 0',
  outline: 'none',
  minWidth: '180px',
  maxHeight: '280px',
  overflowY: 'auto',
}

const SEARCH_INPUT_STYLE: React.CSSProperties = {
  width: 'calc(100% - 16px)',
  margin: '4px 8px',
  padding: '4px 8px',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-default)',
  outline: 'none',
  font: 'inherit',
  fontSize: 'var(--font-size-xs)',
}

function optionStyle(selected: boolean, active: boolean, disabled: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 10px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    background: active
      ? 'var(--bg-surface-hover, var(--bg-surface))'
      : selected
        ? 'var(--accent-soft, transparent)'
        : 'transparent',
    color: selected ? 'var(--accent-default)' : 'var(--fg-default)',
    borderLeft: selected ? '2px solid var(--accent-default)' : '2px solid transparent',
    fontSize: 'inherit',
    minHeight: '24px',
  }
}

const CHIP_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '0 6px',
  background: 'var(--accent-soft, var(--bg-surface))',
  color: 'var(--accent-default)',
  borderRadius: 'var(--radius-xs, 4px)',
  fontSize: 'inherit',
  height: '20px',
  flexShrink: 0,
}

const CHEVRON_STYLE: React.CSSProperties = {
  flexShrink: 0,
  color: 'var(--fg-muted)',
  display: 'inline-flex',
}

function Chevron({ open }: { open: boolean }): React.ReactElement {
  return (
    <span data-admin-select-chevron style={{ ...CHEVRON_STYLE, transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s ease' }}>
      <svg viewBox="0 0 12 12" width="12" height="12" fill="none">
        <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

export function AdminSelect(props: AdminSelectProps): React.ReactElement {
  const {
    options,
    placeholder = '请选择',
    size = 'md',
    disabled = false,
    error = false,
    searchable = false,
    loading = false,
    onSearch,
    className,
    'aria-label': ariaLabel,
    'data-testid': testId,
  } = props

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  // arch-reviewer R-1：a11y combobox aria-activedescendant 模式 — 给每个 option 唯一 id 前缀
  const instanceId = useId()
  const optionIdFor = (value: string) => `as-${instanceId}-${value}`

  const selectedSet = useMemo<Set<string>>(() => {
    if (props.multiple) return new Set(props.value)
    return props.value !== null ? new Set([props.value]) : new Set()
  }, [props.multiple, props.value])

  const filteredOptions = useMemo(() => {
    if (!searchable || onSearch) return options
    if (!query) return options
    const q = query.toLowerCase()
    return options.filter((o) => {
      const label = typeof o.label === 'string' ? o.label : o.value
      return label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    })
  }, [options, query, searchable, onSearch])

  const updatePos = useCallback(() => {
    const t = triggerRef.current
    if (!t) return
    const rect = t.getBoundingClientRect()
    setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }, [])

  useLayoutEffect(() => {
    if (open) updatePos()
  }, [open, updatePos])

  useEffect(() => {
    if (!open) return
    const handleScroll = () => updatePos()
    const handleResize = () => updatePos()
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleResize)
    }
  }, [open, updatePos])

  // 点击外部关闭
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
      setQuery('')
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // 打开后聚焦搜索框
  useEffect(() => {
    if (open && searchable) {
      searchRef.current?.focus()
    }
  }, [open, searchable])

  const handleQuery = (q: string) => {
    setQuery(q)
    setActiveIndex(-1)
    onSearch?.(q)
  }

  // arch-reviewer R-2：search input 的 onKeyDown 也走 handleKeyDown，会冒泡到 panel 触发双重处理
  // → wrapper 在调用主处理器后停止冒泡（panel onKeyDown 仅服务于无 search input 的场景）
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    handleKeyDown(e)
    e.stopPropagation()
  }

  const commitOption = (opt: AdminSelectOption) => {
    if (opt.disabled) return
    if (props.multiple) {
      const set = new Set(props.value)
      if (set.has(opt.value)) set.delete(opt.value)
      else set.add(opt.value)
      props.onChange(Array.from(set))
    } else {
      props.onChange(opt.value === props.value ? null : opt.value)
      setOpen(false)
    }
  }

  const removeChip = (e: React.MouseEvent, value: string) => {
    e.stopPropagation()
    if (!props.multiple) return
    props.onChange(props.value.filter((v) => v !== value))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        setOpen(true)
        setActiveIndex(0)
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setQuery('')
      triggerRef.current?.focus()
      return
    }
    if (e.key === 'Tab') {
      setOpen(false)
      setQuery('')
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(filteredOptions.length - 1, i + 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(0, i - 1))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const opt = filteredOptions[activeIndex]
      if (opt) commitOption(opt)
      return
    }
  }

  const triggerStyle: React.CSSProperties = {
    ...TRIGGER_BASE,
    height: SIZE_HEIGHT[size],
    fontSize: SIZE_FONT[size],
    ...(error
      ? { borderColor: 'var(--border-danger, var(--fg-danger))' }
      : open
        ? { borderColor: 'var(--border-strong, var(--accent-default))', boxShadow: '0 0 0 2px var(--accent-soft, transparent)' }
        : null),
    ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : null),
  }

  const renderTriggerContent = () => {
    if (props.multiple) {
      if (props.value.length === 0) {
        return <span style={{ flex: 1, color: 'var(--fg-muted)' }}>{placeholder}</span>
      }
      const labelMap = new Map(options.map((o) => [o.value, o.label]))
      return (
        <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '4px', flex: 1, minWidth: 0, overflow: 'hidden' }}>
          {props.value.map((v) => (
            <span key={v} style={CHIP_STYLE} data-admin-select-chip>
              <span>{labelMap.get(v) ?? v}</span>
              {/*
                trigger 本身是 <button>；嵌套 <button> 是无效 HTML。
                用 <span role="button"> + 键盘事件支持，保留 a11y 与点击移除能力。
              */}
              <span
                role="button"
                tabIndex={-1}
                aria-label={`移除 ${typeof labelMap.get(v) === 'string' ? labelMap.get(v) : v}`}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
                onClick={(e) => removeChip(e, v)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    if (props.multiple) props.onChange(props.value.filter((x) => x !== v))
                  }
                }}
                style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', padding: '0 2px', userSelect: 'none' }}
              >×</span>
            </span>
          ))}
        </span>
      )
    }
    if (props.value === null) {
      return <span style={{ flex: 1, color: 'var(--fg-muted)' }}>{placeholder}</span>
    }
    const opt = options.find((o) => o.value === props.value)
    return <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt ? opt.label : props.value}</span>
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-admin-select
        data-size={size}
        data-error={error ? '' : undefined}
        data-open={open ? '' : undefined}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-disabled={disabled || undefined}
        aria-invalid={error || undefined}
        aria-label={ariaLabel}
        aria-activedescendant={open && activeIndex >= 0 && filteredOptions[activeIndex]
          ? optionIdFor(filteredOptions[activeIndex].value)
          : undefined}
        aria-controls={open ? `as-${instanceId}-listbox` : undefined}
        disabled={disabled}
        className={className}
        data-testid={testId}
        style={triggerStyle}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
      >
        {renderTriggerContent()}
        <Chevron open={open} />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          id={`as-${instanceId}-listbox`}
          data-admin-select-panel
          role="listbox"
          aria-multiselectable={props.multiple || undefined}
          style={{ ...PANEL_STYLE, top: pos.top, left: pos.left, width: Math.max(pos.width, 180) }}
        >
          {searchable && (
            <input
              ref={searchRef}
              data-admin-select-search
              type="search"
              value={query}
              placeholder="搜索..."
              onChange={(e) => handleQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              style={SEARCH_INPUT_STYLE}
              aria-label="搜索选项"
            />
          )}
          {loading && (
            <div data-admin-select-loading style={{ padding: '12px', textAlign: 'center', color: 'var(--fg-muted)', fontSize: 'var(--font-size-xs)' }}>
              加载中...
            </div>
          )}
          {!loading && filteredOptions.length === 0 && (
            <div data-admin-select-empty style={{ padding: '12px', textAlign: 'center', color: 'var(--fg-muted)', fontSize: 'var(--font-size-xs)' }}>
              无匹配项
            </div>
          )}
          {!loading && filteredOptions.map((opt, idx) => {
            const selected = selectedSet.has(opt.value)
            const active = idx === activeIndex
            return (
              <div
                key={opt.value}
                id={optionIdFor(opt.value)}
                data-admin-select-option
                data-value={opt.value}
                data-selected={selected ? '' : undefined}
                data-active={active ? '' : undefined}
                role="option"
                aria-selected={selected}
                aria-disabled={opt.disabled || undefined}
                style={optionStyle(selected, active, opt.disabled === true)}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseDown={(e) => {
                  e.preventDefault()  // 防 trigger blur
                  commitOption(opt)
                }}
              >
                {opt.label}
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </>
  )
}

'use client'

/**
 * filter-enum.tsx — 列级 ⋯ filterContent 内的 enum 单/多选过滤原语
 * （ADR-149 D-149-3 + AMENDMENT 1 D-149-15 桥接合约 / EP-5-shared 沉淀）
 *
 * 设计目标：替代消费方各自重复实装的 <AdminSelect> boilerplate；统一 enum filter UI
 * + a11y + 单/多选语义。与业务 key 桥接合约配合 — 消费方在 onChange 闭包内读写
 * 自己的业务 key namespace（如 VideoListClient 的 q/type/status）。
 *
 * 行为契约：
 *   - 单选模式（multi=false 默认）：value=string | undefined / onChange(next: string | undefined)
 *     选"全部"占位项时 next=undefined
 *   - 多选模式（multi=true）：value=readonly string[] / onChange(next: readonly string[])
 *     checkbox 列表 + 显示已选数量
 *   - searchable=true：顶部加 search input 过滤 options
 *   - disabled：整体禁用
 *   - a11y：role="listbox" + option aria-selected
 *
 * SSR safe：无 DOM 副作用 / 默认 closed 态 SSR 渲染 trigger button 即可。
 */
import React, { useCallback, useMemo, useState } from 'react'

export interface FilterEnumOption {
  readonly value: string
  /** label 类型与 AdminSelectOption.label 对称（接受 ReactNode）；search 过滤仅按
   * typeof string label / 非 string label 在 search 时被跳过 */
  readonly label: React.ReactNode
}

// 单选模式 props
export interface DataTableEnumFilterSingleProps {
  readonly options: readonly FilterEnumOption[]
  readonly value: string | undefined
  readonly onChange: (next: string | undefined) => void
  readonly multi?: false
  readonly placeholder?: string
  readonly searchable?: boolean
  readonly disabled?: boolean
  readonly 'aria-label'?: string
  readonly 'data-testid'?: string
  readonly size?: 'sm' | 'md'
}

// 多选模式 props
export interface DataTableEnumFilterMultiProps {
  readonly options: readonly FilterEnumOption[]
  readonly value: readonly string[]
  readonly onChange: (next: readonly string[]) => void
  readonly multi: true
  readonly placeholder?: string
  readonly searchable?: boolean
  readonly disabled?: boolean
  readonly 'aria-label'?: string
  readonly 'data-testid'?: string
  readonly size?: 'sm' | 'md'
}

export type DataTableEnumFilterProps =
  | DataTableEnumFilterSingleProps
  | DataTableEnumFilterMultiProps

const SIZE_HEIGHT: Record<'sm' | 'md', string> = {
  sm: '28px',
  md: '32px',
}

const SIZE_FONT_SIZE: Record<'sm' | 'md', string> = {
  sm: 'var(--font-size-sm-tight)',
  md: 'var(--font-size-sm)',
}

export function DataTableEnumFilter(props: DataTableEnumFilterProps): React.ReactElement {
  const {
    options,
    placeholder = '全部',
    searchable = false,
    disabled = false,
    'aria-label': ariaLabel = '过滤',
    'data-testid': testId,
    size = 'sm',
  } = props
  const multi = props.multi === true

  const [searchInput, setSearchInput] = useState('')

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchInput) return options
    const lower = searchInput.toLowerCase()
    return options.filter((o) => {
      // 非 string label 不参与 search 匹配（仅按 value 比较）；string label 双匹配
      const labelMatch = typeof o.label === 'string' && o.label.toLowerCase().includes(lower)
      return labelMatch || o.value.toLowerCase().includes(lower)
    })
  }, [options, searchInput, searchable])

  const handleSingleSelect = useCallback(
    (next: string | undefined) => {
      if (multi) return
      ;(props as DataTableEnumFilterSingleProps).onChange(next)
    },
    [multi, props],
  )

  const handleMultiToggle = useCallback(
    (value: string) => {
      if (!multi) return
      const p = props as DataTableEnumFilterMultiProps
      const current = p.value
      if (current.includes(value)) {
        p.onChange(current.filter((v) => v !== value))
      } else {
        p.onChange([...current, value])
      }
    },
    [multi, props],
  )

  const handleClearMulti = useCallback(() => {
    if (!multi) return
    ;(props as DataTableEnumFilterMultiProps).onChange([])
  }, [multi, props])

  const baseStyle: React.CSSProperties = {
    fontSize: SIZE_FONT_SIZE[size],
    color: 'var(--fg-default)',
    fontFamily: 'inherit',
  }

  if (multi) {
    const p = props as DataTableEnumFilterMultiProps
    const selectedCount = p.value.length

    return (
      <div data-table-filter-enum data-multi="true" style={baseStyle} data-testid={testId}>
        {searchable && (
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="搜索..."
            style={{
              width: '100%',
              height: SIZE_HEIGHT[size],
              padding: '0 8px',
              marginBottom: '6px',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-surface)',
              color: 'var(--fg-default)',
              fontFamily: 'inherit',
              fontSize: SIZE_FONT_SIZE[size],
              outline: 'none',
            }}
            aria-label={`${ariaLabel} 搜索`}
            data-testid={testId ? `${testId}-search` : undefined}
          />
        )}
        <div
          role="listbox"
          aria-label={ariaLabel}
          aria-multiselectable="true"
          style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '240px', overflowY: 'auto' }}
        >
          {filteredOptions.map((opt) => {
            const checked = p.value.includes(opt.value)
            return (
              <label
                key={opt.value}
                role="option"
                aria-selected={checked}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 6px',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  borderRadius: 'var(--radius-sm)',
                  opacity: disabled ? 0.5 : 1,
                }}
                data-testid={testId ? `${testId}-option-${opt.value}` : undefined}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => handleMultiToggle(opt.value)}
                  aria-label={typeof opt.label === 'string' ? opt.label : opt.value}
                />
                <span>{opt.label}</span>
              </label>
            )
          })}
          {filteredOptions.length === 0 && (
            <div style={{ padding: '8px', color: 'var(--fg-muted)', fontSize: SIZE_FONT_SIZE[size] }}>
              无匹配选项
            </div>
          )}
        </div>
        {selectedCount > 0 && (
          <button
            type="button"
            onClick={handleClearMulti}
            disabled={disabled}
            style={{
              marginTop: '6px',
              padding: '4px 8px',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              color: 'var(--fg-muted)',
              fontFamily: 'inherit',
              fontSize: SIZE_FONT_SIZE[size],
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
            data-testid={testId ? `${testId}-clear` : undefined}
          >
            清除（已选 {selectedCount}）
          </button>
        )}
      </div>
    )
  }

  // 单选模式
  const p = props as DataTableEnumFilterSingleProps
  return (
    <div data-table-filter-enum data-multi="false" style={baseStyle} data-testid={testId}>
      {searchable && (
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="搜索..."
          style={{
            width: '100%',
            height: SIZE_HEIGHT[size],
            padding: '0 8px',
            marginBottom: '6px',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-surface)',
            color: 'var(--fg-default)',
            fontFamily: 'inherit',
            fontSize: SIZE_FONT_SIZE[size],
            outline: 'none',
          }}
          aria-label={`${ariaLabel} 搜索`}
          data-testid={testId ? `${testId}-search` : undefined}
        />
      )}
      <div
        role="listbox"
        aria-label={ariaLabel}
        style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '240px', overflowY: 'auto' }}
      >
        <button
          type="button"
          role="option"
          aria-selected={p.value === undefined}
          disabled={disabled}
          onClick={() => handleSingleSelect(undefined)}
          style={{
            padding: '4px 8px',
            border: 0,
            background: p.value === undefined ? 'var(--admin-accent-soft)' : 'transparent',
            color: p.value === undefined ? 'var(--admin-accent-on-soft)' : 'var(--fg-muted)',
            fontFamily: 'inherit',
            fontSize: SIZE_FONT_SIZE[size],
            cursor: disabled ? 'not-allowed' : 'pointer',
            textAlign: 'left',
            borderRadius: 'var(--radius-sm)',
            opacity: disabled ? 0.5 : 1,
          }}
          data-testid={testId ? `${testId}-option-all` : undefined}
        >
          {placeholder}
        </button>
        {filteredOptions.map((opt) => {
          const selected = p.value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={disabled}
              onClick={() => handleSingleSelect(opt.value)}
              style={{
                padding: '4px 8px',
                border: 0,
                background: selected ? 'var(--admin-accent-soft)' : 'transparent',
                color: selected ? 'var(--admin-accent-on-soft)' : 'var(--fg-default)',
                fontFamily: 'inherit',
                fontSize: SIZE_FONT_SIZE[size],
                cursor: disabled ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                borderRadius: 'var(--radius-sm)',
                opacity: disabled ? 0.5 : 1,
              }}
              data-testid={testId ? `${testId}-option-${opt.value}` : undefined}
            >
              {opt.label}
            </button>
          )
        })}
        {filteredOptions.length === 0 && (
          <div style={{ padding: '8px', color: 'var(--fg-muted)', fontSize: SIZE_FONT_SIZE[size] }}>
            无匹配选项
          </div>
        )}
      </div>
    </div>
  )
}

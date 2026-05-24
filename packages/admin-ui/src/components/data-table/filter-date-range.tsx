'use client'

/**
 * filter-date-range.tsx — 列级 ⋯ filterContent 内的日期范围过滤原语
 * （ADR-149 D-149-3 + AMENDMENT 1 D-149-15 / EP-5-shared 沉淀）
 *
 * 设计目标：替代 audit 页 2 个 datetime-local 原生 input boilerplate；提供 from-to
 * 双 input + 可选 presets 快捷选项（近 7 天 / 近 30 天 / 自定义）。
 *
 * 行为契约：
 *   - value: { from?, to? } 受控（消费方持有 state）
 *   - onChange 在每次变化时立即触发（无 debounce / 日期 input 用户改一次就完成）
 *   - type='date' 或 'datetime-local'（消费方根据业务粒度选择）
 *   - presets 可选：快捷点选 + 自定义"清除"按钮
 *   - a11y：role="group" + 2 input aria-label
 */
import React, { useCallback } from 'react'

export interface DateRangeValue {
  readonly from?: string
  readonly to?: string
}

export interface DateRangePreset {
  readonly label: string
  readonly from?: string
  readonly to?: string
}

export interface DataTableDateRangeFilterProps {
  readonly value: DateRangeValue
  readonly onChange: (next: DateRangeValue) => void
  readonly type?: 'date' | 'datetime-local'
  readonly presets?: readonly DateRangePreset[]
  readonly disabled?: boolean
  readonly 'aria-label'?: string
  readonly 'data-testid'?: string
}

const INPUT_STYLE: React.CSSProperties = {
  height: '28px',
  padding: '0 8px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-default)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-default)',
  fontSize: 'var(--font-size-sm-tight)',
  fontFamily: 'inherit',
  outline: 'none',
}

const PRESET_BTN_STYLE: React.CSSProperties = {
  padding: '3px 8px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  color: 'var(--fg-muted)',
  fontFamily: 'inherit',
  fontSize: 'var(--font-size-xs)',
  cursor: 'pointer',
}

export function DataTableDateRangeFilter(props: DataTableDateRangeFilterProps): React.ReactElement {
  const {
    value,
    onChange,
    type = 'date',
    presets,
    disabled = false,
    'aria-label': ariaLabel = '日期范围',
    'data-testid': testId,
  } = props

  const handleFromChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value || undefined
      onChange({ from: next, to: value.to })
    },
    [value.to, onChange],
  )

  const handleToChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value || undefined
      onChange({ from: value.from, to: next })
    },
    [value.from, onChange],
  )

  const handlePresetClick = useCallback(
    (preset: DateRangePreset) => {
      onChange({ from: preset.from, to: preset.to })
    },
    [onChange],
  )

  const handleClear = useCallback(() => {
    onChange({})
  }, [onChange])

  const hasValue = value.from !== undefined || value.to !== undefined

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      data-table-filter-date-range
      data-testid={testId}
      style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontFamily: 'inherit' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
        <input
          type={type}
          value={value.from ?? ''}
          onChange={handleFromChange}
          disabled={disabled}
          aria-label={`${ariaLabel} 起始`}
          data-testid={testId ? `${testId}-from` : undefined}
          style={INPUT_STYLE}
        />
        <span aria-hidden="true" style={{ color: 'var(--fg-muted)', fontSize: 'var(--font-size-sm-tight)' }}>
          —
        </span>
        <input
          type={type}
          value={value.to ?? ''}
          onChange={handleToChange}
          disabled={disabled}
          aria-label={`${ariaLabel} 结束`}
          data-testid={testId ? `${testId}-to` : undefined}
          style={INPUT_STYLE}
        />
      </div>
      {presets && presets.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => handlePresetClick(preset)}
              disabled={disabled}
              style={PRESET_BTN_STYLE}
              data-testid={testId ? `${testId}-preset-${preset.label}` : undefined}
            >
              {preset.label}
            </button>
          ))}
          {hasValue && (
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              style={{ ...PRESET_BTN_STYLE, color: 'var(--state-error-fg)' }}
              data-testid={testId ? `${testId}-clear` : undefined}
            >
              清除
            </button>
          )}
        </div>
      )}
    </div>
  )
}

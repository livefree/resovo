'use client'

/**
 * picker-trigger.tsx — VideoPicker 触发器（已选回显 / 占位 / error 底文）
 *
 * 真源：M-SN-SHARED-04-A / video-picker.types.ts
 */

import { type CSSProperties, type ReactNode } from 'react'
import { Thumb } from '../cell/thumb'
import type { PickerVideoItem } from './video-picker.types'

export interface PickerTriggerProps {
  readonly label?: ReactNode
  readonly required?: boolean
  readonly value: PickerVideoItem | null | readonly PickerVideoItem[]
  readonly multiple: boolean
  readonly placeholder: string
  readonly disabled: boolean
  readonly error?: string
  readonly onOpen: () => void
  readonly onClear: () => void
  readonly id?: string
  readonly 'aria-label'?: string
  readonly 'aria-describedby'?: string
  readonly 'data-testid'?: string
}

const WRAP_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
}

const LABEL_STYLE: CSSProperties = {
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--fg-muted)',
}

const REQUIRED_STAR: CSSProperties = {
  color: 'var(--state-danger-fg, var(--state-danger))',
  marginLeft: '2px',
}

const BUTTON_BASE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '6px 10px',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  fontSize: 'var(--font-size-sm)',
  color: 'var(--fg-default)',
  minHeight: '36px',
}

const CHIP_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '2px 8px',
  background: 'var(--bg-subtle, var(--bg-surface))',
  borderRadius: 'var(--radius-pill, 12px)',
  fontSize: '11px',
  color: 'var(--fg-default)',
}

const META_STYLE: CSSProperties = {
  fontSize: '11px',
  color: 'var(--fg-muted)',
  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
}

const PLACEHOLDER_STYLE: CSSProperties = {
  color: 'var(--fg-muted)',
}

const CLEAR_BTN_STYLE: CSSProperties = {
  marginLeft: 'auto',
  border: 0,
  background: 'transparent',
  color: 'var(--fg-muted)',
  cursor: 'pointer',
  padding: '4px 6px',
  fontSize: '14px',
  lineHeight: 1,
}

const ERROR_STYLE: CSSProperties = {
  fontSize: '11px',
  color: 'var(--state-danger-fg, var(--state-danger))',
}

function buttonStyle(disabled: boolean, hasError: boolean): CSSProperties {
  return {
    ...BUTTON_BASE,
    borderColor: hasError ? 'var(--state-danger-border, var(--state-danger))' : BUTTON_BASE.border as string,
    opacity: disabled ? 0.6 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}

export function PickerTrigger({
  label,
  required,
  value,
  multiple,
  placeholder,
  disabled,
  error,
  onOpen,
  onClear,
  ...rest
}: PickerTriggerProps) {
  const isEmpty = multiple ? (value as readonly PickerVideoItem[]).length === 0 : value == null
  const onKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      onOpen()
    }
  }
  return (
    <span style={WRAP_STYLE}>
      {label && (
        <label htmlFor={rest.id} style={LABEL_STYLE}>
          {label}
          {required && <span style={REQUIRED_STAR}>*</span>}
        </label>
      )}
      <button
        type="button"
        id={rest.id}
        role="combobox"
        aria-haspopup="dialog"
        aria-expanded={false}
        aria-label={rest['aria-label']}
        aria-describedby={rest['aria-describedby']}
        aria-invalid={error ? true : undefined}
        disabled={disabled}
        onClick={() => !disabled && onOpen()}
        onKeyDown={onKey}
        style={buttonStyle(disabled, Boolean(error))}
        data-testid={rest['data-testid']}
      >
        {isEmpty ? (
          <span style={PLACEHOLDER_STYLE}>{placeholder}</span>
        ) : multiple ? (
          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6 }}>
            {(value as readonly PickerVideoItem[]).map((it) => (
              <span key={it.id} style={CHIP_STYLE}>
                {it.title} <span style={META_STYLE}>{it.shortId}</span>
              </span>
            ))}
          </span>
        ) : (
          <>
            <Thumb src={(value as PickerVideoItem).coverUrl} size="poster-sm" alt={(value as PickerVideoItem).title} decorative />
            <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
              <span style={{ fontWeight: 600 }}>{(value as PickerVideoItem).title}</span>
              <span style={META_STYLE}>
                {(value as PickerVideoItem).shortId} · {(value as PickerVideoItem).year ?? '—'}
              </span>
            </span>
          </>
        )}
        {!isEmpty && !disabled && (
          <span
            role="button"
            aria-label="清除已选"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              onClear()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation()
                e.preventDefault()
                onClear()
              }
            }}
            style={CLEAR_BTN_STYLE}
            data-testid={rest['data-testid'] ? `${rest['data-testid']}-clear` : undefined}
          >
            ✕
          </span>
        )}
      </button>
      {error && <span style={ERROR_STYLE}>{error}</span>}
    </span>
  )
}

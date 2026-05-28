'use client'

/**
 * CustomThemeDialog.tsx — 自定义主题编辑器（CHG-369-B / plan §17.2）
 *
 * 用户在 RouteThemeSelector 点 "自定义…" / 编辑按钮 → 打开本 dialog 输入：
 *   - displayName（≤ 10 字符 / 主题展示名）
 *   - labels（每行一条 / 1-30 个 / 每个 ≤ 10 字符）
 *   - deadLabel（可选 / ≤ 10 字符 / 默认 '已断'）
 *
 * 设计模式：仿 ConfirmReplaceDialog（同目录）/ role=dialog + aria-modal / 纯 CSS / 零外部依赖。
 * 校验：实时校验 + Confirm 按钮 disabled 直到通过 + 错误文案就近显示。
 * 字符计数：input 边显示 "n / max"。
 */

import { useId, useMemo, useState } from 'react'
import {
  CUSTOM_THEME_CONSTRAINTS,
  type CustomThemeData,
} from '@/lib/route-theme-storage'

interface CustomThemeDialogProps {
  readonly initial: CustomThemeData | null
  readonly onConfirm: (data: CustomThemeData) => void
  readonly onCancel: () => void
  readonly onClear?: () => void
}

interface FormState {
  displayName: string
  labelsRaw: string
  deadLabel: string
}

interface Validation {
  readonly ok: boolean
  readonly data: CustomThemeData | null
  readonly errors: {
    displayName?: string
    labels?: string
    deadLabel?: string
  }
  readonly labelsCount: number
}

function validateForm(state: FormState): Validation {
  const C = CUSTOM_THEME_CONSTRAINTS
  const errors: Validation['errors'] = {}

  const displayName = state.displayName.trim()
  if (displayName.length === 0) errors.displayName = '主题名不能为空'
  else if (displayName.length > C.displayNameMaxChars)
    errors.displayName = `主题名不能超过 ${C.displayNameMaxChars} 字符`

  const labels = state.labelsRaw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  const overLengthLabel = labels.find((l) => l.length > C.labelMaxChars)
  if (labels.length < C.labelsMinCount)
    errors.labels = `至少需要 ${C.labelsMinCount} 个标签`
  else if (labels.length > C.labelsMaxCount)
    errors.labels = `最多 ${C.labelsMaxCount} 个标签（当前 ${labels.length}）`
  else if (overLengthLabel)
    errors.labels = `标签"${overLengthLabel}"超过 ${C.labelMaxChars} 字符`

  let deadLabel: string | undefined
  const deadTrim = state.deadLabel.trim()
  if (deadTrim.length > 0) {
    if (deadTrim.length > C.deadLabelMaxChars)
      errors.deadLabel = `已断文案不能超过 ${C.deadLabelMaxChars} 字符`
    else deadLabel = deadTrim
  }

  const ok = Object.keys(errors).length === 0
  return {
    ok,
    data: ok ? { displayName, labels, deadLabel } : null,
    errors,
    labelsCount: labels.length,
  }
}

export function CustomThemeDialog({
  initial,
  onConfirm,
  onCancel,
  onClear,
}: CustomThemeDialogProps) {
  const titleId = useId()
  const C = CUSTOM_THEME_CONSTRAINTS

  const [state, setState] = useState<FormState>(() => ({
    displayName: initial?.displayName ?? '',
    labelsRaw: initial?.labels.join('\n') ?? '',
    deadLabel: initial?.deadLabel ?? '',
  }))

  const validation = useMemo(() => validateForm(state), [state])

  function handleConfirm() {
    if (validation.ok && validation.data) onConfirm(validation.data)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="custom-theme-dialog"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'color-mix(in srgb, var(--bg-canvas) 60%, transparent)',
        backdropFilter: 'blur(4px)',
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          maxWidth: '480px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          boxShadow: '0 8px 32px color-mix(in srgb, var(--bg-canvas) 0%, transparent)',
        }}
      >
        <h2
          id={titleId}
          style={{ color: 'var(--fg-default)', fontSize: '1rem', fontWeight: 600, margin: 0 }}
        >
          {initial ? '编辑自定义主题' : '新建自定义主题'}
        </h2>

        <p style={{ color: 'var(--fg-muted)', fontSize: '0.8125rem', margin: 0 }}>
          每行一个标签，自上而下应用到线路 1, 2, 3...；超出标签数将回退到&ldquo;线路N&rdquo;。
        </p>

        <FormField
          label="主题名"
          htmlFor="ct-display-name"
          counter={`${state.displayName.trim().length} / ${C.displayNameMaxChars}`}
          error={validation.errors.displayName}
        >
          <input
            id="ct-display-name"
            data-testid="custom-theme-display-name"
            type="text"
            value={state.displayName}
            maxLength={C.displayNameMaxChars + 2}
            placeholder="例如：我的备用"
            onChange={(e) => setState((s) => ({ ...s, displayName: e.target.value }))}
            style={inputStyle}
          />
        </FormField>

        <FormField
          label="标签列表（每行一条）"
          htmlFor="ct-labels"
          counter={`${validation.labelsCount} / ${C.labelsMaxCount}`}
          error={validation.errors.labels}
        >
          <textarea
            id="ct-labels"
            data-testid="custom-theme-labels"
            value={state.labelsRaw}
            rows={6}
            placeholder={'极速\n备用\n测试'}
            onChange={(e) => setState((s) => ({ ...s, labelsRaw: e.target.value }))}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </FormField>

        <FormField
          label="已断文案（可选）"
          htmlFor="ct-dead-label"
          counter={`${state.deadLabel.trim().length} / ${C.deadLabelMaxChars}`}
          error={validation.errors.deadLabel}
        >
          <input
            id="ct-dead-label"
            data-testid="custom-theme-dead-label"
            type="text"
            value={state.deadLabel}
            maxLength={C.deadLabelMaxChars + 2}
            placeholder="默认 '已断'"
            onChange={(e) => setState((s) => ({ ...s, deadLabel: e.target.value }))}
            style={inputStyle}
          />
        </FormField>

        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '0.25rem',
          }}
        >
          {initial && onClear ? (
            <button
              type="button"
              data-testid="custom-theme-clear"
              onClick={onClear}
              style={{
                ...buttonBaseStyle,
                color: 'var(--fg-danger, #c43)',
                background: 'transparent',
                border: '1px solid var(--border-default)',
              }}
            >
              清除自定义主题
            </button>
          ) : (
            <span />
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              data-testid="custom-theme-cancel"
              onClick={onCancel}
              style={{
                ...buttonBaseStyle,
                color: 'var(--fg-muted)',
                background: 'transparent',
                border: '1px solid var(--border-default)',
              }}
            >
              取消
            </button>
            <button
              type="button"
              data-testid="custom-theme-confirm"
              onClick={handleConfirm}
              disabled={!validation.ok}
              style={{
                ...buttonBaseStyle,
                color: 'var(--accent-fg)',
                background: validation.ok ? 'var(--accent-default)' : 'var(--bg-muted, #888)',
                border: 'none',
                fontWeight: 600,
                cursor: validation.ok ? 'pointer' : 'not-allowed',
                opacity: validation.ok ? 1 : 0.6,
              }}
            >
              保存并应用
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function FormField({
  label,
  htmlFor,
  counter,
  error,
  children,
}: {
  readonly label: string
  readonly htmlFor: string
  readonly counter?: string
  readonly error?: string
  readonly children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <label
          htmlFor={htmlFor}
          style={{ color: 'var(--fg-default)', fontSize: '0.8125rem', fontWeight: 500 }}
        >
          {label}
        </label>
        {counter && (
          <span style={{ color: 'var(--fg-muted)', fontSize: '0.75rem' }}>{counter}</span>
        )}
      </div>
      {children}
      {error && (
        <span
          role="alert"
          style={{ color: 'var(--fg-danger, #c43)', fontSize: '0.75rem' }}
        >
          {error}
        </span>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  borderRadius: '0.375rem',
  border: '1px solid var(--border-default)',
  background: 'var(--bg-canvas)',
  color: 'var(--fg-default)',
  fontSize: '0.875rem',
  boxSizing: 'border-box',
}

const buttonBaseStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  borderRadius: '0.375rem',
  cursor: 'pointer',
  fontSize: '0.875rem',
}

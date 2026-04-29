/**
 * selection-action-bar.tsx — 批量操作工具栏
 * 真源：ADR-103 §4.8（CHG-SN-2-17）
 *
 * 职责：行选中后吸附于表格底部/顶部；已选 N 条 + page↔all-matched 切换 + actions + 清除。
 * 不做 portal 渲染（inline 吸附，无遮罩层级问题）。
 */
import React, { useState } from 'react'
import type { TableSelectionState } from './types'

export interface SelectionAction {
  readonly key: string
  readonly label: React.ReactNode
  readonly icon?: React.ReactNode
  readonly onClick: () => void
  readonly variant?: 'default' | 'primary' | 'danger'
  readonly disabled?: boolean
  readonly confirm?: { readonly title: string; readonly description?: string }
}

export interface SelectionActionBarProps {
  readonly visible: boolean
  readonly variant?: 'sticky-bottom' | 'sticky-top'
  readonly selectedCount: number
  readonly totalMatched?: number
  readonly selectionMode: TableSelectionState['mode']
  readonly onSelectionModeChange?: (next: TableSelectionState['mode']) => void
  readonly onClearSelection: () => void
  readonly actions: readonly SelectionAction[]
  readonly className?: string
  readonly 'data-testid'?: string
}

const BAR_STYLE_BASE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 16px',
  background: 'var(--bg-surface-elevated)',
  borderTop: '1px solid var(--border-subtle)',
  boxShadow: 'var(--shadow-md)',
  position: 'sticky',
  zIndex: 1,
  flexWrap: 'wrap',
}

const COUNT_STYLE: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--fg-default)',
  flexShrink: 0,
}

const DIVIDER_STYLE: React.CSSProperties = {
  width: '1px',
  height: '16px',
  background: 'var(--border-subtle)',
  flexShrink: 0,
}

const SPACER_STYLE: React.CSSProperties = { flex: 1 }

function actionBtnStyle(variant: SelectionAction['variant'], disabled: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '5px 12px',
    fontSize: '13px',
    fontWeight: 500,
    border: '1px solid transparent',
    borderRadius: 'var(--radius-sm)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    flexShrink: 0,
  }
  if (variant === 'primary') {
    return { ...base, background: 'var(--accent-primary)', color: 'var(--fg-on-accent)', borderColor: 'var(--accent-primary)' }
  }
  if (variant === 'danger') {
    return { ...base, background: 'transparent', color: 'var(--state-error)', borderColor: 'var(--state-error)' }
  }
  return { ...base, background: 'var(--bg-surface-hover)', color: 'var(--fg-default)', borderColor: 'var(--border-strong)' }
}

const GHOST_BTN_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '4px 8px',
  fontSize: '12px',
  border: 0,
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  color: 'var(--fg-muted)',
  cursor: 'pointer',
  flexShrink: 0,
}

const LINK_BTN_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '4px 8px',
  fontSize: '12px',
  border: 0,
  background: 'transparent',
  color: 'var(--accent-primary)',
  cursor: 'pointer',
  textDecoration: 'underline',
  flexShrink: 0,
}

const CONFIRM_WRAP_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '4px 10px',
  background: 'var(--bg-surface-hover)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '13px',
  flexShrink: 0,
}

const CONFIRM_OK_STYLE: React.CSSProperties = {
  padding: '2px 10px',
  fontSize: '12px',
  background: 'var(--state-error)',
  color: 'var(--fg-on-accent)',
  border: 0,
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
}

const CONFIRM_CANCEL_STYLE: React.CSSProperties = {
  padding: '2px 8px',
  fontSize: '12px',
  background: 'transparent',
  border: 0,
  color: 'var(--fg-muted)',
  cursor: 'pointer',
}

export function SelectionActionBar({
  visible,
  variant = 'sticky-bottom',
  selectedCount,
  totalMatched,
  selectionMode,
  onSelectionModeChange,
  onClearSelection,
  actions,
  className,
  'data-testid': testId,
}: SelectionActionBarProps): React.ReactElement | null {
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null)

  if (!visible) return null

  const barStyle: React.CSSProperties = {
    ...BAR_STYLE_BASE,
    bottom: variant === 'sticky-bottom' ? 0 : undefined,
    top: variant === 'sticky-top' ? 0 : undefined,
  }

  const handleActionClick = (action: SelectionAction) => {
    if (action.disabled) return
    if (action.confirm) {
      setPendingConfirm(action.key)
    } else {
      action.onClick()
    }
  }

  const handleConfirmOk = (action: SelectionAction) => {
    setPendingConfirm(null)
    action.onClick()
  }

  return (
    <div
      style={barStyle}
      className={className}
      data-testid={testId}
      data-selection-action-bar
      data-variant={variant}
    >
      <span style={COUNT_STYLE} data-selected-count>
        已选 {selectedCount} 条
      </span>

      {totalMatched !== undefined && selectionMode === 'page' && onSelectionModeChange && (
        <button
          type="button"
          style={LINK_BTN_STYLE}
          onClick={() => onSelectionModeChange('all-matched')}
          data-select-all-matched
        >
          选择全部 {totalMatched} 条
        </button>
      )}

      {totalMatched !== undefined && selectionMode === 'all-matched' && (
        <>
          <span style={{ fontSize: '12px', color: 'var(--fg-muted)' }}>
            已选全部 {totalMatched} 条
          </span>
          {onSelectionModeChange && (
            <button
              type="button"
              style={LINK_BTN_STYLE}
              onClick={() => onSelectionModeChange('page')}
              data-deselect-all-matched
            >
              取消全选
            </button>
          )}
        </>
      )}

      {actions.length > 0 && <div style={DIVIDER_STYLE} />}

      {actions.map((action) => {
        if (pendingConfirm === action.key && action.confirm) {
          return (
            <div key={action.key} style={CONFIRM_WRAP_STYLE} data-confirm-prompt={action.key}>
              <span>{action.confirm.title}</span>
              <button type="button" style={CONFIRM_OK_STYLE} onClick={() => handleConfirmOk(action)}>
                确认
              </button>
              <button type="button" style={CONFIRM_CANCEL_STYLE} onClick={() => setPendingConfirm(null)}>
                取消
              </button>
            </div>
          )
        }
        return (
          <button
            key={action.key}
            type="button"
            style={actionBtnStyle(action.variant, !!action.disabled)}
            disabled={action.disabled}
            onClick={() => handleActionClick(action)}
            data-action-key={action.key}
          >
            {action.icon && <span aria-hidden="true">{action.icon}</span>}
            {action.label}
          </button>
        )
      })}

      <div style={SPACER_STYLE} />

      <button
        type="button"
        style={GHOST_BTN_STYLE}
        onClick={() => { setPendingConfirm(null); onClearSelection() }}
        data-clear-selection
      >
        清除选择
      </button>
    </div>
  )
}

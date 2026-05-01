'use client'

/**
 * inline-row-actions.tsx — InlineRowActions 共享组件实装（CHG-DESIGN-12 12B）
 *
 * 真源：inline-row-actions.types.ts（12A Opus PASS 契约 + Codex stop-time fix#1/#2）
 *
 * 实装契约（12A 一致性硬约束）：
 *   - actions 数组顺序即渲染顺序
 *   - primary / danger 互斥；同时传 primary 优先 + dev warn
 *   - alwaysVisible=false（默认）→ 默认 opacity 0 + pointer-events none；
 *     hover 行 / focus-within 后浮现（reference §6.0 + CHG-DESIGN-12 12B fix#2）
 *   - alwaysVisible=true → 永远 opacity 1
 *   - 每个按钮 type=button + e.stopPropagation（防冒泡触发行点击）
 *   - 横排 flex gap 3px
 *
 * opacity 行为由全局 CSS（InlineRowActionsStyles 注入）控制，**不**用 inline style
 *   - inline opacity 优先级 1000 会阻止消费方 `tr:hover` override（fix#1 教训）
 *   - 全局 CSS 选择器优先级 0,2,1，消费方 `tr:hover [data-row-actions]:not(...)` 同等优先级
 *     可直接 override；admin-ui 注入的 CSS 已包含 tr:hover / [role=row]:hover / :focus-within
 *     三 selector 兜底
 *
 * 固定 data attribute：data-row-actions + data-action-key={action.key}
 */
import React from 'react'
import { InlineRowActionsStyles } from './inline-row-actions-styles'
import type { InlineRowActionsProps, InlineRowAction } from './inline-row-actions.types'

const ROOT_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '3px',
  flexShrink: 0,
}

const BTN_BASE_STYLE: React.CSSProperties = {
  height: 'var(--row-h-compact, 24px)',
  padding: '0 8px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-default)',
  font: 'inherit',
  fontSize: '11px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  whiteSpace: 'nowrap',
  flexShrink: 0,
}

const BTN_PRIMARY_STYLE: React.CSSProperties = {
  ...BTN_BASE_STYLE,
  background: 'var(--accent-default)',
  color: 'var(--fg-on-accent)',
  border: '1px solid var(--accent-default)',
  fontWeight: 500,
}

const BTN_DANGER_STYLE: React.CSSProperties = {
  ...BTN_BASE_STYLE,
  color: 'var(--state-error-fg)',
  border: '1px solid var(--state-error-border)',
}

const BTN_DISABLED_OVERLAY: React.CSSProperties = {
  opacity: 0.5,
  cursor: 'not-allowed',
}

function buttonStyle(action: InlineRowAction): React.CSSProperties {
  // primary / danger 互斥；primary 优先（与 12A 契约约定一致）
  let style: React.CSSProperties
  if (action.primary) style = BTN_PRIMARY_STYLE
  else if (action.danger) style = BTN_DANGER_STYLE
  else style = BTN_BASE_STYLE

  if (action.disabled) style = { ...style, ...BTN_DISABLED_OVERLAY }
  return style
}

export function InlineRowActions({
  actions,
  alwaysVisible = false,
  ariaLabel = '行操作',
  testId,
}: InlineRowActionsProps): React.ReactElement {
  // 12A 契约硬约束：primary + danger 同时传 → dev warn（primary 优先）
  if (process.env.NODE_ENV !== 'production') {
    actions.forEach((action) => {
      if (action.primary && action.danger) {
        // eslint-disable-next-line no-console
        console.warn(
          `[InlineRowActions] action key="${action.key}" has both primary=true and danger=true. ` +
          `These are mutually exclusive; primary takes precedence (danger ignored).`,
        )
      }
    })
  }

  // 12A 契约硬约束（reference §6.0 行内 actions 默认 opacity 0，hover 行后出现）：
  // opacity / transition / hover override 全部由 InlineRowActionsStyles 注入的全局 CSS 控制
  // （fix#2 教训：inline opacity 优先级 1000 阻止消费方 tr:hover override，必须走全局 CSS）。
  // 本组件仅设 layout（display/flex/gap）；data-always-visible 标记交给 CSS 选择器分支。
  return (
    <>
      <InlineRowActionsStyles />
      <span
        data-row-actions
        data-always-visible={alwaysVisible ? 'true' : undefined}
        data-testid={testId}
        role="group"
        aria-label={ariaLabel}
        style={ROOT_STYLE}
      >
      {actions.map((action) => {
        const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation()
          if (!action.disabled) action.onClick()
        }
        return (
          <button
            key={action.key}
            type="button"
            data-action-key={action.key}
            data-primary={action.primary ? 'true' : undefined}
            data-danger={action.danger && !action.primary ? 'true' : undefined}
            disabled={action.disabled}
            title={action.title}
            onClick={handleClick}
            style={buttonStyle(action)}
          >
            {action.children}
          </button>
        )
      })}
      </span>
    </>
  )
}

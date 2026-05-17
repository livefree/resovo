'use client'

/**
 * admin-textarea.tsx — 后台长文本通用原语（CHG-SN-6-09 / arch-reviewer Opus PASS）
 *
 * 真源：CHG-SN-6-09 起草卡 + arch-reviewer Opus 1 轮 PASS
 *
 * 消费方场景（≥ 3 处沉淀阈值已满足）：
 *   - SettingsTab siteAnnouncement / doubanCookie（2 处）
 *   - ConfigTab configFile JSON 编辑器（1 处 monospace）
 *   - 未来 reject_modal reason / staff_note / staging note（3+ 处潜在）
 *
 * 视觉契约（与 AdminInput 对称）：
 *   - 12px font / bg-surface / 1px border / radius-sm
 *   - sm/md/lg 字号档（高度由消费方 rows / minHeight 控制）
 *   - resize 默认 'vertical'（textarea 默认 both 在卡片布局会破坏 grid）
 *   - error 态：border-danger + aria-invalid（同 AdminInput）
 *   - focused 态：useState focus 切换 borderColor + box-shadow（同 AdminInput）
 *   - monospace：fontFamily 切 var(--font-mono) 用于 JSON / code
 *
 * 不变约束：
 *   - 零业务视图消费 / Edge Runtime 兼容
 *   - token 引用 100% / 零硬编码颜色
 *   - shorthand+longhand 防回归：border 三段 longhand（CHG-SN-6-RETRO-4 教训）
 */

import React from 'react'

export type AdminTextareaSize = 'sm' | 'md' | 'lg'
export type AdminTextareaResize = 'vertical' | 'horizontal' | 'both' | 'none'

export interface AdminTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  /** 尺寸（仅控字号 + padding；高度由 rows / minHeight 控制）；默认 'md' */
  readonly size?: AdminTextareaSize
  /** 错误态：border-danger + aria-invalid */
  readonly error?: boolean
  /** resize 行为；默认 'vertical' */
  readonly resize?: AdminTextareaResize
  /** 等宽字体（JSON / 代码片段编辑场景） */
  readonly monospace?: boolean
  /** 容器额外 className（当前为 inline-style 范式，预留） */
  readonly wrapperClassName?: string
  /** 容器测试 id（textarea 本身 data-testid 通过 ...rest 透传） */
  readonly 'data-testid'?: string
}

const SIZE_FONT: Record<AdminTextareaSize, string> = {
  sm: 'var(--font-size-xs)',
  md: 'var(--font-size-xs)',
  lg: 'var(--font-size-sm)',
}

const SIZE_PADDING: Record<AdminTextareaSize, string> = {
  sm: '4px 8px',
  md: '6px 10px',
  lg: '8px 12px',
}

const WRAPPER_BASE: React.CSSProperties = {
  display: 'flex',
  background: 'var(--bg-surface)',
  // border 拆 longhand（CHG-SN-6-RETRO-4 / verify:style-shorthand-conflict FAIL fast）
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  width: '100%',
}

const TEXTAREA_BASE: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  width: '100%',
  borderWidth: '0',
  borderStyle: 'none',
  outline: 'none',
  background: 'transparent',
  color: 'var(--fg-default)',
  fontFamily: 'inherit',
  lineHeight: 1.5,
}

export function AdminTextarea({
  size = 'md',
  error = false,
  resize = 'vertical',
  monospace = false,
  disabled,
  wrapperClassName,
  'data-testid': testId,
  onFocus,
  onBlur,
  style: styleOverride,
  rows = 4,
  ...rest
}: AdminTextareaProps): React.ReactElement {
  const [focused, setFocused] = React.useState(false)

  const wrapperStyle: React.CSSProperties = {
    ...WRAPPER_BASE,
    padding: SIZE_PADDING[size],
    fontSize: SIZE_FONT[size],
    ...(error
      ? {
          borderColor: 'var(--border-danger, var(--fg-danger))',
          boxShadow: focused ? '0 0 0 2px var(--accent-soft, transparent)' : undefined,
        }
      : focused
        ? {
            borderColor: 'var(--border-strong, var(--accent-default))',
            boxShadow: '0 0 0 2px var(--accent-soft, transparent)',
          }
        : null),
    ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : null),
  }

  const textareaStyle: React.CSSProperties = {
    ...TEXTAREA_BASE,
    resize,
    ...(monospace
      ? { fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)' }
      : null),
    ...styleOverride,
  }

  return (
    <div
      data-admin-textarea
      data-size={size}
      data-error={error ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      data-monospace={monospace ? '' : undefined}
      className={wrapperClassName}
      style={wrapperStyle}
    >
      <textarea
        data-admin-textarea-control
        data-testid={testId}
        rows={rows}
        disabled={disabled}
        aria-invalid={error || undefined}
        style={textareaStyle}
        onFocus={(e) => { setFocused(true); onFocus?.(e) }}
        onBlur={(e) => { setFocused(false); onBlur?.(e) }}
        {...rest}
      />
    </div>
  )
}

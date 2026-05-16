'use client'

/**
 * admin-input.tsx — 后台输入框通用原语
 * 真源：reference §4.2 Input（CHG-SN-5-PRE-03-C / SEQ-20260506-02 / M-SN-5.5）
 *
 * 用途：取代各页面 inline input 自拼，统一 type / size / prefix/suffix / error 态。
 *
 * 不变约束：
 *   - 零业务视图消费（本卡范围 packages/admin-ui，禁止 import server-next/web-next）
 *   - 不引入 BrandProvider / ThemeProvider
 *   - 零图标库依赖（prefix / suffix 由消费方注入 ReactNode）
 *   - Edge Runtime 兼容
 *
 * 视觉契约（reference §4.2）：
 *   - 12px font / bg3（var(--bg-surface)）/ 1px border / radius 6px / padding 6px 10px
 *   - sm: 24px / md: 28px / lg: 32px 高
 *   - error 态：border-danger 色 + aria-invalid="true"
 *   - prefix/suffix slot：内置 padding 调整
 *   - hover/focus 由 :focus-within 选择器表达；inline style 限制下用 onFocus/onBlur 状态切换
 */

import React, { useState } from 'react'

export type AdminInputType = 'text' | 'email' | 'password' | 'number' | 'search' | 'tel' | 'url'
export type AdminInputSize = 'sm' | 'md' | 'lg'

export interface AdminInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  readonly type?: AdminInputType
  /** 尺寸；默认 'md' */
  readonly size?: AdminInputSize
  /** 错误态（border-danger + aria-invalid） */
  readonly error?: boolean
  /** 左侧装饰节点（图标 / 货币符 / 单位前缀） */
  readonly prefix?: React.ReactNode
  /** 右侧装饰节点（清除按钮 / 计数 / 单位后缀） */
  readonly suffix?: React.ReactNode
  /**
   * 容器额外 class。当前 admin-ui 为全 inline style 范式，此 prop 为 CSS module / styled-jsx
   * 升级预留（DEBT-ADMIN-UI-FOCUS-PSEUDO）；当前版本下消费方建议仅通过 prefix/suffix slot 扩展视觉。
   */
  readonly wrapperClassName?: string
  /** 容器测试 id（input 元素本身的 data-testid 通过 ...rest 透传） */
  readonly 'data-testid'?: string
}

const SIZE_HEIGHT: Record<AdminInputSize, string> = {
  sm: '24px',
  md: '28px',
  lg: '32px',
}

const SIZE_FONT: Record<AdminInputSize, string> = {
  sm: 'var(--font-size-xs)',
  md: 'var(--font-size-xs)',
  lg: 'var(--font-size-sm)',
}

const WRAPPER_BASE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  background: 'var(--bg-surface)',
  // 拆分 border 三段（非 shorthand），避免 focus 切换 borderColor 触发 React
  // "Removing a style property during rerender" warning
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  padding: '0 var(--input-padding-x, 10px)',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
}

const INPUT_BASE: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: 'none',
  outline: 'none',
  background: 'transparent',
  color: 'var(--fg-default)',
  fontFamily: 'inherit',
  padding: 0,
}

const SLOT_BASE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  flexShrink: 0,
  color: 'var(--fg-muted)',
}

export function AdminInput({
  type = 'text',
  size = 'md',
  error = false,
  prefix,
  suffix,
  disabled,
  wrapperClassName,
  'data-testid': testId,
  onFocus,
  onBlur,
  style: styleOverride,
  ...rest
}: AdminInputProps): React.ReactElement {
  const [focused, setFocused] = useState(false)

  const wrapperStyle: React.CSSProperties = {
    ...WRAPPER_BASE,
    height: SIZE_HEIGHT[size],
    fontSize: SIZE_FONT[size],
    ...(error
      ? {
          // canonical: --border-danger；fallback --fg-danger 仅防 legacy theme 缺 border-danger 槽位
          borderColor: 'var(--border-danger, var(--fg-danger))',
          // canonical: --accent-soft；fallback transparent 防 token 缺失时不显示丑边框
          boxShadow: focused ? '0 0 0 2px var(--accent-soft, transparent)' : undefined,
        }
      : focused
        ? {
            // canonical: --border-strong；fallback --accent-default 用于无 strong 槽的 legacy theme
            borderColor: 'var(--border-strong, var(--accent-default))',
            boxShadow: '0 0 0 2px var(--accent-soft, transparent)',
          }
        : null),
    ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : null),
    ...styleOverride,
  }

  return (
    <div
      data-admin-input
      data-size={size}
      data-error={error ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      className={wrapperClassName}
      data-testid={testId}
      style={wrapperStyle}
    >
      {prefix !== undefined && prefix !== null && (
        <span data-admin-input-prefix style={SLOT_BASE}>{prefix}</span>
      )}
      <input
        data-admin-input-control
        type={type}
        disabled={disabled}
        aria-invalid={error || undefined}
        style={INPUT_BASE}
        onFocus={(e) => { setFocused(true); onFocus?.(e) }}
        onBlur={(e) => { setFocused(false); onBlur?.(e) }}
        {...rest}
      />
      {suffix !== undefined && suffix !== null && (
        <span data-admin-input-suffix style={SLOT_BASE}>{suffix}</span>
      )}
    </div>
  )
}

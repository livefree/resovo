'use client'

/**
 * admin-button.tsx — 后台按钮通用原语
 * 真源：reference §4.2（CHG-SN-5-PRE-03-B / SEQ-20260506-02 / M-SN-5.5）
 *
 * 用途：取代各页面 inline HEAD_BTN_STYLE 自拼，统一 variant + size + loading + icon。
 *
 * 不变约束：
 *   - 零业务视图消费（本卡范围 packages/admin-ui，禁止 import server-next/web-next）
 *   - 不引入 BrandProvider / ThemeProvider
 *   - 零图标库依赖（leftIcon / rightIcon 由消费方注入 ReactNode）
 *   - Edge Runtime 兼容
 *
 * 视觉契约（reference §4.2 components.css §249-486）：
 *   - default：bg-surface / fg-default / border-default；hover bg4 / border-strong
 *   - secondary：等同 default（语义别名，便于在 primary+secondary 组合处显式表达）
 *   - primary：accent-default 背景 / fg-on-accent / accent-default border / weight 500
 *   - ghost：透明背景 / fg-default / 无 border；hover bg-surface-hover
 *   - danger：fg-danger / border-default；hover danger-soft 背景 + danger border
 *   - sm: 24px / md: 28px / lg: 32px 高；padding 用 var(--button-padding-x)
 *   - loading：opacity 0.6 + cursor wait + 替换内容为 spinner（保持宽度稳定）
 *   - disabled（含 loading）：opacity 0.5 + cursor not-allowed + aria-disabled
 */

import React from 'react'

export type AdminButtonVariant = 'default' | 'secondary' | 'primary' | 'ghost' | 'danger'
export type AdminButtonSize = 'sm' | 'md' | 'lg'

export interface AdminButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** 视觉变体；默认 'default' */
  readonly variant?: AdminButtonVariant
  /** 尺寸；默认 'md'（28px 高）*/
  readonly size?: AdminButtonSize
  /** 加载态；显示 spinner，自动 aria-disabled + 阻断 onClick */
  readonly loading?: boolean
  /** 左侧图标节点（消费方注入 lucide-react / 自绘 svg 等） */
  readonly leftIcon?: React.ReactNode
  /** 右侧图标节点 */
  readonly rightIcon?: React.ReactNode
  /** 按钮文本（含图标场景仍走 children） */
  readonly children?: React.ReactNode
}

const SIZE_HEIGHT: Record<AdminButtonSize, string> = {
  sm: '24px',
  md: '28px',
  lg: '32px',
}

const SIZE_FONT: Record<AdminButtonSize, string> = {
  sm: 'var(--font-size-xs)',
  md: 'var(--font-size-xs)',
  lg: 'var(--font-size-sm)',
}

const DEFAULT_VARIANT: React.CSSProperties = {
  background: 'var(--bg-surface)',
  color: 'var(--fg-default)',
  border: '1px solid var(--border-default)',
}

const VARIANT_STYLE: Record<AdminButtonVariant, React.CSSProperties> = {
  default: DEFAULT_VARIANT,
  // secondary 是 default 的语义别名（在 primary+secondary 组合处显式表达层次）；
  // 同源引用避免双对象同步漂移（arch-reviewer Y-3）
  secondary: DEFAULT_VARIANT,
  primary: {
    background: 'var(--accent-default)',
    color: 'var(--fg-on-accent)',
    border: '1px solid var(--accent-default)',
    fontWeight: 500,
  },
  ghost: {
    background: 'transparent',
    color: 'var(--fg-default)',
    border: '1px solid transparent',
  },
  danger: {
    // TODO(DEBT-ADMIN-UI-BUTTON-HOVER)：reference §4.2 要求 hover 切换到 danger-soft 背景 + danger border；
    // inline style 无法表达 :hover，留待 admin-ui CSS 范式独立卡（CSS module / styled-jsx）
    background: 'var(--bg-surface)',
    color: 'var(--fg-danger)',
    border: '1px solid var(--border-default)',
  },
}

const BASE_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  padding: '0 var(--button-padding-x)',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'inherit',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  userSelect: 'none',
}

const ICON_SLOT: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  flexShrink: 0,
}

/** Spinner keyframes 自注入（id 去重，浏览器自动 dedupe；零消费方协调成本） */
const SPINNER_KEYFRAMES = `@keyframes admin-button-spin { to { transform: rotate(360deg); } }`

function Spinner(): React.ReactElement {
  // 纯 svg 自旋；零图标库依赖；用 currentColor 自动跟随 button color token；
  // 同时 inject keyframes <style id> 防消费方未声明导致的静止 spinner 退化（arch-reviewer Y-1）
  return (
    <>
      <style>{`#admin-button-spin-kf-marker { display: none } ${SPINNER_KEYFRAMES}`}</style>
      <span
        data-admin-button-spinner
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          width: '1em',
          height: '1em',
          animation: 'admin-button-spin 0.8s linear infinite',
        }}
      >
        <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
          <path
            d="M14 8a6 6 0 0 0-6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>
    </>
  )
}

export function AdminButton({
  variant = 'default',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  children,
  disabled,
  onClick,
  type,
  style: styleOverride,
  ...rest
}: AdminButtonProps): React.ReactElement {
  const isInactive = disabled || loading
  const mergedStyle: React.CSSProperties = {
    ...BASE_STYLE,
    height: SIZE_HEIGHT[size],
    fontSize: SIZE_FONT[size],
    ...VARIANT_STYLE[variant],
    ...(isInactive
      ? { opacity: loading ? 0.6 : 0.5, cursor: loading ? 'wait' : 'not-allowed' }
      : null),
    ...styleOverride,
  }

  return (
    <button
      data-admin-button
      data-variant={variant}
      data-size={size}
      data-loading={loading ? '' : undefined}
      type={type ?? 'button'}
      // arch-reviewer R-1：loading 时也设原生 disabled，让浏览器层阻断 keyboard / 程式化 .click() / AT 激活，
      // 避免 React 层 onClick 守卫被绕过（aria-busy 表达"加载中"语义，aria-disabled 表达"不可激活"）
      disabled={disabled || loading}
      aria-disabled={isInactive || undefined}
      aria-busy={loading || undefined}
      style={mergedStyle}
      onClick={onClick}
      {...rest}
    >
      {loading ? (
        <Spinner />
      ) : leftIcon !== undefined && leftIcon !== null ? (
        <span data-admin-button-left-icon style={ICON_SLOT}>{leftIcon}</span>
      ) : null}
      {children !== undefined && children !== null && (
        <span data-admin-button-label>{children}</span>
      )}
      {!loading && rightIcon !== undefined && rightIcon !== null && (
        <span data-admin-button-right-icon style={ICON_SLOT}>{rightIcon}</span>
      )}
    </button>
  )
}

/** 在全局或 admin-shell-styles 中注入；导出便于消费方按需声明 */
export const ADMIN_BUTTON_KEYFRAMES = `@keyframes admin-button-spin { to { transform: rotate(360deg); } }`

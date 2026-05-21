'use client'

import { useContext, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiClient, ApiClientError } from '@/lib/api-client'
import { sanitizeAdminRedirect } from '@/lib/safe-redirect'
import { useAuthStore } from '@/stores/authStore'
import { BrandContext } from '@/contexts/BrandProvider'
import type { User } from '@resovo/types'
import type { CSSProperties } from 'react'

/**
 * server-next LoginForm — admin 登录（ADR-003 / ADR-010）
 *
 * 视觉：reference.md §5.16（宽 400 / padding 40 / Brand row / remember / SSO 占位 / 审计提示）
 *
 * - 登录成功后调 authStore.login(user, accessToken) 写入内存态（refresh_token
 *   cookie 由 apps/api 设置；后续 apiClient 自动注入 Bearer header）
 * - callbackUrl 必须经 sanitizeAdminRedirect 净化（codex P1 修复：
 *   拒绝外部 URL / 协议 URL / `//host` / 非 /admin 前缀，fallback /admin）
 */

// ── 样式常量 ─────────────────────────────────────────────────────────

const CARD_STYLE: CSSProperties = {
  width: '400px',
  padding: '40px',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-lg)',
  display: 'grid',
  gap: '20px',
}

const INPUT_STYLE: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--bg-surface-row)',
  color: 'var(--fg-default)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '14px',
  boxSizing: 'border-box',
}

const SUBMIT_BTN_STYLE: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--accent-default)',
  color: 'var(--accent-fg)',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
}

const DIVIDER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  color: 'var(--fg-subtle)',
  fontSize: '12px',
}

const SSO_BTN_STYLE: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--bg-surface-sunken)',
  color: 'var(--fg-muted)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '14px',
  cursor: 'not-allowed',
  opacity: 0.6,
}

const AUDIT_NOTICE_STYLE: CSSProperties = {
  fontSize: '11px',
  color: 'var(--fg-subtle)',
  textAlign: 'center',
  lineHeight: 1.5,
}

// ── BrandLogo（36px 渐变方块）────────────────────────────────────────

function BrandLogo({ name }: { name: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: '36px',
          height: '36px',
          borderRadius: '9px',
          background: 'linear-gradient(135deg, var(--accent-default), var(--accent-active))',
          color: 'var(--color-gray-0)',
          fontSize: '15px',
          fontWeight: 900,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {name.charAt(0).toUpperCase()}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span
          data-testid="login-brand-name"
          style={{ fontSize: '18px', fontWeight: 700, color: 'var(--fg-default)', lineHeight: 1 }}
        >
          {name}
        </span>
        <span
          data-testid="login-brand-subtitle"
          style={{ fontSize: '11px', color: 'var(--fg-subtle)', lineHeight: 1 }}
        >
          管理后台
        </span>
      </div>
    </div>
  )
}

// ── LoginForm ─────────────────────────────────────────────────────────

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = sanitizeAdminRedirect(searchParams.get('from'))
  const login = useAuthStore((s) => s.login)
  const brandCtx = useContext(BrandContext)
  const brandName = brandCtx?.brand.name ?? 'Resovo'

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)
    if (!identifier || !password) {
      setServerError('请输入用户名/邮箱与密码')
      return
    }
    setSubmitting(true)
    try {
      const response = await apiClient.post<{ data: { user: User; accessToken: string } }>(
        '/auth/login',
        { identifier, password },
        { skipAuth: true },
      )
      login(response.data.user, response.data.accessToken)
      router.push(callbackUrl)
    } catch (error) {
      setServerError(error instanceof ApiClientError ? error.message : '登录失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={CARD_STYLE} data-testid="login-form">

      {/* Brand row：36px logo + 18px 品牌名 + 11px subtitle（§5.16）*/}
      <BrandLogo name={brandName} />

      {/* 用户名 */}
      <label style={{ display: 'grid', gap: '6px' }}>
        <span style={{ color: 'var(--fg-muted)', fontSize: '13px', fontWeight: 500 }}>
          用户名 / 邮箱
        </span>
        <input
          type="text"
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          disabled={submitting}
          data-testid="login-identifier"
          style={INPUT_STYLE}
        />
      </label>

      {/* 密码 */}
      <label style={{ display: 'grid', gap: '6px' }}>
        <span style={{ color: 'var(--fg-muted)', fontSize: '13px', fontWeight: 500 }}>
          密码
        </span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
          data-testid="login-password"
          style={INPUT_STYLE}
        />
      </label>

      {/* Remember checkbox（§5.16）*/}
      <label
        data-testid="login-remember-label"
        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
      >
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          data-testid="login-remember"
          style={{ width: '14px', height: '14px', accentColor: 'var(--accent-default)' }}
        />
        <span style={{ fontSize: '13px', color: 'var(--fg-muted)' }}>记住我</span>
      </label>

      {/* 错误提示 */}
      {serverError ? (
        <p role="alert" style={{ margin: 0, color: 'var(--state-error-fg)', fontSize: '13px' }}>
          {serverError}
        </p>
      ) : null}

      {/* 主登录按钮 */}
      <button
        type="submit"
        disabled={submitting}
        data-testid="login-submit"
        style={{
          ...SUBMIT_BTN_STYLE,
          cursor: submitting ? 'not-allowed' : 'pointer',
          opacity: submitting ? 0.6 : 1,
        }}
      >
        {submitting ? '登录中…' : '登录'}
      </button>

      {/* 分隔线（§5.16）*/}
      <div style={DIVIDER_STYLE} aria-hidden="true">
        <span style={{ flex: 1, height: '1px', background: 'var(--border-default)' }} />
        <span>或通过 SSO 登录</span>
        <span style={{ flex: 1, height: '1px', background: 'var(--border-default)' }} />
      </div>

      {/* SSO 占位按钮（§5.16，当前未接入 SSO 提供方，disabled 状态）*/}
      <button
        type="button"
        disabled
        data-testid="login-sso-btn"
        aria-label="SSO 单点登录（暂未开放）"
        style={SSO_BTN_STYLE}
      >
        SSO 单点登录（暂未开放）
      </button>

      {/* 审计提示（§5.16）*/}
      <p data-testid="login-audit-notice" style={AUDIT_NOTICE_STYLE}>
        所有登录操作均受监控并记录于审计日志
      </p>

    </form>
  )
}

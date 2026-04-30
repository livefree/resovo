'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiClient, ApiClientError } from '@/lib/api-client'
import { sanitizeAdminRedirect } from '@/lib/safe-redirect'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@resovo/types'

/**
 * server-next LoginForm — admin 登录（ADR-003 / ADR-010）
 *
 * - 登录成功后调 authStore.login(user, accessToken) 写入内存态（refresh_token
 *   cookie 由 apps/api 设置；后续 apiClient 自动注入 Bearer header）
 * - callbackUrl 必须经 sanitizeAdminRedirect 净化（codex P1 修复：
 *   拒绝外部 URL / 协议 URL / `//host` / 非 /admin 前缀，fallback /admin）
 */
export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = sanitizeAdminRedirect(searchParams.get('from'))
  const login = useAuthStore((s) => s.login)

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
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
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'grid',
        gap: 'var(--space-3)',
        width: '320px',
        padding: 'var(--space-5)',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <h1 style={{ margin: 0, fontSize: 'var(--font-size-2xl)' }}>登录</h1>
      <label style={{ display: 'grid', gap: 'var(--space-1)' }}>
        <span style={{ color: 'var(--fg-muted)', fontSize: 'var(--font-size-sm)' }}>用户名 / 邮箱</span>
        <input
          type="text"
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          disabled={submitting}
          style={{
            padding: 'var(--space-2) var(--space-3)',
            background: 'var(--bg-surface-raised)',
            color: 'var(--fg-default)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
          }}
        />
      </label>
      <label style={{ display: 'grid', gap: 'var(--space-1)' }}>
        <span style={{ color: 'var(--fg-muted)', fontSize: 'var(--font-size-sm)' }}>密码</span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
          style={{
            padding: 'var(--space-2) var(--space-3)',
            background: 'var(--bg-surface-raised)',
            color: 'var(--fg-default)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
          }}
        />
      </label>
      {serverError ? (
        <p
          role="alert"
          style={{
            margin: 0,
            color: 'var(--state-error-fg)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          {serverError}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        style={{
          padding: 'var(--space-2) var(--space-3)',
          background: 'var(--accent-default)',
          color: 'var(--accent-fg)',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          cursor: submitting ? 'not-allowed' : 'pointer',
          opacity: submitting ? 0.6 : 1,
        }}
      >
        {submitting ? '登录中…' : '登录'}
      </button>
    </form>
  )
}

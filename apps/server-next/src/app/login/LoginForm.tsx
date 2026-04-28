'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiClient, ApiClientError } from '@/lib/api-client'
import type { User } from '@resovo/types'

/**
 * server-next LoginForm — admin 登录（ADR-003 / ADR-010）
 *
 * 简化策略：
 *   - 不引入 zustand（M-SN-1 仅打通登录 → dashboard 通路；业务页 access token
 *     主动管理留 M-SN-3 业务卡再决定）
 *   - 凭 apiClient credentials: 'include'，浏览器自动接收 refresh_token /
 *     user_role cookie；登录成功后 router.push 即可
 *   - middleware 后续访问 /admin/** 时基于 cookie 鉴权（CHG-SN-1-06 已落）
 */
export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('from') ?? '/admin'

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
      await apiClient.post<{ data: { user: User; accessToken: string } }>('/auth/login', {
        identifier,
        password,
      })
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
            background: 'var(--bg-input)',
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
            background: 'var(--bg-input)',
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

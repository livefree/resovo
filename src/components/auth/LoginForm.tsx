/**
 * LoginForm.tsx — 登录表单（客户端组件）
 * 含实时客户端验证、API 调用、authStore 更新
 */

'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { z } from 'zod'

import { apiClient, ApiClientError } from '@/lib/api-client'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import type { User } from '@/types'

// ── 验证 Schema ────────────────────────────────────────────────────

function useLoginSchema() {
  const t = useTranslations('auth.errors')
  return z.object({
    identifier: z.string().min(1, t('identifierRequired')),
    password: z.string().min(1, t('passwordRequired')),
  })
}

type LoginFields = { identifier: string; password: string }
type FieldErrors = Partial<Record<keyof LoginFields, string>>

// ── 组件 ──────────────────────────────────────────────────────────

export function LoginForm() {
  const t = useTranslations('auth.login')
  const router = useRouter()
  const loginSchema = useLoginSchema()
  const login = useAuthStore((s) => s.login)

  const identifierRef = useRef<HTMLInputElement>(null)
  const [values, setValues] = useState<LoginFields>({ identifier: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function validate(data: LoginFields): boolean {
    const result = loginSchema.safeParse(data)
    if (result.success) {
      setFieldErrors({})
      return true
    }
    const errors: FieldErrors = {}
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof LoginFields
      if (!errors[field]) errors[field] = issue.message
    }
    setFieldErrors(errors)
    return false
  }

  function handleChange(field: keyof LoginFields, value: string) {
    const next = { ...values, [field]: value }
    setValues(next)
    // 实时清除该字段的错误
    if (fieldErrors[field]) {
      const result = loginSchema.shape[field].safeParse(value)
      if (result.success) setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    // Read from DOM — identifier is uncontrolled (ref), password reads DOM fallback
    const form = e.currentTarget as HTMLFormElement
    const domValues: LoginFields = {
      identifier: identifierRef.current?.value ?? '',
      password: (form.querySelector('#login-password') as HTMLInputElement)?.value ?? values.password,
    }
    if (domValues.password !== values.password) {
      setValues((prev) => ({ ...prev, password: domValues.password }))
    }

    if (!validate(domValues)) return

    setIsSubmitting(true)
    try {
      const response = await apiClient.post<{ data: { user: User; accessToken: string } }>(
        '/auth/login',
        domValues,
        { skipAuth: true }
      )
      login(response.data.user, response.data.accessToken)
      router.push('/')
    } catch (error) {
      if (error instanceof ApiClientError) {
        setServerError(error.message)
      } else {
        setServerError('登录失败，请稍后重试')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {serverError && (
        <div
          role="alert"
          data-testid="login-error"
          className={cn(
            'mb-4 rounded-md p-3 text-sm',
            'bg-red-50 text-red-700 border border-red-200',
            'dark:bg-red-950 dark:text-red-400 dark:border-red-900'
          )}
        >
          {serverError}
        </div>
      )}

      {/* Identifier (email or username) */}
      <div className="mb-4">
        <label
          htmlFor="login-identifier"
          className="block text-sm font-medium mb-1"
          style={{ color: 'var(--foreground)' }}
        >
          {t('identifier')}
        </label>
        <input
          ref={identifierRef}
          id="login-identifier"
          type="text"
          autoComplete="username"
          placeholder={t('identifierPlaceholder')}
          defaultValue=""
          aria-invalid={!!fieldErrors.identifier}
          aria-describedby={fieldErrors.identifier ? 'login-identifier-error' : undefined}
          className={cn(
            'w-full rounded-md px-3 py-2 text-sm outline-none transition-colors',
            'border focus:ring-2 focus:ring-[var(--gold)]',
            'bg-[var(--input)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]',
            fieldErrors.identifier
              ? 'border-red-500 focus:ring-red-400'
              : 'border-[var(--border)]'
          )}
        />
        {fieldErrors.identifier && (
          <p id="login-identifier-error" role="alert" className="mt-1 text-xs text-red-500">
            {fieldErrors.identifier}
          </p>
        )}
      </div>

      {/* Password */}
      <div className="mb-6">
        <label
          htmlFor="login-password"
          className="block text-sm font-medium mb-1"
          style={{ color: 'var(--foreground)' }}
        >
          {t('password')}
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          placeholder={t('passwordPlaceholder')}
          value={values.password}
          onChange={(e) => handleChange('password', e.target.value)}
          aria-invalid={!!fieldErrors.password}
          aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
          className={cn(
            'w-full rounded-md px-3 py-2 text-sm outline-none transition-colors',
            'border focus:ring-2 focus:ring-[var(--gold)]',
            'bg-[var(--input)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]',
            fieldErrors.password
              ? 'border-red-500 focus:ring-red-400'
              : 'border-[var(--border)]'
          )}
        />
        {fieldErrors.password && (
          <p id="login-password-error" role="alert" className="mt-1 text-xs text-red-500">
            {fieldErrors.password}
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        data-testid="login-submit"
        className={cn(
          'w-full rounded-md py-2 text-sm font-semibold transition-opacity',
          'bg-[var(--gold)] text-black',
          isSubmitting ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'
        )}
      >
        {isSubmitting ? t('submitting') : t('submit')}
      </button>
    </form>
  )
}

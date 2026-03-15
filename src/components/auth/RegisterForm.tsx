/**
 * RegisterForm.tsx — 注册表单（客户端组件）
 * 含实时客户端验证、API 调用、authStore 更新
 */

'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { z } from 'zod'

import { apiClient, ApiClientError } from '@/lib/api-client'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import type { User } from '@/types'

// ── 验证 Schema ────────────────────────────────────────────────────

function useRegisterSchema() {
  const t = useTranslations('auth.errors')
  return z.object({
    username: z
      .string()
      .min(1, t('usernameRequired'))
      .min(3, t('usernameMin'))
      .max(20, t('usernameMax'))
      .regex(/^[a-zA-Z0-9_]+$/, t('usernamePattern')),
    email: z.string().min(1, t('emailRequired')).email(t('emailInvalid')),
    password: z.string().min(1, t('passwordRequired')).min(8, t('passwordMin')),
  })
}

type RegisterFields = { username: string; email: string; password: string }
type FieldErrors = Partial<Record<keyof RegisterFields, string>>

// ── 组件 ──────────────────────────────────────────────────────────

export function RegisterForm() {
  const t = useTranslations('auth.register')
  const router = useRouter()
  const registerSchema = useRegisterSchema()
  const login = useAuthStore((s) => s.login)

  const [values, setValues] = useState<RegisterFields>({
    username: '',
    email: '',
    password: '',
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function validate(data: RegisterFields): boolean {
    const result = registerSchema.safeParse(data)
    if (result.success) {
      setFieldErrors({})
      return true
    }
    const errors: FieldErrors = {}
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof RegisterFields
      if (!errors[field]) errors[field] = issue.message
    }
    setFieldErrors(errors)
    return false
  }

  function handleChange(field: keyof RegisterFields, value: string) {
    const next = { ...values, [field]: value }
    setValues(next)
    if (fieldErrors[field]) {
      const result = registerSchema.shape[field].safeParse(value)
      if (result.success) setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    if (!validate(values)) return

    setIsSubmitting(true)
    try {
      const response = await apiClient.post<{ data: { user: User; accessToken: string } }>(
        '/auth/register',
        values,
        { skipAuth: true }
      )
      login(response.data.user, response.data.accessToken)
      router.push('/')
    } catch (error) {
      if (error instanceof ApiClientError) {
        setServerError(error.message)
      } else {
        setServerError('注册失败，请稍后重试')
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
          data-testid="register-error"
          className={cn(
            'mb-4 rounded-md p-3 text-sm',
            'bg-red-50 text-red-700 border border-red-200',
            'dark:bg-red-950 dark:text-red-400 dark:border-red-900'
          )}
        >
          {serverError}
        </div>
      )}

      {/* Username */}
      <div className="mb-4">
        <label
          htmlFor="register-username"
          className="block text-sm font-medium mb-1"
          style={{ color: 'var(--foreground)' }}
        >
          {t('username')}
        </label>
        <input
          id="register-username"
          type="text"
          autoComplete="username"
          placeholder={t('usernamePlaceholder')}
          value={values.username}
          onChange={(e) => handleChange('username', e.target.value)}
          aria-invalid={!!fieldErrors.username}
          aria-describedby={fieldErrors.username ? 'register-username-error' : undefined}
          className={cn(
            'w-full rounded-md px-3 py-2 text-sm outline-none transition-colors',
            'border focus:ring-2 focus:ring-[var(--gold)]',
            'bg-[var(--input)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]',
            fieldErrors.username
              ? 'border-red-500 focus:ring-red-400'
              : 'border-[var(--border)]'
          )}
        />
        {fieldErrors.username && (
          <p id="register-username-error" role="alert" className="mt-1 text-xs text-red-500">
            {fieldErrors.username}
          </p>
        )}
      </div>

      {/* Email */}
      <div className="mb-4">
        <label
          htmlFor="register-email"
          className="block text-sm font-medium mb-1"
          style={{ color: 'var(--foreground)' }}
        >
          {t('email')}
        </label>
        <input
          id="register-email"
          type="email"
          autoComplete="email"
          placeholder={t('emailPlaceholder')}
          value={values.email}
          onChange={(e) => handleChange('email', e.target.value)}
          aria-invalid={!!fieldErrors.email}
          aria-describedby={fieldErrors.email ? 'register-email-error' : undefined}
          className={cn(
            'w-full rounded-md px-3 py-2 text-sm outline-none transition-colors',
            'border focus:ring-2 focus:ring-[var(--gold)]',
            'bg-[var(--input)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]',
            fieldErrors.email
              ? 'border-red-500 focus:ring-red-400'
              : 'border-[var(--border)]'
          )}
        />
        {fieldErrors.email && (
          <p id="register-email-error" role="alert" className="mt-1 text-xs text-red-500">
            {fieldErrors.email}
          </p>
        )}
      </div>

      {/* Password */}
      <div className="mb-6">
        <label
          htmlFor="register-password"
          className="block text-sm font-medium mb-1"
          style={{ color: 'var(--foreground)' }}
        >
          {t('password')}
        </label>
        <input
          id="register-password"
          type="password"
          autoComplete="new-password"
          placeholder={t('passwordPlaceholder')}
          value={values.password}
          onChange={(e) => handleChange('password', e.target.value)}
          aria-invalid={!!fieldErrors.password}
          aria-describedby={fieldErrors.password ? 'register-password-error' : undefined}
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
          <p id="register-password-error" role="alert" className="mt-1 text-xs text-red-500">
            {fieldErrors.password}
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        data-testid="register-submit"
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

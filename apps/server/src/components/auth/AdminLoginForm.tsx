'use client'

import { useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { z } from 'zod'
import { apiClient, ApiClientError } from '@/lib/api-client'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import type { User } from '@resovo/types'

const loginSchema = z.object({
  identifier: z.string().min(1, '请输入邮箱或用户名'),
  password: z.string().min(1, '请输入密码'),
})

type LoginFields = { identifier: string; password: string }
type FieldErrors = Partial<Record<keyof LoginFields, string>>

export function AdminLoginForm() {
  const router = useRouter()
  const login = useAuthStore((s) => s.login)
  const searchParams = useSearchParams()
  const identifierRef = useRef<HTMLInputElement>(null)
  const [values, setValues] = useState<LoginFields>({ identifier: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDevSubmitting, setIsDevSubmitting] = useState(false)
  const enableDevLogin = process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === 'true'
  const devLoginSecret = process.env.NEXT_PUBLIC_DEV_LOGIN_SECRET

  function validate(data: LoginFields): boolean {
    const result = loginSchema.safeParse(data)
    if (result.success) { setFieldErrors({}); return true }
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
    if (fieldErrors[field]) {
      const result = loginSchema.shape[field].safeParse(value)
      if (result.success) setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)
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
        '/auth/login', domValues, { skipAuth: true }
      )
      login(response.data.user, response.data.accessToken)
      router.push(searchParams.get('callbackUrl') ?? '/admin')
    } catch (error) {
      setServerError(error instanceof ApiClientError ? error.message : '登录失败，请稍后重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDevLogin() {
    if (!enableDevLogin) return
    setServerError(null)
    setIsDevSubmitting(true)
    try {
      const response = await apiClient.post<{ data: { user: User; accessToken: string } }>(
        '/auth/dev-login', {},
        { skipAuth: true, headers: devLoginSecret ? { 'X-Dev-Auth': devLoginSecret } : {} }
      )
      login(response.data.user, response.data.accessToken)
      router.push(searchParams.get('callbackUrl') ?? '/admin')
    } catch (error) {
      setServerError(error instanceof ApiClientError ? error.message : '开发快捷登录失败')
    } finally {
      setIsDevSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {serverError && (
        <div role="alert" data-testid="login-error"
          className="mb-4 rounded-md p-3 text-sm bg-red-50 text-red-700 border border-red-200">
          {serverError}
        </div>
      )}

      <div className="mb-4">
        <label htmlFor="login-identifier" className="block text-sm font-medium mb-1"
          style={{ color: 'var(--foreground)' }}>
          邮箱或用户名
        </label>
        <input ref={identifierRef} id="login-identifier" type="text" autoComplete="username"
          placeholder="输入邮箱或用户名" defaultValue=""
          aria-invalid={!!fieldErrors.identifier}
          className={cn(
            'w-full rounded-md px-3 py-2 text-sm outline-none transition-colors',
            'border focus:ring-2 focus:ring-[var(--accent)]',
            'bg-[var(--input)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]',
            fieldErrors.identifier ? 'border-red-500' : 'border-[var(--border)]'
          )} />
        {fieldErrors.identifier && (
          <p role="alert" className="mt-1 text-xs text-red-500">{fieldErrors.identifier}</p>
        )}
      </div>

      <div className="mb-6">
        <label htmlFor="login-password" className="block text-sm font-medium mb-1"
          style={{ color: 'var(--foreground)' }}>
          密码
        </label>
        <input id="login-password" type="password" autoComplete="current-password"
          placeholder="输入密码" value={values.password}
          onChange={(e) => handleChange('password', e.target.value)}
          aria-invalid={!!fieldErrors.password}
          className={cn(
            'w-full rounded-md px-3 py-2 text-sm outline-none transition-colors',
            'border focus:ring-2 focus:ring-[var(--accent)]',
            'bg-[var(--input)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]',
            fieldErrors.password ? 'border-red-500' : 'border-[var(--border)]'
          )} />
        {fieldErrors.password && (
          <p role="alert" className="mt-1 text-xs text-red-500">{fieldErrors.password}</p>
        )}
      </div>

      <button type="submit" disabled={isSubmitting} data-testid="login-submit"
        className={cn(
          'w-full rounded-md py-2 text-sm font-semibold transition-opacity',
          'bg-[var(--accent)] text-black',
          isSubmitting ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'
        )}>
        {isSubmitting ? '登录中…' : '登录'}
      </button>

      {enableDevLogin && (
        <button type="button" disabled={isDevSubmitting} onClick={handleDevLogin}
          data-testid="dev-login-submit"
          className={cn(
            'mt-3 w-full rounded-md py-2 text-sm font-medium transition-opacity',
            'border border-[var(--border)] text-[var(--text)] bg-[var(--bg2)]',
            isDevSubmitting ? 'opacity-60 cursor-not-allowed' : 'hover:bg-[var(--bg3)]'
          )}>
          {isDevSubmitting ? '开发登录中…' : '开发快速登录（仅本地）'}
        </button>
      )}
    </form>
  )
}

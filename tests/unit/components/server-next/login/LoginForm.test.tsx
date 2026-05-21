/**
 * LoginForm.test.tsx — 登录表单单元测试（CHG-SN-7-MISC-LOGIN-1）
 *
 * 覆盖：
 *   1. 渲染不崩溃 + 核心 testid 存在
 *   2. Brand row 元素存在
 *   3. remember checkbox 渲染
 *   4. SSO 占位按钮 disabled 状态
 *   5. 审计提示文案渲染
 *   6. 空表单提交 → serverError 提示
 *   7. 登录成功 → apiClient.post 被调用
 *   8. 登录失败 → error 文案渲染
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

// ── mock next/navigation ──────────────────────────────────────────────

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: () => null }),
}))

// ── mock safe-redirect ────────────────────────────────────────────────

vi.mock('../../../../../apps/server-next/src/lib/safe-redirect', () => ({
  sanitizeAdminRedirect: (v: unknown) => (v as string) ?? '/admin',
}))

// ── mock apiClient ────────────────────────────────────────────────────

const postMock = vi.fn()
vi.mock('../../../../../apps/server-next/src/lib/api-client', () => ({
  apiClient: {
    post: (...args: unknown[]) => postMock(...args),
  },
  ApiClientError: class ApiClientError extends Error {
    constructor(msg: string) { super(msg) }
  },
}))

// ── mock authStore ────────────────────────────────────────────────────

const loginMock = vi.fn()
vi.mock('../../../../../apps/server-next/src/stores/authStore', () => ({
  useAuthStore: (sel: (s: { login: typeof loginMock }) => unknown) => sel({ login: loginMock }),
}))

// ── mock BrandContext ─────────────────────────────────────────────────

vi.mock('../../../../../apps/server-next/src/contexts/BrandProvider', () => ({
  BrandContext: {
    _currentValue: { brand: { name: 'Resovo', slug: 'resovo' } },
    Consumer: ({ children }: { children: (v: unknown) => unknown }) =>
      children({ brand: { name: 'Resovo', slug: 'resovo' } }),
    Provider: ({ children }: { children: unknown }) => children,
  },
}))

import { LoginForm } from '../../../../../apps/server-next/src/app/login/LoginForm'

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('LoginForm — 结构渲染', () => {
  it('渲染不崩溃，核心 testid 均存在', () => {
    render(<LoginForm />)
    expect(screen.getByTestId('login-form')).not.toBeNull()
    expect(screen.getByTestId('login-identifier')).not.toBeNull()
    expect(screen.getByTestId('login-password')).not.toBeNull()
    expect(screen.getByTestId('login-submit')).not.toBeNull()
  })

  it('Brand row：品牌名渲染', () => {
    render(<LoginForm />)
    expect(screen.getByTestId('login-brand-name')).not.toBeNull()
    expect(screen.getByTestId('login-brand-subtitle').textContent).toContain('管理后台')
  })

  it('remember checkbox 渲染（label 含"记住我"）', () => {
    render(<LoginForm />)
    expect(screen.getByTestId('login-remember')).not.toBeNull()
    expect(screen.getByTestId('login-remember-label').textContent).toContain('记住我')
  })

  it('SSO 占位按钮以 disabled 状态渲染', () => {
    render(<LoginForm />)
    const ssoBtn = screen.getByTestId('login-sso-btn')
    expect(ssoBtn).not.toBeNull()
    expect((ssoBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it('审计提示文案渲染', () => {
    render(<LoginForm />)
    const notice = screen.getByTestId('login-audit-notice')
    expect(notice.textContent).toContain('审计日志')
  })
})

describe('LoginForm — 表单交互', () => {
  it('空表单提交 → 渲染 serverError 提示', async () => {
    render(<LoginForm />)
    fireEvent.click(screen.getByTestId('login-submit'))
    await waitFor(() => {
      const alert = screen.queryByRole('alert')
      expect(alert).not.toBeNull()
      expect(alert?.textContent).toContain('请输入')
    })
  })

  it('填写表单提交 → apiClient.post 被调用', async () => {
    postMock.mockResolvedValueOnce({ data: { user: { id: 'u1' }, accessToken: 'tok' } })
    render(<LoginForm />)
    fireEvent.change(screen.getByTestId('login-identifier'), { target: { value: 'admin' } })
    fireEvent.change(screen.getByTestId('login-password'), { target: { value: 'pass' } })
    fireEvent.click(screen.getByTestId('login-submit'))
    await waitFor(() => expect(postMock).toHaveBeenCalled())
    expect(loginMock).toHaveBeenCalled()
  })

  it('登录失败 → error 文案渲染', async () => {
    const { ApiClientError } = await import('../../../../../apps/server-next/src/lib/api-client')
    postMock.mockRejectedValueOnce(new ApiClientError('凭据无效'))
    render(<LoginForm />)
    fireEvent.change(screen.getByTestId('login-identifier'), { target: { value: 'admin' } })
    fireEvent.change(screen.getByTestId('login-password'), { target: { value: 'bad' } })
    fireEvent.click(screen.getByTestId('login-submit'))
    await waitFor(() => {
      const alert = screen.queryByRole('alert')
      expect(alert?.textContent).toContain('凭据无效')
    })
  })
})

/**
 * tests/unit/components/admin/banners/BannerForm.test.tsx
 * M5-CLEANUP-03: BannerForm 表单提交、校验、时间窗交互
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BannerForm } from '@/components/admin/banners/BannerForm'
import type { Banner } from '@resovo/types'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const postMock = vi.fn()
const putMock  = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: (...args: unknown[]) => postMock(...args),
    put:  (...args: unknown[]) => putMock(...args),
  },
}))

const pushMock    = vi.fn()
const refreshMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}))

vi.mock('@/components/admin/shared/toast/useAdminToast', () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/components/admin/shared/form/AdminInput', () => ({
  AdminInput: ({
    value, onChange, type, placeholder, 'data-testid': testId,
  }: {
    value: string
    onChange: (v: string) => void
    type?: string
    placeholder?: string
    'data-testid'?: string
  }) => (
    <input
      data-testid={testId}
      type={type ?? 'text'}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}))

vi.mock('@/components/admin/shared/form/AdminSelect', () => ({
  AdminSelect: ({
    value, onChange, options, 'data-testid': testId,
  }: {
    value: string
    onChange: (v: string) => void
    options: Array<{ value: string; label: string }>
    'data-testid'?: string
  }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid={testId ?? `select-${value}`}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
}))

vi.mock('@/components/admin/shared/form/AdminFormField', () => ({
  AdminFormField: ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label>{label}</label>
      {children}
    </div>
  ),
}))

vi.mock('@/components/admin/shared/form/AdminFormActions', () => ({
  AdminFormActions: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/admin/shared/button/AdminButton', () => ({
  AdminButton: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}))

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeBanner(overrides?: Partial<Banner>): Banner {
  return {
    id: 'ban-001',
    title: { 'zh-CN': '测试Banner', en: 'Test Banner' },
    imageUrl: 'https://cdn.example.com/banner.jpg',
    linkType: 'video',
    linkTarget: 'feat0001',
    sortOrder: 0,
    isActive: true,
    brandScope: 'all-brands',
    brandSlug: null,
    activeFrom: null,
    activeTo: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('BannerForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    postMock.mockResolvedValue({})
    putMock.mockResolvedValue({})
  })

  it('新建模式：渲染 data-testid="banner-form"', () => {
    render(<BannerForm />)
    expect(screen.getByTestId('banner-form')).toBeTruthy()
  })

  it('新建模式：图片地址为空时提交不调用 API', async () => {
    const { notify } = await import('@/components/admin/shared/toast/useAdminToast')
    render(<BannerForm />)
    fireEvent.submit(screen.getByTestId('banner-form'))
    await waitFor(() => {
      expect(notify.error).toHaveBeenCalledWith('图片地址不能为空')
    })
    expect(postMock).not.toHaveBeenCalled()
  })

  it('新建模式：填写必填字段后提交调用 POST /admin/banners', async () => {
    const { container } = render(<BannerForm />)
    // Fill imageUrl — first text input in the form
    const textInputs = container.querySelectorAll('input[type="text"]')
    fireEvent.change(textInputs[2], { target: { value: 'https://cdn.example.com/new.jpg' } })
    // Fill linkTarget — 4th text input
    fireEvent.change(textInputs[3], { target: { value: 'feat0001' } })
    fireEvent.submit(screen.getByTestId('banner-form'))
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        '/admin/banners',
        expect.objectContaining({ imageUrl: 'https://cdn.example.com/new.jpg', linkTarget: 'feat0001' }),
      )
    })
  })

  it('编辑模式：预填数据正确显示', () => {
    const banner = makeBanner()
    render(<BannerForm initial={banner} />)
    // imageUrl input should show the initial value
    const imageInput = screen.getByDisplayValue('https://cdn.example.com/banner.jpg')
    expect(imageInput).toBeTruthy()
  })

  it('编辑模式：提交调用 PUT /admin/banners/:id', async () => {
    const banner = makeBanner()
    render(<BannerForm initial={banner} />)
    fireEvent.submit(screen.getByTestId('banner-form'))
    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith(
        '/admin/banners/ban-001',
        expect.objectContaining({ imageUrl: 'https://cdn.example.com/banner.jpg' }),
      )
    })
  })

  it('时间窗：填写生效开始/结束时间后包含在 payload 中', async () => {
    const { container } = render(<BannerForm />)
    const textInputs = container.querySelectorAll('input[type="text"]')
    // Fill imageUrl + linkTarget
    fireEvent.change(textInputs[2], { target: { value: 'https://cdn.example.com/new.jpg' } })
    fireEvent.change(textInputs[3], { target: { value: 'feat0001' } })
    // Fill activeFrom datetime-local
    const dateTimeInputs = container.querySelectorAll('input[type="datetime-local"]')
    expect(dateTimeInputs.length).toBeGreaterThan(0)
    fireEvent.change(dateTimeInputs[0], { target: { value: '2026-05-01T00:00' } })
    fireEvent.submit(screen.getByTestId('banner-form'))
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        '/admin/banners',
        expect.objectContaining({ activeFrom: new Date('2026-05-01T00:00').toISOString() }),
      )
    })
  })

  it('外部链接类型：切换后 linkTarget placeholder 变为 URL 提示', async () => {
    const { container } = render(<BannerForm />)
    // Get the first select (linkType); initial value is "video"
    const selects = container.querySelectorAll('select')
    expect(selects.length).toBeGreaterThan(0)
    fireEvent.change(selects[0], { target: { value: 'external' } })
    await waitFor(() => {
      const textInputs = container.querySelectorAll('input[type="text"]')
      // linkTarget input's placeholder should change to the external URL hint
      const hasExternalHint = Array.from(textInputs).some(
        (el) => el.getAttribute('placeholder') === 'https://example.com',
      )
      expect(hasExternalHint).toBe(true)
    })
  })
})

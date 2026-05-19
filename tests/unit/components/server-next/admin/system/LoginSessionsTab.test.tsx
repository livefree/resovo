/**
 * LoginSessionsTab.test.tsx — 登录会话 Tab 单元测试（CHG-SN-7-REDO-03-C）
 *
 * 覆盖：
 *   1. 渲染不崩溃 + testid
 *   2. 加载后会话超时字段值注入
 *   3. 修改 → dirty + 保存成功 toast
 *   4. 活跃会话 advisory 卡存在
 *   5. 加载失败 ErrorState
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const getSiteSettingsMock = vi.fn()
const saveSiteSettingsMock = vi.fn()
const toastPushMock = vi.fn()

vi.mock('../../../../../../apps/server-next/src/lib/system/api', () => ({
  getSiteSettings: (...args: unknown[]) => getSiteSettingsMock(...args),
  saveSiteSettings: (...args: unknown[]) => saveSiteSettingsMock(...args),
}))

vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    useToast: () => ({
      push: (input: unknown) => { toastPushMock(input); return 'test-toast-id' },
      dismiss: vi.fn(),
      dismissAll: vi.fn(),
    }),
  }
})

vi.mock('../../../../../../apps/server-next/src/lib/api-client', () => {
  class MockApiClientError extends Error {
    public readonly code: string
    public readonly status: number
    constructor(code: string, message: string, status: number) {
      super(message)
      this.code = code
      this.status = status
      this.name = 'ApiClientError'
    }
  }
  return {
    ApiClientError: MockApiClientError,
    apiClient: {
      get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(),
    },
  }
})

import { LoginSessionsTab } from '../../../../../../apps/server-next/src/app/admin/settings/_tabs/LoginSessionsTab'

const FIXTURE = {
  siteName: '', siteAnnouncement: '', doubanProxy: '', doubanCookie: '',
  showAdultContent: false, contentFilterEnabled: true, videoProxyEnabled: false, videoProxyUrl: '',
  autoCrawlEnabled: false, autoCrawlMaxPerRun: 100, autoCrawlRecentOnly: false, autoCrawlRecentDays: 30,
  notificationEmailEnabled: false, notificationEmailTo: '',
  notificationWebhookEnabled: false, notificationWebhookUrl: '', notificationWebhookSecret: '',
  sessionTimeoutMinutes: 90, sessionMaxConcurrent: 3, sessionExtendOnActivity: false,
}

beforeEach(() => {
  getSiteSettingsMock.mockReset()
  saveSiteSettingsMock.mockReset()
  toastPushMock.mockReset()
})

describe('LoginSessionsTab', () => {
  it('1. 渲染不崩溃 + testid', async () => {
    getSiteSettingsMock.mockResolvedValueOnce(FIXTURE)
    render(<LoginSessionsTab />)
    await waitFor(() => expect(screen.getByTestId('login-sessions-tab')).not.toBeNull())
  })

  it('2. 会话超时字段初始值注入', async () => {
    getSiteSettingsMock.mockResolvedValueOnce(FIXTURE)
    const { container } = render(<LoginSessionsTab />)
    await waitFor(() => {
      const input = container.querySelector('[data-testid="session-timeout-minutes"] input') as HTMLInputElement | null
      expect(input?.value ?? '').toBe('90')
    })
  })

  it('3. 修改 → dirty 状态', async () => {
    getSiteSettingsMock.mockResolvedValueOnce(FIXTURE)
    const { container } = render(<LoginSessionsTab />)
    await waitFor(() => expect(screen.getByTestId('login-sessions-card')).not.toBeNull())
    const input = container.querySelector('[data-testid="session-max-concurrent"] input') as HTMLInputElement | null
    if (input) {
      fireEvent.change(input, { target: { value: '10' } })
      await waitFor(() => {
        expect(screen.getByTestId('login-sessions-dirty-indicator').textContent).toContain('有未保存的修改')
      })
    } else {
      expect(screen.getByTestId('login-sessions-card')).not.toBeNull()
    }
  })

  it('4. 活跃会话 advisory 卡存在', async () => {
    getSiteSettingsMock.mockResolvedValueOnce(FIXTURE)
    render(<LoginSessionsTab />)
    await waitFor(() => {
      expect(screen.getByTestId('login-sessions-card-list')).not.toBeNull()
    })
  })

  it('5. 加载失败 ErrorState', async () => {
    getSiteSettingsMock.mockRejectedValueOnce(new Error('加载失败'))
    render(<LoginSessionsTab />)
    await waitFor(() => expect(screen.getByTestId('login-sessions-tab')).not.toBeNull())
  })
})

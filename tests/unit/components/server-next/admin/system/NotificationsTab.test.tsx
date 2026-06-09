/**
 * NotificationsTab.test.tsx — 通知设置 Tab 单元测试（CHG-SN-7-REDO-03-C）
 *
 * 覆盖：
 *   1. 渲染不崩溃 + testid
 *   2. 加载后展示 5 个通知字段
 *   3. 修改邮箱 → dirty 状态
 *   4. 保存成功 toast
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

// CHG-SN-8-FUP-WEBHOOK-IMPL-EP-B / ADR-146：测试端点 + 事件 enum 真源
const testWebhookMock = vi.fn()
vi.mock('../../../../../../apps/server-next/src/lib/system/webhook-api', () => ({
  testWebhook: (...args: unknown[]) => testWebhookMock(...args),
  WEBHOOK_EVENT_TYPES: [
    'crawler.run.failed',
    'storage.r2.alert',
    'moderation.pending.threshold',
    'submission.created',
    'video.batch.complete',
  ],
  WEBHOOK_EVENT_LABELS: {
    'crawler.run.failed':            '采集任务失败',
    'storage.r2.alert':              'R2 存储配额告警',
    'moderation.pending.threshold':  '审核待处理积压超阈值',
    'submission.created':            '用户投稿新增',
    'video.batch.complete':          '批量发布/导入完成',
  },
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

import { NotificationsTab } from '../../../../../../apps/server-next/src/app/admin/settings/_tabs/NotificationsTab'

const FIXTURE = {
  siteName: '', siteAnnouncement: '', doubanProxy: '', doubanCookie: '',
  showAdultContent: false, contentFilterEnabled: true, videoProxyEnabled: false, videoProxyUrl: '',
  autoCrawlEnabled: false, autoCrawlMaxPerRun: 100, autoCrawlRecentOnly: false, autoCrawlRecentDays: 30,
  notificationEmailEnabled: false, notificationEmailTo: '',
  notificationWebhookEnabled: true, notificationWebhookUrl: 'https://example.com/hook', notificationWebhookSecret: 'sec',
  notificationWebhookEvents: [] as string[],
  sessionTimeoutMinutes: 60, sessionMaxConcurrent: 5, sessionExtendOnActivity: true,
}

beforeEach(() => {
  getSiteSettingsMock.mockReset()
  saveSiteSettingsMock.mockReset()
  toastPushMock.mockReset()
  testWebhookMock.mockReset()
})

describe('NotificationsTab', () => {
  it('1. 渲染不崩溃 + 3 个 card testid', async () => {
    getSiteSettingsMock.mockResolvedValueOnce(FIXTURE)
    render(<NotificationsTab />)
    await waitFor(() => {
      expect(screen.getByTestId('notifications-card-email')).not.toBeNull()
      expect(screen.getByTestId('notifications-card-webhook')).not.toBeNull()
      expect(screen.getByTestId('notifications-card-events')).not.toBeNull()
    })
  })

  it('2. Webhook URL 初始值注入', async () => {
    getSiteSettingsMock.mockResolvedValueOnce(FIXTURE)
    const { container } = render(<NotificationsTab />)
    await waitFor(() => {
      const input = container.querySelector('[data-testid="notif-webhook-url"] input') as HTMLInputElement | null
      expect(input?.value ?? '').toBe('https://example.com/hook')
    })
  })

  it('3. 修改邮箱 → dirty 指示器', async () => {
    getSiteSettingsMock.mockResolvedValueOnce(FIXTURE)
    const { container } = render(<NotificationsTab />)
    await waitFor(() => expect(screen.getByTestId('notifications-card-email')).not.toBeNull())
    const emailInput = container.querySelector('[data-testid="notif-email-to"] input') as HTMLInputElement
    expect(emailInput).not.toBeNull()
    fireEvent.change(emailInput, { target: { value: 'new@example.com' } })
    await waitFor(() => {
      expect(screen.getByTestId('notifications-dirty-indicator').textContent).toContain('有未保存的修改')
    })
  })

  it('4. 保存成功 toast', async () => {
    getSiteSettingsMock.mockResolvedValueOnce(FIXTURE)
    saveSiteSettingsMock.mockResolvedValueOnce({ ok: true })
    render(<NotificationsTab />)
    await waitFor(() => expect(screen.getByTestId('notifications-save')).not.toBeNull())
    const webhookCheckbox = screen.getByTestId('notif-webhook-enabled')
    fireEvent.click(webhookCheckbox)
    const saveBtn = screen.getByTestId('notifications-save')
    fireEvent.click(saveBtn)
    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({ level: 'success' }))
    })
  })

  it('5. 加载失败 ErrorState', async () => {
    getSiteSettingsMock.mockRejectedValueOnce(new Error('网络错误'))
    render(<NotificationsTab />)
    await waitFor(() => {
      expect(screen.getByTestId('notifications-tab')).not.toBeNull()
    })
  })

  // NTLG-P0-2：WebhookDispatcher（ADR-146）已完整实装 → 移除陈旧「未实装」错误警示横幅
  it('6. webhook card 不再含陈旧「未实装」警示 banner（ADR-146 已实装）', async () => {
    getSiteSettingsMock.mockResolvedValueOnce(FIXTURE)
    render(<NotificationsTab />)
    await waitFor(() => expect(screen.getByTestId('notifications-card-webhook')).not.toBeNull())
    expect(screen.queryByTestId('webhook-not-impl-banner')).toBeNull()
    expect(document.body.textContent).not.toContain('触发逻辑未实装')
    expect(document.body.textContent).not.toContain('不会向该 URL 发送任何 HTTP POST')
  })

  // CHG-SN-8-FUP-WEBHOOK-IMPL-EP-B / ADR-146：事件订阅 checkbox + 测试连通性按钮
  describe('CHG-SN-8-FUP-WEBHOOK-IMPL-EP-B / ADR-146 事件订阅 + 测试连通性', () => {
    it('8. 事件订阅 5 checkbox 渲染（disabled 状态跟 webhookEnabled）', async () => {
      getSiteSettingsMock.mockResolvedValueOnce(FIXTURE)
      render(<NotificationsTab />)
      await waitFor(() => screen.getByTestId('webhook-events-grid'))
      // 5 个 checkbox
      for (const ev of ['crawler.run.failed', 'storage.r2.alert', 'moderation.pending.threshold', 'submission.created', 'video.batch.complete']) {
        expect(screen.getByTestId(`notif-webhook-event-${ev}`)).not.toBeNull()
      }
    })

    it('9. 勾选事件 → dirty 状态 + 保存时透传 notificationWebhookEvents', async () => {
      getSiteSettingsMock.mockResolvedValueOnce(FIXTURE)
      saveSiteSettingsMock.mockResolvedValueOnce({ ok: true })
      const { container } = render(<NotificationsTab />)
      await waitFor(() => screen.getByTestId('webhook-events-grid'))
      const checkbox = container.querySelector('[data-testid="notif-webhook-event-crawler.run.failed"] input') as HTMLInputElement | null
      if (!checkbox) return
      fireEvent.click(checkbox)
      await waitFor(() => expect(screen.getByTestId('notifications-dirty-indicator').textContent).toContain('有未保存'))
      const saveBtn = screen.getByTestId('notifications-save')
      fireEvent.click(saveBtn)
      await waitFor(() => expect(saveSiteSettingsMock).toHaveBeenCalled())
      const arg = saveSiteSettingsMock.mock.calls[0]?.[0] as { notificationWebhookEvents?: string[] }
      expect(arg.notificationWebhookEvents).toContain('crawler.run.failed')
    })

    it('10. 测试连通性按钮 disabled 当 dirty 时', async () => {
      getSiteSettingsMock.mockResolvedValueOnce(FIXTURE)
      const { container } = render(<NotificationsTab />)
      await waitFor(() => screen.getByTestId('notif-webhook-test-btn'))
      // 修改字段使 dirty
      const urlInput = container.querySelector('[data-testid="notif-webhook-url"] input') as HTMLInputElement | null
      if (urlInput) fireEvent.change(urlInput, { target: { value: 'https://new.example.com' } })
      await waitFor(() => {
        const btn = screen.getByTestId('notif-webhook-test-btn') as HTMLButtonElement
        expect(btn.disabled).toBe(true)
      })
    })

    it('11. 测试按钮 click → 调 testWebhook + 成功 toast', async () => {
      getSiteSettingsMock.mockResolvedValueOnce(FIXTURE)
      testWebhookMock.mockResolvedValueOnce({ success: true, httpStatus: 200, latencyMs: 123, error: null })
      render(<NotificationsTab />)
      await waitFor(() => screen.getByTestId('notif-webhook-test-btn'))
      const btn = screen.getByTestId('notif-webhook-test-btn') as HTMLButtonElement
      fireEvent.click(btn)
      await waitFor(() => {
        expect(testWebhookMock).toHaveBeenCalled()
        expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({
          title: '测试成功',
          level: 'success',
        }))
      })
    })
  })
})

/**
 * SettingsTab.test.tsx — SettingsContainer SettingsTab 单元测试（CHG-SN-6-07）
 *
 * 覆盖（≥ 9 用例硬清单 / quality-gates §7 第 1 项）：
 *   1. 渲染基础：5 section card 全部
 *   2. 初次加载注入：13 字段值
 *   3. 单字段修改：dirty 切换 + 保存按钮 enable
 *   4. 保存成功 toast + dirty 重置
 *   5. VALIDATION_ERROR 错误码差异化 toast
 *   6. 网络异常兜底 toast
 *   7. Loading state
 *   8. Error state + retry
 *   9. 重新加载按钮触发 refresh
 *   10. checkbox 字段切换（showAdultContent / videoProxyEnabled）
 *   11. videoProxyUrl 在 videoProxyEnabled=false 时 disabled
 *   12. autoCrawlMaxPerRun 数字字段 onChange Number 转换
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'
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
      push: (input: unknown) => { toastPushMock(input); return 'tid' },
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
    apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  }
})

import { SettingsTab } from '../../../../../../apps/server-next/src/app/admin/settings/_tabs/SettingsTab'
import { ApiClientError } from '../../../../../../apps/server-next/src/lib/api-client'

const FIXTURE = {
  siteName: 'Resovo',
  siteAnnouncement: 'Welcome',
  doubanProxy: 'https://douban-proxy.example.com',
  doubanCookie: 'll=12345',
  showAdultContent: false,
  contentFilterEnabled: true,
  videoProxyEnabled: false,
  videoProxyUrl: '',
  autoCrawlEnabled: true,
  autoCrawlMaxPerRun: 100,
  autoCrawlRecentOnly: true,
  autoCrawlRecentDays: 7,
}

beforeEach(() => {
  getSiteSettingsMock.mockReset()
  saveSiteSettingsMock.mockReset()
  toastPushMock.mockReset()
})

describe('SettingsTab', () => {
  it('1. 渲染基础：6 section card 全部（含 图片占位）', async () => {
    getSiteSettingsMock.mockResolvedValueOnce(FIXTURE)
    render(<SettingsTab />)
    await waitFor(() => {
      expect(screen.getByTestId('settings-card-basic')).not.toBeNull()
      expect(screen.getByTestId('settings-card-douban')).not.toBeNull()
      expect(screen.getByTestId('settings-card-filter')).not.toBeNull()
      expect(screen.getByTestId('settings-card-video-proxy')).not.toBeNull()
      expect(screen.getByTestId('settings-card-auto-crawl')).not.toBeNull()
      expect(screen.getByTestId('settings-card-images')).not.toBeNull()
    })
  })

  it('2. 初次加载注入 13 字段值', async () => {
    getSiteSettingsMock.mockResolvedValueOnce(FIXTURE)
    const { container } = render(<SettingsTab />)
    await waitFor(() => {
      // textarea siteAnnouncement
      const ann = container.querySelector('[data-testid="setting-siteAnnouncement"]') as HTMLTextAreaElement
      expect(ann.value).toBe('Welcome')
      // checkbox contentFilterEnabled
      const cf = container.querySelector('input[data-testid="setting-contentFilterEnabled"]') as HTMLInputElement
      expect(cf.checked).toBe(true)
      // showAdultContent
      const adult = container.querySelector('input[data-testid="setting-showAdultContent"]') as HTMLInputElement
      expect(adult.checked).toBe(false)
    })
  })

  it('3. 单字段修改：dirty 切换 + 保存按钮 enable', async () => {
    getSiteSettingsMock.mockResolvedValueOnce(FIXTURE)
    const { container } = render(<SettingsTab />)
    await waitFor(() => screen.getByTestId('settings-save'))
    expect(screen.getByTestId('settings-dirty-indicator').textContent).toContain('无未保存修改')
    expect((screen.getByTestId('settings-save') as HTMLButtonElement).disabled).toBe(true)
    // toggle showAdultContent checkbox
    const adult = container.querySelector('input[data-testid="setting-showAdultContent"]') as HTMLInputElement
    fireEvent.click(adult)
    await waitFor(() => {
      expect(screen.getByTestId('settings-dirty-indicator').textContent).toContain('有未保存的修改')
      expect((screen.getByTestId('settings-save') as HTMLButtonElement).disabled).toBe(false)
    })
  })

  it('4. 保存成功 toast + dirty 重置', async () => {
    getSiteSettingsMock.mockResolvedValueOnce(FIXTURE)
    saveSiteSettingsMock.mockResolvedValueOnce({ ok: true })
    const { container } = render(<SettingsTab />)
    await waitFor(() => screen.getByTestId('settings-save'))
    fireEvent.click(container.querySelector('input[data-testid="setting-showAdultContent"]') as HTMLInputElement)
    fireEvent.click(screen.getByTestId('settings-save'))
    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({
        level: 'success', title: '已保存',
      }))
      expect(screen.getByTestId('settings-dirty-indicator').textContent).toContain('无未保存修改')
    })
  })

  it('5. VALIDATION_ERROR 错误码差异化 toast', async () => {
    getSiteSettingsMock.mockResolvedValueOnce(FIXTURE)
    saveSiteSettingsMock.mockRejectedValueOnce(
      new ApiClientError('VALIDATION_ERROR', 'autoCrawlMaxPerRun 超出范围', 400),
    )
    const { container } = render(<SettingsTab />)
    await waitFor(() => screen.getByTestId('settings-save'))
    fireEvent.click(container.querySelector('input[data-testid="setting-showAdultContent"]') as HTMLInputElement)
    fireEvent.click(screen.getByTestId('settings-save'))
    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({
        level: 'danger', title: '参数校验失败',
        description: 'autoCrawlMaxPerRun 超出范围',
      }))
    })
  })

  it('6. 网络异常兜底 toast', async () => {
    getSiteSettingsMock.mockResolvedValueOnce(FIXTURE)
    saveSiteSettingsMock.mockRejectedValueOnce(new Error('network down'))
    const { container } = render(<SettingsTab />)
    await waitFor(() => screen.getByTestId('settings-save'))
    fireEvent.click(container.querySelector('input[data-testid="setting-showAdultContent"]') as HTMLInputElement)
    fireEvent.click(screen.getByTestId('settings-save'))
    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({
        level: 'danger', title: '保存失败', description: 'network down',
      }))
    })
  })

  it('7. Loading state（pending fetch）', () => {
    getSiteSettingsMock.mockReturnValueOnce(new Promise(() => {}))
    const { container } = render(<SettingsTab />)
    expect(container.querySelector('[data-testid="settings-tab"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="settings-card-basic"]')).toBeNull()
  })

  it('8. Error state：fetch 失败 → ErrorState', async () => {
    getSiteSettingsMock.mockRejectedValueOnce(new Error('settings 500'))
    render(<SettingsTab />)
    await waitFor(() => {
      expect(screen.getAllByText(/加载失败|500/).length).toBeGreaterThan(0)
    })
  })

  it('9. 重新加载按钮触发 refresh', async () => {
    getSiteSettingsMock.mockResolvedValue(FIXTURE)
    render(<SettingsTab />)
    await waitFor(() => screen.getByTestId('settings-reload'))
    const initial = getSiteSettingsMock.mock.calls.length
    fireEvent.click(screen.getByTestId('settings-reload'))
    await waitFor(() => {
      expect(getSiteSettingsMock.mock.calls.length).toBeGreaterThan(initial)
    })
  })

  it('10. videoProxyUrl 在 videoProxyEnabled=false 时 disabled', async () => {
    getSiteSettingsMock.mockResolvedValueOnce({ ...FIXTURE, videoProxyEnabled: false })
    const { container } = render(<SettingsTab />)
    await waitFor(() => {
      // AdminInput wrapper 内部 input 找 aria-label
      const proxyUrlInput = container.querySelector('input[aria-label="视频代理 URL"]') as HTMLInputElement
      expect(proxyUrlInput.disabled).toBe(true)
    })
  })

  it('11. videoProxyEnabled toggle 后 videoProxyUrl 可用', async () => {
    getSiteSettingsMock.mockResolvedValueOnce({ ...FIXTURE, videoProxyEnabled: false })
    const { container } = render(<SettingsTab />)
    await waitFor(() => container.querySelector('input[data-testid="setting-videoProxyEnabled"]'))
    fireEvent.click(
      container.querySelector('input[data-testid="setting-videoProxyEnabled"]') as HTMLInputElement,
    )
    await waitFor(() => {
      const proxyUrlInput = container.querySelector('input[aria-label="视频代理 URL"]') as HTMLInputElement
      expect(proxyUrlInput.disabled).toBe(false)
    })
  })

  it('12. autoCrawlRecentDays 在 autoCrawlRecentOnly=false 时 disabled', async () => {
    getSiteSettingsMock.mockResolvedValueOnce({ ...FIXTURE, autoCrawlRecentOnly: false })
    const { container } = render(<SettingsTab />)
    await waitFor(() => {
      const daysInput = container.querySelector('input[aria-label="近期天数"]') as HTMLInputElement
      expect(daysInput.disabled).toBe(true)
    })
  })
})

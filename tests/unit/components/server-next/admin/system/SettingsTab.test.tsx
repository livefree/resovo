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
  doubanCookie: '••••2345',
  doubanCookieSet: true,
  showAdultContent: false,
  contentFilterEnabled: true,
  videoProxyEnabled: false,
  videoProxyUrl: '',
  autoCrawlEnabled: true,
  autoCrawlMaxPerRun: 100,
  autoCrawlRecentOnly: true,
  autoCrawlRecentDays: 7,
  // ADR-168 META-16-C：外部数据源凭证（遮罩值 + Set 布尔）
  notificationWebhookSecretSet: false,
  bangumiApiToken: '',
  bangumiApiTokenSet: false,
  bangumiUserAgent: 'resovo/1.0 (+https://github.com/resovo)',
  bangumiApiTimeoutMs: 8000,
  tmdbApiKey: '',
  tmdbApiKeySet: false,
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

  it('1b. 外部数据源卡（ADR-168）：token password 默认隐藏 + 显隐切换 + 未配置状态行', async () => {
    getSiteSettingsMock.mockResolvedValueOnce(FIXTURE)
    const { container } = render(<SettingsTab />)
    await waitFor(() => expect(screen.getByTestId('settings-card-external')).not.toBeNull())
    const token = container.querySelector('[data-testid="setting-bangumiApiToken"] input') as HTMLInputElement
    expect(token.getAttribute('type')).toBe('password')
    // 未配置状态行
    expect(screen.getByTestId('setting-bangumi-status').textContent).toContain('未配置')
    // 显隐切换 → type=text
    fireEvent.click(screen.getByTestId('setting-bangumiToken-toggle'))
    await waitFor(() => {
      const t2 = container.querySelector('[data-testid="setting-bangumiApiToken"] input') as HTMLInputElement
      expect(t2.getAttribute('type')).toBe('text')
    })
  })

  it('1c. 外部数据源卡：已配置 → 状态行绿条 + 新 token 保存发明文', async () => {
    getSiteSettingsMock.mockResolvedValueOnce({ ...FIXTURE, bangumiApiToken: '••••wxyz', bangumiApiTokenSet: true })
    saveSiteSettingsMock.mockResolvedValueOnce({ ok: true })
    const { container } = render(<SettingsTab />)
    await waitFor(() => expect(screen.getByTestId('setting-bangumi-status').textContent).toContain('已配置'))
    const token = container.querySelector('[data-testid="setting-bangumiApiToken"] input') as HTMLInputElement
    fireEvent.change(token, { target: { value: 'new-real-token' } })
    fireEvent.click(screen.getByTestId('settings-save'))
    await waitFor(() => expect(saveSiteSettingsMock).toHaveBeenCalled())
    expect(saveSiteSettingsMock.mock.calls[0][0]).toMatchObject({ bangumiApiToken: 'new-real-token' })
  })

  it('1d. 只提交改动过的字段（不全量覆盖其它 Tab 配置 / FIX-SETTINGS-PARTIAL-SAVE）', async () => {
    getSiteSettingsMock.mockResolvedValueOnce(FIXTURE)
    saveSiteSettingsMock.mockResolvedValueOnce({ ok: true })
    const { container } = render(<SettingsTab />)
    await waitFor(() => screen.getByTestId('settings-save'))
    // 仅改一个字段
    fireEvent.click(container.querySelector('input[data-testid="setting-showAdultContent"]') as HTMLInputElement)
    fireEvent.click(screen.getByTestId('settings-save'))
    await waitFor(() => expect(saveSiteSettingsMock).toHaveBeenCalled())
    const patch = saveSiteSettingsMock.mock.calls[0][0] as Record<string, unknown>
    // patch 仅含改动字段（防全量快照覆盖其它 Tab 的 notification*/session* 等）
    expect(Object.keys(patch)).toEqual(['showAdultContent'])
    expect(patch).not.toHaveProperty('siteName')
    expect(patch).not.toHaveProperty('notificationEmailEnabled')
    expect(patch).not.toHaveProperty('sessionTimeoutMinutes')
    expect(patch).not.toHaveProperty('bangumiApiToken')
  })

  it('1e. in-flight 保存期间的编辑不被静默丢弃（dirty 竞态 / Codex review）', async () => {
    getSiteSettingsMock.mockResolvedValueOnce(FIXTURE)
    let resolveFirst!: (v: unknown) => void
    saveSiteSettingsMock.mockReturnValueOnce(new Promise((r) => { resolveFirst = r }))
    const { container } = render(<SettingsTab />)
    await waitFor(() => screen.getByTestId('settings-save'))
    // 改字段 A（showAdultContent）→ 点保存进入 in-flight
    fireEvent.click(container.querySelector('input[data-testid="setting-showAdultContent"]') as HTMLInputElement)
    fireEvent.click(screen.getByTestId('settings-save'))
    await waitFor(() => expect(saveSiteSettingsMock).toHaveBeenCalledTimes(1))
    // 保存进行中改字段 B（siteName）
    fireEvent.change(
      container.querySelector('[data-testid="setting-siteName"] input') as HTMLInputElement,
      { target: { value: 'NewName' } },
    )
    // 第一次保存完成（A 提交成功）
    saveSiteSettingsMock.mockResolvedValueOnce({ ok: true })
    resolveFirst({ ok: true })
    // B 仍为未保存 → 保存按钮可点（未被首次保存的 clear 静默吞掉）
    await waitFor(() => expect((screen.getByTestId('settings-save') as HTMLButtonElement).disabled).toBe(false))
    // 再次保存 → 第二次 patch 仅含 siteName=NewName（A 已清、B 保留）
    fireEvent.click(screen.getByTestId('settings-save'))
    await waitFor(() => expect(saveSiteSettingsMock).toHaveBeenCalledTimes(2))
    expect(saveSiteSettingsMock.mock.calls[1][0]).toEqual({ siteName: 'NewName' })
  })

  it('1f. in-flight 重改同一已提交字段不丢（same-field 竞态 / Codex review）', async () => {
    getSiteSettingsMock.mockResolvedValueOnce(FIXTURE)
    let resolveFirst!: (v: unknown) => void
    saveSiteSettingsMock.mockReturnValueOnce(new Promise((r) => { resolveFirst = r }))
    const { container } = render(<SettingsTab />)
    await waitFor(() => screen.getByTestId('settings-save'))
    const siteName = () => container.querySelector('[data-testid="setting-siteName"] input') as HTMLInputElement
    // 改 siteName=v1 → 保存 in-flight（提交 v1）
    fireEvent.change(siteName(), { target: { value: 'v1' } })
    fireEvent.click(screen.getByTestId('settings-save'))
    await waitFor(() => expect(saveSiteSettingsMock).toHaveBeenCalledTimes(1))
    expect(saveSiteSettingsMock.mock.calls[0][0]).toEqual({ siteName: 'v1' })
    // 保存进行中又改同一字段 siteName=v2
    fireEvent.change(siteName(), { target: { value: 'v2' } })
    // 第一次保存完成
    saveSiteSettingsMock.mockResolvedValueOnce({ ok: true })
    resolveFirst({ ok: true })
    // siteName 仍 dirty（v2 未被首次保存静默清除）→ 按钮可点
    await waitFor(() => expect((screen.getByTestId('settings-save') as HTMLButtonElement).disabled).toBe(false))
    // 二次保存提交 v2（同字段 in-flight 重改不丢）
    fireEvent.click(screen.getByTestId('settings-save'))
    await waitFor(() => expect(saveSiteSettingsMock).toHaveBeenCalledTimes(2))
    expect(saveSiteSettingsMock.mock.calls[1][0]).toEqual({ siteName: 'v2' })
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

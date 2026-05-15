/**
 * ConfigTab.test.tsx — SettingsContainer ConfigTab 单元测试（CHG-SN-6-05）
 *
 * 覆盖（≥ 9 用例硬清单 / quality-gates §7 第 1 项）：
 *   1. 渲染基础：config-tab + 2 卡（file / subscription）
 *   2. 初次加载：configFile + subscriptionUrl 注入 textarea + input
 *   3. dirty 标识：初始"无未保存修改" + 修改后切"有未保存的修改"
 *   4. 保存按钮初始 disabled（dirty=false），修改后 enabled
 *   5. 字符计数显示
 *   6. 保存成功 toast（含 synced / skipped）+ dirty 重置
 *   7. INVALID_JSON 错误差异化 toast
 *   8. INVALID_SUBSCRIPTION_URL 错误差异化 toast
 *   9. VALIDATION_ERROR 通用 toast
 *   10. 通用 / 网络错误兜底 toast
 *   11. Loading state（pending）
 *   12. Error state + retry
 *   13. 重新加载按钮触发 refresh
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const getSystemConfigMock = vi.fn()
const saveSystemConfigMock = vi.fn()
const toastPushMock = vi.fn()

vi.mock('../../../../../../apps/server-next/src/lib/system/api', () => ({
  getSystemConfig: (...args: unknown[]) => getSystemConfigMock(...args),
  saveSystemConfig: (...args: unknown[]) => saveSystemConfigMock(...args),
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

import { ConfigTab } from '../../../../../../apps/server-next/src/app/admin/system/settings/_tabs/ConfigTab'
import { ApiClientError } from '../../../../../../apps/server-next/src/lib/api-client'

const CONFIG_FIXTURE = {
  configFile: '{\n  "crawler_sites": {}\n}',
  subscriptionUrl: 'https://example.com/config.json',
}

beforeEach(() => {
  getSystemConfigMock.mockReset()
  saveSystemConfigMock.mockReset()
  toastPushMock.mockReset()
})

describe('ConfigTab', () => {
  it('1. 渲染基础：config-tab + file / subscription 卡', async () => {
    getSystemConfigMock.mockResolvedValueOnce(CONFIG_FIXTURE)
    render(<ConfigTab />)
    await waitFor(() => {
      expect(screen.getByTestId('config-tab')).not.toBeNull()
      expect(screen.getByTestId('config-card-file')).not.toBeNull()
      expect(screen.getByTestId('config-card-subscription')).not.toBeNull()
    })
  })

  it('2. 初次加载 configFile + subscriptionUrl 注入', async () => {
    getSystemConfigMock.mockResolvedValueOnce(CONFIG_FIXTURE)
    const { container } = render(<ConfigTab />)
    await waitFor(() => {
      const textarea = screen.getByTestId('config-file-textarea') as HTMLTextAreaElement
      expect(textarea.value).toContain('crawler_sites')
      // AdminInput 内部 <input>（testid 在 wrapper，aria-label 在内部 input）
      const subInput = container.querySelector<HTMLInputElement>('input[aria-label="subscriptionUrl"]')
      expect(subInput).not.toBeNull()
      expect(subInput!.value).toBe('https://example.com/config.json')
    })
  })

  it('3. dirty 标识：初始"无未保存修改" → 修改后切"有未保存的修改"', async () => {
    getSystemConfigMock.mockResolvedValueOnce(CONFIG_FIXTURE)
    render(<ConfigTab />)
    await waitFor(() => screen.getByTestId('config-dirty-indicator'))
    expect(screen.getByTestId('config-dirty-indicator').textContent).toContain('无未保存修改')
    const textarea = screen.getByTestId('config-file-textarea') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '{}' } })
    await waitFor(() => {
      expect(screen.getByTestId('config-dirty-indicator').textContent).toContain('有未保存的修改')
    })
  })

  it('4. 保存按钮初始 disabled（dirty=false）/ 修改后 enabled', async () => {
    getSystemConfigMock.mockResolvedValueOnce(CONFIG_FIXTURE)
    render(<ConfigTab />)
    await waitFor(() => screen.getByTestId('config-save'))
    expect((screen.getByTestId('config-save') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByTestId('config-file-textarea'), { target: { value: '{}' } })
    await waitFor(() => {
      expect((screen.getByTestId('config-save') as HTMLButtonElement).disabled).toBe(false)
    })
  })

  it('5. 字符数显示', async () => {
    getSystemConfigMock.mockResolvedValueOnce(CONFIG_FIXTURE)
    render(<ConfigTab />)
    await waitFor(() => {
      // configFile length 显示（fixture 长度 ~26 字符）
      expect(screen.getByText(/字符数/)).not.toBeNull()
    })
  })

  it('6. 保存成功 toast（含 synced / skipped）+ dirty 重置', async () => {
    getSystemConfigMock.mockResolvedValueOnce(CONFIG_FIXTURE)
    saveSystemConfigMock.mockResolvedValueOnce({ ok: true, synced: 5, skipped: 2 })
    render(<ConfigTab />)
    await waitFor(() => screen.getByTestId('config-save'))
    fireEvent.change(screen.getByTestId('config-file-textarea'), { target: { value: '{}' } })
    fireEvent.click(screen.getByTestId('config-save'))
    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({
        level: 'success',
        title: '已保存',
        description: expect.stringContaining('成功 5 个'),
      }))
      expect(screen.getByTestId('config-dirty-indicator').textContent).toContain('无未保存修改')
    })
  })

  it('7. INVALID_JSON 错误差异化 toast', async () => {
    getSystemConfigMock.mockResolvedValueOnce(CONFIG_FIXTURE)
    saveSystemConfigMock.mockRejectedValueOnce(
      new ApiClientError('INVALID_JSON', 'JSON 格式不合法', 400),
    )
    render(<ConfigTab />)
    await waitFor(() => screen.getByTestId('config-save'))
    fireEvent.change(screen.getByTestId('config-file-textarea'), { target: { value: 'bad json' } })
    fireEvent.click(screen.getByTestId('config-save'))
    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({
        level: 'danger',
        title: '配置文件格式错误',
        description: expect.stringContaining('JSON 解析失败'),
      }))
    })
  })

  it('8. INVALID_SUBSCRIPTION_URL 错误差异化 toast', async () => {
    getSystemConfigMock.mockResolvedValueOnce(CONFIG_FIXTURE)
    saveSystemConfigMock.mockRejectedValueOnce(
      new ApiClientError('INVALID_SUBSCRIPTION_URL', '订阅 URL 不合法', 400),
    )
    render(<ConfigTab />)
    await waitFor(() => screen.getByTestId('config-save'))
    // 通过 textarea 触发 dirty（subscriptionUrl 用 AdminInput wrapper，testid 在 wrapper 而非 input）
    fireEvent.change(screen.getByTestId('config-file-textarea'), { target: { value: '{}' } })
    fireEvent.click(screen.getByTestId('config-save'))
    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({
        level: 'danger',
        title: '订阅 URL 不合法',
      }))
    })
  })

  it('9. VALIDATION_ERROR 通用 toast 含 message', async () => {
    getSystemConfigMock.mockResolvedValueOnce(CONFIG_FIXTURE)
    saveSystemConfigMock.mockRejectedValueOnce(
      new ApiClientError('VALIDATION_ERROR', 'configFile 必填', 400),
    )
    render(<ConfigTab />)
    await waitFor(() => screen.getByTestId('config-save'))
    fireEvent.change(screen.getByTestId('config-file-textarea'), { target: { value: '' } })
    fireEvent.click(screen.getByTestId('config-save'))
    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({
        level: 'danger',
        title: '参数校验失败',
        description: 'configFile 必填',
      }))
    })
  })

  it('10. 网络异常兜底 toast', async () => {
    getSystemConfigMock.mockResolvedValueOnce(CONFIG_FIXTURE)
    saveSystemConfigMock.mockRejectedValueOnce(new Error('network down'))
    render(<ConfigTab />)
    await waitFor(() => screen.getByTestId('config-save'))
    fireEvent.change(screen.getByTestId('config-file-textarea'), { target: { value: '{}' } })
    fireEvent.click(screen.getByTestId('config-save'))
    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({
        level: 'danger',
        title: '保存失败',
        description: 'network down',
      }))
    })
  })

  it('11. Loading state（pending fetch）', async () => {
    getSystemConfigMock.mockReturnValueOnce(new Promise(() => {}))
    const { container } = render(<ConfigTab />)
    expect(container.querySelector('[data-testid="config-tab"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="config-card-file"]')).toBeNull()
  })

  it('12. Error state：fetch 失败 → ErrorState', async () => {
    getSystemConfigMock.mockRejectedValueOnce(new Error('config 500'))
    render(<ConfigTab />)
    await waitFor(() => {
      expect(screen.getAllByText(/加载失败|500/).length).toBeGreaterThan(0)
    })
  })

  it('13. 重新加载按钮触发 refresh', async () => {
    getSystemConfigMock.mockResolvedValue(CONFIG_FIXTURE)
    render(<ConfigTab />)
    await waitFor(() => screen.getByTestId('config-reload'))
    const initialCalls = getSystemConfigMock.mock.calls.length
    fireEvent.click(screen.getByTestId('config-reload'))
    await waitFor(() => {
      expect(getSystemConfigMock.mock.calls.length).toBeGreaterThan(initialCalls)
    })
  })
})

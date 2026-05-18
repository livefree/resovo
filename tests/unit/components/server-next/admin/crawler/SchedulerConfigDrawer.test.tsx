/**
 * SchedulerConfigDrawer.test.tsx — 调度配置 Drawer 单测（CHG-SN-6-27）
 *
 * 覆盖（≥ 6）：
 *   1. 关闭时 → 不调 API
 *   2. 打开时 → 调 getAutoCrawlConfig
 *   3. 加载中 → LoadingState
 *   4. 加载失败 → ErrorState
 *   5. 6 字段渲染（globalEnabled / dailyTime / defaultMode / onlyEnabledSites / conflictPolicy）
 *   6. 提交成功 → setAutoCrawlConfig 调用 + onSaved + onClose
 *   7. 提交失败 → toast danger
 *   8. 取消按钮 → onClose（未提交）
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const getAutoCrawlConfigMock = vi.fn()
const setAutoCrawlConfigMock = vi.fn()
const toastPushMock = vi.fn()

vi.mock('@/lib/crawler/api', () => ({
  getAutoCrawlConfig: (...args: unknown[]) => getAutoCrawlConfigMock(...args),
  setAutoCrawlConfig: (...args: unknown[]) => setAutoCrawlConfigMock(...args),
}))

vi.mock('@/lib/api-client', () => ({
  ApiClientError: class extends Error {
    constructor(message: string, public readonly status?: number) { super(message) }
  },
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    useToast: () => ({ push: (i: unknown) => { toastPushMock(i); return 'tid' }, dismiss: vi.fn(), dismissAll: vi.fn() }),
  }
})

import { SchedulerConfigDrawer } from '@/app/admin/crawler/_client/SchedulerConfigDrawer'

const CONFIG = {
  globalEnabled: true,
  scheduleType: 'daily' as const,
  dailyTime: '03:30',
  defaultMode: 'incremental' as const,
  onlyEnabledSites: false,
  conflictPolicy: 'skip_running' as const,
  perSiteOverrides: {},
}

beforeEach(() => {
  getAutoCrawlConfigMock.mockReset()
  setAutoCrawlConfigMock.mockReset()
  toastPushMock.mockReset()
})

describe('SchedulerConfigDrawer', () => {
  it('1. 关闭时 → 不调 API', () => {
    render(<SchedulerConfigDrawer open={false} onClose={() => {}} />)
    expect(getAutoCrawlConfigMock).not.toHaveBeenCalled()
  })

  it('2. 打开时 → 调 getAutoCrawlConfig', async () => {
    getAutoCrawlConfigMock.mockResolvedValueOnce(CONFIG)
    render(<SchedulerConfigDrawer open={true} onClose={() => {}} />)
    await waitFor(() => {
      expect(getAutoCrawlConfigMock).toHaveBeenCalledOnce()
    })
  })

  it('3. 加载中 → LoadingState 占位（无表单）', () => {
    getAutoCrawlConfigMock.mockReturnValueOnce(new Promise(() => {})) // pending
    render(<SchedulerConfigDrawer open={true} onClose={() => {}} />)
    expect(document.querySelector('[data-scheduler-config-form]')).toBeNull()
  })

  it('4. 加载失败 → ErrorState', async () => {
    getAutoCrawlConfigMock.mockRejectedValueOnce(new Error('500'))
    render(<SchedulerConfigDrawer open={true} onClose={() => {}} />)
    await waitFor(() => {
      expect(screen.getAllByText(/加载失败|500/).length).toBeGreaterThan(0)
    })
  })

  it('5. 6 字段渲染 + 数据回填', async () => {
    getAutoCrawlConfigMock.mockResolvedValueOnce(CONFIG)
    render(<SchedulerConfigDrawer open={true} onClose={() => {}} />)
    await waitFor(() => {
      expect(screen.getByTestId('scheduler-globalEnabled')).not.toBeNull()
      expect(screen.getByTestId('scheduler-dailyTime')).not.toBeNull()
      expect(screen.getByTestId('scheduler-defaultMode')).not.toBeNull()
      expect(screen.getByTestId('scheduler-onlyEnabledSites')).not.toBeNull()
      expect(screen.getByTestId('scheduler-conflictPolicy')).not.toBeNull()
      expect(screen.getByTestId('scheduler-submit')).not.toBeNull()
      // dailyTime value 回填
      const wrapper = screen.getByTestId('scheduler-dailyTime')
      const input = wrapper.querySelector('input') as HTMLInputElement
      expect(input.value).toBe('03:30')
    })
  })

  it('6. 提交成功 → setAutoCrawlConfig + success toast + onClose 调用', async () => {
    getAutoCrawlConfigMock.mockResolvedValueOnce(CONFIG)
    setAutoCrawlConfigMock.mockResolvedValueOnce(undefined)
    const onClose = vi.fn()
    const onSaved = vi.fn()
    render(<SchedulerConfigDrawer open={true} onClose={onClose} onSaved={onSaved} />)
    const submit = await waitFor(() => screen.getByTestId('scheduler-submit'))
    fireEvent.click(submit)
    await waitFor(() => {
      expect(setAutoCrawlConfigMock).toHaveBeenCalledWith(expect.objectContaining({
        globalEnabled: true,
        dailyTime: '03:30',
        defaultMode: 'incremental',
      }))
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'success', title: '调度配置已更新' }),
      )
      expect(onSaved).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('7. 提交失败 → toast danger（不关闭）', async () => {
    getAutoCrawlConfigMock.mockResolvedValueOnce(CONFIG)
    setAutoCrawlConfigMock.mockRejectedValueOnce(new Error('422 invalid'))
    const onClose = vi.fn()
    render(<SchedulerConfigDrawer open={true} onClose={onClose} />)
    const submit = await waitFor(() => screen.getByTestId('scheduler-submit'))
    fireEvent.click(submit)
    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'danger', title: '保存失败' }),
      )
    })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('8. 取消按钮 → onClose（未提交）', async () => {
    getAutoCrawlConfigMock.mockResolvedValueOnce(CONFIG)
    const onClose = vi.fn()
    render(<SchedulerConfigDrawer open={true} onClose={onClose} />)
    const cancel = await waitFor(() => screen.getByTestId('scheduler-cancel'))
    fireEvent.click(cancel)
    expect(onClose).toHaveBeenCalled()
    expect(setAutoCrawlConfigMock).not.toHaveBeenCalled()
  })
})

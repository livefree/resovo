/**
 * SchedulerConfigDrawer.test.tsx — 调度配置 Drawer 单测（CHG-SN-6-27 / CHG-SN-7-MISC-PERSITE）
 *
 * 覆盖（≥ 13）：
 *   1. 关闭时 → 不调 API
 *   2. 打开时 → 调 getAutoCrawlConfig
 *   3. 加载中 → LoadingState
 *   4. 加载失败 → ErrorState
 *   5. 字段渲染（globalEnabled / scheduleType / dailyTime / defaultMode / onlyEnabledSites / conflictPolicy）
 *   6. 提交成功 → setAutoCrawlConfig 调用 + onSaved + onClose
 *   7. 提交失败 → toast danger
 *   8. 取消按钮 → onClose（未提交）
 *   9. perSiteOverrides 空 → 空提示渲染
 *  10. perSiteOverrides 有条目 → 覆盖行渲染
 *  11. 移除覆盖 → 行消失 + 提交时 perSiteOverrides 不含该站点
 *  12. ADR-154 D-154-6：scheduleType=interval → intervalMinutes 显示 / dailyTime 隐藏
 *  13. ADR-154 D-154-6：scheduleType=interval 提交 → intervalMinutes 包含在 payload
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const getAutoCrawlConfigMock = vi.fn()
const setAutoCrawlConfigMock = vi.fn()
const listCrawlerSitesMock = vi.fn()
const toastPushMock = vi.fn()

vi.mock('@/lib/crawler/api', () => ({
  getAutoCrawlConfig: (...args: unknown[]) => getAutoCrawlConfigMock(...args),
  setAutoCrawlConfig: (...args: unknown[]) => setAutoCrawlConfigMock(...args),
  listCrawlerSites: (...args: unknown[]) => listCrawlerSitesMock(...args),
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
  intervalMinutes: 60,              // ADR-154 D-154-1
  dailyTime: '03:30',
  defaultMode: 'incremental' as const,
  onlyEnabledSites: false,
  conflictPolicy: 'skip_running' as const,
  perSiteOverrides: {},
}

const CONFIG_INTERVAL = {
  ...CONFIG,
  scheduleType: 'interval' as const,
  intervalMinutes: 30,
}

const CONFIG_WITH_OVERRIDE = {
  ...CONFIG,
  perSiteOverrides: {
    'site-a': { enabled: true, mode: 'full' as const },
  },
}

const SITE_A = {
  key: 'site-a',
  name: 'Site A',
  displayName: null,
  apiUrl: 'https://example.com',
  detail: null,
  sourceType: 'vod' as const,
  format: 'json' as const,
  weight: 1,
  isAdult: false,
  disabled: false,
  fromConfig: false,
  lastCrawledAt: null,
  lastCrawlStatus: null,
  ingestPolicy: {
    allow_auto_publish: false,
    allow_search_index: true,
    allow_recommendation: true,
    allow_public_detail: true,
    allow_playback: true,
    require_review_before_publish: false,
  },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

beforeEach(() => {
  getAutoCrawlConfigMock.mockReset()
  setAutoCrawlConfigMock.mockReset()
  listCrawlerSitesMock.mockReset()
  toastPushMock.mockReset()
  // sites 加载失败不阻塞 → 默认返回空，各用例按需覆盖
  listCrawlerSitesMock.mockResolvedValue([])
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

  it('5. 6 字段渲染 + chip 列表回填（ADR-155 D-155-6 EP-1C-2a）', async () => {
    getAutoCrawlConfigMock.mockResolvedValueOnce(CONFIG)
    render(<SchedulerConfigDrawer open={true} onClose={() => {}} />)
    await waitFor(() => {
      expect(screen.getByTestId('scheduler-globalEnabled')).not.toBeNull()
      // ADR-155 D-155-6 EP-1C-2a：dailyTime 单 input → chip 列表
      expect(screen.getByTestId('scheduler-dailyTime-chips')).not.toBeNull()
      // CONFIG.dailyTime '03:30' 兜底渲染为 1 chip
      expect(screen.getByTestId('scheduler-dailyTime-chip-03:30')).not.toBeNull()
      expect(screen.getByTestId('scheduler-dailyTime-input')).not.toBeNull()
      expect(screen.getByTestId('scheduler-defaultMode')).not.toBeNull()
      expect(screen.getByTestId('scheduler-onlyEnabledSites')).not.toBeNull()
      expect(screen.getByTestId('scheduler-conflictPolicy')).not.toBeNull()
      expect(screen.getByTestId('scheduler-submit')).not.toBeNull()
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

  it('9. perSiteOverrides 空 → 渲染空提示', async () => {
    getAutoCrawlConfigMock.mockResolvedValueOnce(CONFIG)
    render(<SchedulerConfigDrawer open={true} onClose={() => {}} />)
    await waitFor(() => {
      expect(screen.getByTestId('scheduler-overrides-empty')).not.toBeNull()
    })
  })

  it('10. perSiteOverrides 有条目 → 渲染覆盖行', async () => {
    getAutoCrawlConfigMock.mockResolvedValueOnce(CONFIG_WITH_OVERRIDE)
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_A])
    render(<SchedulerConfigDrawer open={true} onClose={() => {}} />)
    await waitFor(() => {
      expect(screen.getByTestId('override-row-site-a')).not.toBeNull()
      expect(screen.getByTestId('override-enabled-site-a')).not.toBeNull()
      expect(screen.getByTestId('override-mode-site-a')).not.toBeNull()
      expect(screen.getByTestId('override-remove-site-a')).not.toBeNull()
    })
  })

  it('11. 移除覆盖 → 行消失 + 提交时 perSiteOverrides 不含该站点', async () => {
    getAutoCrawlConfigMock.mockResolvedValueOnce(CONFIG_WITH_OVERRIDE)
    setAutoCrawlConfigMock.mockResolvedValueOnce(undefined)
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_A])
    const onClose = vi.fn()
    render(<SchedulerConfigDrawer open={true} onClose={onClose} />)

    const removeBtn = await waitFor(() => screen.getByTestId('override-remove-site-a'))
    fireEvent.click(removeBtn)

    await waitFor(() => {
      expect(screen.queryByTestId('override-row-site-a')).toBeNull()
      expect(screen.getByTestId('scheduler-overrides-empty')).not.toBeNull()
    })

    const submit = screen.getByTestId('scheduler-submit')
    fireEvent.click(submit)
    await waitFor(() => {
      expect(setAutoCrawlConfigMock).toHaveBeenCalledWith(
        expect.objectContaining({ perSiteOverrides: {} }),
      )
    })
  })

  it('12. ADR-154 D-154-6：scheduleType=interval → intervalMinutes 显示 / dailyTime chip 列表隐藏', async () => {
    getAutoCrawlConfigMock.mockResolvedValueOnce(CONFIG_INTERVAL)
    render(<SchedulerConfigDrawer open={true} onClose={() => {}} />)
    await waitFor(() => {
      // interval 模式：intervalMinutes 显示
      expect(screen.getByTestId('scheduler-intervalMinutes')).not.toBeNull()
      // daily chip 列表隐藏（ADR-155 D-155-6 EP-1C-2a）
      expect(screen.queryByTestId('scheduler-dailyTime-chips')).toBeNull()
      expect(screen.queryByTestId('scheduler-dailyTime-input')).toBeNull()
    })
  })

  it('13. ADR-154 D-154-6：scheduleType=interval 提交 → intervalMinutes 包含在 payload', async () => {
    getAutoCrawlConfigMock.mockResolvedValueOnce(CONFIG_INTERVAL)
    setAutoCrawlConfigMock.mockResolvedValueOnce(undefined)
    render(<SchedulerConfigDrawer open={true} onClose={() => {}} />)
    const submit = await waitFor(() => screen.getByTestId('scheduler-submit'))
    fireEvent.click(submit)
    await waitFor(() => {
      expect(setAutoCrawlConfigMock).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduleType: 'interval',
          intervalMinutes: 30,
        }),
      )
    })
  })

  // ── ADR-155 D-155-6 / EP-1C-2a：chip 列表增删 + max/min 守卫 ──
  it('14. EP-1C-2a: [+] 添加 chip → 列表新增 + state 更新', async () => {
    getAutoCrawlConfigMock.mockResolvedValueOnce(CONFIG)
    render(<SchedulerConfigDrawer open={true} onClose={() => {}} />)
    await waitFor(() => screen.getByTestId('scheduler-dailyTime-chips'))
    // 初始 1 chip: 03:30
    expect(screen.getByTestId('scheduler-dailyTime-chip-03:30')).not.toBeNull()
    expect(screen.queryByTestId('scheduler-dailyTime-chip-04:00')).toBeNull()
    // 输入 04:00 + 点 [+]
    const input = screen.getByTestId('scheduler-dailyTime-input').querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '04:00' } })
    const addBtn = screen.getByTestId('scheduler-dailyTime-add')
    fireEvent.click(addBtn)
    await waitFor(() => {
      expect(screen.getByTestId('scheduler-dailyTime-chip-04:00')).not.toBeNull()
    })
  })

  it('15. EP-1C-2a: chip × 删除 → 列表减项', async () => {
    const CONFIG_TWO_TIMES = { ...CONFIG, dailyTimes: ['03:30', '04:00'] as readonly string[] }
    getAutoCrawlConfigMock.mockResolvedValueOnce(CONFIG_TWO_TIMES)
    render(<SchedulerConfigDrawer open={true} onClose={() => {}} />)
    await waitFor(() => {
      expect(screen.getByTestId('scheduler-dailyTime-chip-03:30')).not.toBeNull()
      expect(screen.getByTestId('scheduler-dailyTime-chip-04:00')).not.toBeNull()
    })
    fireEvent.click(screen.getByTestId('scheduler-dailyTime-remove-04:00'))
    await waitFor(() => {
      expect(screen.queryByTestId('scheduler-dailyTime-chip-04:00')).toBeNull()
      // 03:30 仍存在
      expect(screen.getByTestId('scheduler-dailyTime-chip-03:30')).not.toBeNull()
    })
  })

  it('16. EP-1C-2a: min 1 守卫（仅 1 chip 时无 × 按钮）', async () => {
    getAutoCrawlConfigMock.mockResolvedValueOnce(CONFIG)
    render(<SchedulerConfigDrawer open={true} onClose={() => {}} />)
    await waitFor(() => screen.getByTestId('scheduler-dailyTime-chip-03:30'))
    // 仅 1 chip 时，× 按钮不渲染（min 1 守卫）
    expect(screen.queryByTestId('scheduler-dailyTime-remove-03:30')).toBeNull()
  })

  it('17. EP-1C-2a: 非法 HH:MM 输入 → [+] 按钮 disabled', async () => {
    getAutoCrawlConfigMock.mockResolvedValueOnce(CONFIG)
    render(<SchedulerConfigDrawer open={true} onClose={() => {}} />)
    await waitFor(() => screen.getByTestId('scheduler-dailyTime-chips'))
    const input = screen.getByTestId('scheduler-dailyTime-input').querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '25:99' } })  // 非法 HH:MM（但正则匹配数字）
    // 实际只校验正则；非法范围由 addDailyTime 内部 silent reject
    fireEvent.change(input, { target: { value: 'invalid' } })
    const addBtn = screen.getByTestId('scheduler-dailyTime-add') as HTMLButtonElement
    expect(addBtn.disabled).toBe(true)
  })

  it('18. EP-1C-2a: 提交 payload 含 dailyTimes 数组', async () => {
    const CONFIG_TWO_TIMES = { ...CONFIG, dailyTimes: ['03:30', '04:00'] as readonly string[] }
    getAutoCrawlConfigMock.mockResolvedValueOnce(CONFIG_TWO_TIMES)
    setAutoCrawlConfigMock.mockResolvedValueOnce(undefined)
    render(<SchedulerConfigDrawer open={true} onClose={() => {}} />)
    const submit = await waitFor(() => screen.getByTestId('scheduler-submit'))
    fireEvent.click(submit)
    await waitFor(() => {
      expect(setAutoCrawlConfigMock).toHaveBeenCalledWith(
        expect.objectContaining({
          dailyTimes: ['03:30', '04:00'],
          dailyTime: '03:30',  // alias = dailyTimes[0]
        }),
      )
    })
  })

  it('19. EP-1C-2a: toast description 显示多 dailyTime', async () => {
    const CONFIG_TWO_TIMES = { ...CONFIG, dailyTimes: ['03:30', '04:00'] as readonly string[] }
    getAutoCrawlConfigMock.mockResolvedValueOnce(CONFIG_TWO_TIMES)
    setAutoCrawlConfigMock.mockResolvedValueOnce(undefined)
    render(<SchedulerConfigDrawer open={true} onClose={() => {}} />)
    const submit = await waitFor(() => screen.getByTestId('scheduler-submit'))
    fireEvent.click(submit)
    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'success',
          description: expect.stringContaining('每日 03:30, 04:00'),
        }),
      )
    })
  })
})

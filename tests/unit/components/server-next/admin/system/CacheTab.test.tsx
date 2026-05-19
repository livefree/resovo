/**
 * CacheTab.test.tsx — SettingsContainer CacheTab 单元测试（CHG-SN-6-04）
 *
 * 覆盖（≥ 9 用例硬清单 / quality-gates §7 第 1 项）：
 *   1. 渲染基础：grid + 5 业务前缀卡片
 *   2. 汇总行：总 key 数 + 总 size（formatSize: KB / MB）
 *   3. 单卡 KPI（count + sizeKb formatSize）
 *   4. 中文 label 映射 5 个全命中
 *   5. clear single type 成功 toast + refresh
 *   6. clear single type 失败 toast danger
 *   7. clear all 成功 toast（"已清空全部缓存"）
 *   8. count=0 时清空按钮 disabled
 *   9. Loading state
 *   10. Error state + retry
 *   11. refresh 按钮触发重新加载
 *   12. cache-card-{type} testid 反查（e2e 友好）
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const getCacheStatsMock = vi.fn()
const clearCacheMock = vi.fn()
const toastPushMock = vi.fn()

vi.mock('../../../../../../apps/server-next/src/lib/system/api', () => ({
  getCacheStats: (...args: unknown[]) => getCacheStatsMock(...args),
  clearCache: (...args: unknown[]) => clearCacheMock(...args),
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

import { CacheTab } from '../../../../../../apps/server-next/src/app/admin/settings/_tabs/CacheTab'

const STATS_FIXTURE = [
  { type: 'search' as const,    count: 1234,  sizeKb: 512.5 },
  { type: 'video' as const,     count: 5678,  sizeKb: 2048.3 },
  { type: 'danmaku' as const,   count: 100,   sizeKb: 64.0 },
  { type: 'analytics' as const, count: 0,     sizeKb: 0.0 },
  { type: 'home' as const,      count: 50,    sizeKb: 12.5 },
]

beforeEach(() => {
  getCacheStatsMock.mockReset()
  clearCacheMock.mockReset()
  toastPushMock.mockReset()
})

describe('CacheTab', () => {
  it('1. 渲染基础：cache-tab + grid + 5 业务前缀卡片', async () => {
    getCacheStatsMock.mockResolvedValueOnce(STATS_FIXTURE)
    render(<CacheTab />)
    await waitFor(() => {
      expect(screen.getByTestId('cache-tab')).not.toBeNull()
      expect(screen.getByTestId('cache-stat-grid')).not.toBeNull()
      expect(screen.getByTestId('cache-card-search')).not.toBeNull()
      expect(screen.getByTestId('cache-card-video')).not.toBeNull()
      expect(screen.getByTestId('cache-card-danmaku')).not.toBeNull()
      expect(screen.getByTestId('cache-card-analytics')).not.toBeNull()
      expect(screen.getByTestId('cache-card-home')).not.toBeNull()
    })
  })

  it('2. 汇总行：总 key 数 + 总 size 格式化（KB / MB）', async () => {
    getCacheStatsMock.mockResolvedValueOnce(STATS_FIXTURE)
    render(<CacheTab />)
    await waitFor(() => {
      const label = screen.getByTestId('cache-total-label')
      expect(label.textContent).toContain('5 个业务前缀')
      expect(label.textContent).toContain('7,062 条 key')  // 1234+5678+100+0+50
      // sizeKb 总 2637.3 → MB 格式
      expect(label.textContent).toMatch(/MB|KB/)
    })
  })

  it('3. 单卡 KPI count 千分位 + sizeKb 格式化', async () => {
    getCacheStatsMock.mockResolvedValueOnce(STATS_FIXTURE)
    render(<CacheTab />)
    await waitFor(() => {
      expect(screen.getByText('5,678')).not.toBeNull()  // video count
      expect(screen.getByText(/2\.00 MB/)).not.toBeNull() // video sizeKb 2048.3 → 2.00 MB
      expect(screen.getByText(/512\.5 KB/)).not.toBeNull() // search
    })
  })

  it('4. 中文 label 映射 5 个全命中', async () => {
    getCacheStatsMock.mockResolvedValueOnce(STATS_FIXTURE)
    render(<CacheTab />)
    await waitFor(() => {
      expect(screen.getByText('搜索缓存')).not.toBeNull()
      expect(screen.getByText('视频缓存')).not.toBeNull()
      expect(screen.getByText('弹幕缓存')).not.toBeNull()
      expect(screen.getByText('统计缓存')).not.toBeNull()
      expect(screen.getByText('首页缓存')).not.toBeNull()
    })
  })

  it('5. clear single type 成功 toast + refresh', async () => {
    getCacheStatsMock.mockResolvedValue(STATS_FIXTURE)
    clearCacheMock.mockResolvedValueOnce({ deleted: 1234 })
    render(<CacheTab />)
    await waitFor(() => screen.getByTestId('cache-clear-search'))
    const initialCalls = getCacheStatsMock.mock.calls.length
    fireEvent.click(screen.getByTestId('cache-clear-search'))
    await waitFor(() => {
      expect(clearCacheMock).toHaveBeenCalledWith('search')
      expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({
        level: 'success',
        title: '已清空 搜索缓存',
        description: expect.stringContaining('1,234'),
      }))
      expect(getCacheStatsMock.mock.calls.length).toBeGreaterThan(initialCalls)
    })
  })

  it('6. clear 失败 toast danger', async () => {
    getCacheStatsMock.mockResolvedValueOnce(STATS_FIXTURE)
    clearCacheMock.mockRejectedValueOnce(new Error('Redis offline'))
    render(<CacheTab />)
    await waitFor(() => screen.getByTestId('cache-clear-search'))
    fireEvent.click(screen.getByTestId('cache-clear-search'))
    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({
        level: 'danger',
        title: '清空缓存失败',
        description: 'Redis offline',
      }))
    })
  })

  it('7. clear all 成功 toast"已清空全部缓存"', async () => {
    getCacheStatsMock.mockResolvedValue(STATS_FIXTURE)
    clearCacheMock.mockResolvedValueOnce({ deleted: 7062 })
    render(<CacheTab />)
    await waitFor(() => screen.getByTestId('cache-clear-all'))
    fireEvent.click(screen.getByTestId('cache-clear-all'))
    await waitFor(() => {
      expect(clearCacheMock).toHaveBeenCalledWith('all')
      expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({
        level: 'success',
        title: '已清空全部缓存',
      }))
    })
  })

  it('8. count=0 时清空按钮 disabled', async () => {
    getCacheStatsMock.mockResolvedValueOnce(STATS_FIXTURE)
    render(<CacheTab />)
    await waitFor(() => {
      const btn = screen.getByTestId('cache-clear-analytics') as HTMLButtonElement
      expect(btn.disabled).toBe(true)
    })
  })

  it('9. Loading state（pending fetch）', async () => {
    getCacheStatsMock.mockReturnValueOnce(new Promise(() => {})) // pending
    const { container } = render(<CacheTab />)
    expect(container.querySelector('[data-testid="cache-tab"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="cache-stat-grid"]')).toBeNull()
  })

  it('10. Error state：fetch 失败 → ErrorState', async () => {
    getCacheStatsMock.mockRejectedValueOnce(new Error('cache 500'))
    render(<CacheTab />)
    await waitFor(() => {
      expect(screen.getAllByText(/加载失败|500/).length).toBeGreaterThan(0)
    })
  })

  it('11. refresh 按钮触发重新加载', async () => {
    getCacheStatsMock.mockResolvedValue(STATS_FIXTURE)
    render(<CacheTab />)
    await waitFor(() => screen.getByTestId('cache-refresh'))
    const initialCalls = getCacheStatsMock.mock.calls.length
    fireEvent.click(screen.getByTestId('cache-refresh'))
    await waitFor(() => {
      expect(getCacheStatsMock.mock.calls.length).toBeGreaterThan(initialCalls)
    })
  })

  it('12. all 类型不出现在 grid（仅"全部清空"顶栏按钮）', async () => {
    const STATS_WITH_ALL = [...STATS_FIXTURE, { type: 'all' as const, count: 7062, sizeKb: 2637.3 }]
    getCacheStatsMock.mockResolvedValueOnce(STATS_WITH_ALL)
    render(<CacheTab />)
    await waitFor(() => {
      expect(screen.queryByTestId('cache-card-all')).toBeNull()
      // 5 业务前缀卡片仍然存在
      expect(screen.getByTestId('cache-card-search')).not.toBeNull()
      expect(screen.getByTestId('cache-card-home')).not.toBeNull()
    })
  })
})

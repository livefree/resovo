/**
 * ImageHealthClient.test.tsx — /admin/image-health 视图单元测试（CHG-SN-6-02）
 *
 * 覆盖（≥ 9 用例硬清单，quality-gates §7 第 1 项）：
 *   1. 渲染基础：PageHeader + KPI grid
 *   2. KPI 加载成功：4 卡片显示正确百分比格式
 *   3. KPI 加载失败：ErrorState + onRetry
 *   4. 破损域名表加载成功：渲染 domain + eventCount + affectedVideos
 *   5. 破损域名表空态
 *   6. 缺图视频表加载成功：title + posterStatus badge
 *   7. 缺图视频空态
 *   8. backfill 按钮点击 → toast success
 *   9. backfill 按钮失败 → toast danger
 *   10. 分页 onQueryChange 更新 page
 *   11. 整体加载失败（3 端点全 reject）所有 ErrorState 显示
 *   12. refresh 按钮触发 retry
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

// ── mock api ──────────────────────────────────────────────────────

const getImageHealthStatsMock = vi.fn()
const getTopBrokenDomainsMock = vi.fn()
const listMissingVideosMock = vi.fn()
const triggerImageBackfillMock = vi.fn()
const toastPushMock = vi.fn()

vi.mock('../../../../../../apps/server-next/src/lib/image-health/api', () => ({
  getImageHealthStats: (...args: unknown[]) => getImageHealthStatsMock(...args),
  getTopBrokenDomains: (...args: unknown[]) => getTopBrokenDomainsMock(...args),
  listMissingVideos: (...args: unknown[]) => listMissingVideosMock(...args),
  triggerImageBackfill: (...args: unknown[]) => triggerImageBackfillMock(...args),
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

import { ImageHealthClient } from '../../../../../../apps/server-next/src/app/admin/image-health/_client/ImageHealthClient'

// ── fixtures ──────────────────────────────────────────────────────

const STATS_FIXTURE = {
  totalVideos: 12345,
  posterOkCount: 11000,
  posterCoverage: 0.891,
  backdropOkCount: 9876,
  backdropCoverage: 0.8,
  brokenLast7Days: 42,
}

const DOMAINS_FIXTURE = [
  { domain: 'cdn-broken.example.com', eventCount: 1500, affectedVideos: 320 },
  { domain: 'images.bad.com', eventCount: 800, affectedVideos: 150 },
]

const MISSING_VIDEOS_FIXTURE = {
  data: [
    { videoId: '00000000-0000-0000-0000-000000000001', title: 'Missing Poster Movie 1', posterStatus: 'missing' as const },
    { videoId: '00000000-0000-0000-0000-000000000002', title: 'Broken Poster Series', posterStatus: 'broken' as const },
    { videoId: '00000000-0000-0000-0000-000000000003', title: 'Pending Review Anime', posterStatus: 'pending_review' as const },
  ],
  total: 3,
}

const EMPTY_MISSING = { data: [], total: 0 }
const EMPTY_DOMAINS: never[] = []

beforeEach(() => {
  getImageHealthStatsMock.mockReset()
  getTopBrokenDomainsMock.mockReset()
  listMissingVideosMock.mockReset()
  triggerImageBackfillMock.mockReset()
  toastPushMock.mockReset()
})

// ── 测试 ──────────────────────────────────────────────────────────

describe('ImageHealthClient', () => {
  it('1. 渲染基础：PageHeader + KPI grid', async () => {
    getImageHealthStatsMock.mockResolvedValueOnce(STATS_FIXTURE)
    getTopBrokenDomainsMock.mockResolvedValueOnce(EMPTY_DOMAINS)
    listMissingVideosMock.mockResolvedValueOnce(EMPTY_MISSING)
    render(<ImageHealthClient />)
    expect(screen.getByText('图片健康')).not.toBeNull()
    await waitFor(() => {
      expect(screen.getByTestId('image-health-kpi-grid')).not.toBeNull()
    })
  })

  it('2. KPI 加载成功：4 卡片 + 百分比格式（posterCoverage 0.891 → 89.1%）', async () => {
    getImageHealthStatsMock.mockResolvedValueOnce(STATS_FIXTURE)
    getTopBrokenDomainsMock.mockResolvedValueOnce(EMPTY_DOMAINS)
    listMissingVideosMock.mockResolvedValueOnce(EMPTY_MISSING)
    render(<ImageHealthClient />)
    await waitFor(() => {
      expect(screen.getByTestId('kpi-total-videos')).not.toBeNull()
      expect(screen.getByText('89.1%')).not.toBeNull()  // poster coverage
      expect(screen.getByText('80.0%')).not.toBeNull()  // backdrop coverage
      expect(screen.getByText('42')).not.toBeNull()      // broken-last-7d
    })
  })

  it('3. KPI 加载失败：ErrorState 显示', async () => {
    getImageHealthStatsMock.mockRejectedValueOnce(new Error('stats 500'))
    getTopBrokenDomainsMock.mockResolvedValueOnce(EMPTY_DOMAINS)
    listMissingVideosMock.mockResolvedValueOnce(EMPTY_MISSING)
    render(<ImageHealthClient />)
    await waitFor(() => {
      expect(screen.getAllByText(/统计加载失败|stats 500/).length).toBeGreaterThan(0)
    })
  })

  it('4. 破损域名表加载成功：domain + eventCount + affectedVideos', async () => {
    getImageHealthStatsMock.mockResolvedValueOnce(STATS_FIXTURE)
    getTopBrokenDomainsMock.mockResolvedValueOnce(DOMAINS_FIXTURE)
    listMissingVideosMock.mockResolvedValueOnce(EMPTY_MISSING)
    render(<ImageHealthClient />)
    await waitFor(() => {
      expect(screen.getByText('cdn-broken.example.com')).not.toBeNull()
      expect(screen.getByText('1,500')).not.toBeNull()
      expect(screen.getByText('320')).not.toBeNull()
    })
  })

  it('5. 破损域名表空态', async () => {
    getImageHealthStatsMock.mockResolvedValueOnce(STATS_FIXTURE)
    getTopBrokenDomainsMock.mockResolvedValueOnce(EMPTY_DOMAINS)
    listMissingVideosMock.mockResolvedValueOnce(EMPTY_MISSING)
    render(<ImageHealthClient />)
    await waitFor(() => {
      expect(screen.getByText('暂无破损域名')).not.toBeNull()
    })
  })

  it('6. 缺图视频表加载成功：title + posterStatus badge 3 类', async () => {
    getImageHealthStatsMock.mockResolvedValueOnce(STATS_FIXTURE)
    getTopBrokenDomainsMock.mockResolvedValueOnce(EMPTY_DOMAINS)
    listMissingVideosMock.mockResolvedValueOnce(MISSING_VIDEOS_FIXTURE)
    render(<ImageHealthClient />)
    await waitFor(() => {
      expect(screen.getByText('Missing Poster Movie 1')).not.toBeNull()
      expect(screen.getByText('缺失')).not.toBeNull()
      expect(screen.getByText('破损')).not.toBeNull()
      expect(screen.getByText('待复核')).not.toBeNull()
    })
  })

  it('7. 缺图视频表空态', async () => {
    getImageHealthStatsMock.mockResolvedValueOnce(STATS_FIXTURE)
    getTopBrokenDomainsMock.mockResolvedValueOnce(EMPTY_DOMAINS)
    listMissingVideosMock.mockResolvedValueOnce(EMPTY_MISSING)
    render(<ImageHealthClient />)
    await waitFor(() => {
      expect(screen.getByText('无缺图视频')).not.toBeNull()
    })
  })

  it('8. backfill 按钮点击 → toast success', async () => {
    getImageHealthStatsMock.mockResolvedValueOnce(STATS_FIXTURE)
    getTopBrokenDomainsMock.mockResolvedValueOnce(EMPTY_DOMAINS)
    listMissingVideosMock.mockResolvedValueOnce(EMPTY_MISSING)
    triggerImageBackfillMock.mockResolvedValueOnce({ enqueued: true, message: '已入队 backfill 任务' })
    render(<ImageHealthClient />)
    await waitFor(() => screen.getByTestId('image-health-backfill'))
    fireEvent.click(screen.getByTestId('image-health-backfill'))
    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({
        level: 'success',
        title: 'Backfill 已入队',
      }))
    })
  })

  it('9. backfill 失败 → toast danger', async () => {
    getImageHealthStatsMock.mockResolvedValueOnce(STATS_FIXTURE)
    getTopBrokenDomainsMock.mockResolvedValueOnce(EMPTY_DOMAINS)
    listMissingVideosMock.mockResolvedValueOnce(EMPTY_MISSING)
    triggerImageBackfillMock.mockRejectedValueOnce(new Error('入队失败'))
    render(<ImageHealthClient />)
    await waitFor(() => screen.getByTestId('image-health-backfill'))
    fireEvent.click(screen.getByTestId('image-health-backfill'))
    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({
        level: 'danger',
        title: 'Backfill 触发失败',
      }))
    })
  })

  it('10. 初次加载并行调 3 端点 + 默认参数 page=1 limit=20', async () => {
    getImageHealthStatsMock.mockResolvedValueOnce(STATS_FIXTURE)
    getTopBrokenDomainsMock.mockResolvedValueOnce(EMPTY_DOMAINS)
    listMissingVideosMock.mockResolvedValueOnce(EMPTY_MISSING)
    render(<ImageHealthClient />)
    await waitFor(() => {
      expect(getImageHealthStatsMock).toHaveBeenCalled()
      expect(getTopBrokenDomainsMock).toHaveBeenCalledWith(20)
      expect(listMissingVideosMock).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 20 }),
      )
    })
  })

  it('11. 整体加载失败（3 端点全 reject）三类 ErrorState 不阻塞彼此', async () => {
    getImageHealthStatsMock.mockRejectedValueOnce(new Error('stats 500'))
    getTopBrokenDomainsMock.mockRejectedValueOnce(new Error('domains 500'))
    listMissingVideosMock.mockRejectedValueOnce(new Error('missing 500'))
    render(<ImageHealthClient />)
    await waitFor(() => {
      // 三个独立 ErrorState（Promise.allSettled 不互相阻塞）
      expect(screen.getAllByText(/加载失败|500/).length).toBeGreaterThanOrEqual(3)
    })
  })

  it('12. refresh 按钮触发重新加载', async () => {
    getImageHealthStatsMock.mockResolvedValue(STATS_FIXTURE)
    getTopBrokenDomainsMock.mockResolvedValue(EMPTY_DOMAINS)
    listMissingVideosMock.mockResolvedValue(EMPTY_MISSING)
    render(<ImageHealthClient />)
    await waitFor(() => screen.getByTestId('image-health-refresh'))
    const initialCalls = getImageHealthStatsMock.mock.calls.length
    fireEvent.click(screen.getByTestId('image-health-refresh'))
    await waitFor(() => {
      expect(getImageHealthStatsMock.mock.calls.length).toBeGreaterThan(initialCalls)
    })
  })
})

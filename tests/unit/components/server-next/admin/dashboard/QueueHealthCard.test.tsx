/**
 * QueueHealthCard.test.tsx — Dashboard 后台任务队列健康卡（DASH-QUEUE-HEALTH-B）
 *
 * 覆盖：
 *   1. 渲染全 9 队列行 + 标题 + 四计数（待/跑/完/败）
 *   2. active>0 → data-queue-active="true"（运行中高亮）
 *   3. degraded=true → 降级兜底条
 *   4. getQueueHealth 取数失败 → catch 视为降级（不崩、显兜底条）
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import type { AdminQueueCounts } from '@resovo/types'

const mockGetQueueHealth = vi.fn()

vi.mock('@/lib/dashboard/api', () => ({
  getQueueHealth: (...args: unknown[]) => mockGetQueueHealth(...args),
}))
vi.mock('@/lib/api-client', () => ({
  ApiClientError: class extends Error {},
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

import { QueueHealthCard } from '@/app/admin/_client/QueueHealthCard'

const Q = (waiting: number, active: number, completed: number, failed: number) => ({ waiting, active, completed, failed })

function makeCounts(over: Partial<AdminQueueCounts> = {}): AdminQueueCounts {
  const zero = Q(0, 0, 0, 0)
  return {
    crawler: zero, verify: zero, enrichment: zero, imageHealth: zero, maintenance: zero,
    identityCandidate: zero, homeAutofill: zero, doubanCollections: zero, bangumiCollections: zero,
    ...over,
  }
}

afterEach(() => {
  cleanup()
  mockGetQueueHealth.mockReset()
})
beforeEach(() => {
  mockGetQueueHealth.mockResolvedValue({ queueCounts: makeCounts(), degraded: false })
})

function card() {
  return screen.getByLabelText('后台任务队列') as HTMLElement
}

describe('QueueHealthCard', () => {
  it('渲染全 9 队列行 + 标题', async () => {
    render(<QueueHealthCard />)
    await waitFor(() => expect(card().querySelectorAll('[data-queue-row]')).toHaveLength(9))
    expect(card().querySelector('[data-queue-row="enrichment"]')).not.toBeNull()
    expect(within(card()).getByText('后台任务队列')).toBeTruthy()
  })

  it('enrichment 队列四计数渲染（待/跑/完/败）+ active>0 高亮', async () => {
    mockGetQueueHealth.mockResolvedValue({
      queueCounts: makeCounts({ enrichment: Q(12, 2, 200, 3) }),
      degraded: false,
    })
    render(<QueueHealthCard />)
    const row = await waitFor(() => {
      const r = card().querySelector('[data-queue-row="enrichment"]') as HTMLElement
      expect(r).not.toBeNull()
      return r
    })
    expect(row.getAttribute('data-queue-active')).toBe('true')
    expect(row.textContent).toContain('待 12')
    expect(row.textContent).toContain('跑 2')
    expect(row.textContent).toContain('完 200')
    expect(row.textContent).toContain('败 3')
  })

  it('active=0 → data-queue-active="false"', async () => {
    render(<QueueHealthCard />)
    const row = await waitFor(() => {
      const r = card().querySelector('[data-queue-row="crawler"]') as HTMLElement
      expect(r).not.toBeNull()
      return r
    })
    expect(row.getAttribute('data-queue-active')).toBe('false')
  })

  it('degraded=true → 降级兜底条', async () => {
    mockGetQueueHealth.mockResolvedValue({ queueCounts: makeCounts(), degraded: true })
    render(<QueueHealthCard />)
    await waitFor(() => expect(card().querySelector('[data-queue-degraded]')).not.toBeNull())
  })

  it('取数失败（reject）→ catch 视为降级，显兜底条不崩', async () => {
    mockGetQueueHealth.mockRejectedValue(new Error('5xx'))
    render(<QueueHealthCard />)
    await waitFor(() => expect(card().querySelector('[data-queue-degraded]')).not.toBeNull())
  })
})

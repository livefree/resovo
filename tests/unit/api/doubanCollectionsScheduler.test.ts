/**
 * tests/unit/api/doubanCollectionsScheduler.test.ts
 * CHG-DOUBAN-HOT-STORE-B-FIX（Codex stop-time review）：
 *   tick 用固定 jobId `refresh-douban-collections` 幂等去重 + removeOnComplete/Fail 释放，
 *   入独立 doubanCollectionsQueue（不阻塞 maintenanceQueue）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { add } = vi.hoisted(() => ({ add: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/api/lib/queue', () => ({ doubanCollectionsQueue: { add } }))

import { runDoubanCollectionsTick } from '@/api/workers/doubanCollectionsScheduler'

beforeEach(() => vi.clearAllMocks())

describe('runDoubanCollectionsTick', () => {
  it('入独立队列 + 固定 jobId 幂等 + removeOnComplete/Fail 释放', async () => {
    await runDoubanCollectionsTick()
    expect(add).toHaveBeenCalledOnce()
    const [jobData, opts] = add.mock.calls[0]
    expect(jobData).toEqual({ kind: 'refresh' })
    expect(opts.jobId).toBe('refresh-douban-collections')
    expect(opts.removeOnComplete).toBe(true)
    expect(opts.removeOnFail).toBe(true)
  })

  it('add 抛错（Redis 不可用）→ 吞掉不抛', async () => {
    add.mockRejectedValueOnce(new Error('redis down'))
    await expect(runDoubanCollectionsTick()).resolves.toBeUndefined()
  })
})

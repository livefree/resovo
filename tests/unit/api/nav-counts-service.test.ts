/**
 * nav-counts-service.test.ts — NavCountsService 单元测试（ADR-190 / NTLG-P0-1）
 *
 * 覆盖：
 *   - admin → 5 计数全集，omitted 空，partial=false
 *   - moderator → 角色门控（moderation/sources/userSubmissions 命中；imageHealth/merge omitted）
 *   - 单模块失败 → 该模块进 omitted + baseLogger.warn 留痕（逐模块容错 §11 D8，不拖垮整包）
 *   - merge 复用 VideoMergesService.listCandidates 的 total
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/db/queries/moderation', () => ({ countPendingModeration: vi.fn() }))
vi.mock('@/api/db/queries/sources-matrix', () => ({ getVideoGroupStats: vi.fn() }))
vi.mock('@/api/db/queries/imageHealth', () => ({ getImageHealthStats: vi.fn() }))
vi.mock('@/api/db/queries/userSubmissions', () => ({ countPendingSubmissions: vi.fn() }))

const listCandidatesMock = vi.fn()
vi.mock('@/api/services/VideoMergesService', () => ({
  VideoMergesService: class {
    listCandidates = (...args: unknown[]) => listCandidatesMock(...args)
  },
}))

vi.mock('@/api/lib/logger', () => ({
  baseLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import { NavCountsService } from '@/api/services/NavCountsService'
import { countPendingModeration } from '@/api/db/queries/moderation'
import { getVideoGroupStats } from '@/api/db/queries/sources-matrix'
import { getImageHealthStats } from '@/api/db/queries/imageHealth'
import { countPendingSubmissions } from '@/api/db/queries/userSubmissions'
import { baseLogger } from '@/api/lib/logger'

const mockPool = {} as unknown as import('pg').Pool

function primeAllHappy() {
  vi.mocked(countPendingModeration).mockResolvedValue(484)
  vi.mocked(getVideoGroupStats).mockResolvedValue({ total: 9, active: 7, dead: 1939, orphan: 0 } as never)
  vi.mocked(getImageHealthStats).mockResolvedValue({ brokenLast7Days: 597 } as never)
  vi.mocked(countPendingSubmissions).mockResolvedValue(12)
  listCandidatesMock.mockResolvedValue({ data: [], total: 6, page: 1, limit: 1, source: 'identity' })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('NavCountsService.getCounts', () => {
  it('admin → 5 计数全集，omitted 空，partial=false', async () => {
    primeAllHappy()
    const svc = new NavCountsService(mockPool)
    const r = await svc.getCounts('admin')
    expect(r.counts).toEqual({
      moderation: 484,
      sources: 1939,
      imageHealth: 597,
      userSubmissions: 12,
      merge: 6,
    })
    expect(r.omitted).toEqual([])
    expect(r.partial).toBe(false)
  })

  it('moderator → 角色门控：imageHealth/merge 省略，其余命中', async () => {
    primeAllHappy()
    const svc = new NavCountsService(mockPool)
    const r = await svc.getCounts('moderator')
    expect(r.counts).toEqual({ moderation: 484, sources: 1939, userSubmissions: 12 })
    expect(r.omitted.sort()).toEqual(['imageHealth', 'merge'])
    expect(r.partial).toBe(true)
    // admin-only 模块的 fetcher 不应被调用
    expect(getImageHealthStats).not.toHaveBeenCalled()
    expect(listCandidatesMock).not.toHaveBeenCalled()
  })

  it('单模块失败 → 进 omitted + baseLogger.warn（逐模块容错，不拖垮整包）', async () => {
    primeAllHappy()
    vi.mocked(getVideoGroupStats).mockRejectedValueOnce(new Error('db down'))
    const svc = new NavCountsService(mockPool)
    const r = await svc.getCounts('admin')
    // sources 降级省略，其余 4 仍返回
    expect(r.counts).toEqual({ moderation: 484, imageHealth: 597, userSubmissions: 12, merge: 6 })
    expect(r.omitted).toEqual(['sources'])
    expect(r.partial).toBe(true)
    expect(baseLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'sources' }),
      expect.stringContaining('degraded'),
    )
  })

  it('merge 计数取 VideoMergesService.listCandidates 的 total（identity 来源）', async () => {
    primeAllHappy()
    listCandidatesMock.mockResolvedValueOnce({ data: [], total: 42, page: 1, limit: 1, source: 'identity' })
    const svc = new NavCountsService(mockPool)
    const r = await svc.getCounts('admin')
    expect(r.counts.merge).toBe(42)
    // 复用 candidates 路径：source=identity
    expect(listCandidatesMock).toHaveBeenCalledWith(expect.objectContaining({ source: 'identity' }))
  })
})

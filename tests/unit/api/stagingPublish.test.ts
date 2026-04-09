/**
 * tests/unit/api/stagingPublish.test.ts
 * CHG-383: StagingPublishService 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StagingPublishService } from '@/api/services/StagingPublishService'
import type { StagingVideo, StagingPublishRules } from '@/api/db/queries/staging'
import { DEFAULT_STAGING_RULES } from '@/api/db/queries/staging'

// ── Mocks ─────────────────────────────────────────────────────────

vi.mock('@/api/db/queries/staging', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/db/queries/staging')>()
  return {
    ...actual,
    listReadyStagingVideoIds: vi.fn(),
  }
})

vi.mock('@/api/db/queries/videos', () => ({
  transitionVideoState: vi.fn(),
}))

vi.mock('@/api/db/queries/systemSettings', () => ({
  getSetting: vi.fn(),
  setSetting: vi.fn(),
}))

import * as stagingQueries from '@/api/db/queries/staging'
import * as videoQueries from '@/api/db/queries/videos'
import * as systemSettings from '@/api/db/queries/systemSettings'

const mockListReady = stagingQueries.listReadyStagingVideoIds as ReturnType<typeof vi.fn>
const mockTransition = videoQueries.transitionVideoState as ReturnType<typeof vi.fn>
const mockGetSetting = systemSettings.getSetting as ReturnType<typeof vi.fn>
const mockSetSetting = systemSettings.setSetting as ReturnType<typeof vi.fn>

// ── Helpers ────────────────────────────────────────────────────────

function makeDb() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
  } as unknown as import('pg').Pool
}

function makeStagingVideo(overrides: Partial<StagingVideo> = {}): StagingVideo {
  return {
    id: 'vid-1',
    shortId: 'abCD1234',
    slug: 'test-vid',
    title: '测试视频',
    titleEn: null,
    coverUrl: 'https://example.com/cover.jpg',
    type: 'movie',
    year: 2024,
    doubanStatus: 'matched',
    sourceCheckStatus: 'ok',
    metaScore: 80,
    activeSourceCount: 2,
    approvedAt: '2026-04-09T00:00:00.000Z',
    updatedAt: '2026-04-09T00:00:00.000Z',
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────

describe('StagingPublishService.checkReadiness', () => {
  const svc = new StagingPublishService(makeDb())
  const rules: StagingPublishRules = {
    minMetaScore: 60,
    requireDoubanMatched: false,
    requireCoverUrl: true,
    minActiveSourceCount: 1,
  }

  it('满足所有条件 — ready=true, blockers 为空', () => {
    const result = svc.checkReadiness(makeStagingVideo(), rules)
    expect(result.ready).toBe(true)
    expect(result.blockers).toHaveLength(0)
  })

  it('meta_score 不足 — 阻塞', () => {
    const result = svc.checkReadiness(makeStagingVideo({ metaScore: 30 }), rules)
    expect(result.ready).toBe(false)
    expect(result.blockers.some((b) => b.includes('元数据评分'))).toBe(true)
  })

  it('缺封面 + requireCoverUrl=true — 阻塞', () => {
    const result = svc.checkReadiness(makeStagingVideo({ coverUrl: null }), rules)
    expect(result.ready).toBe(false)
    expect(result.blockers.some((b) => b.includes('封面'))).toBe(true)
  })

  it('activeSourceCount=0 — 阻塞', () => {
    const result = svc.checkReadiness(makeStagingVideo({ activeSourceCount: 0 }), rules)
    expect(result.ready).toBe(false)
    expect(result.blockers.some((b) => b.includes('活跃源'))).toBe(true)
  })

  it('sourceCheckStatus=all_dead — 阻塞', () => {
    const result = svc.checkReadiness(makeStagingVideo({ sourceCheckStatus: 'all_dead' }), rules)
    expect(result.ready).toBe(false)
    expect(result.blockers.some((b) => b.includes('失效'))).toBe(true)
  })

  it('requireDoubanMatched=true 且 doubanStatus!=matched — 阻塞', () => {
    const strictRules = { ...rules, requireDoubanMatched: true }
    const result = svc.checkReadiness(makeStagingVideo({ doubanStatus: 'unmatched' }), strictRules)
    expect(result.ready).toBe(false)
    expect(result.blockers.some((b) => b.includes('豆瓣'))).toBe(true)
  })
})

describe('StagingPublishService.getRules', () => {
  beforeEach(() => vi.clearAllMocks())

  it('无 settings — 返回 DEFAULT_STAGING_RULES', async () => {
    mockGetSetting.mockResolvedValue(null)
    const svc = new StagingPublishService(makeDb())
    const rules = await svc.getRules()
    expect(rules).toEqual(DEFAULT_STAGING_RULES)
  })

  it('有效 JSON settings — 正确解析', async () => {
    const stored = { minMetaScore: 70, requireDoubanMatched: true, requireCoverUrl: false, minActiveSourceCount: 2 }
    mockGetSetting.mockResolvedValue(JSON.stringify(stored))
    const svc = new StagingPublishService(makeDb())
    const rules = await svc.getRules()
    expect(rules).toEqual(stored)
  })

  it('无效 JSON — 回退 DEFAULT_STAGING_RULES', async () => {
    mockGetSetting.mockResolvedValue('invalid-json')
    const svc = new StagingPublishService(makeDb())
    const rules = await svc.getRules()
    expect(rules).toEqual(DEFAULT_STAGING_RULES)
  })
})

describe('StagingPublishService.publishReadyBatch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('有 2 条就绪 — 全部发布', async () => {
    mockGetSetting.mockResolvedValue(null)  // 使用默认规则
    mockListReady.mockResolvedValue(['vid-1', 'vid-2'])
    mockTransition.mockResolvedValue({ id: 'vid-1', review_status: 'approved', visibility_status: 'public', is_published: true, updated_at: '' })
    mockSetSetting.mockResolvedValue(undefined)

    const svc = new StagingPublishService(makeDb())
    const result = await svc.publishReadyBatch(50)
    expect(result.published).toBe(2)
    expect(result.skipped).toBe(0)
  })

  it('transitionVideoState 返回 null（视频消失）— 计入 skipped', async () => {
    mockGetSetting.mockResolvedValue(null)
    mockListReady.mockResolvedValue(['vid-gone'])
    mockTransition.mockResolvedValue(null)
    mockSetSetting.mockResolvedValue(undefined)

    const svc = new StagingPublishService(makeDb())
    const result = await svc.publishReadyBatch(50)
    expect(result.published).toBe(0)
    expect(result.skipped).toBe(1)
  })

  it('无就绪视频 — 0 published', async () => {
    mockGetSetting.mockResolvedValue(null)
    mockListReady.mockResolvedValue([])
    mockSetSetting.mockResolvedValue(undefined)

    const svc = new StagingPublishService(makeDb())
    const result = await svc.publishReadyBatch(50)
    expect(result.published).toBe(0)
    expect(result.skipped).toBe(0)
  })
})

describe('StagingPublishService.publishSingle', () => {
  beforeEach(() => vi.clearAllMocks())

  it('发布成功 — 返回 true', async () => {
    mockTransition.mockResolvedValue({
      id: 'vid-1', review_status: 'approved', visibility_status: 'public',
      is_published: true, updated_at: '',
    })
    const svc = new StagingPublishService(makeDb())
    const ok = await svc.publishSingle('vid-1', 'admin-1')
    expect(ok).toBe(true)
    expect(mockTransition).toHaveBeenCalledWith(expect.anything(), 'vid-1', {
      action: 'publish',
      reviewedBy: 'admin-1',
    })
  })

  it('视频不存在 — 返回 false', async () => {
    mockTransition.mockResolvedValue(null)
    const svc = new StagingPublishService(makeDb())
    const ok = await svc.publishSingle('vid-gone', 'admin-1')
    expect(ok).toBe(false)
  })
})

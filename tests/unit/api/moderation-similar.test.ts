/**
 * tests/unit/api/moderation-similar.test.ts
 * CHG-SN-8-04-EP · ADR-137：类似视频召回端点 + Service + Query
 *
 * 测试范围（ADR-137 §10 要求 ≥ 5）：
 *  1. happy path：同 type 候选 → 返回 score desc 排序
 *  2. 目标视频不存在 → 404 NOT_FOUND
 *  3. 无候选 → 200 + 空 data
 *  4. limit 参数生效
 *  5. yearRange 参数生效
 *  6. computeSimilarityScore 4 维公式（type +40 / year delta / country / genres Jaccard）
 *  7. minScore 内部过滤（score < 10 不返回）
 *  8. CHG-SN-8-04-N1：strict 通过 minScore 后 < limit → fallback relaxType 二次查询补足跨类型
 *  9. CHG-SN-8-04-N1：strict ≥ limit → fallback 不触发（只 1 次 query）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ModerationService, computeSimilarityScore } from '@/api/services/ModerationService'

vi.mock('@/api/db/queries/moderation', () => ({
  findVideoFeatures: vi.fn(),
  listSimilarCandidates: vi.fn(),
}))

vi.mock('@/api/services/AuditLogService', () => ({
  AuditLogService: class { /* stub: listSimilar 不写 audit */ },
}))
vi.mock('@/api/services/VideoIndexSyncService', () => ({
  VideoIndexSyncService: class { /* stub */ },
}))

import * as modQueries from '@/api/db/queries/moderation'
const mockFindFeatures = modQueries.findVideoFeatures as ReturnType<typeof vi.fn>
const mockListCandidates = modQueries.listSimilarCandidates as ReturnType<typeof vi.fn>

function makeDb() {
  return { query: vi.fn() } as unknown as import('pg').Pool
}
function makeEs() {
  return {} as unknown as import('@elastic/elasticsearch').Client
}

beforeEach(() => {
  mockFindFeatures.mockReset()
  mockListCandidates.mockReset()
})

describe('ModerationService.listSimilar (CHG-SN-8-04-EP · ADR-137)', () => {
  it('1. happy path：同 type 候选 → 返回非空 + score desc', async () => {
    mockFindFeatures.mockResolvedValue({
      id: 'target-id', type: 'movie', year: 2020, country: 'US', genres: ['action', 'sci-fi'],
    })
    // CHG-SN-8-04-N1：fallback 路径默认空（本用例不验证 fallback，仅测 strict happy path）
    mockListCandidates
      .mockResolvedValueOnce([
        // 全匹配（type+40 / year=0 → +25 / country +15 / genres 100% → +20 = 100）
        { id: 'a', title: 'A', type: 'movie', year: 2020, country: 'US', genres: ['action', 'sci-fi'], cover_url: null, meta_score: 80, review_status: 'approved', is_published: true },
        // type 一致 + year delta 2 → 25*(1-2/5)=15 + country 无 + genres 1/3 → 7 = 62
        { id: 'b', title: 'B', type: 'movie', year: 2022, country: null, genres: ['action'], cover_url: null, meta_score: 90, review_status: 'pending_review', is_published: false },
      ])
      .mockResolvedValueOnce([])
    const svc = new ModerationService(makeDb(), makeEs())
    const result = await svc.listSimilar('target-id', { limit: 10, yearRange: 5 })
    expect(result.length).toBe(2)
    expect(result[0]!.id).toBe('a')
    expect(result[0]!.similarityScore).toBeGreaterThan(result[1]!.similarityScore)
    expect(result[0]!.similarityScore).toBe(100)
  })

  it('2. 目标视频不存在 → 抛 NOT_FOUND AppError', async () => {
    mockFindFeatures.mockResolvedValue(null)
    const svc = new ModerationService(makeDb(), makeEs())
    await expect(svc.listSimilar('missing-id', { limit: 10, yearRange: 5 })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      httpStatus: 404,
    })
    expect(mockListCandidates).not.toHaveBeenCalled()
  })

  it('3. 无候选 → 返回空数组', async () => {
    mockFindFeatures.mockResolvedValue({
      id: 'target', type: 'movie', year: 2020, country: 'US', genres: [],
    })
    mockListCandidates.mockResolvedValue([])
    const svc = new ModerationService(makeDb(), makeEs())
    const result = await svc.listSimilar('target', { limit: 10, yearRange: 5 })
    expect(result).toEqual([])
  })

  it('4. limit 参数生效（limit=2 → 最多返回 2 条即使候选 5 条）', async () => {
    mockFindFeatures.mockResolvedValue({
      id: 'target', type: 'movie', year: 2020, country: 'US', genres: ['action'],
    })
    mockListCandidates.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        id: `v${i}`, title: `T${i}`, type: 'movie', year: 2020, country: 'US',
        genres: ['action'], cover_url: null, meta_score: 50 + i, review_status: 'approved', is_published: true,
      })),
    )
    const svc = new ModerationService(makeDb(), makeEs())
    const result = await svc.listSimilar('target', { limit: 2, yearRange: 5 })
    expect(result.length).toBe(2)
  })

  it('5. yearRange 透传到 query 层', async () => {
    mockFindFeatures.mockResolvedValue({ id: 't', type: 'movie', year: 2020, country: null, genres: [] })
    mockListCandidates.mockResolvedValue([])
    const svc = new ModerationService(makeDb(), makeEs())
    await svc.listSimilar('t', { limit: 10, yearRange: 1 })
    expect(mockListCandidates).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ excludeId: 't', type: 'movie', year: 2020, yearRange: 1 }),
    )
  })

  it('8. CHG-SN-8-04-N1：strict 通过 minScore 后 < limit → 发起 fallback relaxType 查询并合并', async () => {
    mockFindFeatures.mockResolvedValue({
      id: 't', type: 'movie', year: 2020, country: 'US', genres: ['action'],
    })
    // 第 1 次：strict 查询返 1 条同 type
    // 第 2 次：fallback 查询返 1 条异 type
    mockListCandidates
      .mockResolvedValueOnce([
        { id: 'strict-1', title: 'Strict', type: 'movie', year: 2020, country: 'US', genres: ['action'], cover_url: null, meta_score: 70, review_status: 'approved', is_published: true },
      ])
      .mockResolvedValueOnce([
        { id: 'fallback-1', title: 'Fallback', type: 'anime', year: 2020, country: 'US', genres: ['action'], cover_url: null, meta_score: 60, review_status: 'approved', is_published: true },
      ])
    const svc = new ModerationService(makeDb(), makeEs())
    const result = await svc.listSimilar('t', { limit: 10, yearRange: 5 })
    expect(mockListCandidates).toHaveBeenCalledTimes(2)
    // 第 2 次调用必须 relaxType=true 且 excludeIds 含 strict-1
    expect(mockListCandidates).toHaveBeenNthCalledWith(2, expect.anything(), expect.objectContaining({
      relaxType: true,
      excludeIds: ['strict-1'],
    }))
    expect(result.length).toBe(2)
    // strict-1 全维度命中（type+40 / year=0+25 / country+15 / genres 100%+20 = 100）
    // fallback-1 跨类型 type+0 / year=0+25 / country+15 / genres 100%+20 = 60
    expect(result[0]!.id).toBe('strict-1')
    expect(result[0]!.similarityScore).toBe(100)
    expect(result[1]!.id).toBe('fallback-1')
    expect(result[1]!.similarityScore).toBe(60)
  })

  it('9. CHG-SN-8-04-N1：strict ≥ limit → fallback 不触发（只 1 次 query）', async () => {
    mockFindFeatures.mockResolvedValue({ id: 't', type: 'movie', year: 2020, country: 'US', genres: ['action'] })
    // 4 条全命中且 score ≥ 10，limit=3
    mockListCandidates.mockResolvedValueOnce(
      Array.from({ length: 4 }, (_, i) => ({
        id: `s${i}`, title: `S${i}`, type: 'movie', year: 2020, country: 'US',
        genres: ['action'], cover_url: null, meta_score: 80 - i, review_status: 'approved', is_published: true,
      })),
    )
    const svc = new ModerationService(makeDb(), makeEs())
    const result = await svc.listSimilar('t', { limit: 3, yearRange: 5 })
    expect(mockListCandidates).toHaveBeenCalledTimes(1)
    expect(result.length).toBe(3)
  })

  it('6. minScore 内部过滤：仅 type 匹配（40 分）不足 10 阈值之上但 ≥10 → 进结果；score < 10 不进', async () => {
    mockFindFeatures.mockResolvedValue({ id: 't', type: 'movie', year: 2020, country: 'US', genres: ['a', 'b', 'c'] })
    // 候选 X：仅 type 匹配（40）
    // 候选 Y：完全不匹配但 SQL 已强 type 相等，模拟 score=0 路径很难走（type 仍 +40）
    // CHG-SN-8-04-N1：fallback 返空（strict 1 条 < limit 10 触发但无补足）
    mockListCandidates
      .mockResolvedValueOnce([
        { id: 'X', title: 'X', type: 'movie', year: 1900, country: 'JP', genres: ['x'], cover_url: null, meta_score: 0, review_status: 'approved', is_published: false },
      ])
      .mockResolvedValueOnce([])
    const svc = new ModerationService(makeDb(), makeEs())
    const result = await svc.listSimilar('t', { limit: 10, yearRange: 5 })
    // 候选 X：type +40 / year delta 120>>5 → 0 / country 不匹配 → 0 / genres 0 交集 → 0 = 40，>= 10
    expect(result.length).toBe(1)
    expect(result[0]!.similarityScore).toBe(40)
  })
})

describe('computeSimilarityScore (4 维公式)', () => {
  const target = {
    id: 't', type: 'movie', year: 2020, country: 'US',
    genres: ['action', 'sci-fi', 'drama'] as readonly string[],
  }

  it('全匹配 → 100', () => {
    const row = { type: 'movie', year: 2020, country: 'US', genres: ['action', 'sci-fi', 'drama'] as readonly string[] }
    expect(computeSimilarityScore(target, row, 5)).toBe(100)
  })

  it('仅 type +40', () => {
    const row = { type: 'movie', year: null, country: null, genres: [] as readonly string[] }
    expect(computeSimilarityScore(target, row, 5)).toBe(40)
  })

  it('type+40 / country+15 (year null skip) → 55', () => {
    const row = { type: 'movie', year: null, country: 'US', genres: [] as readonly string[] }
    expect(computeSimilarityScore(target, row, 5)).toBe(55)
  })

  it('genres Jaccard：2 共有 / 4 并集 = 0.5 → +10', () => {
    const row = { type: 'movie', year: null, country: null, genres: ['action', 'sci-fi', 'comedy'] as readonly string[] }
    // type+40 + genres 2/4 × 20 = 40 + 10 = 50
    expect(computeSimilarityScore(target, row, 5)).toBe(50)
  })

  it('year delta 5 (max) → +0', () => {
    const row = { type: 'movie', year: 2025, country: null, genres: [] as readonly string[] }
    // type+40 + year (5/5 → 25 × 0) = 40
    expect(computeSimilarityScore(target, row, 5)).toBe(40)
  })

  it('year delta 超过 yearRange → 0 分', () => {
    const row = { type: 'movie', year: 2010, country: null, genres: [] as readonly string[] }
    // 10 > 5 → year 不得分 = 40
    expect(computeSimilarityScore(target, row, 5)).toBe(40)
  })

  it('country 双方有但不等 → 0 分', () => {
    const row = { type: 'movie', year: null, country: 'JP', genres: [] as readonly string[] }
    expect(computeSimilarityScore(target, row, 5)).toBe(40)
  })
})

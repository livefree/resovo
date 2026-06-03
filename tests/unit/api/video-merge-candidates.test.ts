/**
 * video-merge-candidates.test.ts — VideoMergesService + DB 查询单元测试（CHG-SN-5-09）
 *
 * 覆盖：
 * - fetchRawCandidateGroups: SQL 参数传递 + type 过滤
 * - countRawCandidateGroups: 统计查询
 * - fetchVideoDetailsForCandidates: 批量 video + source 摘要查询
 * - VideoMergesService.listCandidates: 评分算法 + minScore 过滤 + 分页 + 推荐 target
 *   （CHG-VIR-9-D 默认翻 identity 后本文件全部调用显式 source:'legacy'——测 legacy 实时聚合路径）
 * - ListCandidatesSchema: zod 默认值 + 边界校验
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fetchRawCandidateGroups,
  countRawCandidateGroups,
  fetchVideoDetailsForCandidates,
} from '@/api/db/queries/video-merge-candidates'
import { VideoMergesService, ListCandidatesSchema } from '@/api/services/VideoMergesService'

// ── mock helpers ──────────────────────────────────────────────────

const mockQuery = vi.fn()
const mockDb = { query: mockQuery } as unknown as import('pg').Pool

beforeEach(() => {
  mockQuery.mockReset()
})

// ── fixtures ──────────────────────────────────────────────────────

const GROUP_ROW = {
  title_normalized: '復仇者聯盟',
  year: 2019,
  type: 'movie' as const,
  video_ids: ['vid-a', 'vid-b'],
  video_count: '2',
}

function makeVideoRow(id: string, siteKeys: string[], sourceCount = 3, createdAt = '2026-01-01T00:00:00Z') {
  return {
    id,
    title: `Video ${id}`,
    title_normalized: '復仇者聯盟',
    year: 2019,
    type: 'movie' as const,
    created_at: createdAt,
    source_count: String(sourceCount),
    site_keys: siteKeys,
  }
}

// ── fetchRawCandidateGroups ───────────────────────────────────────

describe('fetchRawCandidateGroups', () => {
  it('调用时不传 type 则 $1 = null', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await fetchRawCandidateGroups(mockDb, { type: null, offset: 0, limit: 20 })
    const args: unknown[] = mockQuery.mock.calls[0][1] as unknown[]
    expect(args[0]).toBeNull()
  })

  it('传入 type=movie 则 $1 = movie', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await fetchRawCandidateGroups(mockDb, { type: 'movie', offset: 0, limit: 20 })
    const args: unknown[] = mockQuery.mock.calls[0][1] as unknown[]
    expect(args[0]).toBe('movie')
  })

  it('正确传 limit 和 offset', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await fetchRawCandidateGroups(mockDb, { type: null, offset: 40, limit: 20 })
    const args: unknown[] = mockQuery.mock.calls[0][1] as unknown[]
    expect(args[1]).toBe(20)
    expect(args[2]).toBe(40)
  })

  it('返回原始行数组', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [GROUP_ROW] })
    const result = await fetchRawCandidateGroups(mockDb, { type: null, offset: 0, limit: 20 })
    expect(result).toHaveLength(1)
    expect(result[0]?.title_normalized).toBe('復仇者聯盟')
  })
})

// ── countRawCandidateGroups ───────────────────────────────────────

describe('countRawCandidateGroups', () => {
  it('返回解析后的整数', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ total: '42' }] })
    const count = await countRawCandidateGroups(mockDb, { type: null })
    expect(count).toBe(42)
  })

  it('无结果时返回 0', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ total: '0' }] })
    const count = await countRawCandidateGroups(mockDb, { type: 'anime' })
    expect(count).toBe(0)
  })
})

// ── fetchVideoDetailsForCandidates ────────────────────────────────

describe('fetchVideoDetailsForCandidates', () => {
  it('空 ids 时直接返回 []，不查询 DB', async () => {
    const result = await fetchVideoDetailsForCandidates(mockDb, [])
    expect(mockQuery).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })

  it('传 videoIds 数组时 SQL 含 ANY($1::uuid[])', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await fetchVideoDetailsForCandidates(mockDb, ['vid-a', 'vid-b'])
    const sql: string = mockQuery.mock.calls[0][0] as string
    expect(sql).toContain('ANY($1::uuid[])')
  })

  it('返回正确的 site_keys 数组', async () => {
    const row = makeVideoRow('vid-a', ['iqiyi', 'youku'], 2)
    mockQuery.mockResolvedValueOnce({ rows: [row] })
    const result = await fetchVideoDetailsForCandidates(mockDb, ['vid-a'])
    expect(result[0]?.site_keys).toEqual(['iqiyi', 'youku'])
  })
})

// ── VideoMergesService.listCandidates ─────────────────────────────

describe('VideoMergesService.listCandidates', () => {
  const svc = new VideoMergesService(mockDb)

  it('无候选组时返回空 data + 正确 total/page/limit', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })       // fetchRawCandidateGroups
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })  // countRawCandidateGroups
    const res = await svc.listCandidates({ source: 'legacy', type: undefined, minScore: 0.6, limit: 20, page: 1 })
    expect(res.data).toHaveLength(0)
    expect(res.total).toBe(0)
    expect(res.page).toBe(1)
    expect(res.limit).toBe(20)
  })

  it('两 video 共享 site key → score > 0，满足 minScore 通过', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [GROUP_ROW] })
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [
        makeVideoRow('vid-a', ['iqiyi', 'youku'], 2),
        makeVideoRow('vid-b', ['iqiyi', 'bilibili'], 3),
      ] })
    const res = await svc.listCandidates({ source: 'legacy', type: undefined, minScore: 0.3, limit: 20, page: 1 })
    expect(res.data).toHaveLength(1)
    // shared = ['iqiyi'] (1), union = ['iqiyi','youku','bilibili'] (3) → score = 1/3 ≈ 0.333
    expect(res.data[0]?.score).toBeCloseTo(1 / 3, 3)
  })

  it('score < minScore 时被过滤', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [GROUP_ROW] })
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [
        makeVideoRow('vid-a', ['iqiyi'], 1),
        makeVideoRow('vid-b', ['youku'], 1),
      ] })
    // shared = 0, union = 2 → score = 0 < 0.6
    const res = await svc.listCandidates({ source: 'legacy', type: undefined, minScore: 0.6, limit: 20, page: 1 })
    expect(res.data).toHaveLength(0)
  })

  it('两 video 完全重合 site keys → score = 1.0', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [GROUP_ROW] })
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [
        makeVideoRow('vid-a', ['iqiyi', 'youku'], 2),
        makeVideoRow('vid-b', ['iqiyi', 'youku'], 2),
      ] })
    const res = await svc.listCandidates({ source: 'legacy', type: undefined, minScore: 0.6, limit: 20, page: 1 })
    expect(res.data[0]?.score).toBeCloseTo(1.0, 4)
  })

  it('两 video 均无 site keys → score = 0，被 minScore=0.6 过滤', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [GROUP_ROW] })
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [
        makeVideoRow('vid-a', [], 0),
        makeVideoRow('vid-b', [], 0),
      ] })
    const res = await svc.listCandidates({ source: 'legacy', type: undefined, minScore: 0.6, limit: 20, page: 1 })
    expect(res.data).toHaveLength(0)
  })

  it('推荐 target = source 最多的 video', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [GROUP_ROW] })
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [
        makeVideoRow('vid-a', ['iqiyi', 'youku'], 2),   // sourceCount=2
        makeVideoRow('vid-b', ['iqiyi', 'youku'], 5),   // sourceCount=5 ← 更多
      ] })
    const res = await svc.listCandidates({ source: 'legacy', type: undefined, minScore: 0, limit: 20, page: 1 })
    expect(res.data[0]?.recommendedTargetVideoId).toBe('vid-b')
  })

  it('source 相同时推荐最早 createdAt 的 video', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [GROUP_ROW] })
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [
        makeVideoRow('vid-a', ['iqiyi'], 2, '2025-01-01T00:00:00Z'),  // 更早
        makeVideoRow('vid-b', ['iqiyi'], 2, '2025-06-01T00:00:00Z'),
      ] })
    const res = await svc.listCandidates({ source: 'legacy', type: undefined, minScore: 0, limit: 20, page: 1 })
    expect(res.data[0]?.recommendedTargetVideoId).toBe('vid-a')
  })

  it('type 过滤参数正确传递至 DB 查询', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
    await svc.listCandidates({ source: 'legacy', type: 'anime', minScore: 0.6, limit: 20, page: 1 })
    const args1: unknown[] = mockQuery.mock.calls[0][1] as unknown[]
    const args2: unknown[] = mockQuery.mock.calls[1][1] as unknown[]
    expect(args1[0]).toBe('anime')
    expect(args2[0]).toBe('anime')
  })

  it('分页：page=2, limit=10 → offset=10', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '25' }] })
    const res = await svc.listCandidates({ source: 'legacy', type: undefined, minScore: 0.6, limit: 10, page: 2 })
    const args: unknown[] = mockQuery.mock.calls[0][1] as unknown[]
    expect(args[2]).toBe(10)   // offset
    expect(res.page).toBe(2)
    expect(res.limit).toBe(10)
    expect(res.total).toBe(25)
  })

  // ADR-150 阶段 5 EP-4 follow-up（2026-05-25）：Merge sort 全栈打通 / Service 层 sort 单测
  describe('sort 全栈（ADR-150 阶段 5 EP-4 follow-up）', () => {
    const mockTwoGroups = () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [
          { title_normalized: 'a-low', year: 2020, type: 'movie', video_ids: ['vid-1', 'vid-2'], video_count: '2' },
          { title_normalized: 'b-high', year: 2024, type: 'movie', video_ids: ['vid-3', 'vid-4', 'vid-5'], video_count: '3' },
        ] })
        .mockResolvedValueOnce({ rows: [{ total: '2' }] })
        .mockResolvedValueOnce({ rows: [
          // group 1: low score（共享 0 / union 2）→ 0.0
          makeVideoRow('vid-1', ['site-a'], 1),
          makeVideoRow('vid-2', ['site-b'], 1),
          // group 2: high score（共享 2 / union 2）→ 1.0
          makeVideoRow('vid-3', ['site-x', 'site-y'], 2),
          makeVideoRow('vid-4', ['site-x', 'site-y'], 2),
          makeVideoRow('vid-5', ['site-x', 'site-y'], 2),
        ] })
    }

    it('默认 sortField → score DESC（向后兼容 / CHG-SN-5-10-PATCH P2）', async () => {
      mockTwoGroups()
      const res = await svc.listCandidates({ source: 'legacy', type: undefined, minScore: 0, limit: 20, page: 1 })
      expect(res.data[0]?.titleNormalized).toBe('b-high') // score=1.0 first
      expect(res.data[1]?.titleNormalized).toBe('a-low')  // score=0 second
    })

    it('sortField=score sortDir=asc → score 升序', async () => {
      mockTwoGroups()
      const res = await svc.listCandidates({ source: 'legacy', type: undefined, minScore: 0, limit: 20, page: 1, sortField: 'score', sortDir: 'asc' })
      expect(res.data[0]?.titleNormalized).toBe('a-low')  // score=0 first
      expect(res.data[1]?.titleNormalized).toBe('b-high') // score=1.0 second
    })

    it('sortField=videoCount sortDir=desc → 候选数降序', async () => {
      mockTwoGroups()
      const res = await svc.listCandidates({ source: 'legacy', type: undefined, minScore: 0, limit: 20, page: 1, sortField: 'videoCount', sortDir: 'desc' })
      expect(res.data[0]?.titleNormalized).toBe('b-high') // 3 videos
      expect(res.data[1]?.titleNormalized).toBe('a-low')  // 2 videos
    })

    it('sortField=year sortDir=asc → 年份升序', async () => {
      mockTwoGroups()
      const res = await svc.listCandidates({ source: 'legacy', type: undefined, minScore: 0, limit: 20, page: 1, sortField: 'year', sortDir: 'asc' })
      expect(res.data[0]?.year).toBe(2020)
      expect(res.data[1]?.year).toBe(2024)
    })

    it('sortField=titleNormalized sortDir=asc → 作品名 localeCompare 升序', async () => {
      mockTwoGroups()
      const res = await svc.listCandidates({ source: 'legacy', type: undefined, minScore: 0, limit: 20, page: 1, sortField: 'titleNormalized', sortDir: 'asc' })
      expect(res.data[0]?.titleNormalized).toBe('a-low')
      expect(res.data[1]?.titleNormalized).toBe('b-high')
    })
  })

  it('sort tiebreaker：同 score 候选组按 groupKey 升序稳定（CHG-SN-5-10-PATCH P2）', async () => {
    // 两组同 score（都共享 1 个 site key / 2 总 key → 0.5），groupKey 不同
    const groupB = {
      title_normalized: 'b_title',
      year: 2020,
      type: 'movie' as const,
      video_ids: ['vid-b1', 'vid-b2'],
      video_count: '2',
    }
    const groupA = {
      title_normalized: 'a_title',
      year: 2020,
      type: 'movie' as const,
      video_ids: ['vid-a1', 'vid-a2'],
      video_count: '2',
    }
    mockQuery
      .mockResolvedValueOnce({ rows: [groupB, groupA] }) // DB 初排可能给 B 在 A 前（COUNT 相同 + title_normalized 顺序未稳定）
      .mockResolvedValueOnce({ rows: [{ total: '2' }] })
      .mockResolvedValueOnce({ rows: [
        { ...makeVideoRow('vid-a1', ['iqiyi', 'youku'], 2), title_normalized: 'a_title' },
        { ...makeVideoRow('vid-a2', ['iqiyi', 'bilibili'], 2), title_normalized: 'a_title' },
        { ...makeVideoRow('vid-b1', ['iqiyi', 'youku'], 2), title_normalized: 'b_title' },
        { ...makeVideoRow('vid-b2', ['iqiyi', 'bilibili'], 2), title_normalized: 'b_title' },
      ] })
    const res = await svc.listCandidates({ source: 'legacy', type: undefined, minScore: 0, limit: 20, page: 1 })
    expect(res.data).toHaveLength(2)
    // 同 score → 按 groupKey 升序：'a_title|2020|movie' < 'b_title|2020|movie'
    expect(res.data[0]?.groupKey).toBe('a_title|2020|movie')
    expect(res.data[1]?.groupKey).toBe('b_title|2020|movie')
    expect(res.data[0]?.score).toBe(res.data[1]?.score)
  })
})

// ── ListCandidatesSchema ──────────────────────────────────────────

describe('ListCandidatesSchema', () => {
  it('空输入使用默认值', () => {
    const result = ListCandidatesSchema.parse({})
    expect(result.minScore).toBe(0.6)
    expect(result.limit).toBe(20)
    expect(result.page).toBe(1)
    expect(result.type).toBeUndefined()
    // CHG-VIR-9-D / D-105a-18：默认 source 翻 identity（9-A AMENDMENT 兑现）
    expect(result.source).toBe('identity')
  })

  it('minScore 字符串被 coerce 为数字', () => {
    const result = ListCandidatesSchema.parse({ minScore: '0.8' })
    expect(result.minScore).toBe(0.8)
  })

  it('minScore > 1 报错', () => {
    expect(() => ListCandidatesSchema.parse({ minScore: '1.5' })).toThrow()
  })

  it('minScore < 0 报错', () => {
    expect(() => ListCandidatesSchema.parse({ minScore: '-0.1' })).toThrow()
  })

  it('limit > 100 报错', () => {
    expect(() => ListCandidatesSchema.parse({ limit: '101' })).toThrow()
  })

  it('无效 type 报错', () => {
    expect(() => ListCandidatesSchema.parse({ type: 'invalid_type' })).toThrow()
  })

  it('合法 type=anime 通过', () => {
    const result = ListCandidatesSchema.parse({ type: 'anime' })
    expect(result.type).toBe('anime')
  })
})

// ── perf baseline（ADR-105 §验证段：N=100 / p95 ≤ 200ms）─────────────
// CHG-SN-5-09-PATCH 补 ADR-105 §验证段协议偏离（commit cd049b53 静默跳过判据）。
// 仅断言 Service 层评分 + 组装计算（DB query 已 mock 直返），覆盖 §10 R-M-SN-5-B 风险。

describe('VideoMergesService.listCandidates · perf baseline (ADR-105 §验证)', () => {
  it('N=100 候选组 × 5 video × 10 site_keys：p95 < 200ms（20 iterations）', async () => {
    const SITE_KEY_POOL = [
      'iqiyi', 'youku', 'bilibili', 'tencent', 'mgtv',
      'sohu', 'pptv', 'wasu', 'letv', 'cntv',
      'netflix', 'youtube', 'vimeo', 'dailymotion', 'twitch',
    ]
    const GROUP_COUNT = 100
    const VIDEOS_PER_GROUP = 5
    const KEYS_PER_VIDEO = 10

    const groupRows = Array.from({ length: GROUP_COUNT }, (_, gi) => ({
      title_normalized: `mock_title_${gi}`,
      year: 2000 + (gi % 30),
      type: 'movie' as const,
      video_ids: Array.from({ length: VIDEOS_PER_GROUP }, (_, vi) => `vid-${gi}-${vi}`),
      video_count: String(VIDEOS_PER_GROUP),
    }))

    const detailRows = groupRows.flatMap(g =>
      g.video_ids.map((id, vi) => ({
        id,
        title: `Video ${id}`,
        title_normalized: g.title_normalized,
        year: g.year,
        type: g.type,
        created_at: `2026-01-${String((vi % 28) + 1).padStart(2, '0')}T00:00:00Z`,
        source_count: String(KEYS_PER_VIDEO),
        site_keys: Array.from({ length: KEYS_PER_VIDEO }, (_, ki) =>
          SITE_KEY_POOL[(vi + ki) % SITE_KEY_POOL.length]!,
        ),
      })),
    )

    const ITERATIONS = 20
    const durations: number[] = []

    for (let i = 0; i < ITERATIONS; i++) {
      mockQuery.mockReset()
      mockQuery
        .mockResolvedValueOnce({ rows: groupRows })
        .mockResolvedValueOnce({ rows: [{ total: String(GROUP_COUNT) }] })
        .mockResolvedValueOnce({ rows: detailRows })

      const svc = new VideoMergesService(mockDb)
      const t0 = performance.now()
      const res = await svc.listCandidates({ source: 'legacy', type: undefined, minScore: 0, limit: 100, page: 1 })
      durations.push(performance.now() - t0)
      expect(res.data.length).toBe(GROUP_COUNT)
    }

    const sorted = [...durations].sort((a, b) => a - b)
    const p95Index = Math.floor(ITERATIONS * 0.95) - 1   // 0-indexed 第 19 位 → 容差取 18
    const p95 = sorted[Math.max(p95Index, 0)]!
    expect(p95).toBeLessThan(200)
  })
})

/**
 * identity-source-switch.test.ts — 候选来源切换 + 空表自动降级（CHG-VIR-9-A / Phase 2c）
 *
 * ModerationService.listSimilar（默认 identity / 空降级 legacy）+
 * VideoMergesService.listCandidates（默认 identity / CHG-VIR-9-D 翻转 / 折叠 / 空降级）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/db/queries/moderation', () => ({
  findVideoFeatures: vi.fn(),
  listSimilarCandidates: vi.fn(),
}))
vi.mock('@/api/db/queries/identity-candidate', () => ({
  listPendingCandidatesByVideoId: vi.fn(),
  listPendingCandidatePairs: vi.fn(),
  countPendingCandidatePairs: vi.fn(),
}))
vi.mock('@/api/db/queries/video-merge-candidates', () => ({
  fetchRawCandidateGroups: vi.fn(),
  countRawCandidateGroups: vi.fn(),
  fetchVideoDetailsForCandidates: vi.fn(),
}))

import { ModerationService } from '@/api/services/ModerationService'
import { VideoMergesService } from '@/api/services/VideoMergesService'
import { findVideoFeatures, listSimilarCandidates } from '@/api/db/queries/moderation'
import { listPendingCandidatesByVideoId, listPendingCandidatePairs, countPendingCandidatePairs } from '@/api/db/queries/identity-candidate'
import {
  fetchRawCandidateGroups,
  countRawCandidateGroups,
  fetchVideoDetailsForCandidates,
} from '@/api/db/queries/video-merge-candidates'

const mockDb = {} as import('pg').Pool
const mockEs = {} as import('@elastic/elasticsearch').Client

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(findVideoFeatures).mockResolvedValue({
    id: 'v1', type: 'anime', year: 2020, country: 'JP', genres: ['action'],
  } as never)
})

function neighborRow() {
  return {
    candidate_id: 'c1', neighbor_video_id: 'v2', title: '某动画', type: 'anime',
    year: 2020, country: 'JP', genres: ['action'], cover_url: null, meta_score: 50,
    review_status: 'approved', is_published: true, identity_score: '0.9000',
    strong_negative_reasons: [], evidence_jsonb: [], status: 'pending',
  }
}

describe('ModerationService.listSimilar — source 切换', () => {
  const svc = () => new ModerationService(mockDb, mockEs)

  it('source=identity 有候选 → identity 来源 + candidateId/identityScore', async () => {
    vi.mocked(listPendingCandidatesByVideoId).mockResolvedValue([neighborRow()] as never)
    const r = await svc().listSimilar('v1', { limit: 10, yearRange: 5, source: 'identity' })
    expect(r.source).toBe('identity')
    expect(r.items[0]!.candidateId).toBe('c1')
    expect(r.items[0]!.identityScore).toBe(0.9)
    expect(r.items[0]!.similarityScore).toBe(90) // round(0.9*100) 保旧前端不空
    expect(listSimilarCandidates).not.toHaveBeenCalled()
  })

  it('source=identity 空候选 → 自动降级 legacy', async () => {
    vi.mocked(listPendingCandidatesByVideoId).mockResolvedValue([] as never)
    vi.mocked(listSimilarCandidates).mockResolvedValue([] as never)
    const r = await svc().listSimilar('v1', { limit: 10, yearRange: 5, source: 'identity' })
    expect(r.source).toBe('legacy')
    expect(listSimilarCandidates).toHaveBeenCalled()
  })

  it('source=legacy → 直接 legacy（不查 identity_candidate）', async () => {
    vi.mocked(listSimilarCandidates).mockResolvedValue([] as never)
    const r = await svc().listSimilar('v1', { limit: 10, yearRange: 5, source: 'legacy' })
    expect(r.source).toBe('legacy')
    expect(listPendingCandidatesByVideoId).not.toHaveBeenCalled()
  })

  it('默认（无 source）→ identity', async () => {
    vi.mocked(listPendingCandidatesByVideoId).mockResolvedValue([neighborRow()] as never)
    const r = await svc().listSimilar('v1', { limit: 10, yearRange: 5 })
    expect(r.source).toBe('identity')
  })
})

describe('VideoMergesService.listCandidates — source 切换', () => {
  const svc = () => new VideoMergesService(mockDb)

  it('source=identity 有 pairs → 折叠 2-video group + source identity + total=全量 count（FIX-2）', async () => {
    vi.mocked(listPendingCandidatePairs).mockResolvedValue([
      { id: 'c1', left_video_id: 'a', right_video_id: 'b', identity_score: '0.9000', legacy_score: null, strong_negative_reasons: [], evidence_jsonb: [], group_key: null },
    ] as never)
    // FIX-2（Codex review）：total 取全量 pending count（非当前页 groups.length），候选超 limit 可翻页
    vi.mocked(countPendingCandidatePairs).mockResolvedValue(35 as never)
    vi.mocked(fetchVideoDetailsForCandidates).mockResolvedValue([
      { id: 'a', title: 'X', title_normalized: 'x', year: 2020, type: 'anime', created_at: '2026-01-01T00:00:00Z', source_count: '2', site_keys: [] },
      { id: 'b', title: 'X', title_normalized: 'x', year: 2020, type: 'anime', created_at: '2026-01-01T00:00:00Z', source_count: '2', site_keys: [] },
    ] as never)
    const r = await svc().listCandidates({ minScore: 0, limit: 20, page: 1, source: 'identity' })
    expect(r.source).toBe('identity')
    expect(r.data).toHaveLength(1)
    expect(r.total).toBe(35)
    expect(r.data[0]!.videos).toHaveLength(2)
    expect(r.data[0]!.identity!.identityScore).toBe(0.9)
    expect(fetchRawCandidateGroups).not.toHaveBeenCalled()
  })

  it('source=identity 真空表（count=0）→ 降级 legacy', async () => {
    vi.mocked(listPendingCandidatePairs).mockResolvedValue([] as never)
    vi.mocked(countPendingCandidatePairs).mockResolvedValue(0 as never)
    vi.mocked(fetchRawCandidateGroups).mockResolvedValue([] as never)
    vi.mocked(countRawCandidateGroups).mockResolvedValue(0 as never)
    const r = await svc().listCandidates({ minScore: 0, limit: 20, page: 1, source: 'identity' })
    expect(r.source).toBe('legacy')
    expect(fetchRawCandidateGroups).toHaveBeenCalled()
  })

  it('source=identity total>0 但本页空（offset 超尾）→ 空 data 保持 identity 不悄降 legacy（FIX-2）', async () => {
    vi.mocked(listPendingCandidatePairs).mockResolvedValue([] as never)
    vi.mocked(countPendingCandidatePairs).mockResolvedValue(35 as never)
    vi.mocked(fetchVideoDetailsForCandidates).mockResolvedValue([] as never)
    const r = await svc().listCandidates({ minScore: 0, limit: 20, page: 99, source: 'identity' })
    expect(r.source).toBe('identity')
    expect(r.data).toHaveLength(0)
    expect(r.total).toBe(35)
    expect(fetchRawCandidateGroups).not.toHaveBeenCalled()
  })

  it('默认（无 source）→ identity（CHG-VIR-9-D 翻转；空表仍降级 legacy）', async () => {
    vi.mocked(listPendingCandidatePairs).mockResolvedValue([] as never)
    vi.mocked(countPendingCandidatePairs).mockResolvedValue(0 as never)
    vi.mocked(fetchRawCandidateGroups).mockResolvedValue([] as never)
    vi.mocked(countRawCandidateGroups).mockResolvedValue(0 as never)
    const r = await svc().listCandidates({ minScore: 0, limit: 20, page: 1 })
    // 默认先查 identity_candidate（翻转生效），真空表自动降级 legacy 回显
    expect(listPendingCandidatePairs).toHaveBeenCalled()
    expect(r.source).toBe('legacy')
  })

  // ── CHG-VIR-9-D / D-105a-18：connected components 折叠 ────────────────

  function pairRow(id: string, left: string, right: string, score = '0.9000') {
    return {
      id, left_video_id: left, right_video_id: right, identity_score: score,
      legacy_score: null, strong_negative_reasons: [], evidence_jsonb: [], group_key: null,
    }
  }
  function detailRow(id: string) {
    return {
      id, title: `V${id}`, title_normalized: `v${id}`, year: 2020, type: 'anime',
      created_at: '2026-01-01T00:00:00Z', source_count: '2', site_keys: [],
    }
  }

  it('N-video 连通分量折叠：3 pair 同分量 → 1 行 group（C(N,2) 重复消除）+ candidateIds 全锚点', async () => {
    vi.mocked(listPendingCandidatePairs).mockResolvedValue([
      pairRow('c1', 'a', 'b', '0.9500'),
      pairRow('c2', 'b', 'c', '0.9000'),
      pairRow('c3', 'a', 'c', '0.8500'),
    ] as never)
    vi.mocked(countPendingCandidatePairs).mockResolvedValue(3 as never)
    vi.mocked(fetchVideoDetailsForCandidates).mockResolvedValue([
      detailRow('a'), detailRow('b'), detailRow('c'),
    ] as never)
    const r = await svc().listCandidates({ minScore: 0, limit: 20, page: 1, source: 'identity' })
    expect(r.data).toHaveLength(1)
    const g = r.data[0]!
    expect(g.groupKey).toBe('a|b|c') // 成员升序 join，幂等稳定
    expect(g.videos.map((v) => v.id).sort()).toEqual(['a', 'b', 'c'])
    expect(g.candidateIds).toEqual(['c1', 'c2', 'c3'])
    expect(g.candidateId).toBeUndefined() // 多 pair 不填单数锚点
    // group 聚合 = min over pairs（D-105a-15 保守口径）+ 逐 pair candidateId 锚点
    expect(g.identity!.identityScore).toBe(0.85)
    expect(g.identity!.pairs).toHaveLength(3)
    expect(g.identity!.pairs.map((p) => p.candidateId)).toEqual(['c1', 'c2', 'c3'])
  })

  it('多分量混合：{a,b,c} + {x,y} → 2 行 group，行序保持高分分量优先', async () => {
    vi.mocked(listPendingCandidatePairs).mockResolvedValue([
      pairRow('c1', 'a', 'b', '0.9500'),
      pairRow('c4', 'x', 'y', '0.9200'),
      pairRow('c2', 'b', 'c', '0.9000'),
    ] as never)
    vi.mocked(countPendingCandidatePairs).mockResolvedValue(3 as never)
    vi.mocked(fetchVideoDetailsForCandidates).mockResolvedValue([
      detailRow('a'), detailRow('b'), detailRow('c'), detailRow('x'), detailRow('y'),
    ] as never)
    const r = await svc().listCandidates({ minScore: 0, limit: 20, page: 1, source: 'identity' })
    expect(r.data).toHaveLength(2)
    expect(r.data[0]!.groupKey).toBe('a|b|c')
    expect(r.data[1]!.groupKey).toBe('x|y')
    // N=2 单 pair：candidateId 单数保留（9-C 兼容）
    expect(r.data[1]!.candidateId).toBe('c4')
    expect(r.data[1]!.candidateIds).toEqual(['c4'])
  })
})

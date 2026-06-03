/**
 * identity-source-switch.test.ts — 候选来源切换 + 空表自动降级（CHG-VIR-9-A / Phase 2c）
 *
 * ModerationService.listSimilar（默认 identity / 空降级 legacy）+
 * VideoMergesService.listCandidates（默认 legacy / source=identity 折叠 / 空降级）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/db/queries/moderation', () => ({
  findVideoFeatures: vi.fn(),
  listSimilarCandidates: vi.fn(),
}))
vi.mock('@/api/db/queries/identity-candidate', () => ({
  listPendingCandidatesByVideoId: vi.fn(),
  listPendingCandidatePairs: vi.fn(),
}))
vi.mock('@/api/db/queries/video-merge-candidates', () => ({
  fetchRawCandidateGroups: vi.fn(),
  countRawCandidateGroups: vi.fn(),
  fetchVideoDetailsForCandidates: vi.fn(),
}))

import { ModerationService } from '@/api/services/ModerationService'
import { VideoMergesService } from '@/api/services/VideoMergesService'
import { findVideoFeatures, listSimilarCandidates } from '@/api/db/queries/moderation'
import { listPendingCandidatesByVideoId, listPendingCandidatePairs } from '@/api/db/queries/identity-candidate'
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

  it('source=identity 有 pairs → 折叠 2-video group + source identity', async () => {
    vi.mocked(listPendingCandidatePairs).mockResolvedValue([
      { id: 'c1', left_video_id: 'a', right_video_id: 'b', identity_score: '0.9000', legacy_score: null, strong_negative_reasons: [], evidence_jsonb: [], group_key: null },
    ] as never)
    vi.mocked(fetchVideoDetailsForCandidates).mockResolvedValue([
      { id: 'a', title: 'X', title_normalized: 'x', year: 2020, type: 'anime', created_at: '2026-01-01T00:00:00Z', source_count: '2', site_keys: [] },
      { id: 'b', title: 'X', title_normalized: 'x', year: 2020, type: 'anime', created_at: '2026-01-01T00:00:00Z', source_count: '2', site_keys: [] },
    ] as never)
    const r = await svc().listCandidates({ minScore: 0, limit: 20, page: 1, source: 'identity' })
    expect(r.source).toBe('identity')
    expect(r.data).toHaveLength(1)
    expect(r.data[0]!.videos).toHaveLength(2)
    expect(r.data[0]!.identity!.identityScore).toBe(0.9)
    expect(fetchRawCandidateGroups).not.toHaveBeenCalled()
  })

  it('source=identity 空 pairs → 降级 legacy', async () => {
    vi.mocked(listPendingCandidatePairs).mockResolvedValue([] as never)
    vi.mocked(fetchRawCandidateGroups).mockResolvedValue([] as never)
    vi.mocked(countRawCandidateGroups).mockResolvedValue(0 as never)
    const r = await svc().listCandidates({ minScore: 0, limit: 20, page: 1, source: 'identity' })
    expect(r.source).toBe('legacy')
    expect(fetchRawCandidateGroups).toHaveBeenCalled()
  })

  it('默认（无 source）→ legacy（不查 candidate 表）', async () => {
    vi.mocked(fetchRawCandidateGroups).mockResolvedValue([] as never)
    vi.mocked(countRawCandidateGroups).mockResolvedValue(0 as never)
    const r = await svc().listCandidates({ minScore: 0, limit: 20, page: 1 })
    expect(r.source).toBe('legacy')
    expect(listPendingCandidatePairs).not.toHaveBeenCalled()
  })
})

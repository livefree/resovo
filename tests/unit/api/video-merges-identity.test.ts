/**
 * video-merges-identity.test.ts — listCandidates identity 评分回归守卫
 * （SEQ-20260602-03 / CHG-VIR-7 Phase 2a；CHG-VIR-18 改 identity 路径 mock）
 *
 * 验收（Y-105a-1 / D-105a-9 / D-105a-15）：
 *  - 每组附加 identity 字段（identityScore/pairs/blockingReasons/strongNegativeReasons）。
 *  - legacyScore（score，从 identity_candidate.legacy_score 列填充）与 identityScore 字段分离（R3 / D-105a-6）。
 *  - 组内 release_marker 冲突 → identity.autoMergeBlocked + strongNegativeReasons 含 release_marker_mismatch。
 *  - 多组默认排序 identityScore DESC（identity 路径缺省口径）。
 *
 * 注：CHG-VIR-18（D-105-17）移除 legacy 实时聚合路径后，本文件改走 identity 折叠管线 mock
 * （listPendingCandidatePairsLight + listPendingPairsByIds + fetchVideoDetailsForCandidates）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/db/queries/identity-candidate', () => ({
  listPendingCandidatePairsLight: vi.fn(),
  listPendingPairsLightByVideoIds: vi.fn(),
  listPendingPairsByIds: vi.fn(),
  hasStaleVersionPending: vi.fn().mockResolvedValue(false),
}))
vi.mock('@/api/db/queries/video-merge-candidates', () => ({
  fetchVideoDetailsForCandidates: vi.fn(),
  fetchVideoMetaLight: vi.fn(),
}))

import { VideoMergesService } from '@/api/services/VideoMergesService'
import {
  listPendingCandidatePairsLight,
  listPendingPairsByIds,
} from '@/api/db/queries/identity-candidate'
import { fetchVideoDetailsForCandidates } from '@/api/db/queries/video-merge-candidates'

const mockDb = {} as import('pg').Pool

beforeEach(() => {
  vi.clearAllMocks()
})

function lightRow(id: string, left: string, right: string, score = '0.9000') {
  return { id, left_video_id: left, right_video_id: right, identity_score: score, canonical_pair_key: `${left}|${right}` }
}

interface FullRowOpts {
  identityScore?: string
  legacyScore?: string | null
  strongNeg?: string[]
  evidence?: { type: string; polarity: string; hit: boolean }[]
}
function fullRow(id: string, left: string, right: string, opts: FullRowOpts = {}) {
  return {
    id, left_video_id: left, right_video_id: right,
    identity_score: opts.identityScore ?? '0.9000',
    legacy_score: opts.legacyScore ?? null,
    strong_negative_reasons: opts.strongNeg ?? [],
    evidence_jsonb: opts.evidence ?? [],
    group_key: null,
  }
}

function detailRow(id: string, title: string, titleNormalized: string) {
  return {
    id, title, title_normalized: titleNormalized, year: 2020, type: 'movie',
    created_at: '2026-01-01T00:00:00Z', source_count: '2', site_keys: [],
  }
}

function wire(
  light: ReturnType<typeof lightRow>[],
  full: ReturnType<typeof fullRow>[],
  details: ReturnType<typeof detailRow>[],
) {
  vi.mocked(listPendingCandidatePairsLight).mockResolvedValue(light as never)
  vi.mocked(listPendingPairsByIds).mockImplementation(async (_db: import('pg').Pool, ids: readonly string[]) =>
    full.filter((p) => ids.includes(p.id)) as never)
  vi.mocked(fetchVideoDetailsForCandidates).mockResolvedValue(details as never)
}

const svc = () => new VideoMergesService(mockDb)

describe('VideoMergesService.listCandidates — CHG-VIR-7 identity 评分（identity 路径）', () => {
  it('每组附加 identity 字段（identityScore/pairs/blockingReasons/strongNegativeReasons）', async () => {
    wire(
      [lightRow('c1', 'a', 'b')],
      [fullRow('c1', 'a', 'b', { evidence: [{ type: 'title_exact', polarity: 'strong-positive', hit: true }] })],
      [detailRow('a', '复仇者联盟', '复仇者联盟'), detailRow('b', '复仇者联盟', '复仇者联盟')],
    )
    const res = await svc().listCandidates({ minScore: 0, limit: 20, page: 1, source: 'identity' })
    expect(res.data).toHaveLength(1)
    const g = res.data[0]!
    expect(g.identity).toBeDefined()
    expect(typeof g.identity!.identityScore).toBe('number')
    expect(g.identity!.pairs).toHaveLength(1) // C(2,2)=1
    expect(Array.isArray(g.identity!.strongNegativeReasons)).toBe(true)
    expect(Array.isArray(g.identity!.blockingReasons)).toBe(true)
  })

  it('legacyScore（score）与 identityScore 字段分离（R3 / D-105-17 保留 score 字段）', async () => {
    wire(
      [lightRow('c1', 'a', 'b', '0.8000')],
      [fullRow('c1', 'a', 'b', { identityScore: '0.8000', legacyScore: '1.0000' })],
      [detailRow('a', 'X', 'x'), detailRow('b', 'X', 'x')],
    )
    const res = await svc().listCandidates({ minScore: 0, limit: 20, page: 1, source: 'identity' })
    const g = res.data[0]!
    // score = min over pairs legacy_score（identity_candidate.legacy_score 列填充，CHG-VIR-18 保留）
    expect(g.score).toBeCloseTo(1.0, 4)
    expect(g.identity!.identityScore).toBe(0.8)
    expect(g.identity!.identityScore).not.toBe(g.score)
  })

  it('组内 release_marker 冲突 → autoMergeBlocked + release_marker_mismatch', async () => {
    wire(
      [lightRow('c1', 'c', 'd')],
      [fullRow('c1', 'c', 'd', { strongNeg: ['release_marker_mismatch'] })],
      [detailRow('c', '某动画 剧场版', '某动画剧场版'), detailRow('d', '某动画 OVA', '某动画ova')],
    )
    const res = await svc().listCandidates({ minScore: 0, limit: 20, page: 1, source: 'identity' })
    const g = res.data[0]!
    expect(g.identity!.autoMergeBlocked).toBe(true)
    expect(g.identity!.strongNegativeReasons).toContain('release_marker_mismatch')
  })

  it('多组：默认排序 identityScore DESC（identity 路径缺省口径 / Y-105a-1）', async () => {
    wire(
      [lightRow('c1', 'a', 'b', '0.7000'), lightRow('c2', 'c', 'd', '0.9500')],
      [fullRow('c1', 'a', 'b', { identityScore: '0.7000' }), fullRow('c2', 'c', 'd', { identityScore: '0.9500' })],
      [detailRow('a', '低', '低'), detailRow('b', '低', '低'), detailRow('c', '高', '高'), detailRow('d', '高', '高')],
    )
    const res = await svc().listCandidates({ minScore: 0, limit: 20, page: 1, source: 'identity' })
    expect(res.data).toHaveLength(2)
    // identity 缺省 identityScore DESC：高（0.95）在前、低（0.70）在后
    expect(res.data[0]!.groupKey).toBe('c|d')
    expect(res.data[1]!.groupKey).toBe('a|b')
  })
})

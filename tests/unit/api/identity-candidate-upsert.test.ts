/**
 * identity-candidate-upsert.test.ts — 单事务幂等 upsert 编排（CHG-VIR-8 / ADR-105a R5/R6）
 *
 * mock queries 模块 + client，断言 noop/created/superseded/skipped-rejected/revived/并发兜底。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { EvidenceItem } from '@resovo/types'

vi.mock('@/api/db/queries/identity-candidate', () => ({
  findPendingByPairKey: vi.fn(),
  findLatestRejectedByPairKey: vi.fn(),
  insertCandidate: vi.fn(),
  supersedePendingByPairKey: vi.fn(),
  setSupersededBy: vi.fn(),
}))

import {
  findPendingByPairKey,
  findLatestRejectedByPairKey,
  insertCandidate,
  supersedePendingByPairKey,
  setSupersededBy,
  type IdentityCandidateRow,
} from '@/api/db/queries/identity-candidate'
import { upsertIdentityCandidate, type UpsertCandidateInput } from '@/api/services/identity/candidateUpsert'

const mockClientQuery = vi.fn().mockResolvedValue({ rows: [] })
const mockRelease = vi.fn()
const mockDb = {
  connect: vi.fn().mockResolvedValue({ query: mockClientQuery, release: mockRelease }),
} as unknown as import('pg').Pool

function row(over: Partial<IdentityCandidateRow> = {}): IdentityCandidateRow {
  return {
    id: 'id-x', left_video_id: 'a', right_video_id: 'b', canonical_pair_key: 'a|b',
    status: 'pending', parser_version: '1.0.0', scorer_version: '1.0.0',
    evidence_jsonb: [], evidence_hash: 'h0', legacy_score: null, identity_score: '0.8000',
    strong_negative_reasons: [], trigger_source: 'offline-rescore', group_key: null,
    revived_from_candidate_id: null, superseded_by_candidate_id: null,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', ...over,
  }
}

const EXACT_HIT: EvidenceItem = {
  type: 'external_exact_id_match', polarity: 'strong-positive', weight: 'saturating',
  hit: true, evaluated: true, detail: '',
}

function input(over: Partial<UpsertCandidateInput> = {}): UpsertCandidateInput {
  return {
    leftVideoId: 'a', rightVideoId: 'b', canonicalPairKey: 'a|b',
    parserVersion: '1.0.0', scorerVersion: '1.0.0', evidenceJsonb: [], evidenceHash: 'h1',
    legacyScore: null, identityScore: 0.8, strongNegativeReasons: [],
    triggerSource: 'offline-rescore', groupKey: null, evidenceItems: [], ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockClientQuery.mockResolvedValue({ rows: [] })
})

describe('upsertIdentityCandidate — 状态机', () => {
  it('hash 相同 → noop（不 insert/supersede）', async () => {
    vi.mocked(findLatestRejectedByPairKey).mockResolvedValue(null)
    vi.mocked(findPendingByPairKey).mockResolvedValue(row({ id: 'p1', evidence_hash: 'h1' }))
    const out = await upsertIdentityCandidate(mockDb, input({ evidenceHash: 'h1' }))
    expect(out).toEqual({ kind: 'noop', candidateId: 'p1' })
    expect(insertCandidate).not.toHaveBeenCalled()
    expect(supersedePendingByPairKey).not.toHaveBeenCalled()
  })

  it('无 pending + 无 rejected → created', async () => {
    vi.mocked(findLatestRejectedByPairKey).mockResolvedValue(null)
    vi.mocked(findPendingByPairKey).mockResolvedValue(null)
    vi.mocked(insertCandidate).mockResolvedValue(row({ id: 'new1' }))
    const out = await upsertIdentityCandidate(mockDb, input())
    expect(out).toEqual({ kind: 'created', candidateId: 'new1' })
  })

  it('pending hash 异 → 腾位旧 pending + 新建（superseded）', async () => {
    vi.mocked(findLatestRejectedByPairKey).mockResolvedValue(null)
    vi.mocked(findPendingByPairKey).mockResolvedValue(row({ id: 'old1', evidence_hash: 'h0' }))
    vi.mocked(supersedePendingByPairKey).mockResolvedValue('old1')
    vi.mocked(insertCandidate).mockResolvedValue(row({ id: 'new2' }))
    const out = await upsertIdentityCandidate(mockDb, input({ evidenceHash: 'h1' }))
    expect(out).toEqual({ kind: 'superseded', oldId: 'old1', newId: 'new2' })
    expect(setSupersededBy).toHaveBeenCalledWith(expect.anything(), 'old1', 'new2')
  })

  it('rejected + 无新强正证据 → skipped-rejected（永久压制 R6）', async () => {
    vi.mocked(findLatestRejectedByPairKey).mockResolvedValue(row({ id: 'r1', status: 'rejected', evidence_jsonb: [] }))
    const out = await upsertIdentityCandidate(mockDb, input({ evidenceItems: [] }))
    expect(out).toEqual({ kind: 'skipped-rejected' })
    expect(insertCandidate).not.toHaveBeenCalled()
  })

  it('rejected + 新 exact 证据 → 复活链（revived，revived_from 指向原 rejected R6）', async () => {
    vi.mocked(findLatestRejectedByPairKey).mockResolvedValue(row({ id: 'r2', status: 'rejected', evidence_jsonb: [] }))
    vi.mocked(insertCandidate).mockResolvedValue(row({ id: 'new3', revived_from_candidate_id: 'r2' }))
    const out = await upsertIdentityCandidate(mockDb, input({ evidenceItems: [EXACT_HIT] }))
    expect(out).toEqual({ kind: 'revived', fromId: 'r2', newId: 'new3' })
    expect(insertCandidate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ revivedFromCandidateId: 'r2' }),
    )
  })

  it('rejected 已含 exact + 再来 exact → 不复活（非「新增」exact）', async () => {
    vi.mocked(findLatestRejectedByPairKey).mockResolvedValue(row({ id: 'r3', status: 'rejected', evidence_jsonb: [EXACT_HIT] }))
    const out = await upsertIdentityCandidate(mockDb, input({ evidenceItems: [EXACT_HIT] }))
    expect(out).toEqual({ kind: 'skipped-rejected' })
  })

  it('并发兜底：insert 返回 null（ON CONFLICT 抢先）→ 重查收敛（created）', async () => {
    vi.mocked(findLatestRejectedByPairKey).mockResolvedValue(null)
    vi.mocked(findPendingByPairKey)
      .mockResolvedValueOnce(null) // 主路径无 pending
      .mockResolvedValueOnce(row({ id: 'recovered' })) // insertOrRecover 重查
    vi.mocked(insertCandidate).mockResolvedValue(null) // 被并发抢先
    const out = await upsertIdentityCandidate(mockDb, input())
    expect(out).toEqual({ kind: 'created', candidateId: 'recovered' })
  })

  it('异常 → ROLLBACK + release', async () => {
    vi.mocked(findLatestRejectedByPairKey).mockRejectedValue(new Error('db down'))
    await expect(upsertIdentityCandidate(mockDb, input())).rejects.toThrow('db down')
    expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK')
    expect(mockRelease).toHaveBeenCalled()
  })
})

/**
 * identity-offline-rescore.test.ts — 离线重算 pipeline（CHG-VIR-8 / ADR-105a D-105a-10）
 *
 * mock db + blocking SQL + 详情/externalId/upsert，验证 advisory lock skip / MAX_BUCKET 护栏 /
 * 评分过滤（low score skip）/ 正常 upsert created。scorePair/parseTitle/evidenceHash 真实运行。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/db/queries/video-merge-candidates', () => ({ fetchVideoDetailsForCandidates: vi.fn() }))
vi.mock('@/api/services/identity/candidateUpsert', () => ({ upsertIdentityCandidate: vi.fn() }))
vi.mock('@/api/services/identity/externalIdLoader', () => ({ loadExternalIdSummaries: vi.fn() }))

import { runIdentityRescore } from '@/api/services/identity/offlineRescore'
import { fetchVideoDetailsForCandidates } from '@/api/db/queries/video-merge-candidates'
import { upsertIdentityCandidate } from '@/api/services/identity/candidateUpsert'
import { loadExternalIdSummaries } from '@/api/services/identity/externalIdLoader'

const log = { info: vi.fn(), warn: vi.fn() } as unknown as import('pino').Logger

const mockLockQuery = vi.fn()
const mockLockClient = { query: mockLockQuery, release: vi.fn() }
const mockDbQuery = vi.fn()
const mockDb = { connect: vi.fn().mockResolvedValue(mockLockClient), query: mockDbQuery } as unknown as import('pg').Pool

function videoRow(id: string, title: string, siteKeys: string[]) {
  return {
    id, title, title_normalized: 'x', year: 2020, type: 'anime' as const,
    created_at: '2026-01-01T00:00:00Z', source_count: '2', site_keys: siteKeys,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(loadExternalIdSummaries).mockResolvedValue(new Map())
})

describe('runIdentityRescore', () => {
  it('advisory lock 拿不到 → lockSkipped，不召回', async () => {
    mockLockQuery.mockResolvedValueOnce({ rows: [{ acquired: false }] })
    const r = await runIdentityRescore(mockDb, log)
    expect(r.lockSkipped).toBe(true)
    expect(mockDbQuery).not.toHaveBeenCalled()
  })

  it('MAX_BUCKET 护栏：超大桶跳过 + 不拉详情', async () => {
    mockLockQuery.mockResolvedValueOnce({ rows: [{ acquired: true }] }).mockResolvedValue({ rows: [] })
    mockDbQuery
      .mockResolvedValueOnce({ rows: [{ core_key: 'k', video_ids: Array.from({ length: 10 }, (_, i) => `v${i}`) }] })
      .mockResolvedValueOnce({ rows: [] })
    const r = await runIdentityRescore(mockDb, log, { maxBucket: 5 })
    expect(r.bucketsSkippedOversize).toBe(1)
    expect(fetchVideoDetailsForCandidates).not.toHaveBeenCalled()
  })

  it('正常 pipeline：高重合 pair（0.90）→ upsert created', async () => {
    mockLockQuery.mockResolvedValueOnce({ rows: [{ acquired: true }] }).mockResolvedValue({ rows: [] })
    mockDbQuery
      .mockResolvedValueOnce({ rows: [{ core_key: 'k', video_ids: ['a', 'b'] }] })
      .mockResolvedValueOnce({ rows: [] })
    vi.mocked(fetchVideoDetailsForCandidates).mockResolvedValue([
      videoRow('a', '某科幻动画', ['s1', 's2']),
      videoRow('b', '某科幻动画', ['s1', 's2']),
    ])
    vi.mocked(upsertIdentityCandidate).mockResolvedValue({ kind: 'created', candidateId: 'c1' })
    const r = await runIdentityRescore(mockDb, log)
    expect(r.pairs).toBe(1)
    expect(r.created).toBe(1)
    expect(upsertIdentityCandidate).toHaveBeenCalledTimes(1)
  })

  it('低分 pair（0.60 < 0.75 且无强负）→ skippedLowScore，不 upsert', async () => {
    mockLockQuery.mockResolvedValueOnce({ rows: [{ acquired: true }] }).mockResolvedValue({ rows: [] })
    mockDbQuery
      .mockResolvedValueOnce({ rows: [{ core_key: 'k', video_ids: ['a', 'b'] }] })
      .mockResolvedValueOnce({ rows: [] })
    vi.mocked(fetchVideoDetailsForCandidates).mockResolvedValue([
      videoRow('a', '某科幻动画', []), // 无 source 重合 → 仅 core+year+type = 0.60
      videoRow('b', '某科幻动画', []),
    ])
    const r = await runIdentityRescore(mockDb, log)
    expect(r.skippedLowScore).toBe(1)
    expect(upsertIdentityCandidate).not.toHaveBeenCalled()
  })

  it('空桶立即 break（无 buckets）→ 零处理', async () => {
    mockLockQuery.mockResolvedValueOnce({ rows: [{ acquired: true }] }).mockResolvedValue({ rows: [] })
    mockDbQuery.mockResolvedValueOnce({ rows: [] })
    const r = await runIdentityRescore(mockDb, log)
    expect(r.buckets).toBe(0)
    expect(r.pairs).toBe(0)
  })
})

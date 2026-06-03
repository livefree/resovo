/**
 * identity-pair-scoring-persist.test.ts — 评分→hash→upsert 共享层（CHG-VIR-10 / D-105a-17）
 *
 * 重点：blockingKeys =「双方 core_title_key + 共享 provider:id 桶 key」有序去重并集进
 * evidence_hash 输入域 ④（共享 ext id 出现 → hash 受控变化 → superseded 基础）；
 * triggerSource 透传；低分 pair 返回 PairScore 但不持久化（D-105a-4）。
 * scorePair / parseTitle / computeEvidenceHash 真实运行，仅 mock candidateUpsert。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/services/identity/candidateUpsert', () => ({ upsertIdentityCandidate: vi.fn() }))

import { scoreAndPersistPairs, emptyPairPersistCounters } from '@/api/services/identity/pairScoringPersist'
import { upsertIdentityCandidate } from '@/api/services/identity/candidateUpsert'
import { computeEvidenceHash } from '@/api/services/identity/evidenceHash'
import { scorePair, type PairSideInput } from '@/api/services/identity/scorePair'
import { THRESHOLD_CONFIG_VERSION } from '@/api/services/identity/weights'
import { parseTitle } from '@/api/services/TitleIdentityParser'

const mockDb = {} as unknown as import('pg').Pool
const versions = { parserVersion: '1.0.0', scorerVersion: '1.0.0' }

function side(videoId: string, title: string, extra?: Partial<PairSideInput>): PairSideInput {
  const parsed = parseTitle(title)
  return {
    videoId,
    coreTitleKey: parsed.coreTitleKey,
    facets: parsed.facets,
    year: 2020,
    type: 'anime',
    sourceSiteKeys: ['s1', 's2'],
    ...extra,
  }
}

function snapshotOf(s: PairSideInput) {
  return {
    coreTitleKey: s.coreTitleKey,
    year: s.year,
    type: s.type,
    seasonNumber: s.facets.seasonNumber,
    releaseMarker: s.facets.releaseMarker,
    episodeStructureDigest: '',
    metadataDigest: '',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(upsertIdentityCandidate).mockResolvedValue({ kind: 'created', candidateId: 'c1' })
})

describe('scoreAndPersistPairs — blockingKeys 并集（D-105a-17）', () => {
  it('共享 provider:id → blockingKeys 含 ext 桶 key（与期望 hash 逐字节一致）', async () => {
    const a = side('a', '某科幻动画', { externalIds: { exactIds: { imdb: 'tt1', tmdb: '5' } } })
    const b = side('b', '某科幻动画', { externalIds: { exactIds: { imdb: 'tt1', tmdb: '5' } } })
    const sideMap = new Map([['a', a], ['b', b]])
    const counters = emptyPairPersistCounters()

    await scoreAndPersistPairs(
      mockDb, sideMap, [['a', 'b']],
      { ...versions, triggerSource: 'ingest' }, counters,
    )

    expect(upsertIdentityCandidate).toHaveBeenCalledTimes(1)
    const input = vi.mocked(upsertIdentityCandidate).mock.calls[0]![1]
    expect(input.triggerSource).toBe('ingest')

    // 期望 hash：blockingKeys = 双方 core key + 共享桶 key imdb:tt1 / tmdb:5
    const ps = scorePair(a, b)
    const expected = computeEvidenceHash({
      canonicalPairKey: 'a|b',
      parserVersion: versions.parserVersion,
      scorerVersion: versions.scorerVersion,
      thresholdConfigVersion: THRESHOLD_CONFIG_VERSION,
      blockingKeys: [a.coreTitleKey, b.coreTitleKey, 'imdb:tt1', 'tmdb:5'],
      fieldSnapshot: { left: snapshotOf(a), right: snapshotOf(b) },
      externalRefSummary: ['L:imdb:tt1', 'L:tmdb:5', 'R:imdb:tt1', 'R:tmdb:5'],
      strongNegativeReasons: ps.strongNegativeReasons,
    })
    expect(input.evidenceHash).toBe(expected)
  })

  it('无共享 ext id（无 externalIds）→ blockingKeys 仅双方 core key（hash 与含共享桶时不同）', async () => {
    const a = side('a', '某科幻动画')
    const b = side('b', '某科幻动画')
    const counters = emptyPairPersistCounters()
    await scoreAndPersistPairs(
      mockDb, new Map([['a', a], ['b', b]]), [['a', 'b']],
      { ...versions, triggerSource: 'offline-rescore' }, counters,
    )
    const input = vi.mocked(upsertIdentityCandidate).mock.calls[0]![1]
    const ps = scorePair(a, b)
    const expected = computeEvidenceHash({
      canonicalPairKey: 'a|b',
      parserVersion: versions.parserVersion,
      scorerVersion: versions.scorerVersion,
      thresholdConfigVersion: THRESHOLD_CONFIG_VERSION,
      blockingKeys: [a.coreTitleKey, b.coreTitleKey],
      fieldSnapshot: { left: snapshotOf(a), right: snapshotOf(b) },
      externalRefSummary: [],
      strongNegativeReasons: ps.strongNegativeReasons,
    })
    expect(input.evidenceHash).toBe(expected)
    expect(input.triggerSource).toBe('offline-rescore')
  })

  it('同 provider 不同 id（冲突非共享）→ blockingKeys 不含 ext 桶 key', async () => {
    // external_id_conflict 强负 → 仍持久化（含拦截原因）；blockingKeys 无共享桶
    const a = side('a', '某科幻动画', { externalIds: { exactIds: { imdb: 'tt1' } } })
    const b = side('b', '某科幻动画', { externalIds: { exactIds: { imdb: 'tt2' } } })
    const counters = emptyPairPersistCounters()
    await scoreAndPersistPairs(
      mockDb, new Map([['a', a], ['b', b]]), [['a', 'b']],
      { ...versions, triggerSource: 'offline-rescore' }, counters,
    )
    expect(counters.blocked).toBe(1)
    const input = vi.mocked(upsertIdentityCandidate).mock.calls[0]![1]
    const ps = scorePair(a, b)
    const expected = computeEvidenceHash({
      canonicalPairKey: 'a|b',
      parserVersion: versions.parserVersion,
      scorerVersion: versions.scorerVersion,
      thresholdConfigVersion: THRESHOLD_CONFIG_VERSION,
      blockingKeys: [a.coreTitleKey, b.coreTitleKey], // 冲突 ≠ 共享，不进桶 key
      fieldSnapshot: { left: snapshotOf(a), right: snapshotOf(b) },
      externalRefSummary: ['L:imdb:tt1', 'R:imdb:tt2'],
      strongNegativeReasons: ps.strongNegativeReasons,
    })
    expect(input.evidenceHash).toBe(expected)
  })

  it('低分且无强负 → 返回 PairScore 但不持久化（skippedLowScore）', async () => {
    const a = side('a', '某科幻动画', { sourceSiteKeys: [] }) // 无指纹重合 → 0.60
    const b = side('b', '某科幻动画', { sourceSiteKeys: [] })
    const counters = emptyPairPersistCounters()
    const scores = await scoreAndPersistPairs(
      mockDb, new Map([['a', a], ['b', b]]), [['a', 'b']],
      { ...versions, triggerSource: 'ingest' }, counters,
    )
    expect(scores).toHaveLength(1) // ingest shadow bind 对比需要全量 scores
    expect(counters.skippedLowScore).toBe(1)
    expect(upsertIdentityCandidate).not.toHaveBeenCalled()
  })
})

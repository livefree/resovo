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

  it('段③ ADR-206：共享 alias 桶键 → blockingKeys 含别名键（与期望 hash 逐字节一致）', async () => {
    // 同标题 pair（0.90 ≥ 0.75 必持久化）+ 额外共享别名归一键（≠ coreTitleKey，验证别名键确入并集）
    const a = side('a', '某科幻动画', { aliasBlockingKeys: ['航海王', 'one piece', 'extra-a'] })
    const b = side('b', '某科幻动画', { aliasBlockingKeys: ['航海王', 'one piece', 'extra-b'] })
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
      // sharedAliasBucketKeys 交集 = ['航海王', 'one piece']（extra-a/extra-b 非共享被滤）；dedupeSort 内排序去重
      blockingKeys: [a.coreTitleKey, b.coreTitleKey, '航海王', 'one piece'],
      fieldSnapshot: { left: snapshotOf(a), right: snapshotOf(b) },
      externalRefSummary: [],
      strongNegativeReasons: ps.strongNegativeReasons,
    })
    expect(input.evidenceHash).toBe(expected)
  })

  it('段③ M-2A-6：alias 桶无交集 → blockingKeys 不注入（与无 aliasBlockingKeys 时 hash 逐字节一致，零漂移）', async () => {
    // 既有 pair：双方有别名键但无交集 → 不得改变 hash（避免 candidate 表全量 re-upsert 风暴）
    const a = side('a', '某科幻动画', { aliasBlockingKeys: ['alpha'] })
    const b = side('b', '某科幻动画', { aliasBlockingKeys: ['beta'] })
    const counters = emptyPairPersistCounters()
    await scoreAndPersistPairs(
      mockDb, new Map([['a', a], ['b', b]]), [['a', 'b']],
      { ...versions, triggerSource: 'offline-rescore' }, counters,
    )
    const input = vi.mocked(upsertIdentityCandidate).mock.calls[0]![1]
    // 期望 = 完全不含 alias 维度的旧 hash（仅双方 core key）
    const aNoAlias = side('a', '某科幻动画')
    const bNoAlias = side('b', '某科幻动画')
    const ps = scorePair(aNoAlias, bNoAlias)
    const expected = computeEvidenceHash({
      canonicalPairKey: 'a|b',
      parserVersion: versions.parserVersion,
      scorerVersion: versions.scorerVersion,
      thresholdConfigVersion: THRESHOLD_CONFIG_VERSION,
      blockingKeys: [aNoAlias.coreTitleKey, bNoAlias.coreTitleKey],
      fieldSnapshot: { left: snapshotOf(aNoAlias), right: snapshotOf(bNoAlias) },
      externalRefSummary: [],
      strongNegativeReasons: ps.strongNegativeReasons,
    })
    expect(input.evidenceHash).toBe(expected)
  })

  it('段③ 防风暴：共享别名键恰等于 coreTitleKey → dedupeSort 折叠 → hash 与无 alias 时一致', async () => {
    // 同标题 pair 的别名键含 coreTitleKey 本身（normalizeForExternalMatch 与 coreTitleKey 偶然相等）→
    // 原始键注入后被 dedupeSort 折叠 → 既有同标题 pair 不漂移（不加前缀的关键收益）
    const aNoAlias = side('a', '某科幻动画')
    const coreKey = aNoAlias.coreTitleKey
    const a = side('a', '某科幻动画', { aliasBlockingKeys: [coreKey] })
    const b = side('b', '某科幻动画', { aliasBlockingKeys: [coreKey] })
    const counters = emptyPairPersistCounters()
    await scoreAndPersistPairs(
      mockDb, new Map([['a', a], ['b', b]]), [['a', 'b']],
      { ...versions, triggerSource: 'offline-rescore' }, counters,
    )
    const input = vi.mocked(upsertIdentityCandidate).mock.calls[0]![1]
    const bNoAlias = side('b', '某科幻动画')
    const ps = scorePair(aNoAlias, bNoAlias)
    const expected = computeEvidenceHash({
      canonicalPairKey: 'a|b',
      parserVersion: versions.parserVersion,
      scorerVersion: versions.scorerVersion,
      thresholdConfigVersion: THRESHOLD_CONFIG_VERSION,
      blockingKeys: [aNoAlias.coreTitleKey, bNoAlias.coreTitleKey], // 别名键 = coreKey → 折叠后无新键
      fieldSnapshot: { left: snapshotOf(aNoAlias), right: snapshotOf(bNoAlias) },
      externalRefSummary: [],
      strongNegativeReasons: ps.strongNegativeReasons,
    })
    expect(input.evidenceHash).toBe(expected)
  })

  it('D-105a-20：低分但同 key + 年±1 双锚点（灰区谓词命中）→ 准入候选（grayAdmitted）', async () => {
    const a = side('a', '某科幻动画', { sourceSiteKeys: [] }) // 同名 + year 2020 双方 → 0.60 命中谓词
    const b = side('b', '某科幻动画', { sourceSiteKeys: [] })
    const counters = emptyPairPersistCounters()
    vi.mocked(upsertIdentityCandidate).mockResolvedValue({ kind: 'created', id: 'c-1' } as never)
    const scores = await scoreAndPersistPairs(
      mockDb, new Map([['a', a], ['b', b]]), [['a', 'b']],
      { ...versions, triggerSource: 'ingest' }, counters,
    )
    expect(scores).toHaveLength(1)
    expect(counters.grayAdmitted).toBe(1)
    expect(counters.skippedLowScore).toBe(0)
    expect(upsertIdentityCandidate).toHaveBeenCalledTimes(1)
    // identity_score 如实存储不虚标（仍 < 0.75）
    const input = vi.mocked(upsertIdentityCandidate).mock.calls[0]![1] as { identityScore: number }
    expect(input.identityScore).toBeLessThan(0.75)
  })

  it('D-105a-20：低分且年未知（单锚点）→ none 区不持久化（skippedLowScore，通用名撞车防线）', async () => {
    const a = side('a', '某科幻动画', { sourceSiteKeys: [], year: null }) // 年缺失 → 无 year 证据
    const b = side('b', '某科幻动画', { sourceSiteKeys: [] })
    const counters = emptyPairPersistCounters()
    const scores = await scoreAndPersistPairs(
      mockDb, new Map([['a', a], ['b', b]]), [['a', 'b']],
      { ...versions, triggerSource: 'ingest' }, counters,
    )
    expect(scores).toHaveLength(1) // ingest shadow bind 对比需要全量 scores
    expect(counters.skippedLowScore).toBe(1)
    expect(counters.grayAdmitted).toBe(0)
    expect(upsertIdentityCandidate).not.toHaveBeenCalled()
  })
})

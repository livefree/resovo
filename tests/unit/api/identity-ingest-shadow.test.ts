/**
 * identity-ingest-shadow.test.ts — ingest 旁路 shadow scoring 编排（CHG-VIR-10 / D-105a-16）
 *
 * mock 召回 + 详情 + externalId + upsert（scorePair/parseTitle/evidenceHash 真实运行），验证：
 *  - no-counterpart：双键均无对侧 → 不写候选，仅结构化日志。
 *  - agree-bind / disagree-bind：exact 命中 + 无强负 → shadow catalog 与 legacy 对比。
 *  - candidate-only：模糊高分（无 exact）→ 写 trigger_source='ingest' 候选。
 *  - none：全部低分 → 不写候选。
 *  - blocked：强负 pair 仍持久化（含拦截原因）。
 *  - R9 守护：任何分支不发起 UPDATE/INSERT videos（mock db 只收 SELECT catalog_id 点查）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/db/queries/video-merge-candidates', () => ({ fetchVideoDetailsForCandidates: vi.fn() }))
vi.mock('@/api/services/identity/candidateUpsert', () => ({ upsertIdentityCandidate: vi.fn() }))
vi.mock('@/api/services/identity/externalIdLoader', () => ({ loadExternalIdSummaries: vi.fn() }))
vi.mock('@/api/services/identity/blockingRecall', () => ({
  recallCoreKeyCounterparts: vi.fn(),
  recallExternalIdCounterparts: vi.fn(),
  recallAliasNormCounterparts: vi.fn(),
  loadVideoAliasBlockingKeys: vi.fn(), // ingestShadow self 别名键 + buildSides（真实）共用
}))

import { runIngestShadowScoring } from '@/api/services/identity/ingestShadow'
import { fetchVideoDetailsForCandidates } from '@/api/db/queries/video-merge-candidates'
import { upsertIdentityCandidate } from '@/api/services/identity/candidateUpsert'
import { loadExternalIdSummaries } from '@/api/services/identity/externalIdLoader'
import {
  recallCoreKeyCounterparts,
  recallExternalIdCounterparts,
  recallAliasNormCounterparts,
  loadVideoAliasBlockingKeys,
} from '@/api/services/identity/blockingRecall'

const logInfo = vi.fn()
const log = { info: logInfo, warn: vi.fn() } as unknown as import('pino').Logger

const mockDbQuery = vi.fn()
const mockDb = { query: mockDbQuery } as unknown as import('pg').Pool

function videoRow(id: string, title: string, siteKeys: string[]) {
  return {
    id, title, title_normalized: 'x', year: 2020, type: 'anime' as const,
    created_at: '2026-01-01T00:00:00Z', source_count: '2', site_keys: siteKeys,
  }
}

const baseInput = {
  videoId: 'self',
  catalogId: 'cat-1',
  matchedStep: 'title_triple' as const,
  title: '某科幻动画',
}

/** externalId mock：按 videoId 给 fixture（self 召回 + buildSides 双调用共用）。 */
function mockExternalIds(byId: Record<string, Record<string, string>>) {
  vi.mocked(loadExternalIdSummaries).mockImplementation(
    async (_db: import('pg').Pool, ids: readonly string[]) => {
      const m = new Map<string, { exactIds: Record<string, string> }>()
      for (const id of ids) m.set(id, { exactIds: byId[id] ?? {} })
      return m
    },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDbQuery.mockResolvedValue({ rows: [] })
  vi.mocked(recallCoreKeyCounterparts).mockResolvedValue([])
  vi.mocked(recallExternalIdCounterparts).mockResolvedValue([])
  vi.mocked(recallAliasNormCounterparts).mockResolvedValue([])
  vi.mocked(loadVideoAliasBlockingKeys).mockResolvedValue(new Map())
  vi.mocked(upsertIdentityCandidate).mockResolvedValue({ kind: 'created', candidateId: 'c1' })
  mockExternalIds({})
})

describe('runIngestShadowScoring', () => {
  it('no-counterpart：双键均无对侧 → 不写候选 + 结构化日志', async () => {
    const r = await runIngestShadowScoring(mockDb, log, baseInput)
    expect(r.outcome).toBe('no-counterpart')
    expect(r.candidatesUpserted).toBe(0)
    expect(upsertIdentityCandidate).not.toHaveBeenCalled()
    expect(logInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'ingest-shadow',
        video_id: 'self',
        matched_step: 'title_triple',
        legacy_catalog_id: 'cat-1',
        outcome: 'no-counterpart',
      }),
      'ingest-shadow: done',
    )
  })

  it('agree-bind：exact 命中 + 无强负 + 对侧 catalog == legacy → 一致绑定', async () => {
    vi.mocked(recallExternalIdCounterparts).mockResolvedValue(['b'])
    vi.mocked(fetchVideoDetailsForCandidates).mockResolvedValue([
      videoRow('self', '某科幻动画', ['s1']),
      videoRow('b', '某科幻动画', ['s1']),
    ])
    mockExternalIds({ self: { imdb: 'tt1' }, b: { imdb: 'tt1' } })
    mockDbQuery.mockResolvedValue({ rows: [{ id: 'b', catalog_id: 'cat-1' }] })

    const r = await runIngestShadowScoring(mockDb, log, baseInput)
    expect(r.outcome).toBe('agree-bind')
    expect(r.shadowCatalogId).toBe('cat-1')
    expect(upsertIdentityCandidate).toHaveBeenCalledTimes(1)
    expect(vi.mocked(upsertIdentityCandidate).mock.calls[0]![1]).toMatchObject({ triggerSource: 'ingest' })
  })

  it('disagree-bind：exact 命中但对侧 catalog ≠ legacy → 分歧记录（不改绑定）', async () => {
    vi.mocked(recallExternalIdCounterparts).mockResolvedValue(['b'])
    vi.mocked(fetchVideoDetailsForCandidates).mockResolvedValue([
      videoRow('self', '泰坦尼克号', ['s1']),
      videoRow('b', 'Titanic 1997', ['s2']),
    ])
    mockExternalIds({ self: { imdb: 'tt1' }, b: { imdb: 'tt1' } })
    mockDbQuery.mockResolvedValue({ rows: [{ id: 'b', catalog_id: 'cat-OTHER' }] })

    const r = await runIngestShadowScoring(mockDb, log, baseInput)
    expect(r.outcome).toBe('disagree-bind')
    expect(r.shadowCatalogId).toBe('cat-OTHER')
    expect(logInfo).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'disagree-bind', shadow_catalog_id: 'cat-OTHER' }),
      'ingest-shadow: done',
    )
  })

  it('candidate-only：模糊高分（0.90 无 exact）→ 写 ingest 候选，不绑定', async () => {
    vi.mocked(recallCoreKeyCounterparts).mockResolvedValue(['b'])
    vi.mocked(fetchVideoDetailsForCandidates).mockResolvedValue([
      videoRow('self', '某科幻动画', ['s1', 's2']),
      videoRow('b', '某科幻动画', ['s1', 's2']),
    ])
    const r = await runIngestShadowScoring(mockDb, log, baseInput)
    expect(r.outcome).toBe('candidate-only')
    expect(r.shadowCatalogId).toBeNull()
    expect(r.candidatesUpserted).toBe(1)
  })

  it('段③ ADR-206：self 别名键 → recallAliasNormCounterparts 召回跨译名对侧（扩召回；别名非正证据 D-206-6a）', async () => {
    vi.mocked(loadVideoAliasBlockingKeys).mockResolvedValue(new Map([['self', ['航海王', 'one piece']]]))
    vi.mocked(recallAliasNormCounterparts).mockResolvedValue(['b']) // alias 桶召回（core/ext 均空）
    vi.mocked(fetchVideoDetailsForCandidates).mockResolvedValue([
      videoRow('self', '海贼王', ['s1', 's2']),
      videoRow('b', '航海王', ['s1', 's2']),
    ])
    const r = await runIngestShadowScoring(mockDb, log, baseInput)
    // self 别名键经 loadVideoAliasBlockingKeys 取出 → recallAliasNormCounterparts（段③ 召回口径）
    expect(recallAliasNormCounterparts).toHaveBeenCalledWith(mockDb, ['航海王', 'one piece'], 'self', expect.any(Number))
    expect(r.counterparts).toBe(1) // 跨译名对侧被召回进评分
    // year+type+source=0.55 < 0.75，core 不等（别名永不成正证据）→ none 区不绑定不建候选
    expect(r.outcome).toBe('none')
    expect(r.candidatesUpserted).toBe(0)
  })

  it('D-105a-20：对侧低分但同 key + 年±1 双锚点 → 灰区准入（candidate-only，三路径一致）', async () => {
    vi.mocked(recallCoreKeyCounterparts).mockResolvedValue(['b'])
    vi.mocked(fetchVideoDetailsForCandidates).mockResolvedValue([
      videoRow('self', '某科幻动画', []),
      videoRow('b', '某科幻动画', []),
    ])
    vi.mocked(upsertIdentityCandidate).mockResolvedValue({ kind: 'created', id: 'c-1' } as never)
    const r = await runIngestShadowScoring(mockDb, log, baseInput)
    expect(r.outcome).toBe('candidate-only')
    expect(r.candidatesUpserted).toBe(1)
    expect(upsertIdentityCandidate).toHaveBeenCalledTimes(1)
  })

  it('none：对侧低分且年未知（灰区谓词不命中）→ 不写候选不绑定', async () => {
    vi.mocked(recallCoreKeyCounterparts).mockResolvedValue(['b'])
    vi.mocked(fetchVideoDetailsForCandidates).mockResolvedValue([
      videoRow('self', '某科幻动画', []),
      { ...videoRow('b', '某科幻动画', []), year: null },
    ])
    const r = await runIngestShadowScoring(mockDb, log, baseInput)
    expect(r.outcome).toBe('none')
    expect(r.candidatesUpserted).toBe(0)
    expect(upsertIdentityCandidate).not.toHaveBeenCalled()
  })

  it('blocked：强负 pair（季号冲突）仍持久化（含拦截原因），不进 bind 判定', async () => {
    vi.mocked(recallCoreKeyCounterparts).mockResolvedValue(['b'])
    vi.mocked(fetchVideoDetailsForCandidates).mockResolvedValue([
      videoRow('self', '某科幻动画 第1季', ['s1', 's2']),
      videoRow('b', '某科幻动画 第2季', ['s1', 's2']),
    ])
    // exact 命中但季号强负 → 不豁免（exact 仅豁免 type_incompatible / D-105a-5）→ 不算干净 bind
    mockExternalIds({ self: { imdb: 'tt1' }, b: { imdb: 'tt1' } })
    const r = await runIngestShadowScoring(mockDb, log, baseInput)
    expect(r.outcome).toBe('candidate-only')
    expect(upsertIdentityCandidate).toHaveBeenCalledTimes(1)
    const input = vi.mocked(upsertIdentityCandidate).mock.calls[0]![1]
    expect(input.strongNegativeReasons).toContain('season_mismatch')
  })

  it('R9 守护：全分支 db.query 仅 SELECT（不回写 videos.catalog_id / 不触发 merge）', async () => {
    vi.mocked(recallExternalIdCounterparts).mockResolvedValue(['b'])
    vi.mocked(fetchVideoDetailsForCandidates).mockResolvedValue([
      videoRow('self', '某科幻动画', ['s1']),
      videoRow('b', '某科幻动画', ['s1']),
    ])
    mockExternalIds({ self: { imdb: 'tt1' }, b: { imdb: 'tt1' } })
    mockDbQuery.mockResolvedValue({ rows: [{ id: 'b', catalog_id: 'cat-1' }] })
    await runIngestShadowScoring(mockDb, log, baseInput)
    for (const call of mockDbQuery.mock.calls) {
      expect(String(call[0]).trimStart().toUpperCase()).toMatch(/^SELECT/)
    }
  })
})

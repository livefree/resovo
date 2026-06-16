/**
 * identity-offline-rescore.test.ts — 离线重算 pipeline（CHG-VIR-8 / CHG-VIR-10 / ADR-105a D-105a-10 + D-105a-17）
 *
 * mock db + blocking SQL + 详情/externalId/upsert，验证 advisory lock skip / MAX_BUCKET 护栏 /
 * 评分过滤（low score skip）/ 正常 upsert created / 段 ② external_id 桶召回 + 全局 seen 去重。
 * scorePair/parseTitle/evidenceHash 真实运行。
 *
 * db.query 调用序（CHG-VIR-10 双段）：段 ① core 桶 keyset 循环至空 → 段 ② ext 桶 keyset 循环至空。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/db/queries/video-merge-candidates', () => ({ fetchVideoDetailsForCandidates: vi.fn() }))
vi.mock('@/api/services/identity/candidateUpsert', () => ({ upsertIdentityCandidate: vi.fn() }))
vi.mock('@/api/services/identity/externalIdLoader', () => ({ loadExternalIdSummaries: vi.fn() }))
// 段③（ADR-206）：buildSides 的 alias 自键载入是数据源函数（同 loadExternalIdSummaries 定位），
// 部分 mock 之以免在 buildSides 内插入真实 db.query 打乱分桶 mockResolvedValueOnce 序；
// fetchCoreKeyBuckets/fetchExternalIdBuckets/fetchAliasNormBuckets 仍真实运行（走 mockDbQuery）。
vi.mock('@/api/services/identity/blockingRecall', async (orig) => ({
  ...(await orig<typeof import('@/api/services/identity/blockingRecall')>()),
  loadVideoAliasBlockingKeys: vi.fn(),
}))

import { runIdentityRescore } from '@/api/services/identity/offlineRescore'
import { fetchVideoDetailsForCandidates } from '@/api/db/queries/video-merge-candidates'
import { upsertIdentityCandidate } from '@/api/services/identity/candidateUpsert'
import { loadExternalIdSummaries } from '@/api/services/identity/externalIdLoader'
import { loadVideoAliasBlockingKeys } from '@/api/services/identity/blockingRecall'

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
  vi.mocked(loadVideoAliasBlockingKeys).mockResolvedValue(new Map())
  // 默认：三段召回均空（单测按需 mockResolvedValueOnce 覆盖前几次调用）
  mockDbQuery.mockResolvedValue({ rows: [] })
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
      .mockResolvedValueOnce({ rows: [{ bucket_key: 'k', video_ids: Array.from({ length: 10 }, (_, i) => `v${i}`) }] })
    const r = await runIdentityRescore(mockDb, log, { maxBucket: 5 })
    expect(r.bucketsSkippedOversize).toBe(1)
    expect(fetchVideoDetailsForCandidates).not.toHaveBeenCalled()
  })

  it('正常 pipeline：高重合 pair（0.90）→ upsert created（triggerSource=offline-rescore）', async () => {
    mockLockQuery.mockResolvedValueOnce({ rows: [{ acquired: true }] }).mockResolvedValue({ rows: [] })
    mockDbQuery
      .mockResolvedValueOnce({ rows: [{ bucket_key: 'k', video_ids: ['a', 'b'] }] })
    vi.mocked(fetchVideoDetailsForCandidates).mockResolvedValue([
      videoRow('a', '某科幻动画', ['s1', 's2']),
      videoRow('b', '某科幻动画', ['s1', 's2']),
    ])
    vi.mocked(upsertIdentityCandidate).mockResolvedValue({ kind: 'created', candidateId: 'c1' })
    const r = await runIdentityRescore(mockDb, log)
    expect(r.pairs).toBe(1)
    expect(r.created).toBe(1)
    expect(upsertIdentityCandidate).toHaveBeenCalledTimes(1)
    expect(vi.mocked(upsertIdentityCandidate).mock.calls[0]![1]).toMatchObject({ triggerSource: 'offline-rescore' })
  })

  it('D-105a-20：低分 pair（0.60，同 key + 年±1 双锚点）→ 灰区准入 grayAdmitted + upsert', async () => {
    mockLockQuery.mockResolvedValueOnce({ rows: [{ acquired: true }] }).mockResolvedValue({ rows: [] })
    mockDbQuery
      .mockResolvedValueOnce({ rows: [{ bucket_key: 'k', video_ids: ['a', 'b'] }] })
    vi.mocked(fetchVideoDetailsForCandidates).mockResolvedValue([
      videoRow('a', '某科幻动画', []), // 无 source 重合 → core+year+type = 0.60 命中灰区谓词
      videoRow('b', '某科幻动画', []),
    ])
    vi.mocked(upsertIdentityCandidate).mockResolvedValue({ kind: 'created', id: 'c-1' } as never)
    const r = await runIdentityRescore(mockDb, log)
    expect(r.grayAdmitted).toBe(1)
    expect(r.skippedLowScore).toBe(0)
    expect(upsertIdentityCandidate).toHaveBeenCalledTimes(1)
  })

  it('空桶立即 break（三段均无 buckets）→ 零处理', async () => {
    mockLockQuery.mockResolvedValueOnce({ rows: [{ acquired: true }] }).mockResolvedValue({ rows: [] })
    const r = await runIdentityRescore(mockDb, log)
    expect(r.buckets).toBe(0)
    expect(r.externalIdBuckets).toBe(0)
    expect(r.aliasNormBuckets).toBe(0)
    expect(r.pairs).toBe(0)
    // 段 ① + 段 ② + 段 ③ 各发起一次空召回
    expect(mockDbQuery).toHaveBeenCalledTimes(3)
  })

  it('段 ② external_id 桶召回：标题异/外部 ID 同 pair 仍召回评分（D-105a-17 缺口治理）', async () => {
    mockLockQuery.mockResolvedValueOnce({ rows: [{ acquired: true }] }).mockResolvedValue({ rows: [] })
    mockDbQuery
      .mockResolvedValueOnce({ rows: [] }) // 段 ① core 桶：空（标题差异大 → 不同 core key）
      .mockResolvedValueOnce({ rows: [{ bucket_key: 'imdb:tt1', video_ids: ['a', 'b'] }] }) // 段 ②
    vi.mocked(fetchVideoDetailsForCandidates).mockResolvedValue([
      videoRow('a', '泰坦尼克号', []),
      videoRow('b', 'Titanic 1997', []),
    ])
    // 双方共享 imdb exact → external_exact_id_match 饱和 0.95 ≥ 0.75
    vi.mocked(loadExternalIdSummaries).mockResolvedValue(new Map([
      ['a', { exactIds: { imdb: 'tt1' } }],
      ['b', { exactIds: { imdb: 'tt1' } }],
    ]))
    vi.mocked(upsertIdentityCandidate).mockResolvedValue({ kind: 'created', candidateId: 'c-ext' })
    const r = await runIdentityRescore(mockDb, log)
    expect(r.externalIdBuckets).toBe(1)
    expect(r.buckets).toBe(1)
    expect(r.created).toBe(1)
  })

  it('段 ③ alias_normalized 桶召回：跨译名（海贼王/航海王，core key 异、别名桥接）pair 进评分；别名非正证据（D-206-6a）→ 无其它信号不自动建候选', async () => {
    mockLockQuery.mockResolvedValueOnce({ rows: [{ acquired: true }] }).mockResolvedValue({ rows: [] })
    mockDbQuery
      .mockResolvedValueOnce({ rows: [] }) // 段 ① core 桶：空（海贼王≠航海王 coreTitleKey 不同）
      .mockResolvedValueOnce({ rows: [] }) // 段 ② ext 桶：空（ID 未都填）
      .mockResolvedValueOnce({ rows: [{ bucket_key: '航海王', video_ids: ['a', 'b'] }] }) // 段 ③ alias 桶
    vi.mocked(fetchVideoDetailsForCandidates).mockResolvedValue([
      videoRow('a', '海贼王', ['s1', 's2']),
      videoRow('b', '航海王', ['s1', 's2']),
    ])
    const r = await runIdentityRescore(mockDb, log)
    expect(r.aliasNormBuckets).toBe(1)
    expect(r.buckets).toBe(1) // 仅段 ③ 桶
    expect(r.externalIdBuckets).toBe(0)
    expect(r.pairs).toBe(1) // 段 ③ 召回 → pair 进入评分（核心机制：扩召回面）
    // year+type+source = 0.55 < 0.75，core 不等 → 灰区谓词不命中（别名永不成正证据 D-206-6a）→ 不建候选
    expect(r.created).toBe(0)
    expect(r.skippedLowScore).toBe(1)
    expect(upsertIdentityCandidate).not.toHaveBeenCalled()
  })

  it('段 ① 已召回的 pair 段 ② 重复出现 → 全局 seen 去重，只评分一次', async () => {
    mockLockQuery.mockResolvedValueOnce({ rows: [{ acquired: true }] }).mockResolvedValue({ rows: [] })
    mockDbQuery
      .mockResolvedValueOnce({ rows: [{ bucket_key: 'k', video_ids: ['a', 'b'] }] }) // 段 ①
      .mockResolvedValueOnce({ rows: [] }) // 段 ① 循环结束
      .mockResolvedValueOnce({ rows: [{ bucket_key: 'imdb:tt1', video_ids: ['a', 'b'] }] }) // 段 ② 同 pair
    vi.mocked(fetchVideoDetailsForCandidates).mockResolvedValue([
      videoRow('a', '某科幻动画', ['s1', 's2']),
      videoRow('b', '某科幻动画', ['s1', 's2']),
    ])
    vi.mocked(upsertIdentityCandidate).mockResolvedValue({ kind: 'created', candidateId: 'c1' })
    const r = await runIdentityRescore(mockDb, log)
    expect(r.pairs).toBe(1) // 段 ② 桶被 seen 去重 → 不产新 pair
    expect(r.buckets).toBe(2)
    expect(r.externalIdBuckets).toBe(1)
    expect(upsertIdentityCandidate).toHaveBeenCalledTimes(1)
  })
})

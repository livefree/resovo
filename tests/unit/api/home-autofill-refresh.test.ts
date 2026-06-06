/**
 * home-autofill-refresh.test.ts — 重算调度 + worker 分派
 * （CHG-HOME-AUTOFILL-REFRESH / ADR-183 D-183-3）
 *
 * 影响面 #8 测试义务：调度判定（到期/未到期/interval null/manual_only）/
 * jobId 幂等键 + removeOnComplete 释放前提 / 入队失败不阻塞 / worker section 分派。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { HomeSectionSettings } from '@resovo/types'

// ── Mocks（scheduler / recalculate 共用）────────────────────────────────────

vi.mock('@/api/lib/postgres', () => ({ db: {} }))

const mockQueueAdd = vi.fn()
const mockQueueGetJob = vi.fn()
vi.mock('@/api/lib/queue', () => ({
  homeAutofillQueue: {
    add: (...args: unknown[]) => mockQueueAdd(...args),
    getJob: (...args: unknown[]) => mockQueueGetJob(...args),
    process: vi.fn(),
  },
}))

const mockListSettings = vi.fn()
const mockFindSettings = vi.fn()
vi.mock('@/api/db/queries/home-section-settings', () => ({
  listHomeSectionSettings: (...args: unknown[]) => mockListSettings(...args),
  findHomeSectionSettings: (...args: unknown[]) => mockFindSettings(...args),
}))

const mockSnapshotSummaries = vi.fn()
const mockInsertSnapshot = vi.fn()
vi.mock('@/api/db/queries/home-autofill-snapshots', () => ({
  listLatestSnapshotSummaries: (...args: unknown[]) => mockSnapshotSummaries(...args),
  insertHomeAutofillSnapshot: (...args: unknown[]) => mockInsertSnapshot(...args),
}))

const mockGenDouban = vi.fn()
const mockGenBangumi = vi.fn()
const mockGenTrending = vi.fn()
vi.mock('@/api/services/home-autofill/douban', () => ({
  generateDoubanSectionCandidates: (...args: unknown[]) => mockGenDouban(...args),
}))
vi.mock('@/api/services/home-autofill/bangumi', () => ({
  generateBangumiSectionCandidates: (...args: unknown[]) => mockGenBangumi(...args),
}))
vi.mock('@/api/services/home-autofill/trending', () => ({
  generateTrendingSectionCandidates: (...args: unknown[]) => mockGenTrending(...args),
}))

import { isSectionDue, runHomeAutofillTick, AUTOFILL_TICK_MS } from '@/api/workers/homeAutofillScheduler'
import { recalculateSectionSnapshot } from '@/api/services/home-autofill/recalculate'
import { POLICY_VERSION } from '@/api/services/home-autofill/policy'

const NOW = new Date('2026-06-06T12:00:00Z')

function settingsRow(section: HomeSectionSettings['section'], over: Partial<HomeSectionSettings> = {}): HomeSectionSettings {
  return {
    id: `s-${section}`,
    section,
    autofillMode: 'full_auto',
    refreshIntervalMinutes: 1440,
    displayCount: 10,
    allowDuplicates: false,
    pinnedLimit: null,
    settings: {},
    updatedAt: '2026-06-06T00:00:00Z',
    ...over,
  }
}

// ── isSectionDue（D-183-3.2 判定纯函数）─────────────────────────────────────

describe('isSectionDue', () => {
  it('interval null → 永不到期（不自动重算语义）', () => {
    expect(isSectionDue(settingsRow('featured', { refreshIntervalMinutes: null }), null, NOW)).toBe(false)
  })

  it('manual_only → 永不到期（无候选可算）', () => {
    expect(isSectionDue(settingsRow('type_shortcuts', { autofillMode: 'manual_only' }), null, NOW)).toBe(false)
  })

  it('无快照 → 立即到期（首份）', () => {
    expect(isSectionDue(settingsRow('hot_movies'), null, NOW)).toBe(true)
  })

  it('generated_at + interval 未到 → 不到期；已到/已过 → 到期', () => {
    const s = settingsRow('hot_movies', { refreshIntervalMinutes: 60 })
    expect(isSectionDue(s, '2026-06-06T11:30:00Z', NOW)).toBe(false) // 30min 前，1h 间隔未到
    expect(isSectionDue(s, '2026-06-06T11:00:00Z', NOW)).toBe(true)  // 恰好到期（≤）
    expect(isSectionDue(s, '2026-06-06T09:00:00Z', NOW)).toBe(true)  // 已过期
  })

  it('快照时间非法 → 视为到期（防解析失败卡死调度）', () => {
    expect(isSectionDue(settingsRow('hot_movies'), 'not-a-date', NOW)).toBe(true)
  })

  it('tick 常量 = 5 分钟（D-183-3.2）', () => {
    expect(AUTOFILL_TICK_MS).toBe(5 * 60_000)
  })
})

// ── runHomeAutofillTick（入队语义）──────────────────────────────────────────

describe('runHomeAutofillTick', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQueueAdd.mockResolvedValue({})
  })

  it('仅到期 section 入队：jobId 固定键 + removeOnComplete/removeOnFail true（D-183-3.3 释放前提）', async () => {
    mockListSettings.mockResolvedValue([
      settingsRow('hot_movies'),                                          // 无快照 → due
      settingsRow('hot_series'),                                          // 快照新鲜 → not due
      settingsRow('type_shortcuts', { autofillMode: 'manual_only' }),     // manual_only → skip
      settingsRow('featured', { refreshIntervalMinutes: null }),          // interval null → skip
    ])
    mockSnapshotSummaries.mockResolvedValue({
      hot_series: { generatedAt: NOW.toISOString(), candidateCount: 5 },
    })

    await runHomeAutofillTick(NOW)

    expect(mockQueueAdd).toHaveBeenCalledTimes(1)
    expect(mockQueueAdd).toHaveBeenCalledWith(
      { kind: 'recalculate', section: 'hot_movies', trigger: 'scheduled' },
      { jobId: 'autofill:hot_movies', removeOnComplete: true, removeOnFail: true },
    )
  })

  it('单 section 入队失败 warn 不阻塞其余 section（D-183-3.6）', async () => {
    mockListSettings.mockResolvedValue([settingsRow('hot_movies'), settingsRow('hot_anime')])
    mockSnapshotSummaries.mockResolvedValue({})
    mockQueueAdd.mockRejectedValueOnce(new Error('redis down')).mockResolvedValueOnce({})

    await expect(runHomeAutofillTick(NOW)).resolves.toBeUndefined()
    expect(mockQueueAdd).toHaveBeenCalledTimes(2)
  })

  it('查询失败 warn 不抛出（scheduler 不得拖垮进程）', async () => {
    mockListSettings.mockRejectedValue(new Error('db down'))
    await expect(runHomeAutofillTick(NOW)).resolves.toBeUndefined()
    expect(mockQueueAdd).not.toHaveBeenCalled()
  })
})

// ── recalculateSectionSnapshot（worker 分派 + 快照写入）─────────────────────

describe('recalculateSectionSnapshot', () => {
  const GEN_OUT = { candidates: [{ id: 'c1' }], gaps: [{ provider: 'douban' }] }

  beforeEach(() => {
    vi.clearAllMocks()
    mockFindSettings.mockResolvedValue(settingsRow('hot_movies'))
    mockGenDouban.mockResolvedValue(GEN_OUT)
    mockGenBangumi.mockResolvedValue(GEN_OUT)
    mockGenTrending.mockResolvedValue({ candidates: [], gaps: [] })
    mockInsertSnapshot.mockResolvedValue({ id: 'snap-1' })
  })

  it.each([
    ['hot_movies', () => mockGenDouban],
    ['hot_series', () => mockGenDouban],
  ] as const)('%s → douban 候选源分派', async (section, getMock) => {
    mockFindSettings.mockResolvedValue(settingsRow(section))
    const result = await recalculateSectionSnapshot({} as never, section, 'scheduled')
    expect(getMock()).toHaveBeenCalledWith(expect.anything(), section)
    expect(result.outcome).toBe('written')
  })

  it('hot_anime → bangumi / featured·top10·banner → trending 分派', async () => {
    mockFindSettings.mockResolvedValue(settingsRow('hot_anime'))
    await recalculateSectionSnapshot({} as never, 'hot_anime', 'scheduled')
    expect(mockGenBangumi).toHaveBeenCalledOnce()

    for (const section of ['featured', 'top10', 'banner'] as const) {
      mockFindSettings.mockResolvedValue(settingsRow(section, { autofillMode: 'manual_plus_autofill' }))
      await recalculateSectionSnapshot({} as never, section, 'scheduled')
    }
    expect(mockGenTrending).toHaveBeenCalledTimes(3)
    expect(mockGenTrending).toHaveBeenLastCalledWith(expect.anything(), 'banner')
  })

  it('快照写入携 POLICY_VERSION + trigger + settings 全行快照（方案 §11.2 回溯链）', async () => {
    const settings = settingsRow('hot_movies')
    mockFindSettings.mockResolvedValue(settings)
    const result = await recalculateSectionSnapshot({} as never, 'hot_movies', 'manual')
    expect(mockInsertSnapshot).toHaveBeenCalledWith(expect.anything(), {
      section: 'hot_movies',
      trigger: 'manual',
      policyVersion: POLICY_VERSION,
      settingsSnapshot: settings,
      candidates: GEN_OUT.candidates,
      gaps: GEN_OUT.gaps,
    })
    expect(result).toMatchObject({ outcome: 'written', snapshotId: 'snap-1', candidateCount: 1, gapCount: 1 })
  })

  it('settings 缺行 / manual_only / type_shortcuts → skipped 不写快照', async () => {
    mockFindSettings.mockResolvedValue(null)
    expect((await recalculateSectionSnapshot({} as never, 'hot_movies', 'scheduled')).skipReason).toBe('settings_missing')

    mockFindSettings.mockResolvedValue(settingsRow('hot_movies', { autofillMode: 'manual_only' }))
    expect((await recalculateSectionSnapshot({} as never, 'hot_movies', 'scheduled')).skipReason).toBe('manual_only')

    mockFindSettings.mockResolvedValue(settingsRow('type_shortcuts', { autofillMode: 'full_auto' }))
    expect((await recalculateSectionSnapshot({} as never, 'type_shortcuts', 'scheduled')).skipReason).toBe('no_candidate_source')

    expect(mockInsertSnapshot).not.toHaveBeenCalled()
  })
})

// ── buildTrendingCandidates（站内信号生成纯函数）────────────────────────────

describe('buildTrendingCandidates', () => {
  it('源序保持 + rank 仅未过滤占名次 + 可播/封面过滤仍生效', async () => {
    // 直接 import 真实现（trending 模块在本文件被 mock，经 importActual 取原始导出）
    const { buildTrendingCandidates } = await vi.importActual<
      typeof import('@/api/services/home-autofill/trending')
    >('@/api/services/home-autofill/trending')

    const card = (id: string, over: Record<string, unknown> = {}) => ({
      id, shortId: `s-${id}`, slug: `slug-${id}`, title: `视频 ${id}`, titleEn: null,
      coverUrl: 'c.jpg', posterBlurhash: null, posterStatus: 'ok',
      type: 'movie', rating: 8.0, year: 2026, status: 'completed',
      episodeCount: 1, sourceCount: 2, subtitleLangs: [],
      ...over,
    })
    const out = buildTrendingCandidates([
      card('v-1'),
      card('v-nosrc', { sourceCount: 0 }),
      card('v-2', { rating: null }),
    ] as never, 'trending')

    expect(out.map((c) => c.videoId)).toEqual(['v-1', 'v-nosrc', 'v-2']) // 源序权威
    expect(out.map((c) => c.rank)).toEqual([1, 0, 2])
    expect(out[1]).toMatchObject({ filtered: true, filterReason: 'no_playable_source' })
    expect(out[0]!.origin).toBe('trending')
    expect(out[2]!.score).toBe(0) // rating 缺失按 0
  })
})

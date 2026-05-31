/**
 * tests/unit/api/bangumi-service.test.ts — BangumiService + utils（ADR-161 / CHG-BNG-04/05）
 * 纯函数 utils 直接测；Service 走真实逻辑 + mock 依赖（lib/bangumi + queries）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── utils（纯函数，无需 mock）────────────────────────────────────
import {
  computeLocalBangumiConfidence,
  computeRestBangumiConfidence,
  parseInfobox,
  mapSubjectToCatalogFields,
  mapEpisodes,
} from '@/api/services/BangumiService.utils'
import type { BangumiSearchItem } from '@/api/lib/bangumi'
import type { BangumiEntryMatch } from '@/api/db/queries/externalData'
import type { BangumiSubject, BangumiEpisode } from '@/api/lib/bangumi'

function entry(p: Partial<BangumiEntryMatch> = {}): BangumiEntryMatch {
  return {
    bangumiId: 51, titleCn: '团子大家族', titleJp: 'CLANNAD', year: 2007,
    rating: 8.5, summary: '简介', airDate: '2007-10-04',
    coverUrl: null, rank: 87, nsfw: false, ...p,
  }
}

describe('computeLocalBangumiConfidence', () => {
  it('年份精确 → 0.92（auto 区间）', () => {
    expect(computeLocalBangumiConfidence(entry({ year: 2007 }), 2007).confidence).toBeCloseTo(0.92)
  })
  it('年份差 1 → 0.87', () => {
    expect(computeLocalBangumiConfidence(entry({ year: 2007 }), 2008).confidence).toBeCloseTo(0.87)
  })
  it('无年份 → 0.70（candidate 区间）', () => {
    expect(computeLocalBangumiConfidence(entry({ year: 2007 }), null).confidence).toBeCloseTo(0.7)
  })
  it('年份差 ≥2 → 0.70（不加分）', () => {
    expect(computeLocalBangumiConfidence(entry({ year: 2007 }), 2010).confidence).toBeCloseTo(0.7)
  })
})

describe('computeRestBangumiConfidence（META-17 方案 A：精确兜底）', () => {
  const item = (p: Partial<BangumiSearchItem> = {}): BangumiSearchItem => ({
    id: 1, name: 'ONE PIECE', name_cn: '海贼王', date: '2007-01-01', images: null, rating: null, ...p,
  })
  it('name_cn 精确 + 年份精确 → 0.92（auto）', () => {
    expect(computeRestBangumiConfidence(item(), '海贼王', 2007).confidence).toBeCloseTo(0.92)
  })
  it('name(日) 精确无年份 → 0.70（candidate）', () => {
    expect(computeRestBangumiConfidence(item({ name_cn: '别名', name: 'clannad' }), 'clannad', null).confidence).toBeCloseTo(0.7)
  })
  it('模糊（海贼王子 ≠ 海贼王）→ 0（拒绝）', () => {
    expect(computeRestBangumiConfidence(item({ name_cn: '海贼王子', name: '' }), '海贼王', 2007).confidence).toBe(0)
  })
  it('别名差异（航海王 ≠ 海贼王）→ 0（安全漏配）', () => {
    expect(computeRestBangumiConfidence(item({ name_cn: '航海王', name: 'ONE PIECE' }), '海贼王', 1999).confidence).toBe(0)
  })
})

describe('parseInfobox', () => {
  it('提取 导演/系列构成/动画制作，忽略 CV', () => {
    const r = parseInfobox([
      { key: '导演', value: '石原立也' },
      { key: '系列构成', value: '志茂文彦' },
      { key: '动画制作', value: '京都动画' },
      { key: 'CV', value: [{ k: '冈崎朋也', v: '中村悠一' }] },
    ])
    expect(r.directors).toEqual(['石原立也'])
    expect(r.writers).toEqual(['志茂文彦'])
    expect(r.studios).toEqual(['京都动画'])
  })
  it('数组型 value 摊平取 v', () => {
    const r = parseInfobox([{ key: '导演', value: [{ v: 'A' }, { v: 'B' }] }])
    expect(r.directors).toEqual(['A', 'B'])
  })
  it('非数组 infobox → 空结果（不抛）', () => {
    expect(parseInfobox(null)).toEqual({ directors: [], writers: [], studios: [] })
  })
})

function subject(p: Partial<BangumiSubject> = {}): BangumiSubject {
  return {
    id: 51, type: 2, name: 'CLANNAD', name_cn: '团子大家族', summary: '简介',
    nsfw: false, date: '2007-10-04', platform: 'TV',
    images: { large: 'https://x/large.jpg', common: 'https://x/common.jpg' },
    infobox: [{ key: '导演', value: '石原立也' }, { key: '动画制作', value: '京都动画' }],
    rating: { rank: 87, total: 5000, score: 8.5 },
    tags: [{ name: '治愈', count: 100 }, { name: '催泪', count: 50 }],
    total_episodes: 24, eps: 24, ...p,
  }
}

describe('mapSubjectToCatalogFields', () => {
  it('映射核心字段 + tags 含制作前缀', () => {
    const f = mapSubjectToCatalogFields(subject())
    expect(f.title).toBe('团子大家族')
    expect(f.titleOriginal).toBe('CLANNAD')
    expect(f.description).toBe('简介')
    expect(f.coverUrl).toBe('https://x/large.jpg')
    expect(f.rating).toBe(8.5)
    expect(f.ratingVotes).toBe(5000)
    expect(f.releaseDate).toBe('2007-10-04')
    expect(f.year).toBe(2007)
    expect(f.director).toEqual(['石原立也'])
    expect(f.tags).toEqual(['治愈', '催泪', '制作:京都动画'])
    expect(f.bangumiSubjectId).toBe(51)
  })
  it('缺省字段不写入（rating=0 / 无 cover）', () => {
    const f = mapSubjectToCatalogFields(subject({ rating: { rank: 0, total: 0, score: 0 }, images: null }))
    expect(f.rating).toBeUndefined()
    expect(f.coverUrl).toBeUndefined()
  })
})

describe('mapEpisodes', () => {
  it('映射逐集字段 + 解析 HH:MM:SS 时长', () => {
    const eps: BangumiEpisode[] = [{
      id: 1001, type: 0, name: 'Ep1', name_cn: '第一集', sort: 1, ep: 1,
      airdate: '2007-10-04', duration: '00:24:00', duration_seconds: null, desc: 'd',
    }]
    const r = mapEpisodes(eps)
    expect(r[0]).toMatchObject({
      source: 'bangumi', externalEpisodeId: '1001', epType: 0, sort: 1, ep: 1,
      name: 'Ep1', nameCn: '第一集', airdate: '2007-10-04', durationSeconds: 1440,
    })
  })
})

// ── Service（mock 依赖）──────────────────────────────────────────

vi.mock('@/api/lib/bangumi', () => ({
  getSubject: vi.fn(),
  getEpisodes: vi.fn(),
  searchSubjects: vi.fn(),
  searchSubjectsStrict: vi.fn(),
  isBangumiApiConfigured: vi.fn(),
}))
vi.mock('@/api/db/queries/externalData', () => ({
  findBangumiByTitleNorm: vi.fn(),
  findBangumiById: vi.fn(),
  upsertVideoExternalRef: vi.fn().mockResolvedValue({}),
}))
vi.mock('@/api/db/queries/catalogEpisodes', () => ({
  upsertCatalogEpisodes: vi.fn().mockResolvedValue(0),
}))
vi.mock('@/api/db/queries/videos', () => ({
  updateEpisodeCount: vi.fn().mockResolvedValue(undefined),
  updateVideoBangumiStatus: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/api/db/queries/mediaCatalog', () => ({
  findCatalogById: vi.fn(),
  updateCatalogFields: vi.fn(),
  setLockedFields: vi.fn(),
  addLockedFields: vi.fn(),
}))
vi.mock('@/api/db/queries/metadataProvenance', () => ({
  getHardLockedFields: vi.fn().mockResolvedValue([]),
  batchUpsertFieldProvenance: vi.fn().mockResolvedValue(undefined),
}))

import { BangumiService } from '@/api/services/BangumiService'
import * as bangumiLib from '@/api/lib/bangumi'
import * as extQ from '@/api/db/queries/externalData'
import * as epQ from '@/api/db/queries/catalogEpisodes'
import * as vQ from '@/api/db/queries/videos'
import * as catQ from '@/api/db/queries/mediaCatalog'

const mGetSubject = bangumiLib.getSubject as ReturnType<typeof vi.fn>
const mGetEpisodes = bangumiLib.getEpisodes as ReturnType<typeof vi.fn>
const mConfigured = bangumiLib.isBangumiApiConfigured as ReturnType<typeof vi.fn>
const mSearchStrict = bangumiLib.searchSubjectsStrict as ReturnType<typeof vi.fn>
const mFindByTitle = extQ.findBangumiByTitleNorm as ReturnType<typeof vi.fn>
const mFindById = extQ.findBangumiById as ReturnType<typeof vi.fn>
const mUpsertRef = extQ.upsertVideoExternalRef as ReturnType<typeof vi.fn>
const mUpsertEps = epQ.upsertCatalogEpisodes as ReturnType<typeof vi.fn>
const mUpdateEpCount = vQ.updateEpisodeCount as ReturnType<typeof vi.fn>
const mUpdateBangumiStatus = vQ.updateVideoBangumiStatus as ReturnType<typeof vi.fn>
const mFindCatalog = catQ.findCatalogById as ReturnType<typeof vi.fn>
const mUpdateCatalog = catQ.updateCatalogFields as ReturnType<typeof vi.fn>

const VID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const CID = 'cccccccc-dddd-eeee-ffff-111111111111'

describe('BangumiService.matchAndEnrich', () => {
  let svc: BangumiService
  // auto 路径 Phase 2 已事务化（Codex stop-time review）：mock Pool.connect 返回 client，
  // 记录 query 序列以断言 BEGIN/COMMIT/ROLLBACK 原子性
  let clientQueries: string[]
  let clientReleased: boolean
  let mockClient: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> }
  let mockPool: { connect: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    vi.clearAllMocks()
    clientQueries = []
    clientReleased = false
    mockClient = {
      query: vi.fn(async (sql: string) => {
        clientQueries.push(sql)
        return { rows: [], rowCount: 0 }
      }),
      release: vi.fn(() => { clientReleased = true }),
    }
    mockPool = { connect: vi.fn(async () => mockClient) }
    svc = new BangumiService(mockPool as never)
    mFindCatalog.mockResolvedValue({ id: CID, metadataSource: 'crawler', lockedFields: [] })
    mUpdateCatalog.mockResolvedValue({ id: CID, metadataSource: 'bangumi' })
    mConfigured.mockReturnValue(true)
    // META-17：REST 兜底默认无命中（既有用例 REST 不参与 → 行为不变）；REST 用例各自覆写
    mSearchStrict.mockResolvedValue([])
  })

  it('本地无匹配 → none/no_local_match + 写 bangumi_status=unmatched（Pool / ADR-170）', async () => {
    mFindByTitle.mockResolvedValue([])
    const r = await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: 'x', year: 2007 })
    expect(r).toEqual({ matched: 'none', reason: 'no_local_match' })
    expect(mUpsertRef).not.toHaveBeenCalled()
    // none 无事务 → 经 Pool（this.db = mockPool）写 unmatched
    expect(mUpdateBangumiStatus).toHaveBeenCalledWith(mockPool, VID, 'unmatched')
  })

  it('置信度 candidate（无年份 0.70）→ 写 candidate ref + bangumi_status=candidate（Pool），不更新 catalog', async () => {
    mFindByTitle.mockResolvedValue([entry()])
    const r = await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: 'x', year: null })
    expect(r).toMatchObject({ matched: 'candidate', bangumiSubjectId: 51 })
    expect(mUpsertRef).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      provider: 'bangumi', matchStatus: 'candidate', isPrimary: false,
    }))
    expect(mGetSubject).not.toHaveBeenCalled()
    expect(mUpdateCatalog).not.toHaveBeenCalled()
    // candidate 无事务 → Pool 写
    expect(mUpdateBangumiStatus).toHaveBeenCalledWith(mockPool, VID, 'candidate')
  })

  it('auto + Token 配置 → 拉 rich 详情 + 逐集 + 回填集数', async () => {
    mFindByTitle.mockResolvedValue([entry({ year: 2007 })])
    mGetSubject.mockResolvedValue(subject())
    mGetEpisodes.mockResolvedValue([{
      id: 1, type: 0, name: 'e', name_cn: '', sort: 1, ep: 1,
      airdate: '2007-10-04', duration: '', duration_seconds: 1440, desc: '',
    }])
    mUpsertEps.mockResolvedValue(1)

    const r = await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: 'x', year: 2007 })
    expect(r).toMatchObject({ matched: 'auto', bangumiSubjectId: 51, degraded: false, episodes: 1 })
    expect(mUpsertRef).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ matchStatus: 'auto_matched', isPrimary: true }))
    expect(mUpdateCatalog).toHaveBeenCalledWith(expect.anything(), CID, expect.objectContaining({
      bangumiSubjectId: 51, metadataSource: 'bangumi',
    }))
    expect(mUpsertEps).toHaveBeenCalled()
    expect(mUpdateEpCount).toHaveBeenCalledWith(expect.anything(), VID, 24)
  })

  it('auto + Token 缺失 → 降级用本地 dump 字段，不调 API', async () => {
    mConfigured.mockReturnValue(false)
    mFindByTitle.mockResolvedValue([entry({ year: 2007 })])

    const r = await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: 'x', year: 2007 })
    expect(r).toMatchObject({ matched: 'auto', degraded: true, episodes: 0 })
    expect(mGetSubject).not.toHaveBeenCalled()
    expect(mUpdateCatalog).toHaveBeenCalledWith(expect.anything(), CID, expect.objectContaining({
      bangumiSubjectId: 51, title: '团子大家族', metadataSource: 'bangumi',
    }))
  })

  it('auto + getSubject 失败 → 降级本地 dump 字段', async () => {
    mFindByTitle.mockResolvedValue([entry({ year: 2007 })])
    mGetSubject.mockResolvedValue(null)

    const r = await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: 'x', year: 2007 })
    expect(r).toMatchObject({ matched: 'auto', degraded: true })
    expect(mUpdateCatalog).toHaveBeenCalled()
  })

  it('集数回填用 wiki eps（本篇），不用 total_episodes（P1）', async () => {
    mFindByTitle.mockResolvedValue([entry({ year: 2007 })])
    // total_episodes=26（含 SP/OP/ED）但 eps=24（本篇）→ 应回填 24
    mGetSubject.mockResolvedValue(subject({ eps: 24, total_episodes: 26 }))
    mGetEpisodes.mockResolvedValue([])
    await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: 'x', year: 2007 })
    expect(mUpdateEpCount).toHaveBeenCalledWith(expect.anything(), VID, 24)
  })

  it('eps 缺省时数 type===0 本篇集数回填（P1）', async () => {
    mFindByTitle.mockResolvedValue([entry({ year: 2007 })])
    mGetSubject.mockResolvedValue(subject({ eps: 0, total_episodes: 13 }))
    mGetEpisodes.mockResolvedValue([
      { id: 1, type: 0, name: '', name_cn: '', sort: 1, ep: 1, airdate: '', duration: '', duration_seconds: null, desc: '' },
      { id: 2, type: 0, name: '', name_cn: '', sort: 2, ep: 2, airdate: '', duration: '', duration_seconds: null, desc: '' },
      { id: 3, type: 1, name: 'SP', name_cn: '', sort: 3, ep: null, airdate: '', duration: '', duration_seconds: null, desc: '' },
    ])
    mUpsertEps.mockResolvedValue(3)
    await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: 'x', year: 2007 })
    expect(mUpdateEpCount).toHaveBeenCalledWith(expect.anything(), VID, 2)
  })

  // ── Codex stop-time review FIX：auto 路径原子性回归 ──────────────────
  it('auto 成功 → BEGIN … COMMIT 原子提交 catalog + auto_matched ref', async () => {
    mFindByTitle.mockResolvedValue([entry({ year: 2007 })])
    mGetSubject.mockResolvedValue(subject())
    mGetEpisodes.mockResolvedValue([])

    await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: 'x', year: 2007 })

    expect(clientQueries[0]).toBe('BEGIN')
    expect(clientQueries[clientQueries.length - 1]).toBe('COMMIT')
    expect(mUpsertRef).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      provider: 'bangumi', matchStatus: 'auto_matched', isPrimary: true,
    }))
    // ADR-170 R-3：status 写入用事务 client（mockClient，非 mockPool）→ 与 catalog+ref 同事务
    expect(mUpdateBangumiStatus).toHaveBeenCalledWith(mockClient, VID, 'matched')
    expect(mUpdateBangumiStatus).not.toHaveBeenCalledWith(mockPool, VID, 'matched')
    expect(clientReleased).toBe(true)
  })

  it('auto + catalog 写失败 → ROLLBACK + 抛错，不留已提交的 auto_matched ref（脏态防护）', async () => {
    mFindByTitle.mockResolvedValue([entry({ year: 2007 })])
    mGetSubject.mockResolvedValue(subject())
    mGetEpisodes.mockResolvedValue([])
    mUpdateCatalog.mockRejectedValueOnce(new Error('catalog write failure'))

    await expect(
      svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: 'x', year: 2007 }),
    ).rejects.toThrow('catalog write failure')

    expect(clientQueries).toContain('BEGIN')
    expect(clientQueries).toContain('ROLLBACK')
    expect(clientQueries).not.toContain('COMMIT')
    // ref 在 catalog 写入之后才写 → catalog 失败时根本未触达 ref upsert（无孤儿 auto_matched ref）
    expect(mUpsertRef).not.toHaveBeenCalled()
    // ADR-170 R-3：catalog 失败 → status 也未写（无脏 matched）
    expect(mUpdateBangumiStatus).not.toHaveBeenCalled()
    expect(clientReleased).toBe(true)
  })

  it('auto + status update 写失败 → ROLLBACK + 抛错，不得 COMMIT（ADR-170 R-3：status 在事务内）', async () => {
    mFindByTitle.mockResolvedValue([entry({ year: 2007 })])
    mGetSubject.mockResolvedValue(subject())
    mGetEpisodes.mockResolvedValue([])
    mUpdateBangumiStatus.mockRejectedValueOnce(new Error('status update failure'))

    await expect(
      svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: 'x', year: 2007 }),
    ).rejects.toThrow('status update failure')

    // status 写在 ref 之后、COMMIT 之前 → catalog + ref 已写但事务整体 ROLLBACK（无半提交脏态）
    expect(mUpdateCatalog).toHaveBeenCalled()
    expect(mUpsertRef).toHaveBeenCalled()
    expect(mUpdateBangumiStatus).toHaveBeenCalledWith(mockClient, VID, 'matched')
    expect(clientQueries).toContain('BEGIN')
    expect(clientQueries).toContain('ROLLBACK')
    expect(clientQueries).not.toContain('COMMIT')
    expect(clientReleased).toBe(true)
  })

  // ── META-17 方案 A：REST 精确兜底（本地 dump 空时）──────────────────
  it('REST 兜底：name_cn 精确 + 年份 → auto（dump 空 / token 配置）', async () => {
    mFindByTitle.mockResolvedValue([])
    mSearchStrict.mockResolvedValue([
      { id: 975, name: 'ONE PIECE', name_cn: '海贼王', date: '2007-01-01', images: null, rating: null },
    ])
    mGetSubject.mockResolvedValue(subject({ id: 975 }))
    mGetEpisodes.mockResolvedValue([])
    const r = await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: '海贼王', year: 2007 })
    expect(r).toMatchObject({ matched: 'auto', bangumiSubjectId: 975 })
    expect(mSearchStrict).toHaveBeenCalledWith('海贼王')
    expect(mUpsertRef).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ matchStatus: 'auto_matched', isPrimary: true }))
  })

  it('REST 兜底：name 精确无年份 → candidate', async () => {
    mFindByTitle.mockResolvedValue([])
    mSearchStrict.mockResolvedValue([
      { id: 800, name: 'clannad', name_cn: '别名不符', date: null, images: null, rating: null },
    ])
    const r = await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: 'clannad', year: null })
    expect(r).toMatchObject({ matched: 'candidate', bangumiSubjectId: 800 })
    expect(mUpdateBangumiStatus).toHaveBeenCalledWith(mockPool, VID, 'candidate')
  })

  it('REST 兜底：模糊命中（海贼王子 ≠ 海贼王）→ 拒绝 none/unmatched（防假阳性）', async () => {
    mFindByTitle.mockResolvedValue([])
    mSearchStrict.mockResolvedValue([
      { id: 145691, name: '', name_cn: '海贼王子', date: null, images: null, rating: null },
    ])
    const r = await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: '海贼王', year: null })
    expect(r).toEqual({ matched: 'none', reason: 'no_local_match' })
    expect(mUpdateBangumiStatus).toHaveBeenCalledWith(mockPool, VID, 'unmatched')
  })

  it('REST 兜底：别名差异（航海王 ≠ 海贼王）→ 安全漏配 none（留人工确认）', async () => {
    mFindByTitle.mockResolvedValue([])
    mSearchStrict.mockResolvedValue([
      { id: 975, name: 'ONE PIECE', name_cn: '航海王', date: '1999-01-01', images: null, rating: null },
    ])
    const r = await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: '海贼王', year: 1999 })
    expect(r).toEqual({ matched: 'none', reason: 'no_local_match' })
  })

  it('REST 兜底：token 未配置 → 不调 REST', async () => {
    mConfigured.mockReturnValue(false)
    mFindByTitle.mockResolvedValue([])
    const r = await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: '海贼王', year: 2007 })
    expect(r).toEqual({ matched: 'none', reason: 'no_local_match' })
    expect(mSearchStrict).not.toHaveBeenCalled()
  })

  it('本地命中 → 不触发 REST 兜底', async () => {
    mFindByTitle.mockResolvedValue([entry({ year: 2007 })])
    mGetSubject.mockResolvedValue(subject())
    mGetEpisodes.mockResolvedValue([])
    await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: 'x', year: 2007 })
    expect(mSearchStrict).not.toHaveBeenCalled()
  })

  // ── Codex stop-time review 修复：瞬时失败不得写终态 ───────────────────
  it('REST 搜索瞬时失败（throw）→ 上抛重试，不写终态 unmatched', async () => {
    mFindByTitle.mockResolvedValue([])
    mSearchStrict.mockRejectedValue(new Error('bangumi searchSubjects failed: HTTP 429'))
    await expect(
      svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: '海贼王', year: 2007 }),
    ).rejects.toThrow('429')
    // 关键：未把瞬时失败误写成终态 unmatched（保持 pending，由 Bull 重试）
    expect(mUpdateBangumiStatus).not.toHaveBeenCalled()
  })

  it('REST 命中但 getSubject 详情瞬时失败（fields=null）→ 上抛重试，不提交 matched 空数据', async () => {
    mFindByTitle.mockResolvedValue([])
    mSearchStrict.mockResolvedValue([
      { id: 975, name: 'ONE PIECE', name_cn: '海贼王', date: '2007-01-01', images: null, rating: null },
    ])
    mGetSubject.mockResolvedValue(null) // 详情瞬时失败 → degraded + fields=null（REST 命中无 dump 降级）
    await expect(
      svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: '海贼王', year: 2007 }),
    ).rejects.toThrow(/detail fetch failed/)
    // 关键：未提交 matched + 未写 ref（无「matched 但空数据」终态）
    expect(mUpsertRef).not.toHaveBeenCalled()
    expect(mUpdateBangumiStatus).not.toHaveBeenCalledWith(expect.anything(), VID, 'matched')
  })
})

describe('BangumiService.confirmMatch', () => {
  let svc: BangumiService
  // ── 事务化 confirmMatch（Codex stop-time review FIX）：mock Pool.connect 返回 client
  //    记录 query 调用序列，便于断言 BEGIN/COMMIT/ROLLBACK 顺序与原子性 ──────────
  let clientQueries: string[]
  let clientReleased: boolean
  let mockClient: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> }
  let mockPool: { connect: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    vi.clearAllMocks()
    clientQueries = []
    clientReleased = false
    mockClient = {
      query: vi.fn(async (sql: string) => {
        clientQueries.push(sql)
        return { rows: [], rowCount: 0 }
      }),
      release: vi.fn(() => { clientReleased = true }),
    }
    mockPool = { connect: vi.fn(async () => mockClient) }
    svc = new BangumiService(mockPool as never)
    mFindCatalog.mockResolvedValue({ id: CID, metadataSource: 'crawler', lockedFields: [] })
    mUpdateCatalog.mockResolvedValue({ id: CID, metadataSource: 'bangumi' })
  })

  it('subject 不在 dump 且无 Token → updated:false，不写 catalog/ref（P1）', async () => {
    mConfigured.mockReturnValue(false)
    mFindById.mockResolvedValue(null)
    const r = await svc.confirmMatch(VID, CID, 99999)
    expect(r).toEqual({ updated: false })
    expect(mUpdateCatalog).not.toHaveBeenCalled()
    expect(mUpsertRef).not.toHaveBeenCalled()
    // gather 返回 null fields → 不开事务（不浪费连接）
    expect(mockPool.connect).not.toHaveBeenCalled()
    expect(clientQueries).toEqual([])
    expect(clientReleased).toBe(false)
  })

  it('subject 不在 dump 但有 Token → 用显式 bangumiId 拉 rich，updated:true + 写 manual_confirmed ref（P1）', async () => {
    mConfigured.mockReturnValue(true)
    mFindById.mockResolvedValue(null)
    mGetSubject.mockResolvedValue(subject({ id: 99999 }))
    mGetEpisodes.mockResolvedValue([])
    const r = await svc.confirmMatch(VID, CID, 99999)
    expect(r).toEqual({ updated: true })
    expect(mGetSubject).toHaveBeenCalledWith(99999)
    expect(mUpdateCatalog).toHaveBeenCalled()
    expect(mUpsertRef).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      provider: 'bangumi', matchStatus: 'manual_confirmed', isPrimary: true,
    }))
    // ADR-170 D-170-4：手动确认 → matched，用事务 client（同事务原子）
    expect(mUpdateBangumiStatus).toHaveBeenCalledWith(mockClient, VID, 'matched')
    // BEGIN ... COMMIT；client 释放
    expect(clientQueries[0]).toBe('BEGIN')
    expect(clientQueries[clientQueries.length - 1]).toBe('COMMIT')
    expect(clientReleased).toBe(true)
  })

  // ── Codex stop-time review FIX-1（P2）：REST 必须在 BEGIN 前，防 idle-in-transaction ──
  it('REST (getSubject/getEpisodes) 在 pool.connect()/BEGIN 之前完成，避免事务持锁等网络', async () => {
    mConfigured.mockReturnValue(true)
    mFindById.mockResolvedValue(null)

    const callOrder: string[] = []
    mGetSubject.mockImplementation(async () => {
      callOrder.push('getSubject')
      return subject({ id: 99999 })
    })
    mGetEpisodes.mockImplementation(async () => {
      callOrder.push('getEpisodes')
      return []
    })
    mockPool.connect = vi.fn(async () => {
      callOrder.push('pool.connect')
      return mockClient
    })
    mockClient.query = vi.fn(async (sql: string) => {
      callOrder.push(`query:${sql}`)
      clientQueries.push(sql)
      return { rows: [], rowCount: 0 }
    })

    await svc.confirmMatch(VID, CID, 99999)

    const idxGetSubject = callOrder.indexOf('getSubject')
    const idxGetEpisodes = callOrder.indexOf('getEpisodes')
    const idxConnect = callOrder.indexOf('pool.connect')
    const idxBegin = callOrder.indexOf('query:BEGIN')

    expect(idxGetSubject).toBeGreaterThanOrEqual(0)
    expect(idxGetEpisodes).toBeGreaterThan(idxGetSubject)
    expect(idxConnect).toBeGreaterThan(idxGetEpisodes)
    expect(idxBegin).toBeGreaterThan(idxConnect)
  })

  // ── Codex stop-time review FIX：原子性回归 ────────────────────────
  it('ref 写入抛错 → ROLLBACK + 错误抛出，不留 catalog 已改但 ref 未写的脏态', async () => {
    mConfigured.mockReturnValue(true)
    mFindById.mockResolvedValue(null)
    mGetSubject.mockResolvedValue(subject({ id: 99999 }))
    mGetEpisodes.mockResolvedValue([])
    mUpsertRef.mockRejectedValueOnce(new Error('simulated ref write failure'))

    await expect(svc.confirmMatch(VID, CID, 99999)).rejects.toThrow('simulated ref write failure')
    // enrichCatalog 已调用 updateCatalogFields（共享 client），但事务 ROLLBACK
    expect(mUpdateCatalog).toHaveBeenCalled()
    expect(mUpsertRef).toHaveBeenCalled()
    expect(clientQueries).toContain('BEGIN')
    expect(clientQueries).toContain('ROLLBACK')
    expect(clientQueries).not.toContain('COMMIT')
    expect(clientReleased).toBe(true)
  })

  it('confirmMatch + status update 写失败 → ROLLBACK + 抛错，不得 COMMIT（ADR-170 R-3：status 在事务内）', async () => {
    mConfigured.mockReturnValue(true)
    mFindById.mockResolvedValue(null)
    mGetSubject.mockResolvedValue(subject({ id: 99999 }))
    mGetEpisodes.mockResolvedValue([])
    mUpdateBangumiStatus.mockRejectedValueOnce(new Error('status update failure'))

    await expect(svc.confirmMatch(VID, CID, 99999)).rejects.toThrow('status update failure')

    // status 写在 ref 之后、COMMIT 之前 → catalog + manual_confirmed ref 已写但事务整体 ROLLBACK
    expect(mUpdateCatalog).toHaveBeenCalled()
    expect(mUpsertRef).toHaveBeenCalled()
    expect(mUpdateBangumiStatus).toHaveBeenCalledWith(mockClient, VID, 'matched')
    expect(clientQueries).toContain('BEGIN')
    expect(clientQueries).toContain('ROLLBACK')
    expect(clientQueries).not.toContain('COMMIT')
    expect(clientReleased).toBe(true)
  })

  it('enrichCatalog 内部抛错（updateCatalogFields fail）→ ROLLBACK + 错误抛出', async () => {
    mConfigured.mockReturnValue(true)
    mFindById.mockResolvedValue(null)
    mGetSubject.mockResolvedValue(subject({ id: 99999 }))
    mGetEpisodes.mockResolvedValue([])
    mUpdateCatalog.mockRejectedValueOnce(new Error('catalog write failure'))

    await expect(svc.confirmMatch(VID, CID, 99999)).rejects.toThrow('catalog write failure')
    expect(mUpsertRef).not.toHaveBeenCalled()
    expect(clientQueries).toContain('BEGIN')
    expect(clientQueries).toContain('ROLLBACK')
    expect(clientQueries).not.toContain('COMMIT')
    expect(clientReleased).toBe(true)
  })
})

describe('BangumiService.searchCandidates', () => {
  let svc: BangumiService
  beforeEach(() => {
    vi.clearAllMocks()
    svc = new BangumiService({} as never)
  })

  it('本地 dump 召回 → 带置信度，按 confidence 降序', async () => {
    mFindByTitle.mockResolvedValue([
      entry({ bangumiId: 1, year: 2007 }),   // year 精确 → 0.92
      entry({ bangumiId: 2, year: 2000 }),   // year 差远 → 0.70
    ])
    const r = await svc.searchCandidates({ titleNorm: 'clannad', year: 2007 })
    expect(r.map((c) => c.bangumiSubjectId)).toEqual([1, 2])
    expect(r[0].confidence).toBeCloseTo(0.92)
    expect((bangumiLib.searchSubjects as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })

  it('keyword + Token → REST 兜底（confidence=0），与本地去重合并', async () => {
    mFindByTitle.mockResolvedValue([entry({ bangumiId: 1, year: 2007 })])
    mConfigured.mockReturnValue(true)
    ;(bangumiLib.searchSubjects as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 1, name: 'dup', name_cn: 'dup-cn', date: '2007-01-01', images: null, rating: null }, // 与本地重复 → 跳过
      { id: 5, name: 'New', name_cn: '新', date: '2010-04-01', images: { large: 'L' }, rating: { score: 7, total: 10, rank: 1 } },
    ])
    const r = await svc.searchCandidates({ titleNorm: 'clannad', year: 2007, keyword: 'clannad' })
    expect(r.map((c) => c.bangumiSubjectId).sort()).toEqual([1, 5])
    const rest = r.find((c) => c.bangumiSubjectId === 5)!
    expect(rest).toMatchObject({ confidence: 0, year: 2010, rating: 7, coverUrl: 'L', nameCn: '新' })
  })

  it('keyword 但 Token 缺失 → 不调 REST，仅本地', async () => {
    mFindByTitle.mockResolvedValue([])
    mConfigured.mockReturnValue(false)
    const r = await svc.searchCandidates({ titleNorm: 'x', year: null, keyword: 'foo' })
    expect(r).toEqual([])
    expect((bangumiLib.searchSubjects as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })
})

/**
 * tests/unit/api/bangumi-service.test.ts — BangumiService + utils（ADR-161 / CHG-BNG-04/05）
 * 纯函数 utils 直接测；Service 走真实逻辑 + mock 依赖（lib/bangumi + queries）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── utils（纯函数，无需 mock）────────────────────────────────────
import {
  computeLocalBangumiConfidence,
  parseInfobox,
  mapSubjectToCatalogFields,
  mapEpisodes,
} from '@/api/services/BangumiService.utils'
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
const mFindByTitle = extQ.findBangumiByTitleNorm as ReturnType<typeof vi.fn>
const mFindById = extQ.findBangumiById as ReturnType<typeof vi.fn>
const mUpsertRef = extQ.upsertVideoExternalRef as ReturnType<typeof vi.fn>
const mUpsertEps = epQ.upsertCatalogEpisodes as ReturnType<typeof vi.fn>
const mUpdateEpCount = vQ.updateEpisodeCount as ReturnType<typeof vi.fn>
const mFindCatalog = catQ.findCatalogById as ReturnType<typeof vi.fn>
const mUpdateCatalog = catQ.updateCatalogFields as ReturnType<typeof vi.fn>

const VID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const CID = 'cccccccc-dddd-eeee-ffff-111111111111'

describe('BangumiService.matchAndEnrich', () => {
  let svc: BangumiService
  beforeEach(() => {
    vi.clearAllMocks()
    svc = new BangumiService({} as never)
    mFindCatalog.mockResolvedValue({ id: CID, metadataSource: 'crawler', lockedFields: [] })
    mUpdateCatalog.mockResolvedValue({ id: CID, metadataSource: 'bangumi' })
    mConfigured.mockReturnValue(true)
  })

  it('本地无匹配 → none/no_local_match', async () => {
    mFindByTitle.mockResolvedValue([])
    const r = await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: 'x', year: 2007 })
    expect(r).toEqual({ matched: 'none', reason: 'no_local_match' })
    expect(mUpsertRef).not.toHaveBeenCalled()
  })

  it('置信度 candidate（无年份 0.70）→ 写 candidate ref，不更新 catalog', async () => {
    mFindByTitle.mockResolvedValue([entry()])
    const r = await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: 'x', year: null })
    expect(r).toMatchObject({ matched: 'candidate', bangumiSubjectId: 51 })
    expect(mUpsertRef).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      provider: 'bangumi', matchStatus: 'candidate', isPrimary: false,
    }))
    expect(mGetSubject).not.toHaveBeenCalled()
    expect(mUpdateCatalog).not.toHaveBeenCalled()
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
})

describe('BangumiService.confirmMatch', () => {
  let svc: BangumiService
  beforeEach(() => {
    vi.clearAllMocks()
    svc = new BangumiService({} as never)
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

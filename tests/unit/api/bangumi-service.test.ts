/**
 * tests/unit/api/bangumi-service.test.ts — BangumiService + utils（ADR-161 / CHG-BNG-04/05）
 * 纯函数 utils 直接测；Service 走真实逻辑 + mock 依赖（lib/bangumi + queries）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── utils（纯函数，无需 mock）────────────────────────────────────
import {
  computeLocalBangumiConfidence,
  computeRestBangumiConfidence,
  computeAliasBangumiConfidence,
  isAmbiguousLocalMatch,
  parseInfobox,
  parseInfoboxAliases,
  parseInfoboxCountry,
  mapSubjectToCatalogFields,
  mapEpisodes,
  mapCharacters,
} from '@/api/services/BangumiService.utils'
import type { BangumiCharacter } from '@/api/lib/bangumi'
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

describe('isAmbiguousLocalMatch（META-22 三次修订 / 有损键歧义守卫）', () => {
  it('单条命中 → 非歧义', () => {
    expect(isAmbiguousLocalMatch([{ year: 2007 }], 2007)).toBe(false)
  })
  it('top-2 同为年份精确 → 歧义（标题键无法唯一定位）', () => {
    expect(isAmbiguousLocalMatch([{ year: 2007 }, { year: 2007 }], 2007)).toBe(true)
  })
  it('top-1 年份精确 / top-2 年份差 2 → 非歧义（年份可区分）', () => {
    expect(isAmbiguousLocalMatch([{ year: 2007 }, { year: 2010 }], 2007)).toBe(false)
  })
  it('视频无年份 + 多条命中 → 歧义（无年份可判别）', () => {
    expect(isAmbiguousLocalMatch([{ year: 2007 }, { year: 2010 }], null)).toBe(true)
  })
  it('top-2 同为差 1 档 → 歧义', () => {
    expect(isAmbiguousLocalMatch([{ year: 2008 }, { year: 2006 }], 2007)).toBe(true)
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
  it('别名差异（航海王 ≠ 海贼王）→ 0（安全漏配，由 META-20 别名感知补救）', () => {
    expect(computeRestBangumiConfidence(item({ name_cn: '航海王', name: 'ONE PIECE' }), '海贼王', 1999).confidence).toBe(0)
  })
})

describe('parseInfoboxAliases / computeAliasBangumiConfidence（META-20 别名感知 B）', () => {
  it('parseInfoboxAliases 提取「别名」（字符串 + 数组型）', () => {
    expect(parseInfoboxAliases([
      { key: '别名', value: [{ v: '海贼王' }, { v: 'ワンピース' }] },
      { key: '导演', value: '尾田' },
    ])).toEqual(['海贼王', 'ワンピース'])
    expect(parseInfoboxAliases([{ key: '别名', value: '航海王' }])).toEqual(['航海王'])
    expect(parseInfoboxAliases(null)).toEqual([])
  })

  it('别名精确命中 + 年份 → ≥0.85（auto，召回 海贼王↔航海王）', () => {
    const subj = subject({ name_cn: '航海王', name: 'ONE PIECE', date: '1999-10-20', infobox: [{ key: '别名', value: [{ v: '海贼王' }] }] })
    const r = computeAliasBangumiConfidence(subj, '海贼王', 1999)
    expect(r.confidence).toBeCloseTo(0.92)
  })

  it('别名命中无年份 → 0.70（candidate，人工确认）', () => {
    const subj = subject({ name_cn: '航海王', name: 'ONE PIECE', date: null, infobox: [{ key: '别名', value: '海贼王' }] })
    expect(computeAliasBangumiConfidence(subj, '海贼王', null).confidence).toBeCloseTo(0.7)
  })

  it('无别名命中 → 0（不引入假阳性）', () => {
    const subj = subject({ name_cn: '航海王', name: 'ONE PIECE', infobox: [{ key: '别名', value: '航海王启航' }] })
    expect(computeAliasBangumiConfidence(subj, '火影忍者', 2002).confidence).toBe(0)
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

describe('parseInfoboxCountry（META-41-B：仅显式产地键，不盲目缺省）', () => {
  it('命中显式产地键「国家/地区」→ 返回首值', () => {
    expect(parseInfoboxCountry([{ key: '国家/地区', value: '中国大陆' }])).toBe('中国大陆')
  })
  it('命中「制作国家/地区」/「产地」', () => {
    expect(parseInfoboxCountry([{ key: '制作国家/地区', value: '日本' }])).toBe('日本')
    expect(parseInfoboxCountry([{ key: '产地', value: '美国' }])).toBe('美国')
  })
  it('繁体键变体「國家/地區」', () => {
    expect(parseInfoboxCountry([{ key: '國家/地區', value: '香港' }])).toBe('香港')
  })
  it('数组型 value 取首值', () => {
    expect(parseInfoboxCountry([{ key: '国家/地区', value: [{ v: '日本' }, { v: '美国' }] }])).toBe('日本')
  })
  it('无产地键 → null（绝不盲目缺省 JP）', () => {
    expect(parseInfoboxCountry([{ key: '导演', value: '石原立也' }, { key: '动画制作', value: '京都动画' }])).toBeNull()
  })
  it('非数组 infobox → null（不抛）', () => {
    expect(parseInfoboxCountry(null)).toBeNull()
    expect(parseInfoboxCountry(undefined)).toBeNull()
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
  it('META-41-A：题材标签经白名单归一 → genres + genresRaw（噪声/情绪标签滤除）', () => {
    const f = mapSubjectToCatalogFields(subject({
      tags: [
        { name: '热血', count: 500 },   // action ✓
        { name: '校园', count: 480 },   // 设定，跳过
        { name: '战斗', count: 300 },   // action（与热血去重）
        { name: '科幻', count: 200 },   // sci_fi ✓
        { name: '治愈', count: 100 },   // 情绪，跳过
      ],
    }))
    expect(f.genres).toEqual(['action', 'sci_fi'])
    expect(f.genresRaw).toEqual(['热血', '战斗', '科幻'])
    // tags 字段仍保留全部原始标签（含未映射的设定/情绪标签）供审核
    expect(f.tags).toContain('校园')
    expect(f.tags).toContain('治愈')
  })
  it('META-41-A：无可映射题材标签 → 不写 genres/genresRaw（默认 fixture 治愈/催泪不入表）', () => {
    const f = mapSubjectToCatalogFields(subject())
    expect(f.genres).toBeUndefined()
    expect(f.genresRaw).toBeUndefined()
  })
  it('META-41-B：infobox 显式产地键 → country 经 countryToIso 归一 ISO（中国大陆→CN）', () => {
    const f = mapSubjectToCatalogFields(subject({
      infobox: [{ key: '导演', value: '石原立也' }, { key: '国家/地区', value: '中国大陆' }],
    }))
    expect(f.country).toBe('CN')
  })
  it('META-41-B：日本产地 → JP；无产地键 → 不写 country（绝不盲目缺省 JP）', () => {
    expect(mapSubjectToCatalogFields(subject({ infobox: [{ key: '产地', value: '日本' }] })).country).toBe('JP')
    // 默认 fixture infobox 仅 导演/动画制作，无产地键 → country 不写
    expect(mapSubjectToCatalogFields(subject()).country).toBeUndefined()
  })
  it('META-41-B：产地值 countryToIso 归一不到（表外生僻名）→ 不写 country（保列纯净）', () => {
    const f = mapSubjectToCatalogFields(subject({ infobox: [{ key: '国家/地区', value: '火星国' }] }))
    expect(f.country).toBeUndefined()
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

  it('META-15-C：清洗非法 airdate（仅年份/残缺/空 → null，防 DATE 插入失败回滚）', () => {
    const mk = (id: number, airdate: string) => ({
      id, type: 0, name: '', name_cn: '', sort: id, ep: id,
      airdate, duration: '', duration_seconds: 0, desc: '',
    })
    const r = mapEpisodes([
      mk(1, '2099'),          // 仅年份
      mk(2, '2024-00-00'),    // 残缺月日
      mk(3, ''),              // 空
      mk(4, '2007-10-04'),    // 合法
      mk(5, '2024-13-40'),    // 越界月日
    ])
    expect(r.map((e) => e.airdate)).toEqual([null, null, null, '2007-10-04', null])
  })
})

describe('mapCharacters（META-19）', () => {
  const chars: BangumiCharacter[] = [
    { id: 1, name: '配角X', type: 1, images: { medium: 'x.jpg' }, relation: '配角', summary: 's1', actors: [{ id: 91, name: 'CV-X', type: 1, images: null }] },
    { id: 2, name: '主角Y', type: 1, images: null, relation: '主角', summary: 's2',
      actors: [{ id: 92, name: 'CV-Y1', type: 1, images: { large: 'y1.jpg' } }, { id: 93, name: 'CV-Y2', type: 1, images: null }] },
    { id: 3, name: '路人Z', type: 1, images: null, relation: '闲角', summary: '', actors: [] },
  ]

  it('映射 + relation 权重排序（主角 sort < 配角 < 闲角）', () => {
    const r = mapCharacters(chars)
    const byName = Object.fromEntries(r.map((c) => [c.name, c]))
    expect(byName['主角Y'].sort).toBeLessThan(byName['配角X'].sort)
    expect(byName['配角X'].sort).toBeLessThan(byName['路人Z'].sort)
  })

  it('保留 N:M 多 CV + 字段映射 + 取图降级', () => {
    const r = mapCharacters(chars)
    const y = r.find((c) => c.name === '主角Y')!
    expect(y).toMatchObject({ source: 'bangumi', externalCharacterId: '2', relation: '主角', charType: 1 })
    expect(y.actors).toHaveLength(2)
    expect(y.actors[0]).toMatchObject({ externalActorId: '92', name: 'CV-Y1', imageUrl: 'y1.jpg', sort: 0 })
    expect(y.actors[1]).toMatchObject({ externalActorId: '93', name: 'CV-Y2', imageUrl: null, sort: 1 })
    // 取图降级：配角X 用 medium
    expect(r.find((c) => c.name === '配角X')!.imageUrl).toBe('x.jpg')
  })
})

// ── Service（mock 依赖）──────────────────────────────────────────

vi.mock('@/api/lib/bangumi', () => ({
  getSubject: vi.fn(),
  getEpisodes: vi.fn(),
  // 默认 null = 抓取未成功（既有 auto 用例不触发角色替换）；角色用例各自覆写
  getCharacters: vi.fn().mockResolvedValue(null),
  searchSubjects: vi.fn(),
  searchSubjectsStrict: vi.fn(),
  isBangumiApiConfigured: vi.fn(),
}))
vi.mock('@/api/db/queries/externalData', () => ({
  findBangumiByTitleNorm: vi.fn(),
  findBangumiById: vi.fn(),
  upsertVideoExternalRef: vi.fn().mockResolvedValue({}),
  // META-15-C FIX：默认无既有绑定 → 走正常匹配（既有用例不受影响）；绑定用例各自覆写
  findPrimaryVideoExternalRef: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/api/db/queries/catalogEpisodes', () => ({
  upsertCatalogEpisodes: vi.fn().mockResolvedValue(0),
}))
vi.mock('@/api/db/queries/catalogCharacters', () => ({
  replaceCatalogCharacters: vi.fn().mockResolvedValue(0),
}))
vi.mock('@/api/db/queries/videos', () => ({
  updateEpisodeCount: vi.fn().mockResolvedValue(undefined),
  updateVideoBangumiStatus: vi.fn().mockResolvedValue(undefined),
}))
// META-16-B：getBangumiConfig 读 system_settings；默认返回空 → cfg={} → lib 回退 env（mConfigured 控制行为）
vi.mock('@/api/db/queries/systemSettings', () => ({
  getAllSettings: vi.fn().mockResolvedValue({}),
}))
// META-26 / ADR-173 D-173-3：loadBangumiClientConfig 现经 loadProviderCredential 先读 api_credentials；
// getApiCredentialRow → null 使解析器回退已 mock 的 getAllSettings（避免 db.query is not a function）
vi.mock('@/api/db/queries/apiCredentials', () => ({
  getApiCredentialRow: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/api/db/queries/mediaCatalog', () => ({
  findCatalogById: vi.fn(),
  // D-174-3：默认无他行占用该 subject → resolveBangumiBinding 返回 safe（既有用例不受影响）
  findCatalogByBangumiId: vi.fn().mockResolvedValue(null),
  updateCatalogFields: vi.fn(),
  setLockedFields: vi.fn(),
  addLockedFields: vi.fn(),
  linkVideoToCatalog: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/api/db/queries/metadataProvenance', () => ({
  getHardLockedFields: vi.fn().mockResolvedValue([]),
  batchUpsertFieldProvenance: vi.fn().mockResolvedValue(undefined),
}))
// CHG-VIR-12-D：catalog 层冲突双写 + safeUpdate 写侧接线（YY-C）—— mock 写原语
vi.mock('@/api/db/queries/catalogExternalRefs', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/api/db/queries/catalogExternalRefs')>()
  return {
    ...orig,
    resolveAndWriteExactRef: vi.fn().mockResolvedValue({ outcome: 'exact_written' }),
    insertCandidateRef: vi.fn().mockResolvedValue(true),
    demoteExactRef: vi.fn().mockResolvedValue(0),
  }
})

import * as externalRefQueries from '@/api/db/queries/catalogExternalRefs'
import { BangumiService, clearBangumiConfigCache } from '@/api/services/BangumiService'
import * as bangumiLib from '@/api/lib/bangumi'
import * as extQ from '@/api/db/queries/externalData'
import * as epQ from '@/api/db/queries/catalogEpisodes'
import * as vQ from '@/api/db/queries/videos'
import * as catQ from '@/api/db/queries/mediaCatalog'
import * as charQ from '@/api/db/queries/catalogCharacters'
import * as sysQ from '@/api/db/queries/systemSettings'

const mGetAllSettings = sysQ.getAllSettings as ReturnType<typeof vi.fn>
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
const mFindCatalogByBangumiId = catQ.findCatalogByBangumiId as ReturnType<typeof vi.fn>
const mLinkVideo = catQ.linkVideoToCatalog as ReturnType<typeof vi.fn>
const mUpdateCatalog = catQ.updateCatalogFields as ReturnType<typeof vi.fn>
const mGetCharacters = bangumiLib.getCharacters as ReturnType<typeof vi.fn>
const mReplaceChars = charQ.replaceCatalogCharacters as ReturnType<typeof vi.fn>
const mFindPrimaryRef = extQ.findPrimaryVideoExternalRef as ReturnType<typeof vi.fn>

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
    clearBangumiConfigCache()
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
    // D-174-3：默认无他行占用该 subject → safe（去重用例各自覆写为 redirect/conflict）
    mFindCatalogByBangumiId.mockResolvedValue(null)
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

  it('META-22：本地有损键命中多条同年份不同 subject → 歧义降级 candidate（不 auto 绑定/不写 catalog）', async () => {
    // 两条不同 subject 均年份精确（confidence 0.92），标题键无法唯一定位 → 禁止 auto
    mFindByTitle.mockResolvedValue([entry({ bangumiId: 51, year: 2007 }), entry({ bangumiId: 99, year: 2007 })])
    const r = await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: 'x', year: 2007 })
    expect(r).toMatchObject({ matched: 'candidate', bangumiSubjectId: 51 })
    expect(mUpsertRef).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      matchStatus: 'candidate', isPrimary: false,
    }))
    expect(mUpdateCatalog).not.toHaveBeenCalled()
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

  it('META-19：auto + getCharacters 命中 → replaceCatalogCharacters 全量替换（事务内 client）', async () => {
    mFindByTitle.mockResolvedValue([entry({ year: 2007 })])
    mGetSubject.mockResolvedValue(subject())
    mGetEpisodes.mockResolvedValue([])
    mGetCharacters.mockResolvedValue([
      { id: 1, name: '主角A', type: 1, images: { large: 'a.jpg' }, relation: '主角', summary: 's',
        actors: [{ id: 9, name: 'CV甲', type: 1, images: null }, { id: 10, name: 'CV乙', type: 1, images: null }] },
    ])

    await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: 'x', year: 2007 })
    expect(mReplaceChars).toHaveBeenCalledWith(mockClient, CID, 'bangumi', expect.arrayContaining([
      expect.objectContaining({
        externalCharacterId: '1', name: '主角A', relation: '主角',
        actors: expect.arrayContaining([expect.objectContaining({ name: 'CV甲' })]),
      }),
    ]))
  })

  it('META-19：auto + getCharacters 抓取失败(null) → 不调 replaceCatalogCharacters（不误删 / D-161-AMD-3）', async () => {
    mFindByTitle.mockResolvedValue([entry({ year: 2007 })])
    mGetSubject.mockResolvedValue(subject())
    mGetEpisodes.mockResolvedValue([])
    mGetCharacters.mockResolvedValue(null)  // 抓取失败 → 保留既有角色

    await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: 'x', year: 2007 })
    expect(mReplaceChars).not.toHaveBeenCalled()
  })

  it('META-19：auto + getCharacters 成功返回空([]) → 调 replace([]) 清陈旧角色（非误删）', async () => {
    mFindByTitle.mockResolvedValue([entry({ year: 2007 })])
    mGetSubject.mockResolvedValue(subject())
    mGetEpisodes.mockResolvedValue([])
    mGetCharacters.mockResolvedValue([])  // 成功但作品无角色 → 应清空陈旧

    await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: 'x', year: 2007 })
    expect(mReplaceChars).toHaveBeenCalledWith(mockClient, CID, 'bangumi', [])
  })

  // ── META-15-C FIX（Codex）：已有绑定只刷新不重配 ─────────────────────
  const primaryRef = (over: Record<string, unknown> = {}) => ({
    id: 'r1', videoId: VID, provider: 'bangumi', externalId: '51',
    matchStatus: 'auto_matched', matchMethod: 'title_norm', confidence: 0.9,
    isPrimary: true, linkedBy: 'auto', linkedAt: '2026-05-01T00:00:00Z', notes: null,
    ...over,
  })

  it('META-15-C：已有 primary 绑定 → 只刷新不重配（不调匹配 / 不动 ref / 刷新角色 / 重申 matched）', async () => {
    mFindPrimaryRef.mockResolvedValue(primaryRef())
    mGetSubject.mockResolvedValue(subject())
    mGetEpisodes.mockResolvedValue([])
    mGetCharacters.mockResolvedValue([
      { id: 1, name: 'A', type: 1, images: null, relation: '主角', summary: '', actors: [{ id: 9, name: 'CV', type: 1, images: null }] },
    ])

    const r = await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: 'x', year: 2007 })
    expect(r).toMatchObject({ matched: 'auto', bangumiSubjectId: 51 })
    expect(mFindByTitle).not.toHaveBeenCalled()           // 不重新匹配
    expect(mUpsertRef).not.toHaveBeenCalled()             // 不动既有 ref（不降级/不改绑）
    expect(mFindById).toHaveBeenCalledWith(expect.anything(), 51)  // 按既有 subject 刷新
    expect(mReplaceChars).toHaveBeenCalledWith(mockClient, CID, 'bangumi', expect.any(Array))  // 刷新角色
    expect(mUpdateBangumiStatus).toHaveBeenCalledWith(mockClient, VID, 'matched')  // 重申 matched
  })

  it('META-15-C：已 matched + 重配本应 none → 绑定不被清空为 unmatched（核心修复）', async () => {
    mFindPrimaryRef.mockResolvedValue(primaryRef())
    mFindByTitle.mockResolvedValue([])   // 若重配：本地空
    mSearchStrict.mockResolvedValue([])  // 若重配：REST 空 → 本会 none → unmatched
    mGetSubject.mockResolvedValue(subject())
    mGetEpisodes.mockResolvedValue([])
    mGetCharacters.mockResolvedValue([])

    const r = await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: 'x', year: 2007 })
    expect(r.matched).toBe('auto')
    expect(mUpdateBangumiStatus).not.toHaveBeenCalledWith(expect.anything(), VID, 'unmatched')
  })

  it('META-15-C：manual_confirmed 绑定 → 不被降级为 auto（不 upsert ref）', async () => {
    mFindPrimaryRef.mockResolvedValue(primaryRef({ matchStatus: 'manual_confirmed', linkedBy: 'moderator', confidence: 1 }))
    mGetSubject.mockResolvedValue(subject())
    mGetEpisodes.mockResolvedValue([])
    mGetCharacters.mockResolvedValue(null)  // 角色抓取失败 → 不动角色

    await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: 'x', year: 2007 })
    expect(mUpsertRef).not.toHaveBeenCalled()
    expect(mReplaceChars).not.toHaveBeenCalled()  // getCharacters null → 不替换
  })

  it('META-15-C：candidate primary（非 matched 绑定）不触发刷新 → 走正常匹配', async () => {
    mFindPrimaryRef.mockResolvedValue(primaryRef({ matchStatus: 'candidate', isPrimary: true }))
    mFindByTitle.mockResolvedValue([])
    mSearchStrict.mockResolvedValue([])

    const r = await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: 'x', year: 2007 })
    // candidate 不算「已绑定」→ 落正常匹配；本地+REST 空 → none
    expect(mFindByTitle).toHaveBeenCalled()
    expect(r).toMatchObject({ matched: 'none' })
  })

  it('META-20：本地空 + REST name 未命中 + 别名命中 → auto（pass 2 别名感知）', async () => {
    mFindByTitle.mockResolvedValue([])  // 本地 dump 空
    // REST 搜索：name_cn=航海王 ≠ 海贼王 → pass 1 miss
    mSearchStrict.mockResolvedValue([{ id: 100, name: 'ONE PIECE', name_cn: '航海王', date: '1999-10-20', images: null, rating: null }])
    // pass 2 getSubject：infobox 别名含 海贼王 + 年份 1999 → 0.92 auto
    mGetSubject.mockResolvedValue(subject({ id: 100, name_cn: '航海王', name: 'ONE PIECE', date: '1999-10-20', infobox: [{ key: '别名', value: [{ v: '海贼王' }] }] }))
    mGetEpisodes.mockResolvedValue([])
    mGetCharacters.mockResolvedValue(null)

    const r = await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: '海贼王', year: 1999 })
    expect(r).toMatchObject({ matched: 'auto', bangumiSubjectId: 100 })
    expect(mUpsertRef).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ provider: 'bangumi', matchStatus: 'auto_matched' }))
  })

  it('META-20：REST name 未命中 + 别名也不命中 → none（不引入假阳性）', async () => {
    mFindByTitle.mockResolvedValue([])
    mSearchStrict.mockResolvedValue([{ id: 101, name: 'NARUTO', name_cn: '火影忍者', date: '2002-10-03', images: null, rating: null }])
    mGetSubject.mockResolvedValue(subject({ id: 101, name_cn: '火影忍者', name: 'NARUTO', infobox: [{ key: '别名', value: '鸣人' }] }))

    const r = await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: '海贼王', year: 1999 })
    expect(r).toMatchObject({ matched: 'none' })
  })

  it('auto + Token 缺失 → 降级用本地 dump 字段，不调 API', async () => {
    mConfigured.mockReturnValue(false)
    mFindByTitle.mockResolvedValue([entry({ year: 2007 })])

    const r = await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: 'x', year: 2007 })
    expect(r).toMatchObject({ matched: 'auto', degraded: true, episodes: 0 })
    expect(mGetSubject).not.toHaveBeenCalled()
    // META-49-B1（方案 X）：auto defer → safeUpdate 只写身份 bangumiSubjectId（留事务触发 catalog ref/cache）；
    // 内容字段 title 进 proposedFields，由 enrich 层立即 safeUpdate（bangumi-service 不直接写内容）。
    expect(mUpdateCatalog).toHaveBeenCalledWith(expect.anything(), CID, expect.objectContaining({
      bangumiSubjectId: 51, metadataSource: 'bangumi',
    }))
    expect(mUpdateCatalog.mock.calls[0][2]).not.toHaveProperty('title')
    expect((r as { matched: 'auto'; proposedFields?: Record<string, unknown> }).proposedFields).toMatchObject({ title: '团子大家族' })
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

  // ── ADR-174 D-174-3：唯一约束兜底真去重（同番裂行抢绑同一 subject）─────────
  const EXISTING_CID = 'eeeeeeee-1111-2222-3333-444444444444'
  // 当前行 CID 与 existing 行各自的 type/year（resolveBangumiBinding + safeUpdate 共用 findCatalogById）
  const catalogRow = (id: string, type: string, year: number | null, src = 'crawler') =>
    ({ id, type, year, metadataSource: src, lockedFields: [] })

  it('D-174-3 redirect：subject 已被他行占用 + type/year 一致 → 重指向 video + 写 existing（不抛 duplicate key / auto）', async () => {
    mFindByTitle.mockResolvedValue([entry({ year: 2007 })])
    mGetSubject.mockResolvedValue(subject())
    mGetEpisodes.mockResolvedValue([])
    // subject 51 已被 EXISTING 占用（同 anime/2007 → 重指向安全）
    mFindCatalogByBangumiId.mockResolvedValue(catalogRow(EXISTING_CID, 'anime', 2007, 'bangumi'))
    mFindCatalog.mockImplementation(async (_db: unknown, id: string) =>
      id === EXISTING_CID ? catalogRow(EXISTING_CID, 'anime', 2007, 'bangumi') : catalogRow(CID, 'anime', 2007))

    const r = await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: 'x', year: 2007 })
    // 有效 catalogId 回传为重指向后的 EXISTING（供 MetadataEnrichService.step5 算分用）
    expect(r).toMatchObject({ matched: 'auto', bangumiSubjectId: 51, catalogId: EXISTING_CID })
    // 运行时真去重：video.catalog_id 重指向 EXISTING（事务 client）
    expect(mLinkVideo).toHaveBeenCalledWith(mockClient, VID, EXISTING_CID)
    // 富集写到 EXISTING（已持有 subject → UPDATE 同值不撞唯一约束），不写当前裂行 CID
    expect(mUpdateCatalog).toHaveBeenCalledWith(expect.anything(), EXISTING_CID, expect.objectContaining({ bangumiSubjectId: 51 }))
    expect(mUpsertRef).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ matchStatus: 'auto_matched', isPrimary: true }))
    expect(clientQueries).toContain('COMMIT')
    expect(clientQueries).not.toContain('ROLLBACK')
  })

  it('D-174-3 conflict：subject 被他行占用但 type 冲突 → 降级 candidate ref + 保留 unmatched + COMMIT（不炸事务）', async () => {
    mFindByTitle.mockResolvedValue([entry({ year: 2007 })])
    mGetSubject.mockResolvedValue(subject())
    mGetEpisodes.mockResolvedValue([])
    // subject 51 被 EXISTING 占用，但 EXISTING 是 movie ≠ 当前 anime → 重指向不安全
    mFindCatalogByBangumiId.mockResolvedValue(catalogRow(EXISTING_CID, 'movie', 2007, 'bangumi'))
    mFindCatalog.mockImplementation(async (_db: unknown, id: string) =>
      id === EXISTING_CID ? catalogRow(EXISTING_CID, 'movie', 2007, 'bangumi') : catalogRow(CID, 'anime', 2007))

    const r = await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: 'x', year: 2007 })
    // 降级为 candidate（带 subjectId 供审核台人工裁定），不抛 duplicate key
    expect(r).toMatchObject({ matched: 'candidate', bangumiSubjectId: 51 })
    expect(mLinkVideo).not.toHaveBeenCalled()       // 不重指向
    expect(mUpdateCatalog).not.toHaveBeenCalled()    // 不写 catalog（规避唯一约束冲突）
    expect(mUpsertRef).toHaveBeenCalledWith(mockClient, expect.objectContaining({ matchStatus: 'candidate', isPrimary: false }))
    expect(mUpdateBangumiStatus).toHaveBeenCalledWith(mockClient, VID, 'unmatched')
    expect(mUpdateBangumiStatus).not.toHaveBeenCalledWith(mockClient, VID, 'matched')
    // 正常 COMMIT（绝不让单冲突 video 炸 matchAndEnrich）
    expect(clientQueries).toContain('COMMIT')
    expect(clientQueries).not.toContain('ROLLBACK')
    // CHG-VIR-12-D / D-177-7：catalog 层冲突同事务双写 catalog_external_refs candidate
    // （Y-177-1 conflict 分支 → catalog_id = 当前入参 catalog；video 级 candidate 零改 R7）
    expect(externalRefQueries.insertCandidateRef).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({
        catalogId: CID, provider: 'bangumi', externalId: '51',
        externalKind: 'subject', source: 'auto', linkedBy: 'bangumi-enrich-conflict',
      }),
    )
  })

  it('D-174-3 conflict：year 显著冲突（≥2）→ 同样降级 candidate（不重指向到不同年份作品）', async () => {
    mFindByTitle.mockResolvedValue([entry({ year: 2007 })])
    mGetSubject.mockResolvedValue(subject())
    mGetEpisodes.mockResolvedValue([])
    // 同 anime 但 year 差 3（2007 vs 2010）→ 视为不同版本/季 → 不安全
    mFindCatalogByBangumiId.mockResolvedValue(catalogRow(EXISTING_CID, 'anime', 2010, 'bangumi'))
    mFindCatalog.mockImplementation(async (_db: unknown, id: string) =>
      id === EXISTING_CID ? catalogRow(EXISTING_CID, 'anime', 2010, 'bangumi') : catalogRow(CID, 'anime', 2007))

    const r = await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: 'x', year: 2007 })
    expect(r).toMatchObject({ matched: 'candidate', bangumiSubjectId: 51 })
    expect(mLinkVideo).not.toHaveBeenCalled()
    expect(mUpdateCatalog).not.toHaveBeenCalled()
  })

  it('D-174-3 safe（自绑）：subject 已绑在当前 catalog → 正常 auto 写入，不重指向', async () => {
    mFindByTitle.mockResolvedValue([entry({ year: 2007 })])
    mGetSubject.mockResolvedValue(subject())
    mGetEpisodes.mockResolvedValue([])
    // 占用者即当前行 CID → safe（resolveBangumiBinding 不查 findCatalogById，直接 safe）
    mFindCatalogByBangumiId.mockResolvedValue(catalogRow(CID, 'anime', 2007, 'bangumi'))

    const r = await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: 'x', year: 2007 })
    // 自绑无重指向 → 有效 catalogId 仍为入参 CID
    expect(r).toMatchObject({ matched: 'auto', bangumiSubjectId: 51, catalogId: CID })
    expect(mLinkVideo).not.toHaveBeenCalled()
    expect(mUpdateCatalog).toHaveBeenCalledWith(expect.anything(), CID, expect.objectContaining({ bangumiSubjectId: 51 }))
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
    expect(mSearchStrict).toHaveBeenCalledWith('海贼王', 10, expect.any(Object), 'enrich_worker')
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

  // ── META-16-B：凭证下沉 Service（system_settings → cfg → lib）──────────
  it('getBangumiConfig：DB token 流到 lib 调用（cfg.token）', async () => {
    mGetAllSettings.mockResolvedValue({ bangumi_api_token: 'db-token-xyz', bangumi_user_agent: 'custom/1.0', bangumi_api_timeout_ms: '5000' })
    mFindByTitle.mockResolvedValue([])
    mSearchStrict.mockResolvedValue([])
    await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: 'x', year: 2007 })
    expect(mSearchStrict).toHaveBeenCalledWith('x', 10, { token: 'db-token-xyz', userAgent: 'custom/1.0', timeoutMs: 5000 }, 'enrich_worker')
  })

  it('getBangumiConfig：DB 空 → cfg={}（lib 回退 env）', async () => {
    mGetAllSettings.mockResolvedValue({})
    mFindByTitle.mockResolvedValue([])
    mSearchStrict.mockResolvedValue([])
    await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: 'y', year: 2007 })
    expect(mSearchStrict).toHaveBeenCalledWith('y', 10, {}, 'enrich_worker')
  })

  it('getBangumiConfig：60s 缓存 → 同实例多次只查 system_settings 一次', async () => {
    mGetAllSettings.mockResolvedValue({ bangumi_api_token: 't' })
    mFindByTitle.mockResolvedValue([])
    mSearchStrict.mockResolvedValue([])
    await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: 'a', year: 2007 })
    await svc.matchAndEnrich({ videoId: VID, catalogId: CID, titleNorm: 'b', year: 2007 })
    expect(mGetAllSettings).toHaveBeenCalledTimes(1)   // 缓存命中，第二次不查库
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
    clearBangumiConfigCache()
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
    // D-174-3：默认无他行占用该 subject → safe
    mFindCatalogByBangumiId.mockResolvedValue(null)
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
    expect(mGetSubject).toHaveBeenCalledWith(99999, expect.any(Object), 'enrich_worker')
    // META-49-B1 confirm scalar unchanged：confirmMatch 走 inline 模式（默认），仍在事务内写全部 scalar
    // （含内容字段 title，非仅身份）——ADR-202 confirm 零改红线守卫。
    expect(mUpdateCatalog).toHaveBeenCalledWith(expect.anything(), CID, expect.objectContaining({
      bangumiSubjectId: 99999, title: '团子大家族',
    }))
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

  // ── ADR-174 D-174-3：手动确认路径的唯一约束兜底真去重 ─────────────────
  const EX_CID = 'eeeeeeee-9999-8888-7777-666666666666'
  const row = (id: string, type: string, src = 'crawler') =>
    ({ id, type, year: 2007, metadataSource: src, lockedFields: [] })

  it('D-174-3 confirmMatch redirect：subject 已被他行占用(安全) → 重指向 video + 写 existing + manual_confirmed', async () => {
    mConfigured.mockReturnValue(true)
    mFindById.mockResolvedValue(null)
    mGetSubject.mockResolvedValue(subject({ id: 51 }))
    mGetEpisodes.mockResolvedValue([])
    mFindCatalogByBangumiId.mockResolvedValue(row(EX_CID, 'anime', 'bangumi'))
    mFindCatalog.mockImplementation(async (_db: unknown, id: string) =>
      id === EX_CID ? row(EX_CID, 'anime', 'bangumi') : row(CID, 'anime'))

    const r = await svc.confirmMatch(VID, CID, 51)
    expect(r).toEqual({ updated: true })
    expect(mLinkVideo).toHaveBeenCalledWith(mockClient, VID, EX_CID)
    expect(mUpdateCatalog).toHaveBeenCalledWith(expect.anything(), EX_CID, expect.anything())
    expect(mUpsertRef).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ matchStatus: 'manual_confirmed', isPrimary: true }))
    expect(clientQueries).toContain('COMMIT')
  })

  it('D-174-3 confirmMatch conflict：subject 被他行占用但 type 冲突 → updated:false + ROLLBACK（不抛 / 不写 ref）', async () => {
    mConfigured.mockReturnValue(true)
    mFindById.mockResolvedValue(null)
    mGetSubject.mockResolvedValue(subject({ id: 51 }))
    mGetEpisodes.mockResolvedValue([])
    mFindCatalogByBangumiId.mockResolvedValue(row(EX_CID, 'movie', 'bangumi'))
    mFindCatalog.mockImplementation(async (_db: unknown, id: string) =>
      id === EX_CID ? row(EX_CID, 'movie', 'bangumi') : row(CID, 'anime'))

    const r = await svc.confirmMatch(VID, CID, 51)
    expect(r).toEqual({ updated: false })
    expect(mLinkVideo).not.toHaveBeenCalled()
    expect(mUpdateCatalog).not.toHaveBeenCalled()
    expect(mUpsertRef).not.toHaveBeenCalled()
    expect(clientQueries).toContain('BEGIN')
    expect(clientQueries).toContain('ROLLBACK')
    expect(clientQueries).not.toContain('COMMIT')
  })
})

describe('BangumiService.searchCandidates', () => {
  let svc: BangumiService
  beforeEach(() => {
    vi.clearAllMocks()
    clearBangumiConfigCache()
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

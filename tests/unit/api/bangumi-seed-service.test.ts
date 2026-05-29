/**
 * tests/unit/api/bangumi-seed-service.test.ts — BangumiSeedService（ADR-161 决策 7 / CHG-BNG-07）
 * 反向建库无源占位 + 缺口清单。mock queries（精确计数走 insertCatalog row|null 信号）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/db/queries/externalData', () => ({
  listBangumiEntriesForSeed: vi.fn(),
}))
vi.mock('@/api/db/queries/mediaCatalog', () => ({
  findCatalogByBangumiId: vi.fn(),
  findCatalogByNormalizedKey: vi.fn(),
  insertCatalog: vi.fn(),
  listBangumiGaps: vi.fn(),
  countBangumiGaps: vi.fn(),
}))

import { BangumiSeedService } from '@/api/services/BangumiSeedService'
import * as extQ from '@/api/db/queries/externalData'
import * as catQ from '@/api/db/queries/mediaCatalog'
import type { BangumiEntryMatch } from '@/api/db/queries/externalData'

const mListSeed = extQ.listBangumiEntriesForSeed as ReturnType<typeof vi.fn>
const mFindByBangumi = catQ.findCatalogByBangumiId as ReturnType<typeof vi.fn>
const mFindByNorm = catQ.findCatalogByNormalizedKey as ReturnType<typeof vi.fn>
const mInsert = catQ.insertCatalog as ReturnType<typeof vi.fn>
const mListGaps = catQ.listBangumiGaps as ReturnType<typeof vi.fn>
const mCountGaps = catQ.countBangumiGaps as ReturnType<typeof vi.fn>

function entry(p: Partial<BangumiEntryMatch> = {}): BangumiEntryMatch {
  return {
    bangumiId: 51, titleCn: '团子大家族', titleJp: 'CLANNAD', year: 2007,
    rating: 8.5, summary: '简介', airDate: '2007-10-04',
    coverUrl: 'https://x/c.jpg', rank: 87, nsfw: false, ...p,
  }
}

function makeSvc() {
  return new BangumiSeedService({} as never)
}

describe('BangumiSeedService.seedPlaceholders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mFindByBangumi.mockResolvedValue(null)
    mFindByNorm.mockResolvedValue(null)
  })

  it('全部新建 → created 计数 + type=anime + bangumi 源', async () => {
    mListSeed.mockResolvedValue([entry({ bangumiId: 1 }), entry({ bangumiId: 2 })])
    mInsert.mockImplementation(async (_db: unknown, i: { bangumiSubjectId: number }) => ({ id: `c-${i.bangumiSubjectId}`, bangumiSubjectId: i.bangumiSubjectId }))

    const r = await makeSvc().seedPlaceholders({ limit: 100 })
    expect(r).toEqual({ scanned: 2, created: 2, matched: 0 })
    expect(mInsert).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      type: 'anime', metadataSource: 'bangumi', titleNormalized: expect.any(String),
    }))
  })

  it('bangumi_id 命中 → matched，不查三元组、不插入', async () => {
    mListSeed.mockResolvedValue([entry({ bangumiId: 1 })])
    mFindByBangumi.mockResolvedValue({ id: 'c-1', bangumiSubjectId: 1 })

    const r = await makeSvc().seedPlaceholders({ limit: 100 })
    expect(r).toEqual({ scanned: 1, created: 0, matched: 1 })
    expect(mFindByNorm).not.toHaveBeenCalled()
    expect(mInsert).not.toHaveBeenCalled()
  })

  it('三元组命中既有 catalog（无 bangumi_id，D-161-1 防重复占位）→ matched，不插入', async () => {
    mListSeed.mockResolvedValue([entry({ bangumiId: 9 })])
    mFindByNorm.mockResolvedValue({ id: 'c-x', bangumiSubjectId: null })

    const r = await makeSvc().seedPlaceholders({ limit: 100 })
    expect(r).toEqual({ scanned: 1, created: 0, matched: 1 })
    expect(mInsert).not.toHaveBeenCalled()
  })

  it('INSERT 唯一冲突并发竞态（insertCatalog 返回 null）→ matched，不误计 created', async () => {
    mListSeed.mockResolvedValue([entry({ bangumiId: 7 })])
    mInsert.mockResolvedValue(null) // precheck 后并发插入同 bangumi_id → ON CONFLICT 跳过

    const r = await makeSvc().seedPlaceholders({ limit: 100 })
    expect(r).toEqual({ scanned: 1, created: 0, matched: 1 })
  })

  it('无标题条目跳过（scanned 计入，不计 created/matched）', async () => {
    mListSeed.mockResolvedValue([entry({ bangumiId: 1 }), entry({ bangumiId: 2, titleCn: null, titleJp: null })])
    mInsert.mockImplementation(async (_db: unknown, i: { bangumiSubjectId: number }) => ({ id: `c-${i.bangumiSubjectId}`, bangumiSubjectId: i.bangumiSubjectId }))

    const r = await makeSvc().seedPlaceholders({ limit: 100 })
    expect(r).toEqual({ scanned: 2, created: 1, matched: 0 })
    expect(mInsert).toHaveBeenCalledTimes(1)
  })

  it('过滤参数透传到 query（minRank/year/limit）', async () => {
    mListSeed.mockResolvedValue([])
    await makeSvc().seedPlaceholders({ minRank: 100, year: 2007, limit: 50 })
    expect(mListSeed).toHaveBeenCalledWith(expect.anything(), { minRank: 100, year: 2007, limit: 50 })
  })
})

describe('BangumiSeedService.listGaps', () => {
  beforeEach(() => vi.clearAllMocks())

  it('分页 offset 计算 + 返回 rows/total', async () => {
    const row = { catalogId: 'c-1', bangumiSubjectId: 1, title: 'A', year: 2007, rank: 5, coverUrl: null }
    mListGaps.mockResolvedValue([row])
    mCountGaps.mockResolvedValue(42)

    const r = await makeSvc().listGaps({ page: 3, limit: 20 })
    expect(mListGaps).toHaveBeenCalledWith(expect.anything(), { limit: 20, offset: 40 })
    expect(r).toEqual({ rows: [row], total: 42 })
  })
})

/**
 * tests/unit/api/bangumi-seed-service.test.ts — BangumiSeedService（ADR-159 决策 7 / CHG-BNG-07）
 * 反向建库无源占位 + 缺口清单。mock queries + 注入 catalogService。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/db/queries/externalData', () => ({
  listBangumiEntriesForSeed: vi.fn(),
}))
vi.mock('@/api/db/queries/mediaCatalog', () => ({
  findCatalogByBangumiId: vi.fn(),
  listBangumiGaps: vi.fn(),
  countBangumiGaps: vi.fn(),
}))

import { BangumiSeedService } from '@/api/services/BangumiSeedService'
import * as extQ from '@/api/db/queries/externalData'
import * as catQ from '@/api/db/queries/mediaCatalog'
import type { BangumiEntryMatch } from '@/api/db/queries/externalData'
import type { MediaCatalogService } from '@/api/services/MediaCatalogService'

const mListSeed = extQ.listBangumiEntriesForSeed as ReturnType<typeof vi.fn>
const mFindByBangumi = catQ.findCatalogByBangumiId as ReturnType<typeof vi.fn>
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
  const findOrCreate = vi.fn()
  const catalogSvc = { findOrCreate } as unknown as MediaCatalogService
  const svc = new BangumiSeedService({} as never, catalogSvc)
  return { svc, findOrCreate }
}

describe('BangumiSeedService.seedPlaceholders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('全部新建 → created 计数 + type=anime + bangumi 源', async () => {
    const { svc, findOrCreate } = makeSvc()
    mListSeed.mockResolvedValue([entry({ bangumiId: 1 }), entry({ bangumiId: 2 })])
    mFindByBangumi.mockResolvedValue(null)
    findOrCreate.mockImplementation(async (i: { bangumiSubjectId: number }) => ({ id: `c-${i.bangumiSubjectId}`, bangumiSubjectId: i.bangumiSubjectId }))

    const r = await svc.seedPlaceholders({ limit: 100 })
    expect(r).toEqual({ scanned: 2, created: 2, matched: 0 })
    expect(findOrCreate).toHaveBeenCalledWith(expect.objectContaining({
      type: 'anime', metadataSource: 'bangumi', titleNormalized: expect.any(String),
    }))
  })

  it('已存在（bangumi_id 命中）→ matched，不调 findOrCreate', async () => {
    const { svc, findOrCreate } = makeSvc()
    mListSeed.mockResolvedValue([entry({ bangumiId: 1 })])
    mFindByBangumi.mockResolvedValue({ id: 'c-1', bangumiSubjectId: 1 })

    const r = await svc.seedPlaceholders({ limit: 100 })
    expect(r).toEqual({ scanned: 1, created: 0, matched: 1 })
    expect(findOrCreate).not.toHaveBeenCalled()
  })

  it('normalizedKey 命中既有 catalog（未 link bangumi_id，D-159-1）→ matched', async () => {
    const { svc, findOrCreate } = makeSvc()
    mListSeed.mockResolvedValue([entry({ bangumiId: 9 })])
    mFindByBangumi.mockResolvedValue(null)
    // findOrCreate 命中既有同名 catalog，其 bangumiSubjectId 为 null（非本 entry）
    findOrCreate.mockResolvedValue({ id: 'c-x', bangumiSubjectId: null })

    const r = await svc.seedPlaceholders({ limit: 100 })
    expect(r).toEqual({ scanned: 1, created: 0, matched: 1 })
  })

  it('无标题条目跳过（scanned 计入，不计 created/matched）', async () => {
    const { svc, findOrCreate } = makeSvc()
    mListSeed.mockResolvedValue([entry({ bangumiId: 1 }), entry({ bangumiId: 2, titleCn: null, titleJp: null })])
    mFindByBangumi.mockResolvedValue(null)
    findOrCreate.mockImplementation(async (i: { bangumiSubjectId: number }) => ({ id: `c-${i.bangumiSubjectId}`, bangumiSubjectId: i.bangumiSubjectId }))

    const r = await svc.seedPlaceholders({ limit: 100 })
    expect(r).toEqual({ scanned: 2, created: 1, matched: 0 })
    expect(findOrCreate).toHaveBeenCalledTimes(1)
  })

  it('过滤参数透传到 query（minRank/year/limit）', async () => {
    const { svc } = makeSvc()
    mListSeed.mockResolvedValue([])
    await svc.seedPlaceholders({ minRank: 100, year: 2007, limit: 50 })
    expect(mListSeed).toHaveBeenCalledWith(expect.anything(), { minRank: 100, year: 2007, limit: 50 })
  })
})

describe('BangumiSeedService.listGaps', () => {
  beforeEach(() => vi.clearAllMocks())

  it('分页 offset 计算 + 返回 rows/total', async () => {
    const { svc } = makeSvc()
    const row = { catalogId: 'c-1', bangumiSubjectId: 1, title: 'A', year: 2007, rank: 5, coverUrl: null }
    mListGaps.mockResolvedValue([row])
    mCountGaps.mockResolvedValue(42)

    const r = await svc.listGaps({ page: 3, limit: 20 })
    expect(mListGaps).toHaveBeenCalledWith(expect.anything(), { limit: 20, offset: 40 })
    expect(r).toEqual({ rows: [row], total: 42 })
  })
})

/**
 * tests/unit/api/mediaCatalogFindOrCreate.test.ts — findOrCreate 并发 retry（ADR-161 Y5 / CHG-BNG-07）
 * 验证 INSERT 因 bangumi_subject_id 唯一冲突被 ON CONFLICT 跳过后，retry 链能经 bangumiId 分支查回。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/db/queries/mediaCatalog', () => ({
  findCatalogByImdbId: vi.fn().mockResolvedValue(null),
  findCatalogByTmdbId: vi.fn().mockResolvedValue(null),
  findCatalogByDoubanId: vi.fn().mockResolvedValue(null),
  findCatalogByBangumiId: vi.fn(),
  findCatalogByNormalizedKey: vi.fn().mockResolvedValue(null),
  insertCatalog: vi.fn(),
}))

import * as catQ from '@/api/db/queries/mediaCatalog'
import { MediaCatalogService } from '@/api/services/MediaCatalogService'

const mFindByBangumi = catQ.findCatalogByBangumiId as ReturnType<typeof vi.fn>
const mInsert = catQ.insertCatalog as ReturnType<typeof vi.fn>

const client = { query: vi.fn().mockResolvedValue({}), release: vi.fn() }
const db = { connect: vi.fn().mockResolvedValue(client) } as unknown as import('pg').Pool

describe('MediaCatalogService.findOrCreate — ADR-161 Y5 retry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    client.query.mockResolvedValue({})
  })

  it('INSERT 冲突跳过 → retry 经 bangumiId 分支查回收敛（不抛）', async () => {
    const existing = { id: 'c-1', bangumiSubjectId: 51, title: 'CLANNAD' }
    // step4 首查 null（尚未写入），insert ON CONFLICT 跳过返回 null，retry 再查命中
    mFindByBangumi.mockResolvedValueOnce(null).mockResolvedValueOnce(existing)
    mInsert.mockResolvedValue(null)

    const svc = new MediaCatalogService(db)
    const row = await svc.findOrCreate({
      title: 'CLANNAD',
      titleNormalized: 'clannad',
      type: 'anime',
      year: 2007,
      bangumiSubjectId: 51,
      metadataSource: 'bangumi',
    })

    expect(row).toEqual(existing)
    expect(mFindByBangumi).toHaveBeenCalledTimes(2)
    expect(client.query).toHaveBeenCalledWith('COMMIT')
  })
})

// ── CHG-VIR-10 / D-105a-16：findOrCreateWithMatch 透出命中步骤 ──────────

describe('MediaCatalogService.findOrCreateWithMatch — matchedStep（CHG-VIR-10）', () => {
  const baseInput = {
    title: 'CLANNAD',
    titleNormalized: 'clannad',
    type: 'anime' as const,
    year: 2007,
    metadataSource: 'crawler' as const,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    client.query.mockResolvedValue({})
    mFindByBangumi.mockResolvedValue(null)
  })

  it('bangumi_subject_id 命中 → matchedStep=bangumi_id', async () => {
    const existing = { id: 'c-1', bangumiSubjectId: 51 }
    mFindByBangumi.mockResolvedValueOnce(existing)
    const svc = new MediaCatalogService(db)
    const r = await svc.findOrCreateWithMatch({ ...baseInput, bangumiSubjectId: 51 })
    expect(r.catalog).toEqual(existing)
    expect(r.matchedStep).toBe('bangumi_id')
  })

  it('三元组命中 → matchedStep=title_triple', async () => {
    const existing = { id: 'c-2' }
    ;(catQ.findCatalogByNormalizedKey as ReturnType<typeof vi.fn>).mockResolvedValueOnce(existing)
    const svc = new MediaCatalogService(db)
    const r = await svc.findOrCreateWithMatch(baseInput)
    expect(r.matchedStep).toBe('title_triple')
  })

  it('全部未命中 INSERT 成功 → matchedStep=created', async () => {
    const inserted = { id: 'c-3' }
    mInsert.mockResolvedValueOnce(inserted)
    const svc = new MediaCatalogService(db)
    const r = await svc.findOrCreateWithMatch(baseInput)
    expect(r.catalog).toEqual(inserted)
    expect(r.matchedStep).toBe('created')
  })

  it('INSERT 冲突跳过 retry 收敛 → matchedStep=conflict_recovered', async () => {
    const existing = { id: 'c-4', bangumiSubjectId: 51 }
    mFindByBangumi.mockResolvedValueOnce(null).mockResolvedValueOnce(existing)
    mInsert.mockResolvedValueOnce(null)
    const svc = new MediaCatalogService(db)
    const r = await svc.findOrCreateWithMatch({ ...baseInput, bangumiSubjectId: 51 })
    expect(r.catalog).toEqual(existing)
    expect(r.matchedStep).toBe('conflict_recovered')
  })
})

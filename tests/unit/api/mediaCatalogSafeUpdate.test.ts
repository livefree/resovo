/**
 * tests/unit/api/mediaCatalogSafeUpdate.test.ts — ADMIN-14
 *
 * 验证 MediaCatalogService.safeUpdate 的新规则（2026-04-22）：
 * 1. 硬锁（video_metadata_locks.hard）阻挡所有来源，返回 skippedFields
 * 2. 软锁（locked_fields）阻挡非 manual 来源；manual 允许覆盖自锁字段（修 audit §3.3）
 * 3. 返回签名 { updated, skippedFields } 供前端 toast 分支
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/db/queries/mediaCatalog', () => ({
  findCatalogById: vi.fn(),
  setLockedFields: vi.fn().mockResolvedValue(undefined),
  updateCatalogFields: vi.fn(),
}))

vi.mock('@/api/db/queries/metadataProvenance', () => ({
  getHardLockedFields: vi.fn(),
  batchUpsertFieldProvenance: vi.fn().mockResolvedValue(undefined),
}))

import * as catalogQueries from '@/api/db/queries/mediaCatalog'
import * as provenanceQueries from '@/api/db/queries/metadataProvenance'
import { MediaCatalogService } from '@/api/services/MediaCatalogService'

const mockDb = { query: vi.fn() } as unknown as import('pg').Pool

function makeCatalog(overrides: Partial<{ lockedFields: string[]; metadataSource: string }> = {}) {
  return {
    id: 'cat-1',
    title: 'Old Title',
    titleEn: null,
    type: 'movie',
    genres: [],
    metadataSource: overrides.metadataSource ?? 'manual',
    lockedFields: overrides.lockedFields ?? [],
  } as unknown as Awaited<ReturnType<typeof catalogQueries.findCatalogById>>
}

describe('MediaCatalogService.safeUpdate — ADMIN-14 规则', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('manual 允许覆盖自锁字段（软锁中的 genres 被 manual 二次写入）', async () => {
    vi.mocked(catalogQueries.findCatalogById).mockResolvedValue(
      makeCatalog({ lockedFields: ['genres'], metadataSource: 'manual' }) as never,
    )
    vi.mocked(provenanceQueries.getHardLockedFields).mockResolvedValue([])
    vi.mocked(catalogQueries.updateCatalogFields).mockResolvedValue({
      id: 'cat-1',
      genres: ['action', 'romance'],
    } as never)

    const svc = new MediaCatalogService(mockDb)
    const result = await svc.safeUpdate(
      'cat-1',
      { genres: ['action', 'romance'] } as never,
      'manual',
    )

    expect(result.skippedFields).toEqual([])
    expect(result.updated).toMatchObject({ id: 'cat-1' })
    // manual 写入后，locked_fields 保持包含 genres（幂等）
    expect(catalogQueries.setLockedFields).toHaveBeenCalledWith(
      expect.anything(),
      'cat-1',
      expect.arrayContaining(['genres']),
    )
    expect(catalogQueries.updateCatalogFields).toHaveBeenCalled()
  })

  it('非 manual 来源被软锁阻挡（douban 试图覆盖已软锁的 genres → skippedFields=["genres"]）', async () => {
    vi.mocked(catalogQueries.findCatalogById).mockResolvedValue(
      makeCatalog({ lockedFields: ['genres'], metadataSource: 'manual' }) as never,
    )
    vi.mocked(provenanceQueries.getHardLockedFields).mockResolvedValue([])

    const svc = new MediaCatalogService(mockDb)
    const result = await svc.safeUpdate(
      'cat-1',
      { genres: ['sci_fi'] } as never,
      'douban',
    )

    expect(result.skippedFields).toEqual(['genres'])
    // 无字段可写 → 返回原 catalog
    expect(result.updated).toMatchObject({ id: 'cat-1' })
    expect(catalogQueries.updateCatalogFields).not.toHaveBeenCalled()
  })

  it('硬锁对 manual 也阻挡（video_metadata_locks.hard 中的字段 → skippedFields）', async () => {
    vi.mocked(catalogQueries.findCatalogById).mockResolvedValue(
      makeCatalog({ lockedFields: [], metadataSource: 'manual' }) as never,
    )
    vi.mocked(provenanceQueries.getHardLockedFields).mockResolvedValue(['title'])

    const svc = new MediaCatalogService(mockDb)
    const result = await svc.safeUpdate(
      'cat-1',
      { title: 'New Title', genres: ['action'] } as never,
      'manual',
    )

    expect(result.skippedFields).toEqual(['title'])
    expect(catalogQueries.updateCatalogFields).toHaveBeenCalled()
    // 写入的字段不含 title
    const writtenArg = vi.mocked(catalogQueries.updateCatalogFields).mock.calls[0][2] as Record<string, unknown>
    expect(writtenArg).not.toHaveProperty('title')
    expect(writtenArg).toHaveProperty('genres')
  })

  it('来源优先级低于当前 → 全部 skipped（不写入，返回原 catalog）', async () => {
    vi.mocked(catalogQueries.findCatalogById).mockResolvedValue(
      makeCatalog({ metadataSource: 'manual' }) as never,  // priority 5
    )
    vi.mocked(provenanceQueries.getHardLockedFields).mockResolvedValue([])

    const svc = new MediaCatalogService(mockDb)
    const result = await svc.safeUpdate(
      'cat-1',
      { title: 'From Crawler' } as never,
      'crawler',  // priority 1
    )

    expect(result.skippedFields).toEqual(['title'])
    expect(result.updated).toMatchObject({ id: 'cat-1' })
    expect(catalogQueries.updateCatalogFields).not.toHaveBeenCalled()
  })

  it('catalog 不存在 → { updated: null, skippedFields: [] }', async () => {
    vi.mocked(catalogQueries.findCatalogById).mockResolvedValue(null as never)
    vi.mocked(provenanceQueries.getHardLockedFields).mockResolvedValue([])

    const svc = new MediaCatalogService(mockDb)
    const result = await svc.safeUpdate(
      'cat-missing',
      { title: 'X' } as never,
      'manual',
    )

    expect(result).toEqual({ updated: null, skippedFields: [] })
  })
})

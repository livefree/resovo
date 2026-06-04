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

// CHG-VIR-12-D：safeUpdate 外部 ID 写侧接线（YY-C 同事务）—— mock 写原语
vi.mock('@/api/db/queries/catalogExternalRefs', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/api/db/queries/catalogExternalRefs')>()
  return {
    ...orig, // EXTERNAL_KIND_BY_PROVIDER / PRECISE_KINDS 常量用真源
    resolveAndWriteExactRef: vi.fn().mockResolvedValue({ outcome: 'exact_written' }),
    insertCandidateRef: vi.fn().mockResolvedValue(true),
    demoteExactRef: vi.fn().mockResolvedValue(0),
  }
})

import * as catalogQueries from '@/api/db/queries/mediaCatalog'
import * as provenanceQueries from '@/api/db/queries/metadataProvenance'
import * as externalRefQueries from '@/api/db/queries/catalogExternalRefs'
import { MediaCatalogService } from '@/api/services/MediaCatalogService'

// 自起事务路径（ownTx）用的 client mock：记录 BEGIN/COMMIT/ROLLBACK
const txClientQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 })
const txClientRelease = vi.fn()
const mockTxClient = { query: txClientQuery, release: txClientRelease }
const mockDb = {
  query: vi.fn(),
  connect: vi.fn().mockResolvedValue(mockTxClient),
} as unknown as import('pg').Pool

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

  // ── CHORE-11 FIX-FIX (Codex round 9)：undefined value 不污染 provenance ───
  it('undefined value 整段 skip → 不进 filteredFields / 不进 skippedFields / provenance 不记', async () => {
    vi.mocked(catalogQueries.findCatalogById).mockResolvedValue(
      makeCatalog({ metadataSource: 'crawler' }) as never,
    )
    vi.mocked(provenanceQueries.getHardLockedFields).mockResolvedValue([])
    vi.mocked(catalogQueries.updateCatalogFields).mockResolvedValue({
      id: 'cat-1', metadataSource: 'douban',
    } as never)

    const svc = new MediaCatalogService(mockDb)
    const result = await svc.safeUpdate(
      'cat-1',
      // 模拟 MetadataEnrichService step1LocalDouban 等 caller 用 `?? undefined` 模式：
      // 部分字段是 undefined（未传），部分是有效值
      { doubanId: 'sub-123', rating: undefined, description: 'real desc', writers: undefined } as never,
      'douban',
      { sourceRef: 'sub-123' },
    )

    // 1. skippedFields 不包含 undefined 字段（语义：不是被锁阻挡，是没传值）
    expect(result.skippedFields).toEqual([])

    // 2. updateCatalogFields 只收到有效字段
    const writtenArg = vi.mocked(catalogQueries.updateCatalogFields).mock.calls[0][2] as Record<string, unknown>
    expect(writtenArg).not.toHaveProperty('rating')
    expect(writtenArg).not.toHaveProperty('writers')
    expect(writtenArg).toHaveProperty('doubanId')
    expect(writtenArg).toHaveProperty('description')

    // 3. provenance 写入的字段名清单不含 undefined 字段（关键：provenance 不被污染）
    expect(provenanceQueries.batchUpsertFieldProvenance).toHaveBeenCalledWith(
      expect.anything(), 'cat-1',
      expect.arrayContaining(['doubanId', 'description']),
      'douban', 'sub-123', 3,
    )
    const provArg = vi.mocked(provenanceQueries.batchUpsertFieldProvenance).mock.calls[0][2]
    expect(provArg).not.toContain('rating')
    expect(provArg).not.toContain('writers')
  })

  it('全部 value 都是 undefined → filteredFields 空 → 不调 updateCatalogFields / 不调 batchUpsertFieldProvenance', async () => {
    vi.mocked(catalogQueries.findCatalogById).mockResolvedValue(
      makeCatalog({ metadataSource: 'crawler' }) as never,
    )
    vi.mocked(provenanceQueries.getHardLockedFields).mockResolvedValue([])

    const svc = new MediaCatalogService(mockDb)
    const result = await svc.safeUpdate(
      'cat-1',
      { rating: undefined, description: undefined, writers: undefined } as never,
      'douban',
      { sourceRef: 'sub-123' },
    )

    expect(result.skippedFields).toEqual([])
    expect(result.updated).toMatchObject({ id: 'cat-1' })
    expect(catalogQueries.updateCatalogFields).not.toHaveBeenCalled()
    expect(provenanceQueries.batchUpsertFieldProvenance).not.toHaveBeenCalled()
  })
})

describe('safeUpdate — catalog_external_refs 写侧接线（CHG-VIR-12-D / YY-C）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(mockDb.connect).mockResolvedValue(mockTxClient as never)
    vi.mocked(externalRefQueries.resolveAndWriteExactRef).mockResolvedValue({ outcome: 'exact_written' })
    vi.mocked(externalRefQueries.demoteExactRef).mockResolvedValue(0)
    vi.mocked(catalogQueries.findCatalogById).mockResolvedValue(
      makeCatalog({ metadataSource: 'crawler' }) as never,
    )
    vi.mocked(provenanceQueries.getHardLockedFields).mockResolvedValue([])
    vi.mocked(catalogQueries.updateCatalogFields).mockResolvedValue({ id: 'cat-1' } as never)
  })

  it('写 doubanId（非 null）→ 自起事务 BEGIN/COMMIT + resolveAndWriteExactRef 同事务（YY-C）+ cache 照写', async () => {
    const svc = new MediaCatalogService(mockDb)
    const result = await svc.safeUpdate('cat-1', { doubanId: '88001' } as never, 'douban')

    expect(externalRefQueries.resolveAndWriteExactRef).toHaveBeenCalledWith(
      mockTxClient,
      expect.objectContaining({
        catalogId: 'cat-1', provider: 'douban', externalId: '88001',
        externalKind: 'subject', source: 'auto', linkedBy: 'safe-update:douban',
      }),
    )
    const txSql = txClientQuery.mock.calls.map((c) => String(c[0]))
    expect(txSql).toContain('BEGIN')
    expect(txSql).toContain('COMMIT')
    // updateCatalogFields 用同一事务 client（YY-C 同事务）且 doubanId 照写
    expect(catalogQueries.updateCatalogFields).toHaveBeenCalledWith(
      mockTxClient, 'cat-1', expect.objectContaining({ doubanId: '88001' }),
    )
    expect(txClientRelease).toHaveBeenCalled()
    expect(result.skippedFields).toEqual([])
  })

  it('manual 来源 → ref source=manual', async () => {
    const svc = new MediaCatalogService(mockDb)
    await svc.safeUpdate('cat-1', { doubanId: '88001' } as never, 'manual')
    expect(externalRefQueries.resolveAndWriteExactRef).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ source: 'manual', linkedBy: 'safe-update:manual' }),
    )
  })

  it('conflict_candidate → 字段剔除不写 cache（槽位属 holder）+ 计入 skippedFields', async () => {
    vi.mocked(externalRefQueries.resolveAndWriteExactRef).mockResolvedValue({
      outcome: 'conflict_candidate', holderCatalogId: 'cat-holder',
    })
    const svc = new MediaCatalogService(mockDb)
    const result = await svc.safeUpdate(
      'cat-1', { doubanId: '88001', description: 'x' } as never, 'douban',
    )

    expect(result.skippedFields).toContain('doubanId')
    // description 照写、doubanId 被剔除
    const written = vi.mocked(catalogQueries.updateCatalogFields).mock.calls[0]![2] as Record<string, unknown>
    expect(written).not.toHaveProperty('doubanId')
    expect(written).toHaveProperty('description')
  })

  it('conflict 剔除后无字段可写 → 不调 updateCatalogFields（candidate ref 已落）+ COMMIT', async () => {
    vi.mocked(externalRefQueries.resolveAndWriteExactRef).mockResolvedValue({
      outcome: 'conflict_candidate', holderCatalogId: 'cat-holder',
    })
    const svc = new MediaCatalogService(mockDb)
    const result = await svc.safeUpdate('cat-1', { doubanId: '88001' } as never, 'douban')

    expect(result.skippedFields).toEqual(['doubanId'])
    expect(catalogQueries.updateCatalogFields).not.toHaveBeenCalled()
    expect(txClientQuery.mock.calls.map((c) => String(c[0]))).toContain('COMMIT')
  })

  it('doubanId=null（清空 cache）→ demoteExactRef 同事务联动降级（D-177-5 反向）', async () => {
    const svc = new MediaCatalogService(mockDb)
    await svc.safeUpdate('cat-1', { doubanId: null } as never, 'manual')

    expect(externalRefQueries.demoteExactRef).toHaveBeenCalledWith(mockTxClient, 'cat-1', 'douban')
    expect(externalRefQueries.resolveAndWriteExactRef).not.toHaveBeenCalled()
    // null 照写 cache（清空语义保留）
    expect(catalogQueries.updateCatalogFields).toHaveBeenCalledWith(
      mockTxClient, 'cat-1', expect.objectContaining({ doubanId: null }),
    )
  })

  it('外部传入 client（事务内调用，如 BangumiService）→ 不自起 BEGIN，复用外部连接', async () => {
    const externalClient = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }
    const svc = new MediaCatalogService(mockDb)
    await svc.safeUpdate('cat-1', { bangumiSubjectId: 51 } as never, 'bangumi', {
      db: externalClient as never,
    })

    expect(mockDb.connect).not.toHaveBeenCalled()
    expect(externalClient.query.mock.calls.map((c) => String(c[0]))).not.toContain('BEGIN')
    expect(externalRefQueries.resolveAndWriteExactRef).toHaveBeenCalledWith(
      externalClient,
      expect.objectContaining({ provider: 'bangumi', externalId: '51', externalKind: 'subject' }),
    )
  })

  it('无外部 ID 字段 → 不起事务不调写原语（主路径行为逐值不变）', async () => {
    const svc = new MediaCatalogService(mockDb)
    await svc.safeUpdate('cat-1', { description: 'x' } as never, 'douban')

    expect(mockDb.connect).not.toHaveBeenCalled()
    expect(externalRefQueries.resolveAndWriteExactRef).not.toHaveBeenCalled()
    expect(externalRefQueries.demoteExactRef).not.toHaveBeenCalled()
    expect(catalogQueries.updateCatalogFields).toHaveBeenCalled()
  })

  it('写原语抛错 → ROLLBACK + release + 异常透传（cache 与 ref 原子性）', async () => {
    vi.mocked(externalRefQueries.resolveAndWriteExactRef).mockRejectedValue(new Error('db down'))
    const svc = new MediaCatalogService(mockDb)
    await expect(
      svc.safeUpdate('cat-1', { doubanId: '88001' } as never, 'douban'),
    ).rejects.toThrow('db down')

    expect(txClientQuery.mock.calls.map((c) => String(c[0]))).toContain('ROLLBACK')
    expect(txClientRelease).toHaveBeenCalled()
    expect(catalogQueries.updateCatalogFields).not.toHaveBeenCalled()
  })
})

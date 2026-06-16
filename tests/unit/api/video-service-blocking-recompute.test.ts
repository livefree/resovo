/**
 * video-service-blocking-recompute.test.ts — META-50-2A-1（Codex stop-time review fix）
 *
 * 验证 VideoService.update 手动编辑改 catalog 已知名字段（title/titleEn）后触发
 * recomputeCatalogBlockingKeys（防派生 blocking 键 stale）；非已知名字段编辑不触发。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/db/queries/videos', () => ({
  findAdminVideoById: vi.fn(),
  updateVideoMeta: vi.fn(),
}))
vi.mock('@/api/services/MediaCatalogService', () => ({
  MediaCatalogService: vi.fn().mockImplementation(() => ({
    safeUpdate: vi.fn().mockResolvedValue({ updated: true, skippedFields: [] }),
  })),
}))
vi.mock('@/api/services/metadata/catalogBlockingKeys', () => ({
  recomputeCatalogBlockingKeys: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/api/db/queries/catalogAliases', () => ({
  replaceManualAkaAliases: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/api/services/CacheService', () => ({ CACHE_PREFIXES: {} }))
vi.mock('@/api/services/AuditLogService', () => ({ AuditLogService: vi.fn().mockImplementation(() => ({ write: vi.fn() })) }))
vi.mock('@/api/services/VideoIndexSyncService', () => ({
  VideoIndexSyncService: vi.fn().mockImplementation(() => ({ syncVideo: vi.fn().mockResolvedValue(undefined) })),
}))
vi.mock('@/api/db/queries/titleObservations', () => ({ insertObservationIfAbsent: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/api/services/titleObservation.builder', () => ({ buildTitleObservation: vi.fn(() => ({})) }))
vi.mock('@/api/services/identity/enqueueVideoRescore', () => ({ enqueueIdentityVideoRescore: vi.fn() }))
vi.mock('@/api/lib/queue', () => ({ enrichmentQueue: { add: vi.fn().mockResolvedValue(undefined) } }))

import * as videoQueries from '@/api/db/queries/videos'
import { recomputeCatalogBlockingKeys } from '@/api/services/metadata/catalogBlockingKeys'
import { replaceManualAkaAliases } from '@/api/db/queries/catalogAliases'
import { VideoService } from '@/api/services/VideoService'

const VIDEO_ID = '00000000-0000-0000-0000-000000000aaa'
const CATALOG_ID = '00000000-0000-0000-0000-0000000000cc'

function makeSvc() {
  return new VideoService(
    {} as unknown as import('pg').Pool,
    {} as unknown as import('@elastic/elasticsearch').Client,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(videoQueries.findAdminVideoById).mockResolvedValue({
    id: VIDEO_ID, catalog_id: CATALOG_ID, title: '旧标题', type: 'movie', year: 2020,
  } as unknown as Awaited<ReturnType<typeof videoQueries.findAdminVideoById>>)
  vi.mocked(videoQueries.updateVideoMeta).mockResolvedValue({ id: VIDEO_ID } as unknown as Awaited<ReturnType<typeof videoQueries.updateVideoMeta>>)
})

describe('VideoService.update — blocking 键重算 hook（Codex fix）', () => {
  it('改 title → recomputeCatalogBlockingKeys(db, catalogId)', async () => {
    await makeSvc().update(VIDEO_ID, { title: '新标题' })
    await Promise.resolve() // 等 fire-and-forget microtask
    expect(recomputeCatalogBlockingKeys).toHaveBeenCalledWith(expect.anything(), CATALOG_ID)
  })

  it('改 titleEn → 触发重算', async () => {
    await makeSvc().update(VIDEO_ID, { titleEn: 'New Title' })
    await Promise.resolve()
    expect(recomputeCatalogBlockingKeys).toHaveBeenCalledTimes(1)
  })

  it('仅改非已知名字段（rating）→ 不触发重算', async () => {
    await makeSvc().update(VIDEO_ID, { rating: 8.5 })
    await Promise.resolve()
    expect(recomputeCatalogBlockingKeys).not.toHaveBeenCalled()
  })

  // ── META-50-3A 扩：titleOriginal / aliases 入 knownNames → 触发重算；originalLanguage 不触发 ──

  it('改 titleOriginal（原名入 knownNames）→ 触发重算', async () => {
    await makeSvc().update(VIDEO_ID, { titleOriginal: 'ONE PIECE' })
    await Promise.resolve()
    expect(recomputeCatalogBlockingKeys).toHaveBeenCalledTimes(1)
  })

  it('改 aliases → replaceManualAkaAliases(db, catalogId, aliases) + 触发重算', async () => {
    await makeSvc().update(VIDEO_ID, { aliases: ['航海王', 'ONE PIECE'] })
    await Promise.resolve()
    expect(replaceManualAkaAliases).toHaveBeenCalledWith(expect.anything(), CATALOG_ID, ['航海王', 'ONE PIECE'])
    expect(recomputeCatalogBlockingKeys).toHaveBeenCalledTimes(1)
  })

  it('仅改 originalLanguage（语种标注非名字，不入 knownNames 文本）→ 不触发重算', async () => {
    await makeSvc().update(VIDEO_ID, { originalLanguage: 'ja' })
    await Promise.resolve()
    expect(replaceManualAkaAliases).not.toHaveBeenCalled()
    expect(recomputeCatalogBlockingKeys).not.toHaveBeenCalled()
  })
})

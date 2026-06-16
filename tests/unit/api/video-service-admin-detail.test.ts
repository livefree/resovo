/**
 * video-service-admin-detail.test.ts — META-50-3B-1（ADR-206 D-206-9）
 *
 * 验证 VideoService.adminFindById 注入结构化 manual aka aliases + original_language 透传：
 *   - aliases 仅含 source='manual' ∧ kind='aka'（过滤富集别名 / 覆盖数组列 stale 值）
 *   - listCatalogAliases 以 kinds=['aka'] 调用（结构化表读，非 mc.aliases 数组列）
 *   - 回填作用域与 3A replaceManualAkaAliases 提交作用域双向一致（防非 manual 别名误转 manual）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/db/queries/videos', () => ({
  findAdminVideoById: vi.fn(),
  buildEnrichmentSummary: vi.fn(() => ({})),
}))
vi.mock('@/api/db/queries/catalogAliases', () => ({
  listCatalogAliases: vi.fn(),
  replaceManualAkaAliases: vi.fn(),
}))
vi.mock('@/api/db/queries/externalData', () => ({
  listVideoExternalRefs: vi.fn().mockResolvedValue([]),
  findBangumiById: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/api/db/queries/catalogCharacters', () => ({
  listCatalogCharactersForDisplay: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/api/db/queries/metadata-status.derive', () => ({
  getMetadataProviderRefs: vi.fn().mockResolvedValue(new Map()),
  buildMetadataStatusSummary: vi.fn(() => ({})),
  toMetadataStatusSourceRow: vi.fn(() => ({})),
}))
vi.mock('@/api/db/queries/metadata-field-proposals', () => ({
  getConflictFieldsByCatalogIds: vi.fn().mockResolvedValue(new Map()),
}))
vi.mock('@/api/services/CacheService', () => ({ CACHE_PREFIXES: {} }))
vi.mock('@/api/services/AuditLogService', () => ({ AuditLogService: vi.fn().mockImplementation(() => ({ write: vi.fn() })) }))
vi.mock('@/api/services/NotificationEmitter', () => ({ NotificationEmitter: vi.fn().mockImplementation(() => ({ emit: vi.fn() })) }))
vi.mock('@/api/services/VideoIndexSyncService', () => ({
  VideoIndexSyncService: vi.fn().mockImplementation(() => ({ syncVideo: vi.fn().mockResolvedValue(undefined) })),
}))
vi.mock('@/api/lib/queue', () => ({ enrichmentQueue: { add: vi.fn().mockResolvedValue(undefined) } }))

import * as videoQueries from '@/api/db/queries/videos'
import { listCatalogAliases } from '@/api/db/queries/catalogAliases'
import { VideoService } from '@/api/services/VideoService'

const VIDEO_ID = '00000000-0000-0000-0000-000000000aaa'
const CATALOG_ID = '00000000-0000-0000-0000-0000000000cc'

function makeSvc() {
  return new VideoService(
    {} as unknown as import('pg').Pool,
    {} as unknown as import('@elastic/elasticsearch').Client,
  )
}

function aliasRow(over: { alias: string; source: string; kind?: string | null }) {
  return {
    alias: over.alias, lang: null, region: null, script: null,
    kind: over.kind ?? 'aka', confidence: 1.0, source: over.source, isPrimaryForLocale: false,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(videoQueries.findAdminVideoById).mockResolvedValue({
    id: VIDEO_ID, catalog_id: CATALOG_ID, type: 'movie',
    original_language: 'ja', aliases: ['数组列STALE'], bangumi_subject_id: null,
  } as unknown as Awaited<ReturnType<typeof videoQueries.findAdminVideoById>>)
})

describe('VideoService.adminFindById — 结构化 manual aka 注入（3B-1）', () => {
  it('aliases 仅含 manual aka（过滤 douban/tmdb），覆盖 mc.aliases 数组列 stale 值', async () => {
    vi.mocked(listCatalogAliases).mockResolvedValue([
      aliasRow({ alias: '航海王', source: 'manual' }),
      aliasRow({ alias: 'ONE PIECE', source: 'manual' }),
      aliasRow({ alias: '海賊王', source: 'douban' }), // 非 manual → 不回填
    ])
    const detail = (await makeSvc().adminFindById(VIDEO_ID)) as { aliases: string[] }
    expect(detail.aliases).toEqual(['航海王', 'ONE PIECE'])
    expect(detail.aliases).not.toContain('数组列STALE')
    expect(listCatalogAliases).toHaveBeenCalledWith(expect.anything(), CATALOG_ID, ['aka'])
  })

  it('original_language 透传（SQL select → spread）', async () => {
    vi.mocked(listCatalogAliases).mockResolvedValue([])
    const detail = (await makeSvc().adminFindById(VIDEO_ID)) as { original_language: string }
    expect(detail.original_language).toBe('ja')
  })

  it('无 manual aka（仅富集别名）→ aliases 空数组', async () => {
    vi.mocked(listCatalogAliases).mockResolvedValue([aliasRow({ alias: 'x', source: 'tmdb' })])
    const detail = (await makeSvc().adminFindById(VIDEO_ID)) as { aliases: string[] }
    expect(detail.aliases).toEqual([])
  })
})

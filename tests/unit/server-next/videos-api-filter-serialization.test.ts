/**
 * videos-api-filter-serialization.test.ts — listVideos 三层过滤入参序列化契约（CHG-VSR-2）
 *
 * 证明 VideoListFilter 新增字段经 typed client 可触达，且序列化与后端解析器对齐：
 * - 数组 → CSV（对齐 csvEnum / csvFreeStr 逗号分割）
 * - 布尔 → 'true'/'false'（对齐 queryBool z.enum）
 * - 范围 → String
 * - 派生快捷筛选仅 true 发送
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../apps/server-next/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import { apiClient } from '../../../apps/server-next/src/lib/api-client'
import { listVideos } from '../../../apps/server-next/src/lib/videos/api'

const mockedGet = vi.mocked(apiClient.get)

function calledUrl(): string {
  const url = mockedGet.mock.calls[0]?.[0] as string
  return url
}
function calledParams(): URLSearchParams {
  return new URLSearchParams(calledUrl().split('?')[1] ?? '')
}

describe('listVideos 过滤序列化（CHG-VSR-2 / ADR-150 AMENDMENT 3）', () => {
  beforeEach(() => {
    mockedGet.mockReset()
    mockedGet.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 })
  })

  it('数组字段序列化为 CSV（对齐后端 csvEnum/csvFreeStr）', async () => {
    await listVideos({
      types: ['movie', 'anime'],
      country: ['US', 'JP'],
      catalogStatus: ['ongoing'],
      doubanStatus: ['matched', 'candidate'],
      bangumiStatus: ['matched'],
    })
    const p = calledParams()
    expect(p.get('types')).toBe('movie,anime')
    expect(p.get('country')).toBe('US,JP')
    expect(p.get('catalogStatus')).toBe('ongoing')
    expect(p.get('doubanStatus')).toBe('matched,candidate')
    expect(p.get('bangumiStatus')).toBe('matched')
  })

  it('范围 + 布尔序列化（isPublished → true/false 对齐 queryBool）', async () => {
    await listVideos({ yearMin: 2000, yearMax: 2025, metaScoreMin: 30, metaScoreMax: 90, isPublished: false })
    const p = calledParams()
    expect(p.get('yearMin')).toBe('2000')
    expect(p.get('yearMax')).toBe('2025')
    expect(p.get('metaScoreMin')).toBe('30')
    expect(p.get('metaScoreMax')).toBe('90')
    expect(p.get('isPublished')).toBe('false')
  })

  it('派生快捷筛选仅 true 发送', async () => {
    await listVideos({ episodeMismatch: true, episodeMissing: false, metaIncomplete: true, pendingReview: false })
    const p = calledParams()
    expect(p.get('episodeMismatch')).toBe('true')
    expect(p.get('metaIncomplete')).toBe('true')
    expect(p.has('episodeMissing')).toBe(false)
    expect(p.has('pendingReview')).toBe(false)
  })

  it('空数组 / 未传字段不出现在 query', async () => {
    await listVideos({ types: [], country: [] })
    const p = calledParams()
    expect(p.has('types')).toBe(false)
    expect(p.has('country')).toBe(false)
    expect(p.has('yearMin')).toBe(false)
  })

  it('episode_count 排序字段可达', async () => {
    await listVideos({ sortField: 'episode_count', sortDir: 'asc' })
    const p = calledParams()
    expect(p.get('sortField')).toBe('episode_count')
    expect(p.get('sortDir')).toBe('asc')
  })

  it('META-36-A: 元数据多维过滤序列化（enum→CSV / date→string / 快捷仅 true）', async () => {
    await listVideos({
      metadataOverall: ['needs_review', 'candidate'],
      metadataProvider: ['douban', 'tmdb'],
      metadataProviderState: ['applied'],
      metadataIssueLevel: ['danger', 'warn'],
      metadataUpdatedFrom: '2026-01-01T00:00:00Z',
      metadataUpdatedTo: '2026-06-14T00:00:00Z',
      metadataNeedsReview: true,
      metadataHasCandidate: false,
      metadataMissing: true,
      metadataTmdbPending: true,
    })
    const p = calledParams()
    expect(p.get('metadataOverall')).toBe('needs_review,candidate')
    expect(p.get('metadataProvider')).toBe('douban,tmdb')
    expect(p.get('metadataProviderState')).toBe('applied')
    expect(p.get('metadataIssueLevel')).toBe('danger,warn')
    expect(p.get('metadataUpdatedFrom')).toBe('2026-01-01T00:00:00Z')
    expect(p.get('metadataUpdatedTo')).toBe('2026-06-14T00:00:00Z')
    expect(p.get('metadataNeedsReview')).toBe('true')
    expect(p.get('metadataMissing')).toBe('true')
    expect(p.get('metadataTmdbPending')).toBe('true')
    // 仅 true 发送：metadataHasCandidate=false 不出现
    expect(p.has('metadataHasCandidate')).toBe(false)
  })

  it('META-36-C: metadataMatched「已匹配源」过滤序列化（四源 + none 哨兵 → CSV）', async () => {
    await listVideos({ metadataMatched: ['tmdb', 'douban', 'none'] })
    expect(calledParams().get('metadataMatched')).toBe('tmdb,douban,none')
    // 空数组不发送
    mockedGet.mockClear()
    await listVideos({ metadataMatched: [] })
    expect(calledParams().has('metadataMatched')).toBe(false)
  })

  it('META-36-C: metadata_matched_count 排序字段可达（`元数据`列新排序）', async () => {
    await listVideos({ sortField: 'metadata_matched_count', sortDir: 'desc' })
    expect(calledParams().get('sortField')).toBe('metadata_matched_count')
  })

  it('META-36-A: metadata 排序字段（metadata_status / metadata_score）可达', async () => {
    await listVideos({ sortField: 'metadata_status', sortDir: 'asc' })
    expect(calledParams().get('sortField')).toBe('metadata_status')
    mockedGet.mockClear()
    await listVideos({ sortField: 'metadata_score', sortDir: 'desc' })
    expect(calledParams().get('sortField')).toBe('metadata_score')
  })

  it('META-36-A: 空 metadata 过滤不污染 query', async () => {
    await listVideos({ metadataOverall: [], metadataProvider: [] })
    const p = calledParams()
    expect(p.has('metadataOverall')).toBe(false)
    expect(p.has('metadataProvider')).toBe(false)
  })
})

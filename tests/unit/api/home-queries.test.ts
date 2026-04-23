/**
 * tests/unit/api/home-queries.test.ts — HANDOFF-04
 *
 * DB 查询层单元测试（不 mock @/api/db/queries/videos，直接测实际实现）：
 *   - listVideosByRatingDesc：排序 / excludeIds / limit clamp
 *   - listVideoCardsByIds：批量 UUID 查询 / 空数组短路
 *   - countVideosByType：全 11 种 VideoType / 零值填充
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  listVideosByRatingDesc,
  listVideoCardsByIds,
  countVideosByType,
} from '@/api/db/queries/videos'
import type { Pool } from 'pg'

// ── Pool mock ─────────────────────────────────────────────────────────────────

const mockQuery = vi.fn()
const mockPool = { query: mockQuery, connect: vi.fn() } as unknown as Pool

beforeEach(() => {
  mockQuery.mockReset()
})

// ── 最小 DbVideoRow（mapVideoCard 依赖的字段） ────────────────────────────────

const BASE_ROW = {
  id: 'v0000000-0000-0000-0000-000000000001',
  short_id: 'abc12345',
  slug: null,
  title: '测试电影',
  type: 'movie',
  catalog_id: 'c1',
  episode_count: 1,
  is_published: true,
  created_at: '2026-04-01T00:00:00Z',
  updated_at: '2026-04-01T00:00:00Z',
  source_content_type: null,
  normalized_type: null,
  content_format: null,
  episode_pattern: null,
  review_status: 'approved',
  visibility_status: 'public',
  needs_manual_review: false,
  content_rating: 'general',
  site_key: null,
  source_category: null,
  douban_status: 'pending',
  source_check_status: 'pending',
  meta_score: 0,
  trending_tag: null,
  title_en: null,
  title_original: null,
  description: null,
  cover_url: null,
  rating: 8.5,
  rating_votes: 100,
  runtime_minutes: null,
  year: 2024,
  country: null,
  status: 'completed',
  director: [],
  cast: [],
  writers: [],
  genres: [],
  aliases: [],
  languages: [],
  tags: [],
  douban_id: null,
  imdb_id: null,
  tmdb_id: null,
  title_normalized: 'test',
  metadata_source: 'manual',
  poster_blurhash: null,
  poster_status: null,
  backdrop_blurhash: null,
  backdrop_status: null,
  logo_url: null,
  logo_status: null,
  source_count: '2',
  subtitle_langs: [],
}

const ALL_TYPES = [
  'movie', 'series', 'anime', 'variety', 'documentary',
  'short', 'sports', 'music', 'news', 'kids', 'other',
] as const

// ═════════════════════════════════════════════════════════════════════════════
// listVideosByRatingDesc
// ═════════════════════════════════════════════════════════════════════════════

describe('listVideosByRatingDesc', () => {
  it('无 excludeIds 时 SQL 包含 rating DESC，不含 ALL(', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [BASE_ROW] })
    const result = await listVideosByRatingDesc(mockPool, 5)
    const sql: string = mockQuery.mock.calls[0][0]
    expect(sql).toContain('ORDER BY mc.rating DESC NULLS LAST')
    expect(sql).not.toContain('ALL(')
    expect(result).toHaveLength(1)
  })

  it('有 excludeIds 时 SQL 包含 ALL( 并正确传递参数', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const ids = ['v1', 'v2']
    await listVideosByRatingDesc(mockPool, 5, ids)
    const sql: string = mockQuery.mock.calls[0][0]
    expect(sql).toContain('ALL(')
    const params: unknown[] = mockQuery.mock.calls[0][1]
    expect(params[1]).toEqual(ids)
  })

  it('limit > 100 时截断为 100（防止大查询）', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await listVideosByRatingDesc(mockPool, 999)
    const params: unknown[] = mockQuery.mock.calls[0][1]
    expect(params[0]).toBe(100)
  })

  it('excludeIds=[] 时等价于无排除', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await listVideosByRatingDesc(mockPool, 5, [])
    const sql: string = mockQuery.mock.calls[0][0]
    expect(sql).not.toContain('ALL(')
  })

  it('无数据时返回空数组', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const result = await listVideosByRatingDesc(mockPool, 10)
    expect(result).toEqual([])
  })

  it('正确映射 shortId / rating（mapVideoCard 验证）', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [BASE_ROW] })
    const [card] = await listVideosByRatingDesc(mockPool, 1)
    expect(card.id).toBe(BASE_ROW.id)
    expect(card.shortId).toBe(BASE_ROW.short_id)
    expect(card.rating).toBe(BASE_ROW.rating)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// listVideoCardsByIds
// ═════════════════════════════════════════════════════════════════════════════

describe('listVideoCardsByIds', () => {
  it('ids=[] 时直接返回空数组，不调用 DB', async () => {
    const result = await listVideoCardsByIds(mockPool, [])
    expect(result).toEqual([])
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('SQL 包含 ANY($1::uuid[])', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [BASE_ROW] })
    await listVideoCardsByIds(mockPool, [BASE_ROW.id])
    const sql: string = mockQuery.mock.calls[0][0]
    expect(sql).toContain('ANY($1::uuid[])')
  })

  it('SQL WHERE 仅含已发布公开视频条件', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await listVideoCardsByIds(mockPool, ['some-uuid'])
    const sql: string = mockQuery.mock.calls[0][0]
    expect(sql).toContain('is_published = true')
    expect(sql).toContain("visibility_status = 'public'")
    expect(sql).toContain('deleted_at IS NULL')
  })

  it('正确映射 id / shortId / rating', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [BASE_ROW] })
    const [card] = await listVideoCardsByIds(mockPool, [BASE_ROW.id])
    expect(card.id).toBe(BASE_ROW.id)
    expect(card.shortId).toBe(BASE_ROW.short_id)
    expect(card.rating).toBe(BASE_ROW.rating)
  })

  it('DB 返回空（已下线视频）时结果为空', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const result = await listVideoCardsByIds(mockPool, ['offline-uuid'])
    expect(result).toEqual([])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// countVideosByType
// ═════════════════════════════════════════════════════════════════════════════

describe('countVideosByType', () => {
  it('DB 返回部分类型时缺失类型 count=0（零值填充）', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { type: 'movie', count: '42' },
        { type: 'series', count: '15' },
      ],
    })
    const result = await countVideosByType(mockPool)
    expect(result).toHaveLength(11)
    expect(result.find((r) => r.type === 'movie')?.count).toBe(42)
    expect(result.find((r) => r.type === 'anime')?.count).toBe(0)
    expect(result.find((r) => r.type === 'kids')?.count).toBe(0)
  })

  it('返回全部 11 种 VideoType（枚举完整性）', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const result = await countVideosByType(mockPool)
    const types = result.map((r) => r.type).sort()
    expect(types).toEqual([...ALL_TYPES].sort())
  })

  it('SQL 包含 GROUP BY v.type 和 is_published 过滤', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await countVideosByType(mockPool)
    const sql: string = mockQuery.mock.calls[0][0]
    expect(sql).toContain('GROUP BY')
    expect(sql).toContain('is_published = true')
  })

  it('DB 全部空时 11 种类型均为 count=0', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const result = await countVideosByType(mockPool)
    expect(result.every((r) => r.count === 0)).toBe(true)
  })
})

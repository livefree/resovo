import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listAdminVideos } from '@/api/db/queries/videos'

describe('listAdminVideos (CHG-209)', () => {
  const query = vi.fn()
  const db = { query } as unknown as import('pg').Pool

  beforeEach(() => {
    query.mockReset()
  })

  it('applies visibility/review filters and returns source aggregates', async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'vid-1',
            short_id: 'short1',
            title: 'Video 1',
            title_en: null,
            cover_url: null,
            type: 'movie',
            year: 2025,
            is_published: true,
            created_at: '2026-03-25T00:00:00Z',
            updated_at: '2026-03-25T00:00:00Z',
            visibility_status: 'public',
            review_status: 'approved',
            slug: '',
            description: '',
            source_category: null,
            genre: null,
            country: '',
            episode_count: 0,
            status: 'completed',
            rating: null,
            director: [],
            cast: [],
            writers: [],
            subtitle_langs: null,
            source_count: '2',
            active_source_count: '2',
            total_source_count: '3',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })

    const result = await listAdminVideos(db, {
      status: 'all',
      visibilityStatus: 'public',
      reviewStatus: 'approved',
      siteKey: 'alpha',
      page: 1,
      limit: 20,
    })

    expect(result.total).toBe(1)
    expect(result.rows[0]).toMatchObject({
      visibility_status: 'public',
      review_status: 'approved',
      active_source_count: '2',
      total_source_count: '3',
    })

    const [sql, params] = query.mock.calls[0]
    expect(sql).toContain('v.visibility_status = $')
    expect(sql).toContain('v.review_status = $')
    expect(sql).toContain('active_source_count')
    expect(sql).toContain('total_source_count')
    expect(params).toContain('public')
    expect(params).toContain('approved')
    expect(params).toContain('alpha')
  })
})

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

  // ── CHG-VSR-2（设计 §2.6）：三层过滤升级 ──────────────────────────
  it('CHG-VSR-2: 数组枚举走 = ANY($n::text[]) 参数化 + 范围 + q 扩面', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })

    const types = ['movie', 'anime'] as const
    const country = ['US', 'JP']
    const doubanStatus = ['matched', 'candidate'] as const
    const bangumiStatus = ['matched'] as const
    await listAdminVideos(db, {
      status: 'all',
      types,
      yearMin: 2000,
      yearMax: 2025,
      country,
      catalogStatus: ['ongoing'],
      isPublished: true,
      doubanStatus,
      bangumiStatus,
      metaScoreMin: 30,
      metaScoreMax: 90,
      q: 'naruto',
      page: 1,
      limit: 20,
    })

    const [sql, params] = query.mock.calls[0]
    // 数组枚举参数化（防注入）
    expect(sql).toContain('v.type = ANY($')
    expect(sql).toContain('::text[]')
    expect(sql).toContain('mc.country = ANY($')
    expect(sql).toContain('mc.status = ANY($')
    expect(sql).toContain('v.douban_status = ANY($')
    expect(sql).toContain('v.bangumi_status = ANY($')
    // 范围
    expect(sql).toContain('mc.year >= $')
    expect(sql).toContain('mc.year <= $')
    expect(sql).toContain('v.meta_score >= $')
    expect(sql).toContain('v.meta_score <= $')
    expect(sql).toContain('v.is_published = $')
    // q 扩面 4 列 OR
    expect(sql).toContain('mc.title_original ILIKE')
    expect(sql).toContain('v.short_id ILIKE')
    // 数组以 JS array 形态作为参数（pg 参数化，非字符串拼接）
    expect(params).toContainEqual(types)
    expect(params).toContainEqual(country)
    expect(params).toContainEqual(doubanStatus)
    expect(params).toContain(2000)
    expect(params).toContain(2025)
    expect(params).toContain('%naruto%')
  })

  it('CHG-VSR-2: 派生快捷筛选仅 true 追加谓词，空数组短路', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })

    await listAdminVideos(db, {
      status: 'all',
      types: [], // 空数组 → 短路不追加（不误过滤全表）
      episodeMismatch: true,
      episodeMissing: true,
      metaIncomplete: true,
      pendingReview: true,
      page: 1,
      limit: 20,
    })

    const [sql] = query.mock.calls[0]
    expect(sql).toContain('v.current_episodes IS DISTINCT FROM v.episode_count')
    expect(sql).toContain('(v.total_episodes IS NULL OR v.current_episodes IS NULL)')
    expect(sql).toContain('(v.meta_score IS NULL OR v.meta_score < 60)')
    expect(sql).toContain("v.review_status = 'pending_review'")
    // 空 types 数组短路：不出现 v.type = ANY
    expect(sql).not.toContain('v.type = ANY')
  })

  // ── SRCHEALTH-P1-1-A（B1 后端）：探测/试播聚合字段 + 排序 ─────────
  it('SRCHEALTH-P1-1-A: SELECT 含 render_check_status 聚合（语义同构 computeCheckStatus）+ 双字段排序白名单', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })

    await listAdminVideos(db, {
      status: 'all',
      sortField: 'render_check_status',
      sortDir: 'asc',
      page: 1,
      limit: 20,
    })

    const [sql] = query.mock.calls[0]
    // render 聚合子查询（active + 未删除口径，与 worker / api computeCheckStatus 输入一致）
    expect(sql).toContain('AS render_check_status')
    expect(sql).toContain("COUNT(*) FILTER (WHERE render_status <> 'pending') = 0 THEN 'pending'")
    expect(sql).toContain("COUNT(*) FILTER (WHERE render_status <> 'dead') = 0 THEN 'all_dead'")
    expect(sql).toContain("COUNT(*) FILTER (WHERE render_status = 'ok') = COUNT(*) THEN 'ok'")
    // probe 字段已在 VIDEO_FULL_SELECT（v.source_check_status 直通列）
    expect(sql).toContain('v.source_check_status')
    // render_check_status 排序走 SELECT alias（同 source_health 先例）
    expect(sql).toContain('ORDER BY render_check_status ASC')

    // probe 排序走列直通
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
    await listAdminVideos(db, {
      status: 'all',
      sortField: 'source_check_status',
      sortDir: 'desc',
      page: 1,
      limit: 20,
    })
    const [sql2] = query.mock.calls[2]
    expect(sql2).toContain('ORDER BY v.source_check_status DESC')
  })
})

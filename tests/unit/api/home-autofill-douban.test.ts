/**
 * home-autofill-douban.test.ts — 豆瓣候选源 + 生成集成
 * （CHG-HOME-AUTOFILL-DOUBAN / ADR-183 D-183-1 / D-183-4.1 / D-183-7.2）
 *
 * 影响面 #8 测试义务：分池 videos.type 参数化 / 缺失信号按 0 /
 * filtered 条目保留 + rank 不占名次 / 缺口 DTO 无 videoId。
 */

import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import {
  buildDoubanCandidates,
  buildDoubanGaps,
  generateDoubanSectionCandidates,
} from '@/api/services/home-autofill/douban'
import {
  listDoubanCandidateSourceRows,
  listDoubanGapSourceRows,
  type DoubanCandidateSourceRow,
  type DoubanGapSourceRow,
} from '@/api/db/queries/home-autofill-douban'
import { CANDIDATE_POOL_LIMIT, GAP_SCAN_WINDOW, GAP_TOP_N } from '@/api/services/home-autofill/policy'

const NOW = new Date('2026-06-06T12:00:00Z')

function sourceRow(over: Partial<DoubanCandidateSourceRow> = {}): DoubanCandidateSourceRow {
  return {
    videoId: 'v-1',
    slug: 'slug-1',
    title: '映射视频',
    type: 'movie',
    isPublished: true,
    visibilityStatus: 'public',
    contentRating: 'general',
    siteIsAdult: false,
    updatedAt: '2026-06-06T00:00:00Z',
    coverUrl: 'https://cdn.example.com/cover.jpg',
    year: 2026,
    catalogRating: 8.2,
    doubanId: 'db-1',
    doubanVotes: 10000,
    doubanRating: 8.5,
    sourceCheckStatus: 'ok',
    activeSourceCount: 3,
    ...over,
  }
}

function gapRow(over: Partial<DoubanGapSourceRow> = {}): DoubanGapSourceRow {
  return {
    doubanId: 'db-gap-1',
    title: '未映射条目',
    coverUrl: 'https://img.douban.com/x.jpg',
    doubanVotes: 50000,
    doubanRating: 9.0,
    mediaTypeHint: 'movie',
    ...over,
  }
}

// ── buildDoubanCandidates ────────────────────────────────────────

describe('buildDoubanCandidates（D-183-4.1 + D-183-4.5）', () => {
  it('score DESC 排序；rank 从 1 起连续', () => {
    const out = buildDoubanCandidates([
      sourceRow({ videoId: 'v-low', doubanVotes: 100, doubanRating: 5 }),
      sourceRow({ videoId: 'v-high', doubanVotes: 10000, doubanRating: 9 }),
    ], NOW)
    expect(out.map((c) => c.videoId)).toEqual(['v-high', 'v-low'])
    expect(out.map((c) => c.rank)).toEqual([1, 2])
    expect(out[0]!.score).toBeGreaterThan(out[1]!.score)
  })

  it('filtered 条目保留入结果（解释展示）+ rank=0 不占名次（后续未过滤项名次连续）', () => {
    const out = buildDoubanCandidates([
      sourceRow({ videoId: 'v-ok1', doubanVotes: 10000 }),
      sourceRow({ videoId: 'v-unpub', doubanVotes: 9000, isPublished: false }),
      sourceRow({ videoId: 'v-ok2', doubanVotes: 100 }),
    ], NOW)
    const byId = new Map(out.map((c) => [c.videoId, c]))
    expect(byId.get('v-unpub')).toMatchObject({ filtered: true, filterReason: 'not_published', rank: 0 })
    expect(byId.get('v-ok1')!.rank).toBe(1)
    expect(byId.get('v-ok2')!.rank).toBe(2)
    expect(out).toHaveLength(3)
  })

  it('过滤链信号映射：非 public / 成人（content_rating 或源站）/ 零可播源 / 缺图', () => {
    const out = buildDoubanCandidates([
      sourceRow({ videoId: 'v-internal', visibilityStatus: 'internal' }),
      sourceRow({ videoId: 'v-adult', contentRating: 'adult' }),
      sourceRow({ videoId: 'v-site-adult', siteIsAdult: true }),
      sourceRow({ videoId: 'v-nosrc', activeSourceCount: 0 }),
      sourceRow({ videoId: 'v-noimg', coverUrl: null }),
    ], NOW)
    const reason = (id: string) => out.find((c) => c.videoId === id)?.filterReason
    expect(reason('v-internal')).toBe('not_visible')
    expect(reason('v-adult')).toBe('adult_content')
    expect(reason('v-site-adult')).toBe('adult_content')
    expect(reason('v-nosrc')).toBe('no_playable_source')
    expect(reason('v-noimg')).toBe('missing_image')
  })

  it('缺失信号按 0：votes/rating 全缺仍产出候选（低分非报错）', () => {
    const out = buildDoubanCandidates([
      sourceRow({ videoId: 'v-bare', doubanVotes: null, doubanRating: null }),
    ], NOW)
    expect(out).toHaveLength(1)
    expect(out[0]!.filtered).toBe(false)
    expect(out[0]!.score).toBeGreaterThan(0) // recency + source_health 仍贡献
    expect(out[0]!.score).toBeLessThan(0.5)
  })

  it('源不稳定惩罚：partial/all_dead 比 ok 低一档', () => {
    const [ok] = buildDoubanCandidates([sourceRow({ sourceCheckStatus: 'ok' })], NOW)
    const [partial] = buildDoubanCandidates([sourceRow({ sourceCheckStatus: 'partial' })], NOW)
    const [allDead] = buildDoubanCandidates([sourceRow({ sourceCheckStatus: 'all_dead' })], NOW)
    expect(partial!.score).toBeLessThan(ok!.score)
    expect(allDead!.score).toBeLessThan(ok!.score)
  })

  it('videoSummary 展示口径：rating 取站内 catalog 而非豆瓣 / origin=douban / id 唯一', () => {
    const out = buildDoubanCandidates([
      sourceRow({ catalogRating: 7.7, doubanRating: 9.9 }),
      sourceRow({ videoId: 'v-2', doubanId: 'db-2' }),
    ], NOW)
    expect(out[0]!.videoSummary.rating).toBe(7.7)
    expect(out[0]!.origin).toBe('douban')
    expect(new Set(out.map((c) => c.id)).size).toBe(2)
  })

  it('空源行 → 空数组（映射桥零产能时不报错）', () => {
    expect(buildDoubanCandidates([], NOW)).toEqual([])
  })
})

// ── buildDoubanGaps ──────────────────────────────────────────────

describe('buildDoubanGaps（D-183-7.2/7.3）', () => {
  it('top-N 截断 + score DESC；DTO 无 videoId/videoSummary（独立 ContentGap）', () => {
    const out = buildDoubanGaps([
      gapRow({ doubanId: 'g-mid', doubanVotes: 5000 }),
      gapRow({ doubanId: 'g-top', doubanVotes: 50000 }),
      gapRow({ doubanId: 'g-low', doubanVotes: 10 }),
    ], 2)
    expect(out.map((g) => g.externalId)).toEqual(['g-top', 'g-mid'])
    expect(out[0]).not.toHaveProperty('videoId')
    expect(out[0]).not.toHaveProperty('videoSummary')
    expect(out[0]).toMatchObject({ provider: 'douban', title: '未映射条目', rank: null })
  })

  it('mediaTypeHint 为提示性透传（D-183-1.2：不参与分池判定）', () => {
    const out = buildDoubanGaps([gapRow({ mediaTypeHint: 'movie' })], 10)
    expect(out[0]!.mediaTypeHint).toBe('movie')
  })

  it('站内信号自然缺失：纯豆瓣信号评分（votes+rating 权重上界 0.7）', () => {
    const out = buildDoubanGaps([gapRow({ doubanVotes: 50000, doubanRating: 10 })], 10)
    expect(out[0]!.score).toBeCloseTo(0.7, 10) // 0.4·1 + 0.3·1，recency/health 缺失按 0
  })
})

// ── queries SQL 契约 ─────────────────────────────────────────────

describe('listDoubanCandidateSourceRows（映射桥三源 UNION + 分池）', () => {
  it('分池 WHERE videos.type 参数化（D-183-1）+ 三源 UNION + 不预过滤可见性', async () => {
    const pool = { query: vi.fn(async () => ({ rows: [] })) } as unknown as Pool
    await listDoubanCandidateSourceRows(pool, 'series', 100)
    const [sql, params] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(params).toEqual(['series', 100])
    expect(sql).toContain('v.type = $1')
    expect(sql).toContain('mc.douban_id IS NOT NULL')
    expect(sql).toContain(`match_status = 'manual_confirmed'`)
    expect(sql).toContain(`cer.relation = 'exact'`)
    // 源查询不预过滤可见性（filtered 候选保留入快照，D-183-4.5）
    expect(sql).not.toContain(`visibility_status = 'public'`)
    expect(sql).not.toContain('is_published = true')
    // 软删恒排除（删除行连 filtered 解释也不该出现）
    expect(sql).toContain('v.deleted_at IS NULL')
  })
})

describe('listDoubanGapSourceRows（未映射扫描窗）', () => {
  it('三源 NOT EXISTS + votes 序预截 + 窗口钳位', async () => {
    const pool = { query: vi.fn(async () => ({ rows: [] })) } as unknown as Pool
    await listDoubanGapSourceRows(pool, 99999)
    const [sql, params] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect((sql.match(/NOT EXISTS/g) ?? [])).toHaveLength(3)
    expect(sql).toContain('ORDER BY de.douban_votes DESC NULLS LAST')
    expect(params).toEqual([2000]) // 窗口上限钳位
  })
})

// ── 编排 ─────────────────────────────────────────────────────────

describe('generateDoubanSectionCandidates（编排）', () => {
  it('section → type 分派 + 候选与缺口同时序产出（同一快照，D-183-7.3）', async () => {
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('WITH bridge')) {
          return { rows: [{
            video_id: 'v-1', slug: 's', title: 't', type: 'series',
            is_published: true, visibility_status: 'public', content_rating: 'general',
            site_is_adult: false, updated_at: '2026-06-06T00:00:00Z',
            cover_url: 'c.jpg', year: 2026, catalog_rating: 8,
            douban_id: 'db-1', douban_votes: 100, douban_rating: 8,
            source_check_status: 'ok', active_source_count: 2,
          }] }
        }
        return { rows: [{
          douban_id: 'g-1', title: 'gap', cover_url: null,
          douban_votes: 9, rating: 7, media_type: 'movie',
        }] }
      }),
    } as unknown as Pool

    const out = await generateDoubanSectionCandidates(pool, 'hot_series', NOW)
    expect(out.candidates).toHaveLength(1)
    expect(out.candidates[0]!.origin).toBe('douban')
    expect(out.gaps).toHaveLength(1)
    expect(out.gaps[0]!.provider).toBe('douban')

    // 分派断言：hot_series → 'series' 池 + 常量透传
    const calls = (pool.query as ReturnType<typeof vi.fn>).mock.calls
    const candidateCall = calls.find((c) => (c[0] as string).includes('WITH bridge'))!
    expect(candidateCall[1]).toEqual(['series', CANDIDATE_POOL_LIMIT])
    const gapCall = calls.find((c) => (c[0] as string).includes('NOT EXISTS'))!
    expect(gapCall[1]).toEqual([GAP_SCAN_WINDOW])
    expect(GAP_TOP_N).toBe(50) // D-183-7.2 裁定值守护
  })
})

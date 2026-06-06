/**
 * home-autofill-bangumi.test.ts — Bangumi 候选源 + 生成集成
 * （CHG-HOME-AUTOFILL-BANGUMI / ADR-183 D-183-4.2 / D-183-7.1）
 *
 * 影响面 #8 测试义务：nsfw 硬过滤断言（当前 0 行仍须测试守护增量防线）/
 * rank 缺失排后 / filtered 保留 + rank 不占名次。
 */

import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import {
  buildBangumiCandidates,
  buildBangumiGaps,
  generateBangumiSectionCandidates,
} from '@/api/services/home-autofill/bangumi'
import {
  listBangumiCandidateSourceRows,
  listBangumiGapSourceRows,
  type BangumiCandidateSourceRow,
  type BangumiGapSourceRow,
} from '@/api/db/queries/home-autofill-bangumi'
import { CANDIDATE_POOL_LIMIT, GAP_SCAN_WINDOW } from '@/api/services/home-autofill/policy'

function sourceRow(over: Partial<BangumiCandidateSourceRow> = {}): BangumiCandidateSourceRow {
  return {
    videoId: 'v-1',
    slug: 'slug-1',
    title: '映射动漫',
    type: 'anime',
    isPublished: true,
    visibilityStatus: 'public',
    contentRating: 'general',
    siteIsAdult: false,
    updatedAt: '2026-06-06T00:00:00Z',
    coverUrl: 'https://cdn.example.com/cover.jpg',
    year: 2026,
    catalogRating: 8.0,
    bangumiId: 100,
    bangumiRank: 10,
    bangumiRating: 8.5,
    sourceCheckStatus: 'ok',
    activeSourceCount: 2,
    ...over,
  }
}

function gapRow(over: Partial<BangumiGapSourceRow> = {}): BangumiGapSourceRow {
  return {
    bangumiId: 900,
    title: '未映射动漫',
    coverUrl: 'https://img.bgm.tv/x.jpg',
    bangumiRank: 5,
    bangumiRating: 9.0,
    ...over,
  }
}

// ── buildBangumiCandidates ───────────────────────────────────────

describe('buildBangumiCandidates（D-183-4.2 rank 主序）', () => {
  it('rank ASC 主序排序（非 score 序）；rank 字段从 1 起连续', () => {
    const out = buildBangumiCandidates([
      sourceRow({ videoId: 'v-r30', bangumiRank: 30, bangumiRating: 9.9 }),
      sourceRow({ videoId: 'v-r1', bangumiRank: 1, bangumiRating: 5.0 }),
    ])
    // rank 1 在前——即便 r30 的 rating 更高（rank 主序裁定，排序权威 ≠ score）
    expect(out.map((c) => c.videoId)).toEqual(['v-r1', 'v-r30'])
    expect(out.map((c) => c.rank)).toEqual([1, 2])
    expect(out[0]!.score).toBeLessThan(out[1]!.score) // score 仅展示，可与排序逆序
  })

  it('bangumi rank 缺失项排在有 rank 项之后，组内 rating DESC', () => {
    const out = buildBangumiCandidates([
      sourceRow({ videoId: 'v-norank-low', bangumiRank: null, bangumiRating: 6.0 }),
      sourceRow({ videoId: 'v-ranked', bangumiRank: 500, bangumiRating: 1.0 }),
      sourceRow({ videoId: 'v-norank-high', bangumiRank: null, bangumiRating: 9.0 }),
    ])
    expect(out.map((c) => c.videoId)).toEqual(['v-ranked', 'v-norank-high', 'v-norank-low'])
  })

  it('filtered 条目保留（解释展示）+ rank=0 不占名次', () => {
    const out = buildBangumiCandidates([
      sourceRow({ videoId: 'v-ok', bangumiRank: 1 }),
      sourceRow({ videoId: 'v-nosrc', bangumiRank: 2, activeSourceCount: 0 }),
      sourceRow({ videoId: 'v-ok2', bangumiRank: 3 }),
    ])
    const byId = new Map(out.map((c) => [c.videoId, c]))
    expect(byId.get('v-nosrc')).toMatchObject({ filtered: true, filterReason: 'no_playable_source', rank: 0 })
    expect(byId.get('v-ok')!.rank).toBe(1)
    expect(byId.get('v-ok2')!.rank).toBe(2)
  })

  it('展示 score：rating/10 − 惩罚（缺图/源不稳定）下钳 0；origin=bangumi', () => {
    const [clean] = buildBangumiCandidates([sourceRow({ bangumiRating: 8.0 })])
    const [penalized] = buildBangumiCandidates([
      sourceRow({ bangumiRating: 8.0, coverUrl: null, sourceCheckStatus: 'partial' }),
    ])
    expect(clean!.score).toBeCloseTo(0.8, 10)
    expect(penalized!.score).toBeCloseTo(0.6, 10)
    expect(clean!.origin).toBe('bangumi')
    const [floor] = buildBangumiCandidates([
      sourceRow({ bangumiRating: 0.5, coverUrl: null, sourceCheckStatus: 'all_dead' }),
    ])
    expect(floor!.score).toBe(0)
  })
})

// ── buildBangumiGaps ─────────────────────────────────────────────

describe('buildBangumiGaps（D-183-7.1：只读透出，建库复用 ADR-161）', () => {
  it('rank ASC 主序 + top-N 截断；ContentGap 携 bangumi 原生 rank + 无 videoId', () => {
    const out = buildBangumiGaps([
      gapRow({ bangumiId: 901, bangumiRank: 50 }),
      gapRow({ bangumiId: 902, bangumiRank: 3 }),
      gapRow({ bangumiId: 903, bangumiRank: null, bangumiRating: 9.9 }),
    ], 2)
    expect(out.map((g) => g.externalId)).toEqual(['902', '901'])
    expect(out[0]).toMatchObject({ provider: 'bangumi', rank: 3, mediaTypeHint: 'anime' })
    expect(out[0]).not.toHaveProperty('videoId')
  })
})

// ── queries SQL 契约 ─────────────────────────────────────────────

describe('listBangumiCandidateSourceRows（nsfw 硬过滤 + 映射桥三源）', () => {
  it('nsfw=false 硬过滤（增量防线）+ 三源 UNION + anime 分池 + 不预过滤可见性', async () => {
    const pool = { query: vi.fn(async () => ({ rows: [] })) } as unknown as Pool
    await listBangumiCandidateSourceRows(pool, 100)
    const [sql, params] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(params).toEqual([100])
    expect(sql).toContain('be.nsfw = false')
    expect(sql).toContain('mc.bangumi_subject_id IS NOT NULL')
    expect(sql).toContain(`match_status = 'manual_confirmed'`)
    expect(sql).toContain(`cer.relation = 'exact'`)
    expect(sql).toContain(`v.type = 'anime'`)
    expect(sql).not.toContain(`visibility_status = 'public'`)
    expect(sql).toContain('v.deleted_at IS NULL')
    // 同 video 多映射取 rank 最优
    expect(sql).toContain('ORDER BY v.id, be.rank ASC NULLS LAST')
  })
})

describe('listBangumiGapSourceRows（缺口路径同样 nsfw 硬过滤）', () => {
  it('nsfw=false + 三源 NOT EXISTS + rank ASC 主序预截 + 窗口钳位', async () => {
    const pool = { query: vi.fn(async () => ({ rows: [] })) } as unknown as Pool
    await listBangumiGapSourceRows(pool, 99999)
    const [sql, params] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(sql).toContain('be.nsfw = false')
    expect((sql.match(/NOT EXISTS/g) ?? [])).toHaveLength(3)
    expect(sql).toContain('ORDER BY be.rank ASC NULLS LAST')
    expect(params).toEqual([2000])
  })
})

// ── 编排 ─────────────────────────────────────────────────────────

describe('generateBangumiSectionCandidates（编排）', () => {
  it('候选与缺口同时序产出 + 常量透传', async () => {
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('WITH bridge')) {
          return { rows: [{
            video_id: 'v-1', slug: 's', title: 't', type: 'anime',
            is_published: true, visibility_status: 'public', content_rating: 'general',
            site_is_adult: false, updated_at: '2026-06-06T00:00:00Z',
            cover_url: 'c.jpg', year: 2026, catalog_rating: 8,
            bangumi_id: 100, bangumi_rank: 1, bangumi_rating: 8,
            source_check_status: 'ok', active_source_count: 2,
          }] }
        }
        return { rows: [{ bangumi_id: 900, title: 'gap', cover_url: null, rank: 5, rating: 9 }] }
      }),
    } as unknown as Pool

    const out = await generateBangumiSectionCandidates(pool)
    expect(out.candidates).toHaveLength(1)
    expect(out.candidates[0]!.origin).toBe('bangumi')
    expect(out.gaps).toHaveLength(1)
    expect(out.gaps[0]!.provider).toBe('bangumi')

    const calls = (pool.query as ReturnType<typeof vi.fn>).mock.calls
    expect(calls.find((c) => (c[0] as string).includes('WITH bridge'))![1]).toEqual([CANDIDATE_POOL_LIMIT])
    expect(calls.find((c) => (c[0] as string).includes('NOT EXISTS'))![1]).toEqual([GAP_SCAN_WINDOW])
  })
})

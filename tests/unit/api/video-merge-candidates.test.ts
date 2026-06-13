/**
 * video-merge-candidates.test.ts — merge 候选 DB 查询 + schema 单元测试
 *
 * 覆盖（CHG-VIR-18 收缩，ADR-105 AMENDMENT 2026-06-12 / D-105-17）：
 * - fetchVideoDetailsForCandidates: 批量 video + source 摘要查询（identity 折叠管线 stage 5 回查消费）
 * - mapVideoRow: D-105-7 对比矩阵 +7 字段映射（三消费点之一）
 * - ListCandidatesSchema: zod 默认值 + 边界校验 + source 单值收敛（D-105-18）
 *
 * 注：legacy 实时聚合路径（computeOverlapScore + fetchRawCandidateGroups + listCandidates(legacy)
 * 评分/排序/分页/perf）随 source=legacy 退役删除（D-105-17）；identity 路径 listCandidates 测试
 * 见 identity-source-switch.test.ts（折叠/排序/筛选/搜索/截断/GOV-2 解耦 17 用例）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchVideoDetailsForCandidates } from '@/api/db/queries/video-merge-candidates'
import { ListCandidatesSchema } from '@/api/services/VideoMergesService'
import { mapVideoRow } from '@/api/services/VideoMergesService.schemas'

// ── mock helpers ──────────────────────────────────────────────────

const mockQuery = vi.fn()
const mockDb = { query: mockQuery } as unknown as import('pg').Pool

beforeEach(() => {
  mockQuery.mockReset()
})

// ── fixtures ──────────────────────────────────────────────────────

function makeVideoRow(id: string, siteKeys: string[], sourceCount = 3, createdAt = '2026-01-01T00:00:00Z') {
  return {
    id,
    title: `Video ${id}`,
    title_normalized: '復仇者聯盟',
    year: 2019,
    type: 'movie' as const,
    created_at: createdAt,
    source_count: String(sourceCount),
    site_keys: siteKeys,
  }
}

/** 含 D-105-7 全部新列的完整 detail 行 fixture */
function makeVideoRowFull(id: string, siteKeys: string[], sourceCount = 3) {
  return {
    ...makeVideoRow(id, siteKeys, sourceCount),
    review_status: 'approved' as const,
    visibility_status: 'public' as const,
    catalog_id: 'cat-uuid-1',
    catalog_title: '復仇者聯盟（catalog）',
    cover_url: 'https://img.example/cover.jpg',
    episode_min: 1,
    episode_max: 12,
    external_ids: [{ provider: 'douban', externalId: 'db-123' }],
  }
}

// ── fetchVideoDetailsForCandidates ────────────────────────────────

describe('fetchVideoDetailsForCandidates', () => {
  it('空 ids 时直接返回 []，不查询 DB', async () => {
    const result = await fetchVideoDetailsForCandidates(mockDb, [])
    expect(mockQuery).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })

  it('传 videoIds 数组时 SQL 含 ANY($1::uuid[])', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await fetchVideoDetailsForCandidates(mockDb, ['vid-a', 'vid-b'])
    const sql: string = mockQuery.mock.calls[0][0] as string
    expect(sql).toContain('ANY($1::uuid[])')
  })

  it('返回正确的 site_keys 数组', async () => {
    const row = makeVideoRow('vid-a', ['iqiyi', 'youku'], 2)
    mockQuery.mockResolvedValueOnce({ rows: [row] })
    const result = await fetchVideoDetailsForCandidates(mockDb, ['vid-a'])
    expect(result[0]?.site_keys).toEqual(['iqiyi', 'youku'])
  })

  // ── ADR-105 AMENDMENT 2026-06-04 D-105-7（CHG-VIR-13-B1）：对比矩阵 SQL 数据源 ──
  it('SQL 含 7 项数据源（状态/catalog/封面/集数/外部 ID）', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await fetchVideoDetailsForCandidates(mockDb, ['vid-a'])
    const sql: string = mockQuery.mock.calls[0][0] as string
    expect(sql).toContain('v.review_status')
    expect(sql).toContain('v.visibility_status')
    expect(sql).toContain('v.catalog_id')
    expect(sql).toContain('mc.title AS catalog_title')
    expect(sql).toContain('mc.cover_url')
    expect(sql).toContain('MIN(vs.episode_number)')
    expect(sql).toContain('MAX(vs.episode_number)')
    expect(sql).toContain('FROM video_external_refs r')
    // 仅 primary + 已确认（manual_confirmed/auto_matched），candidate/rejected 不透出
    expect(sql).toContain('r.is_primary')
    expect(sql).toContain("'manual_confirmed', 'auto_matched'")
  })
})

// ── mapVideoRow — D-105-7 +7 字段映射（三消费点之一）─────────────────

describe('mapVideoRow — D-105-7 对比矩阵 +7 字段映射', () => {
  it('DB row +7 列 → VideoSummaryForMerge 透出', () => {
    const v = mapVideoRow(makeVideoRowFull('vid-a', ['iqiyi', 'youku'], 2) as never)
    expect(v.reviewStatus).toBe('approved')
    expect(v.visibilityStatus).toBe('public')
    expect(v.catalogId).toBe('cat-uuid-1')
    expect(v.catalogTitle).toBe('復仇者聯盟（catalog）')
    expect(v.coverUrl).toBe('https://img.example/cover.jpg')
    expect(v.episodeRange).toEqual({ min: 1, max: 12 })
    expect(v.externalIds).toEqual([{ provider: 'douban', externalId: 'db-123' }])
  })

  it('基础映射：title/year/sourceCount/siteKeys', () => {
    const v = mapVideoRow(makeVideoRow('vid-a', ['iqiyi'], 5) as never)
    expect(v.id).toBe('vid-a')
    expect(v.titleNormalized).toBe('復仇者聯盟')
    expect(v.year).toBe(2019)
    expect(v.sourceCount).toBe(5)
    expect(v.sourceSiteKeys).toEqual(['iqiyi'])
  })
})

// ── ListCandidatesSchema ──────────────────────────────────────────

describe('ListCandidatesSchema', () => {
  it('空输入使用默认值', () => {
    const result = ListCandidatesSchema.parse({})
    expect(result.minScore).toBe(0.6)
    expect(result.limit).toBe(20)
    expect(result.page).toBe(1)
    expect(result.type).toBeUndefined()
    // CHG-VIR-18 / D-105-18：source 默认（且唯一合法值）identity
    expect(result.source).toBe('identity')
  })

  it('source=identity 显式传入通过', () => {
    expect(ListCandidatesSchema.parse({ source: 'identity' }).source).toBe('identity')
  })

  it('source=legacy → 422（CHG-VIR-18 D-105-18：legacy 检索路径退役，显式拒绝）', () => {
    expect(() => ListCandidatesSchema.parse({ source: 'legacy' })).toThrow()
  })

  it('minScore 字符串被 coerce 为数字（D-105-19 字段保留）', () => {
    expect(ListCandidatesSchema.parse({ minScore: '0.8' }).minScore).toBe(0.8)
  })

  it('minScore > 1 报错', () => {
    expect(() => ListCandidatesSchema.parse({ minScore: '1.5' })).toThrow()
  })

  it('minScore < 0 报错', () => {
    expect(() => ListCandidatesSchema.parse({ minScore: '-0.1' })).toThrow()
  })

  it('limit > 100 报错', () => {
    expect(() => ListCandidatesSchema.parse({ limit: '101' })).toThrow()
  })

  it('无效 type 报错', () => {
    expect(() => ListCandidatesSchema.parse({ type: 'invalid_type' })).toThrow()
  })

  it('合法 type=anime 通过', () => {
    expect(ListCandidatesSchema.parse({ type: 'anime' }).type).toBe('anime')
  })

  // D-105a-19 组级筛选字段（契约表补登真相，零行为变更）
  it('identityScoreMin/Max coerce 0..1 + min>max 报错', () => {
    expect(ListCandidatesSchema.parse({ identityScoreMin: '0.5', identityScoreMax: '0.9' }).identityScoreMin).toBe(0.5)
    expect(() => ListCandidatesSchema.parse({ identityScoreMin: '0.9', identityScoreMax: '0.5' })).toThrow()
  })

  it('videoCountMin/Max int≥2 + min>max 报错', () => {
    expect(ListCandidatesSchema.parse({ videoCountMin: '3' }).videoCountMin).toBe(3)
    expect(() => ListCandidatesSchema.parse({ videoCountMin: '5', videoCountMax: '3' })).toThrow()
  })

  it('q trim 非空 max 100', () => {
    expect(ListCandidatesSchema.parse({ q: '斗破' }).q).toBe('斗破')
    expect(() => ListCandidatesSchema.parse({ q: 'x'.repeat(101) })).toThrow()
  })
})

/**
 * VideoListClient 辅助函数单测（CHG-SN-3-04 / CHG-VSR-4-B 扩展）
 *
 * 覆盖：
 * - buildVideoFilter: snapshot → VideoListFilter 映射
 *   - 基础：q / type / status / visibility / reviewStatus / site / sort / pagination
 *   - CHG-VSR-4-B 原子列：year/metaScore(range) / country/catalogStatus/douban/bangumi(enum 数组) / isPublished(单值→bool)
 *   - CHG-VSR-4-B 快捷筛选：quickFilters Set → pendingReview/metaIncomplete/episodeMismatch（仅 true）
 * - VIDEO_TYPE_OPTIONS / VISIBILITY_OPTIONS / REVIEW_STATUS_OPTIONS / VIDEO_QUICK_FILTERS 完整性
 *
 * 注：CHG-VSR-4-B 删除 FilterChipBar（设计 §1.1-5）→ buildFilterChips 死代码移除，相关单测同步删除。
 */

import { describe, it, expect } from 'vitest'
import {
  buildVideoFilter,
  VIDEO_TYPE_OPTIONS,
  VIDEO_STATUS_OPTIONS,
  VISIBILITY_OPTIONS,
  REVIEW_STATUS_OPTIONS,
  VIDEO_QUICK_FILTERS,
  type VideoQuickFilterKey,
} from '../../../../../../apps/server-next/src/app/admin/videos/_client/VideoFilterFields'
import type { TableQuerySnapshot, FilterValue } from '../../../../../../packages/admin-ui/src/components/data-table/types'

// ── test helpers ──────────────────────────────────────────────────

function makeSnapshot(overrides: Partial<TableQuerySnapshot> = {}): TableQuerySnapshot {
  return {
    pagination: { page: 1, pageSize: 20 },
    sort: { field: undefined, direction: 'asc' },
    filters: new Map(),
    columns: new Map(),
    selection: { selectedKeys: new Set(), mode: 'page' },
    ...overrides,
  }
}

function snapshotWithFilters(entries: ReadonlyArray<readonly [string, FilterValue]>): TableQuerySnapshot {
  return makeSnapshot({ filters: new Map(entries) })
}

// ── buildVideoFilter — 基础 ───────────────────────────────────────

describe('buildVideoFilter — 空 snapshot', () => {
  it('空 filters → 全部字段 undefined（除 page/limit/sortDir）', () => {
    const filter = buildVideoFilter(makeSnapshot())
    expect(filter.q).toBeUndefined()
    expect(filter.type).toBeUndefined()
    expect(filter.status).toBeUndefined()
    expect(filter.visibilityStatus).toBeUndefined()
    expect(filter.reviewStatus).toBeUndefined()
    expect(filter.site).toBeUndefined()
    // CHG-VSR-4-B 原子/快捷字段空 snapshot 均 undefined
    expect(filter.yearMin).toBeUndefined()
    expect(filter.country).toBeUndefined()
    expect(filter.isPublished).toBeUndefined()
    expect(filter.metaScoreMax).toBeUndefined()
    expect(filter.pendingReview).toBeUndefined()
    expect(filter.metaIncomplete).toBeUndefined()
    expect(filter.episodeMismatch).toBeUndefined()
  })

  it('默认 pagination → page=1, limit=20', () => {
    const filter = buildVideoFilter(makeSnapshot())
    expect(filter.page).toBe(1)
    expect(filter.limit).toBe(20)
  })

  it('默认 sort → sortField=undefined, sortDir=undefined（白名单守卫）', () => {
    const filter = buildVideoFilter(makeSnapshot())
    expect(filter.sortField).toBeUndefined()
    expect(filter.sortDir).toBeUndefined()
  })
})

describe('buildVideoFilter — text filter', () => {
  it('q text filter → filter.q', () => {
    const filter = buildVideoFilter(snapshotWithFilters([['q', { kind: 'text', value: '星际穿越' }]]))
    expect(filter.q).toBe('星际穿越')
  })

  it('q text filter 空字符串 → filter.q=undefined', () => {
    const filter = buildVideoFilter(snapshotWithFilters([['q', { kind: 'text', value: '' }]]))
    expect(filter.q).toBeUndefined()
  })
})

describe('buildVideoFilter — 既有 enum filters（单值，向后兼容）', () => {
  it('type enum → filter.type', () => {
    expect(buildVideoFilter(snapshotWithFilters([['type', { kind: 'enum', value: ['movie'] }]])).type).toBe('movie')
  })
  it('status enum → filter.status（URL 向后兼容保留映射）', () => {
    expect(buildVideoFilter(snapshotWithFilters([['status', { kind: 'enum', value: ['published'] }]])).status).toBe('published')
  })
  it('visibilityStatus enum → filter.visibilityStatus', () => {
    expect(buildVideoFilter(snapshotWithFilters([['visibilityStatus', { kind: 'enum', value: ['hidden'] }]])).visibilityStatus).toBe('hidden')
  })
  it('reviewStatus enum → filter.reviewStatus', () => {
    expect(buildVideoFilter(snapshotWithFilters([['reviewStatus', { kind: 'enum', value: ['approved'] }]])).reviewStatus).toBe('approved')
  })
  it('site enum → filter.site（URL 向后兼容保留映射）', () => {
    expect(buildVideoFilter(snapshotWithFilters([['site', { kind: 'enum', value: ['bilibili'] }]])).site).toBe('bilibili')
  })
})

// ── buildVideoFilter — CHG-VSR-4-B 原子列筛选 ─────────────────────

describe('buildVideoFilter — 原子列筛选映射（§2.6②）', () => {
  it('year range → yearMin/yearMax', () => {
    const filter = buildVideoFilter(snapshotWithFilters([['year', { kind: 'range', min: 2000, max: 2025 }]]))
    expect(filter.yearMin).toBe(2000)
    expect(filter.yearMax).toBe(2025)
  })

  it('year range 仅 min → yearMin set / yearMax undefined', () => {
    const filter = buildVideoFilter(snapshotWithFilters([['year', { kind: 'range', min: 2010 }]]))
    expect(filter.yearMin).toBe(2010)
    expect(filter.yearMax).toBeUndefined()
  })

  it('metaScore range → metaScoreMin/metaScoreMax', () => {
    const filter = buildVideoFilter(snapshotWithFilters([['metaScore', { kind: 'range', min: 30, max: 90 }]]))
    expect(filter.metaScoreMin).toBe(30)
    expect(filter.metaScoreMax).toBe(90)
  })

  it('country enum 多选 → country[]', () => {
    const filter = buildVideoFilter(snapshotWithFilters([['country', { kind: 'enum', value: ['US', 'JP'] }]]))
    expect(filter.country).toEqual(['US', 'JP'])
  })

  it('catalogStatus enum → catalogStatus[]', () => {
    const filter = buildVideoFilter(snapshotWithFilters([['catalogStatus', { kind: 'enum', value: ['ongoing'] }]]))
    expect(filter.catalogStatus).toEqual(['ongoing'])
  })

  it('doubanStatus / bangumiStatus enum → 数组', () => {
    const filter = buildVideoFilter(snapshotWithFilters([
      ['doubanStatus', { kind: 'enum', value: ['matched', 'candidate'] }],
      ['bangumiStatus', { kind: 'enum', value: ['matched'] }],
    ]))
    expect(filter.doubanStatus).toEqual(['matched', 'candidate'])
    expect(filter.bangumiStatus).toEqual(['matched'])
  })

  it('isPublished 单值 published → true / draft → false', () => {
    expect(buildVideoFilter(snapshotWithFilters([['isPublished', { kind: 'enum', value: ['published'] }]])).isPublished).toBe(true)
    expect(buildVideoFilter(snapshotWithFilters([['isPublished', { kind: 'enum', value: ['draft'] }]])).isPublished).toBe(false)
  })

  it('enum 空数组 → undefined（不误过滤，对齐 api 空数组短路）', () => {
    const filter = buildVideoFilter(snapshotWithFilters([['country', { kind: 'enum', value: [] }]]))
    expect(filter.country).toBeUndefined()
  })
})

// ── buildVideoFilter — CHG-VSR-4-B 快捷筛选(B) ────────────────────

describe('buildVideoFilter — 快捷筛选 Set 合流（§2.6③）', () => {
  it('quickFilters undefined → 三派生字段 undefined', () => {
    const filter = buildVideoFilter(makeSnapshot())
    expect(filter.pendingReview).toBeUndefined()
    expect(filter.metaIncomplete).toBeUndefined()
    expect(filter.episodeMismatch).toBeUndefined()
  })

  it('Set 含 key → 对应 boolean true（仅 true）', () => {
    const set = new Set<VideoQuickFilterKey>(['pendingReview', 'episodeMismatch'])
    const filter = buildVideoFilter(makeSnapshot(), set)
    expect(filter.pendingReview).toBe(true)
    expect(filter.episodeMismatch).toBe(true)
    // 未选中 → undefined（不发送 false）
    expect(filter.metaIncomplete).toBeUndefined()
  })

  it('空 Set → 全部 undefined', () => {
    const filter = buildVideoFilter(makeSnapshot(), new Set())
    expect(filter.pendingReview).toBeUndefined()
    expect(filter.metaIncomplete).toBeUndefined()
    expect(filter.episodeMismatch).toBeUndefined()
  })

  it('快捷筛选与列筛选/排序可共存', () => {
    const snapshot = makeSnapshot({
      filters: new Map([['type', { kind: 'enum', value: ['anime'] }]]),
      sort: { field: 'meta', direction: 'desc' },
    })
    const filter = buildVideoFilter(snapshot, new Set<VideoQuickFilterKey>(['metaIncomplete']))
    expect(filter.type).toBe('anime')
    // META-36-C：meta 复合列改按「已匹配源数量」metadata_matched_count 排序（取代运营优先级 metadata_status）
    expect(filter.sortField).toBe('metadata_matched_count')
    expect(filter.metaIncomplete).toBe(true)
  })
})

// ── buildVideoFilter — sort + pagination ─────────────────────────

describe('buildVideoFilter — sort + pagination', () => {
  it('sort field + direction → sortField/sortDir', () => {
    const filter = buildVideoFilter(makeSnapshot({ sort: { field: 'created_at', direction: 'desc' } }))
    expect(filter.sortField).toBe('created_at')
    expect(filter.sortDir).toBe('desc')
  })

  it('pagination page=3 + pageSize=50 → page/limit', () => {
    const filter = buildVideoFilter(makeSnapshot({ pagination: { page: 3, pageSize: 50 } }))
    expect(filter.page).toBe(3)
    expect(filter.limit).toBe(50)
  })
})

// ── option / 快捷筛选常量 完整性 ──────────────────────────────────

describe('filter option 常量', () => {
  it('VIDEO_TYPE_OPTIONS 含 11 种类型', () => {
    expect(VIDEO_TYPE_OPTIONS).toHaveLength(11)
    expect(VIDEO_TYPE_OPTIONS.map((o) => o.value)).toContain('movie')
    expect(VIDEO_TYPE_OPTIONS.map((o) => o.value)).toContain('other')
  })

  it('VIDEO_STATUS_OPTIONS 含 published/pending/all', () => {
    const values = VIDEO_STATUS_OPTIONS.map((o) => o.value)
    expect(values).toContain('published')
    expect(values).toContain('pending')
    expect(values).toContain('all')
  })

  it('VISIBILITY_OPTIONS 含 public/internal/hidden', () => {
    const values = VISIBILITY_OPTIONS.map((o) => o.value)
    expect(values).toEqual(expect.arrayContaining(['public', 'internal', 'hidden']))
  })

  it('REVIEW_STATUS_OPTIONS 含 pending_review/approved/rejected', () => {
    const values = REVIEW_STATUS_OPTIONS.map((o) => o.value)
    expect(values).toEqual(expect.arrayContaining(['pending_review', 'approved', 'rejected']))
  })

  it('VIDEO_QUICK_FILTERS = 待审/元数据缺失/集数不一致 + META-36-A 元数据运营快捷（需复核/有候选/未增强/TMDB 待处理）', () => {
    expect(VIDEO_QUICK_FILTERS.map((q) => q.key)).toEqual([
      'pendingReview', 'metaIncomplete', 'episodeMismatch',
      'metadataNeedsReview', 'metadataHasCandidate', 'metadataMissing', 'metadataTmdbPending',
    ])
    expect(VIDEO_QUICK_FILTERS.map((q) => q.label)).toEqual([
      '待审', '元数据缺失', '集数不一致', '需复核', '有候选', '未增强', 'TMDB 待处理',
    ])
  })
})

/**
 * VideoListClient 辅助函数单测（CHG-SN-3-04）
 *
 * 覆盖：
 * - buildVideoFilter: snapshot → VideoListFilter 映射（含 q / type / status / visibility /
 *   reviewStatus / site / sort / pagination）
 * - buildFilterChips: 空 / 单 / 多 filter → chip 数组
 * - VIDEO_TYPE_OPTIONS / VISIBILITY_OPTIONS / REVIEW_STATUS_OPTIONS 完整性
 *
 * 注：VideoListClient 组件集成测试依赖 next/navigation mock + listVideos mock，
 * 因 vitest.config.ts 中 @ 别名当前未含 server-next 路径，组件级测试待 CHG-SN-3-14 配置更新后追加。
 */

import { describe, it, expect, vi } from 'vitest'
import {
  buildVideoFilter,
  buildFilterChips,
  VIDEO_TYPE_OPTIONS,
  VIDEO_STATUS_OPTIONS,
  VISIBILITY_OPTIONS,
  REVIEW_STATUS_OPTIONS,
} from '../../../../../../apps/server-next/src/app/admin/videos/_client/VideoFilterFields'
import type { TableQuerySnapshot } from '../../../../../../packages/admin-ui/src/components/data-table/types'

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

// ── buildVideoFilter ──────────────────────────────────────────────

describe('buildVideoFilter — 空 snapshot', () => {
  it('空 filters → 全部字段 undefined（除 page/limit/sortDir）', () => {
    const filter = buildVideoFilter(makeSnapshot())
    expect(filter.q).toBeUndefined()
    expect(filter.type).toBeUndefined()
    expect(filter.status).toBeUndefined()
    expect(filter.visibilityStatus).toBeUndefined()
    expect(filter.reviewStatus).toBeUndefined()
    expect(filter.site).toBeUndefined()
  })

  it('默认 pagination → page=1, limit=20', () => {
    const filter = buildVideoFilter(makeSnapshot())
    expect(filter.page).toBe(1)
    expect(filter.limit).toBe(20)
  })

  it('默认 sort → sortField=undefined, sortDir="asc"', () => {
    const filter = buildVideoFilter(makeSnapshot())
    expect(filter.sortField).toBeUndefined()
    expect(filter.sortDir).toBe('asc')
  })
})

describe('buildVideoFilter — text filter', () => {
  it('q text filter → filter.q', () => {
    const snapshot = makeSnapshot({
      filters: new Map([['q', { kind: 'text', value: '星际穿越' }]]),
    })
    const filter = buildVideoFilter(snapshot)
    expect(filter.q).toBe('星际穿越')
  })

  it('q text filter 空字符串 → filter.q=undefined', () => {
    const snapshot = makeSnapshot({
      filters: new Map([['q', { kind: 'text', value: '' }]]),
    })
    const filter = buildVideoFilter(snapshot)
    expect(filter.q).toBeUndefined()
  })
})

describe('buildVideoFilter — enum filters', () => {
  it('type enum → filter.type', () => {
    const snapshot = makeSnapshot({
      filters: new Map([['type', { kind: 'enum', value: ['movie'] }]]),
    })
    expect(buildVideoFilter(snapshot).type).toBe('movie')
  })

  it('status enum → filter.status', () => {
    const snapshot = makeSnapshot({
      filters: new Map([['status', { kind: 'enum', value: ['published'] }]]),
    })
    expect(buildVideoFilter(snapshot).status).toBe('published')
  })

  it('visibilityStatus enum → filter.visibilityStatus', () => {
    const snapshot = makeSnapshot({
      filters: new Map([['visibilityStatus', { kind: 'enum', value: ['hidden'] }]]),
    })
    expect(buildVideoFilter(snapshot).visibilityStatus).toBe('hidden')
  })

  it('reviewStatus enum → filter.reviewStatus', () => {
    const snapshot = makeSnapshot({
      filters: new Map([['reviewStatus', { kind: 'enum', value: ['approved'] }]]),
    })
    expect(buildVideoFilter(snapshot).reviewStatus).toBe('approved')
  })

  it('site enum → filter.site', () => {
    const snapshot = makeSnapshot({
      filters: new Map([['site', { kind: 'enum', value: ['bilibili'] }]]),
    })
    expect(buildVideoFilter(snapshot).site).toBe('bilibili')
  })
})

describe('buildVideoFilter — sort + pagination', () => {
  it('sort field + direction → sortField/sortDir', () => {
    const snapshot = makeSnapshot({
      sort: { field: 'created_at', direction: 'desc' },
    })
    const filter = buildVideoFilter(snapshot)
    expect(filter.sortField).toBe('created_at')
    expect(filter.sortDir).toBe('desc')
  })

  it('pagination page=3 + pageSize=50 → page/limit', () => {
    const snapshot = makeSnapshot({
      pagination: { page: 3, pageSize: 50 },
    })
    const filter = buildVideoFilter(snapshot)
    expect(filter.page).toBe(3)
    expect(filter.limit).toBe(50)
  })
})

// ── buildFilterChips ──────────────────────────────────────────────

describe('buildFilterChips', () => {
  it('空 filters → 空 chips 数组', () => {
    expect(buildFilterChips(makeSnapshot(), vi.fn())).toHaveLength(0)
  })

  it('q filter → 1 chip，label="搜索"，value=搜索词', () => {
    const snapshot = makeSnapshot({
      filters: new Map([['q', { kind: 'text', value: '星际' }]]),
    })
    const chips = buildFilterChips(snapshot, vi.fn())
    expect(chips).toHaveLength(1)
    expect(chips[0]?.label).toBe('搜索')
    expect(chips[0]?.value).toBe('星际')
    expect(chips[0]?.id).toBe('q')
  })

  it('type enum → chip value 为中文标签（movie → 电影）', () => {
    const snapshot = makeSnapshot({
      filters: new Map([['type', { kind: 'enum', value: ['movie'] }]]),
    })
    const chips = buildFilterChips(snapshot, vi.fn())
    expect(chips[0]?.value).toBe('电影')
  })

  it('多 filter → 多 chip，onClear 对应 key', () => {
    const onClear = vi.fn()
    const snapshot = makeSnapshot({
      filters: new Map([
        ['type', { kind: 'enum', value: ['series'] }],
        ['reviewStatus', { kind: 'enum', value: ['pending_review'] }],
      ]),
    })
    const chips = buildFilterChips(snapshot, onClear)
    expect(chips).toHaveLength(2)
    chips[0]?.onClear()
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('enum value 空数组 → 不产生 chip', () => {
    const snapshot = makeSnapshot({
      filters: new Map([['type', { kind: 'enum', value: [] }]]),
    })
    expect(buildFilterChips(snapshot, vi.fn())).toHaveLength(0)
  })
})

// ── option constants 完整性 ───────────────────────────────────────

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
    expect(values).toContain('public')
    expect(values).toContain('internal')
    expect(values).toContain('hidden')
  })

  it('REVIEW_STATUS_OPTIONS 含 pending_review/approved/rejected', () => {
    const values = REVIEW_STATUS_OPTIONS.map((o) => o.value)
    expect(values).toContain('pending_review')
    expect(values).toContain('approved')
    expect(values).toContain('rejected')
  })
})

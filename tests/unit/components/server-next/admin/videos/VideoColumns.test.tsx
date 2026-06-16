/**
 * VideoColumns.test.tsx — 视频库列重构单测（CHG-VSR-4-A / 设计 §2.2/§2.3/§2.4/§2.5/§2.6）
 *
 * 覆盖：
 *   1. 列集结构：默认可见列 = §2.2；可选/原子列默认隐藏；列顺序
 *   2. 复合显示列只读不挂筛选（release/episodes/meta/status filterable:false）+ sortable
 *   3. 筛选面 = title(q)/type/visibility/review_status（既有可用），其余 filterable:false
 *   4. §2.4 集数降级 render（电影 / 三值 / 已播>收录 warn / 仅收录 / 全空）
 *   5. release / status 复合 render
 *   6. buildVideoFilter 排序映射（复合列 id → 后端 sortField）
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { buildVideoColumns } from '../../../../../../apps/server-next/src/app/admin/videos/_client/VideoColumns'
import { buildVideoFilter } from '../../../../../../apps/server-next/src/app/admin/videos/_client/VideoFilterFields'
import type { VideoAdminRow } from '../../../../../../apps/server-next/src/lib/videos'
import { VIDEO_COLUMN_DESCRIPTORS } from '../../../../../../apps/server-next/src/lib/videos/columns'
import type { TableColumn, TableQuerySnapshot } from '../../../../../../packages/admin-ui/src/components/data-table/types'

// ── test helpers ──────────────────────────────────────────────────

function makeRow(overrides: Partial<VideoAdminRow> = {}): VideoAdminRow {
  return {
    id: 'vid-1',
    short_id: 'abc1234',
    title: '示例视频',
    title_en: 'Sample Video',
    cover_url: null,
    type: 'series',
    year: 2024,
    is_published: false,
    source_count: '3',
    active_source_count: '3',
    visibility_status: 'public',
    review_status: 'approved',
    created_at: '2026-05-15T10:00:00Z',
    updated_at: '2026-05-20T10:00:00Z',
    title_original: '示例原名',
    country: 'CN',
    status: 'completed',
    episode_count: 12,
    current_episodes: 10,
    total_episodes: 12,
    douban_status: 'matched',
    bangumi_status: 'pending',
    meta_score: 80,
    ...overrides,
  }
}

const cols = () => buildVideoColumns(false, vi.fn(), vi.fn(), [], [], [])

function colById(id: string): TableColumn<VideoAdminRow> {
  const c = cols().find((col) => col.id === id)
  if (!c) throw new Error(`column ${id} not found`)
  return c
}

function renderCell(id: string, row: VideoAdminRow): ReactNode {
  const col = colById(id)
  return col.cell ? col.cell({ row, value: col.accessor(row), rowIndex: 0 }) : null
}

function makeSnapshot(field: string | undefined): TableQuerySnapshot {
  return {
    pagination: { page: 1, pageSize: 20 },
    sort: { field, direction: 'desc' },
    filters: new Map(),
    columns: new Map(),
    selection: { selectedKeys: new Set(), mode: 'page' },
  }
}

// ── 1. 列集结构（§2.2/§2.3/§2.6②）────────────────────────────────

describe('buildVideoColumns — 列集结构', () => {
  it('默认可见列 = §2.2（cover/title/type/release/episodes/meta/status/updated_at/actions）', () => {
    const visible = cols().filter((c) => c.defaultVisible !== false).map((c) => c.id)
    expect(visible).toEqual([
      'cover', 'title', 'type', 'release', 'episodes', 'meta', 'status', 'updated_at', 'actions',
    ])
  })

  it('§2.3 可选列 source_health/probe/image_health 默认隐藏', () => {
    for (const id of ['source_health', 'probe', 'image_health']) {
      expect(colById(id).defaultVisible).toBe(false)
    }
  })

  it('§2.6② 原子列 year/country/catalog_status/visibility/review_status/is_published/douban_status/bangumi_status/meta_score 默认隐藏', () => {
    for (const id of [
      'year', 'country', 'catalog_status', 'visibility', 'review_status',
      'is_published', 'douban_status', 'bangumi_status', 'meta_score',
    ]) {
      expect(colById(id).defaultVisible).toBe(false)
    }
  })
})

// ── 2/3. 筛选面收敛（§2.6 复合列只读）────────────────────────────

describe('buildVideoColumns — 筛选面（§2.6）', () => {
  it('复合显示列 release/episodes/status 只读不挂筛选（filterable:false）', () => {
    // META-36-C：meta 列改为可筛选（「已匹配源」OR 过滤），不再属只读复合列。
    for (const id of ['release', 'episodes', 'status']) {
      expect((colById(id) as { filterable?: boolean }).filterable).toBe(false)
    }
  })

  it('META-36-C: meta 列挂「已匹配源」enum 过滤（metadataMatched，四源 + 未匹配哨兵）', () => {
    type FCol = { filterable?: boolean; filterKind?: string; filterFieldName?: string; filterOptions?: readonly { value: string }[] }
    const meta = colById('meta') as FCol
    expect(meta.filterable).toBe(true)
    expect(meta).toMatchObject({ filterKind: 'enum', filterFieldName: 'metadataMatched' })
    const values = (meta.filterOptions ?? []).map((o) => o.value)
    expect(values).toEqual(['douban', 'bangumi', 'tmdb', 'imdb', 'none'])
  })

  it('复合显示列 release/episodes/meta/status 可排序（enableSorting:true）', () => {
    for (const id of ['release', 'episodes', 'meta', 'status']) {
      expect(colById(id).enableSorting).toBe(true)
    }
  })

  it('筛选面 = title/type + 原子列 + META-36-A 元数据多维列(metadata_overall/provider/issue_level/updated)', () => {
    const filterable = cols()
      .filter((c) => (c as { filterable?: boolean }).filterable === true)
      .map((c) => c.id)
    expect(filterable.sort()).toEqual([
      'bangumi_status', 'catalog_status', 'country', 'douban_status', 'is_published',
      'meta', 'meta_score', 'metadata_issue_level', 'metadata_overall', 'metadata_provider', 'metadata_updated',
      'review_status', 'title', 'type', 'visibility', 'year',
    ])
  })

  it('原子列 filterKind/filterFieldName 接线（§2.6② → ADR-150 AMD3 入参）', () => {
    type FCol = { filterKind?: string; filterFieldName?: string; filterDistinctTable?: string; filterOptions?: readonly unknown[] }
    expect((colById('year') as FCol)).toMatchObject({ filterKind: 'number', filterFieldName: 'year' })
    expect((colById('meta_score') as FCol)).toMatchObject({ filterKind: 'number', filterFieldName: 'metaScore' })
    expect((colById('catalog_status') as FCol)).toMatchObject({ filterKind: 'enum', filterFieldName: 'catalogStatus' })
    expect((colById('is_published') as FCol)).toMatchObject({ filterKind: 'enum', filterFieldName: 'isPublished' })
    expect((colById('douban_status') as FCol)).toMatchObject({ filterKind: 'enum', filterFieldName: 'doubanStatus' })
    expect((colById('bangumi_status') as FCol)).toMatchObject({ filterKind: 'enum', filterFieldName: 'bangumiStatus' })
    // country 走 distinct（无静态 filterOptions）
    const country = colById('country') as FCol
    expect(country).toMatchObject({ filterKind: 'enum', filterFieldName: 'country', filterDistinctTable: 'media_catalog' })
    expect(country.filterOptions).toBeUndefined()
  })
})

// ── 4. §2.4 集数降级 ──────────────────────────────────────────────

describe('EpisodesCell — §2.4 集数降级', () => {
  it('电影 → 整列 —', () => {
    render(<>{renderCell('episodes', makeRow({ type: 'movie' }))}</>)
    expect(screen.getByTestId('episodes-cell').textContent).toBe('—')
    cleanup()
  })

  it('三值齐全（已播≤收录）→ 收录 N · 已播 M / 共 K，无 warn 提示', () => {
    render(<>{renderCell('episodes', makeRow({ episode_count: 12, current_episodes: 10, total_episodes: 12 }))}</>)
    const cell = screen.getByTestId('episodes-cell')
    expect(cell.textContent).toContain('收录 12')
    expect(cell.textContent).toContain('已播 10')
    expect(cell.textContent).toContain('共 12')
    expect(cell.getAttribute('title')).toBeNull()
    cleanup()
  })

  it('已播 > 收录 → hover「外部数据领先于已收录」提示', () => {
    render(<>{renderCell('episodes', makeRow({ episode_count: 10, current_episodes: 12, total_episodes: 12 }))}</>)
    expect(screen.getByTestId('episodes-cell').getAttribute('title')).toBe('外部数据领先于已收录')
    cleanup()
  })

  it('仅有收录（已播/共 缺失）→ 收录 N', () => {
    render(<>{renderCell('episodes', makeRow({ episode_count: 12, current_episodes: null, total_episodes: null }))}</>)
    expect(screen.getByTestId('episodes-cell').textContent).toBe('收录 12')
    cleanup()
  })

  it('全空（episode_count null）→ —', () => {
    render(<>{renderCell('episodes', makeRow({ type: 'series', episode_count: undefined, current_episodes: null, total_episodes: null }))}</>)
    expect(screen.getByTestId('episodes-cell').textContent).toBe('—')
    cleanup()
  })
})

// ── 5. release / status 复合 render ──────────────────────────────

describe('复合列 render', () => {
  it('ReleaseCell → year · 国家 + 完结 Pill（status=completed）', () => {
    render(<>{renderCell('release', makeRow({ year: 2024, country: 'CN', status: 'completed' }))}</>)
    const cell = screen.getByTestId('release-cell')
    expect(cell.textContent).toContain('2024')
    expect(cell.textContent).toContain('完结')
    cleanup()
  })

  it('ReleaseCell → 连载（status=ongoing）', () => {
    render(<>{renderCell('release', makeRow({ status: 'ongoing' }))}</>)
    expect(screen.getByTestId('release-cell').textContent).toContain('连载')
    cleanup()
  })

  it('ReleaseCell → 未知（status 缺失）', () => {
    render(<>{renderCell('release', makeRow({ status: undefined }))}</>)
    expect(screen.getByTestId('release-cell').textContent).toContain('未知')
    cleanup()
  })

  it('StatusCell → 已上架（is_published=true）', () => {
    render(<>{renderCell('status', makeRow({ is_published: true }))}</>)
    expect(screen.getByTestId('status-cell').textContent).toContain('已上架')
    cleanup()
  })

  it('StatusCell → 草稿（is_published=false）', () => {
    render(<>{renderCell('status', makeRow({ is_published: false }))}</>)
    expect(screen.getByTestId('status-cell').textContent).toContain('草稿')
    cleanup()
  })

  it('title 副行 = title_en ?? title_original · short_id', () => {
    render(<>{renderCell('title', makeRow({ title_en: 'EN Name', title_original: '原名', short_id: 'xyz9' }))}</>)
    expect(screen.getByText('EN Name · xyz9')).toBeTruthy()
    cleanup()
  })

  it('title 副行 title_en 缺失 → fallback title_original', () => {
    render(<>{renderCell('title', makeRow({ title_en: null, title_original: '原名兜底', short_id: 'xyz9' }))}</>)
    expect(screen.getByText('原名兜底 · xyz9')).toBeTruthy()
    cleanup()
  })
})

// ── 6. buildVideoFilter 排序映射（§2.2/§2.5）──────────────────────

describe('buildVideoFilter — 复合列排序映射', () => {
  it('release → year', () => {
    expect(buildVideoFilter(makeSnapshot('release')).sortField).toBe('year')
  })
  it('episodes → episode_count', () => {
    expect(buildVideoFilter(makeSnapshot('episodes')).sortField).toBe('episode_count')
  })
  it('META-36-C: meta → metadata_matched_count（已匹配源数量，取代运营优先级 metadata_status）', () => {
    expect(buildVideoFilter(makeSnapshot('meta')).sortField).toBe('metadata_matched_count')
  })
  it('META-36-A: meta_score → metadata_score（完整度数值独立排序字段）', () => {
    expect(buildVideoFilter(makeSnapshot('meta_score')).sortField).toBe('metadata_score')
  })
  it('status → review_status', () => {
    expect(buildVideoFilter(makeSnapshot('status')).sortField).toBe('review_status')
  })
  it('updated_at 直通（id 同后端字段）', () => {
    expect(buildVideoFilter(makeSnapshot('updated_at')).sortField).toBe('updated_at')
  })
  it('title/source_health/created_at 直通', () => {
    expect(buildVideoFilter(makeSnapshot('title')).sortField).toBe('title')
    expect(buildVideoFilter(makeSnapshot('source_health')).sortField).toBe('source_health')
    expect(buildVideoFilter(makeSnapshot('created_at')).sortField).toBe('created_at')
  })
  it('非白名单 sort.field → undefined（守卫）', () => {
    expect(buildVideoFilter(makeSnapshot('bogus')).sortField).toBeUndefined()
    expect(buildVideoFilter(makeSnapshot(undefined)).sortField).toBeUndefined()
  })
})

// ── META-36-A: 元数据多维过滤列 + buildVideoFilter 映射 ──────────────

import type { FilterValue } from '../../../../../../packages/admin-ui/src/components/data-table/types'
import { VIDEO_QUICK_FILTERS, type VideoQuickFilterKey } from '../../../../../../apps/server-next/src/app/admin/videos/_client/VideoFilterFields'

function snapshotWithFilters(filters: Map<string, FilterValue>): TableQuerySnapshot {
  return {
    pagination: { page: 1, pageSize: 20 },
    sort: { field: undefined, direction: 'desc' },
    filters,
    columns: new Map(),
    selection: { selectedKeys: new Set(), mode: 'page' },
  }
}

describe('META-36-A 元数据过滤列接线（filterKind/filterFieldName/filterOptions）', () => {
  type FCol = { filterKind?: string; filterFieldName?: string; filterOptions?: readonly { value: string }[] }
  it('metadata_overall = enum/metadataOverall + 5 态选项', () => {
    const c = colById('metadata_overall') as FCol
    expect(c).toMatchObject({ filterKind: 'enum', filterFieldName: 'metadataOverall' })
    expect(c.filterOptions?.map((o) => o.value)).toEqual(['needs_review', 'candidate', 'missing', 'partial', 'complete'])
  })
  it('metadata_provider = enum/metadataProvider + 四源选项（固定顺序）', () => {
    const c = colById('metadata_provider') as FCol
    expect(c).toMatchObject({ filterKind: 'enum', filterFieldName: 'metadataProvider' })
    expect(c.filterOptions?.map((o) => o.value)).toEqual(['douban', 'bangumi', 'tmdb', 'imdb'])
  })
  it('metadata_issue_level = enum/metadataIssueLevel + 4 级选项', () => {
    const c = colById('metadata_issue_level') as FCol
    expect(c).toMatchObject({ filterKind: 'enum', filterFieldName: 'metadataIssueLevel' })
    expect(c.filterOptions?.map((o) => o.value)).toEqual(['none', 'info', 'warn', 'danger'])
  })
  it('metadata_updated = date/metadataUpdated（date-range）', () => {
    expect(colById('metadata_updated') as FCol).toMatchObject({ filterKind: 'date', filterFieldName: 'metadataUpdated' })
  })
  it('4 个元数据过滤列默认隐藏 + 不可排序（filter-only）', () => {
    for (const id of ['metadata_overall', 'metadata_provider', 'metadata_issue_level', 'metadata_updated']) {
      expect(colById(id).defaultVisible).toBe(false)
      expect(colById(id).enableSorting).toBe(false)
    }
  })
})

describe('META-36-A buildVideoFilter — 元数据过滤映射', () => {
  it('overall/provider/issue enum 多选 → 数组透传', () => {
    const filters = new Map<string, FilterValue>([
      ['metadataOverall', { kind: 'enum', value: ['needs_review', 'candidate'] }],
      ['metadataProvider', { kind: 'enum', value: ['douban', 'tmdb'] }],
      ['metadataIssueLevel', { kind: 'enum', value: ['danger'] }],
    ])
    const f = buildVideoFilter(snapshotWithFilters(filters))
    expect(f.metadataOverall).toEqual(['needs_review', 'candidate'])
    expect(f.metadataProvider).toEqual(['douban', 'tmdb'])
    expect(f.metadataIssueLevel).toEqual(['danger'])
  })
  it('metadataUpdated date-range → metadataUpdatedFrom/To', () => {
    const filters = new Map<string, FilterValue>([
      ['metadataUpdated', { kind: 'date-range', from: '2026-01-01T00:00:00Z', to: '2026-06-14T00:00:00Z' }],
    ])
    const f = buildVideoFilter(snapshotWithFilters(filters))
    expect(f.metadataUpdatedFrom).toBe('2026-01-01T00:00:00Z')
    expect(f.metadataUpdatedTo).toBe('2026-06-14T00:00:00Z')
  })
  it('空过滤 → 元数据字段全 undefined（不污染默认查询）', () => {
    const f = buildVideoFilter(snapshotWithFilters(new Map()))
    expect(f.metadataOverall).toBeUndefined()
    expect(f.metadataProvider).toBeUndefined()
    expect(f.metadataIssueLevel).toBeUndefined()
    expect(f.metadataUpdatedFrom).toBeUndefined()
    expect(f.metadataUpdatedTo).toBeUndefined()
  })
  it('元数据快捷筛选 Set → 派生 boolean（仅命中 true，未命中 undefined）', () => {
    const quick = new Set<VideoQuickFilterKey>(['metadataNeedsReview', 'metadataHasCandidate'])
    const f = buildVideoFilter(snapshotWithFilters(new Map()), quick)
    expect(f.metadataNeedsReview).toBe(true)
    expect(f.metadataHasCandidate).toBe(true)
    expect(f.metadataMissing).toBeUndefined()
    expect(f.metadataTmdbPending).toBeUndefined()
  })
  it('VIDEO_QUICK_FILTERS 含 4 个元数据运营快捷入口', () => {
    const keys = VIDEO_QUICK_FILTERS.map((q) => q.key)
    expect(keys).toContain('metadataNeedsReview')
    expect(keys).toContain('metadataHasCandidate')
    expect(keys).toContain('metadataMissing')
    expect(keys).toContain('metadataTmdbPending')
  })
})

// ── 7. probe 探测/播放列接真数据（SRCHEALTH-P1-1-B / B1）──────────

describe('probe 列 — 探测/播放双信号接真数据', () => {
  it('四态映射：source/render_check_status → DualSignal data-state（all_dead→dead）', () => {
    const { container } = render(
      <>{renderCell('probe', makeRow({ source_check_status: 'ok', render_check_status: 'all_dead' }))}</>,
    )
    expect(container.querySelector('[data-dual-signal-row="probe"]')?.getAttribute('data-state')).toBe('ok')
    expect(container.querySelector('[data-dual-signal-row="render"]')?.getAttribute('data-state')).toBe('dead')
    cleanup()
  })

  it('字段缺失（旧行 / 无 active 源 NULL）→ unknown，不再硬编码占位', () => {
    const { container } = render(
      <>{renderCell('probe', makeRow({ source_check_status: undefined, render_check_status: undefined }))}</>,
    )
    expect(container.querySelector('[data-dual-signal-row="probe"]')?.getAttribute('data-state')).toBe('unknown')
    expect(container.querySelector('[data-dual-signal-row="render"]')?.getAttribute('data-state')).toBe('unknown')
    cleanup()
  })

  it('partial/pending 直通映射', () => {
    const { container } = render(
      <>{renderCell('probe', makeRow({ source_check_status: 'partial', render_check_status: 'pending' }))}</>,
    )
    expect(container.querySelector('[data-dual-signal-row="probe"]')?.getAttribute('data-state')).toBe('partial')
    expect(container.querySelector('[data-dual-signal-row="render"]')?.getAttribute('data-state')).toBe('pending')
    cleanup()
  })

  it('排序恢复：enableSorting=true + 复合列映射 probe→source_check_status + render_check_status 直通白名单', () => {
    expect(colById('probe').enableSorting).toBe(true)
    expect(buildVideoFilter(makeSnapshot('probe')).sortField).toBe('source_check_status')
    expect(buildVideoFilter(makeSnapshot('render_check_status')).sortField).toBe('render_check_status')
  })

  it('descriptors 与 buildVideoColumns enableSorting 逐列对齐（probe 列防漂移，Codex review 拦截项）', () => {
    const descriptor = VIDEO_COLUMN_DESCRIPTORS.find((d) => d.id === 'probe')
    expect(descriptor?.enableSorting).toBe(true)
    expect(descriptor?.enableSorting).toBe(colById('probe').enableSorting)
  })
})

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
  it('复合显示列 release/episodes/meta/status 只读不挂筛选（filterable:false）', () => {
    for (const id of ['release', 'episodes', 'meta', 'status']) {
      expect((colById(id) as { filterable?: boolean }).filterable).toBe(false)
    }
  })

  it('复合显示列 release/episodes/meta/status 可排序（enableSorting:true）', () => {
    for (const id of ['release', 'episodes', 'meta', 'status']) {
      expect(colById(id).enableSorting).toBe(true)
    }
  })

  it('4-A 筛选面 = title/type/visibility/review_status（既有可用），其余 filterable 非 true', () => {
    const filterable = cols()
      .filter((c) => (c as { filterable?: boolean }).filterable === true)
      .map((c) => c.id)
    expect(filterable.sort()).toEqual(['review_status', 'title', 'type', 'visibility'])
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
  it('meta → meta_score', () => {
    expect(buildVideoFilter(makeSnapshot('meta')).sortField).toBe('meta_score')
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

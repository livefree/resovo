/**
 * enrichment-cluster-faces.test.tsx — META-11 / feature-2 富集徽标簇接入单测
 *
 * 覆盖 2 数据就绪消费面：
 *   Face 1 视频库列表（VideoListClient `enrichment` 列 / density='row'）
 *   Face 2 编辑抽屉（VideoEditDrawer QUICK_HEAD / density='header'）
 *
 * 真源：EnrichmentBadgeCluster（ADR-172 / META-10）+ EnrichmentSummary（ADR-170）
 */
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import type { EnrichmentSummary } from '@resovo/types'
import { VIDEO_COLUMN_DESCRIPTORS } from '../../../../../../apps/server-next/src/lib/videos/columns'
import type {
  VideoAdminRow,
  VideoAdminDetail,
} from '../../../../../../apps/server-next/src/lib/videos/types'

// ── mocks（VideoListClient + VideoEditDrawer 组件级依赖）──────────────

const listVideosMock = vi.fn()
const getVideoMock = vi.fn()

vi.mock('@/lib/videos/api', () => ({
  listVideos: (...a: unknown[]) => listVideosMock(...a),
  getVideo: (...a: unknown[]) => getVideoMock(...a),
  patchVideoMeta: vi.fn(),
  createVideo: vi.fn(),
  batchPublish: vi.fn(),
  batchUnpublish: vi.fn(),
  reviewVideo: vi.fn(),
  fetchDistinct: vi.fn(() => Promise.resolve([])),
}))

vi.mock('@/lib/crawler/api', () => ({
  listCrawlerSites: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/api-client', () => ({
  ApiClientError: class extends Error {
    constructor(message: string, public readonly status?: number) { super(message) }
  },
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/admin/videos',
}))

// Drawer stub（保留真实 EnrichmentBadgeCluster：仅替换 Drawer 容器）
vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    Drawer: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
      open ? <div data-testid="drawer-stub">{children}</div> : null,
  }
})

import { VideoListClient } from '../../../../../../apps/server-next/src/app/admin/videos/_client/VideoListClient'
import { VideoEditDrawer } from '../../../../../../apps/server-next/src/app/admin/videos/_client/VideoEditDrawer'

afterEach(() => cleanup())

// ── fixtures ─────────────────────────────────────────────────────

function makeSummary(over: Partial<EnrichmentSummary> = {}): EnrichmentSummary {
  return {
    doubanStatus: 'matched',
    bangumiStatus: 'matched',
    sourceCheckStatus: 'ok',
    metaScore: 88,
    enrichedAt: '2026-05-30T12:00:00Z',
    titleEnIsPinyin: false,
    doubanConfidence: 0.9,
    bangumiSubjectId: 8,
    doubanId: '1292052',
    tmdbId: 27205,
    imdbId: 'tt1375666',
    ...over,
  }
}

function makeRow(over: Partial<VideoAdminRow> = {}): VideoAdminRow {
  return {
    id: 'v1', short_id: 'abc', title: '某番', title_en: null, cover_url: null,
    type: 'anime', year: 2024, is_published: true, source_count: '1',
    visibility_status: 'public', review_status: 'approved',
    created_at: '2024-01-01T00:00:00Z',
    enrichmentSummary: makeSummary(),
    ...over,
  }
}

function makeDetail(over: Partial<VideoAdminDetail> = {}): VideoAdminDetail {
  return {
    ...makeRow(),
    description: null, title_en: null, genres: [], country: null,
    episode_count: 12, status: 'completed', rating: null,
    director: [], cast: [], writers: [], douban_id: null,
    ...over,
  }
}

// ── Face 1a：列描述符注册 ─────────────────────────────────────────

describe('feature-2 Face 1 — 视频库 enrichment 列注册', () => {
  it('VIDEO_COLUMN_DESCRIPTORS 含 meta 元数据列（默认可见 / CHG-VSR-4-A enrichment→meta 重命名）', () => {
    const col = VIDEO_COLUMN_DESCRIPTORS.find((c) => c.id === 'meta')
    expect(col).toBeTruthy()
    expect(col!.defaultVisible).toBe(true)
  })

  it('douban_status / meta_score 隐藏列保留（ADR-170 排序契约）', () => {
    const douban = VIDEO_COLUMN_DESCRIPTORS.find((c) => c.id === 'douban_status')
    const meta = VIDEO_COLUMN_DESCRIPTORS.find((c) => c.id === 'meta_score')
    expect(douban?.defaultVisible).toBe(false)
    expect(meta?.defaultVisible).toBe(false)
  })
})

// ── Face 1b：视频库行渲染簇 ───────────────────────────────────────

describe('feature-2 Face 1 — 视频库行渲染 EnrichmentBadgeCluster', () => {
  beforeEach(() => vi.clearAllMocks())

  it('anime 行 → 渲染簇（density=row）+ 含 bangumi 徽标', async () => {
    listVideosMock.mockResolvedValue({ data: [makeRow({ type: 'anime' })], total: 1, page: 1, limit: 20 })
    const { container } = render(<VideoListClient />)
    await waitFor(() => {
      expect(container.querySelector('[data-enrichment-badge-cluster][data-density="row"]')).toBeTruthy()
    })
    const cluster = container.querySelector('[data-enrichment-badge-cluster]')!
    expect(cluster.querySelector('[data-source="bangumi"]')).toBeTruthy()
  })

  it('movie 行 → 簇不含 bangumi 徽标（anime-only 门控）', async () => {
    listVideosMock.mockResolvedValue({ data: [makeRow({ type: 'movie' })], total: 1, page: 1, limit: 20 })
    const { container } = render(<VideoListClient />)
    await waitFor(() => expect(container.querySelector('[data-enrichment-badge-cluster]')).toBeTruthy())
    expect(container.querySelector('[data-source="bangumi"]')).toBeNull()
    expect(container.querySelector('[data-source="douban"]')).toBeTruthy()
  })

  it('行无 enrichmentSummary → 不渲染簇', async () => {
    listVideosMock.mockResolvedValue({ data: [makeRow({ enrichmentSummary: undefined })], total: 1, page: 1, limit: 20 })
    const { container } = render(<VideoListClient />)
    // CHG-VSR-4-A：source_health 列降级默认隐藏（§2.3），改等 title 列行渲染（始终可见）作锚点
    await screen.findByText('某番')
    expect(container.querySelector('[data-enrichment-badge-cluster]')).toBeNull()
  })
})

// ── Face 2：编辑抽屉 QUICK_HEAD 簇 ────────────────────────────────

describe('feature-2 Face 2 — 编辑抽屉头部 EnrichmentBadgeCluster', () => {
  beforeEach(() => vi.clearAllMocks())

  it('anime 详情 → header 簇含 bangumi + 富集时间', async () => {
    getVideoMock.mockResolvedValue(makeDetail({ type: 'anime', enrichmentSummary: makeSummary() }))
    const { container } = render(<VideoEditDrawer open videoId="v1" onClose={vi.fn()} onSaved={vi.fn()} />)
    await waitFor(() => expect(container.querySelector('[data-enrichment-badge-cluster][data-density="header"]')).toBeTruthy())
    const cluster = container.querySelector('[data-enrichment-badge-cluster]')!
    expect(cluster.querySelector('[data-source="bangumi"]')).toBeTruthy()
    // 富集时间 slot（enrichedAt.slice(0,10)）
    expect(container.querySelector('[data-enrichment-cluster-time]')?.textContent).toContain('2026-05-30')
  })

  it('movie 详情 → header 簇不含 bangumi', async () => {
    getVideoMock.mockResolvedValue(makeDetail({ type: 'movie', enrichmentSummary: makeSummary() }))
    const { container } = render(<VideoEditDrawer open videoId="v1" onClose={vi.fn()} onSaved={vi.fn()} />)
    await waitFor(() => expect(container.querySelector('[data-enrichment-badge-cluster]')).toBeTruthy())
    expect(container.querySelector('[data-source="bangumi"]')).toBeNull()
  })

  it('enrichedAt=null → 富集时间 slot 显示「未富集」', async () => {
    getVideoMock.mockResolvedValue(makeDetail({ enrichmentSummary: makeSummary({ enrichedAt: null }) }))
    const { container } = render(<VideoEditDrawer open videoId="v1" onClose={vi.fn()} onSaved={vi.fn()} />)
    await waitFor(() => expect(container.querySelector('[data-enrichment-cluster-time]')).toBeTruthy())
    expect(container.querySelector('[data-enrichment-cluster-time]')?.textContent).toBe('未富集')
  })

  it('详情无 enrichmentSummary → 无簇', async () => {
    getVideoMock.mockResolvedValue(makeDetail({ enrichmentSummary: undefined }))
    const { container } = render(<VideoEditDrawer open videoId="v1" onClose={vi.fn()} onSaved={vi.fn()} />)
    await waitFor(() => expect(screen.getByTestId('drawer-stub')).toBeTruthy())
    expect(container.querySelector('[data-enrichment-badge-cluster]')).toBeNull()
  })
})

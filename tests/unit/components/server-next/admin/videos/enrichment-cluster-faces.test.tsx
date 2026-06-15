/**
 * enrichment-cluster-faces.test.tsx — 四来源图标簇接入单测（META-36-B 迁移自 EnrichmentBadgeCluster）
 *
 * 覆盖 2 数据就绪消费面（D-201-3 / ADR-201）：
 *   Face 1 视频库列表（VideoListClient `meta` 列 / MetadataSourceIconCluster density='table'）
 *   Face 2 编辑抽屉（VideoEditDrawer QUICK_HEAD / MetadataSourceIconCluster density='header'）
 *
 * 真源：MetadataSourceIconCluster（ADR-201 / META-33-A）+ MetadataStatusSummary（META-32-A）
 * 历史：META-36-B 前用退役 EnrichmentBadgeCluster（density='row'/'header'，anime-only bangumi 门控）；
 *       新原语三密度均渲染全四源图标（含 missing/not_applicable 灰显，D-201-B），无 anime 门控。
 */
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { VIDEO_COLUMN_DESCRIPTORS } from '../../../../../../apps/server-next/src/lib/videos/columns'
import type {
  VideoAdminRow,
  VideoAdminDetail,
} from '../../../../../../apps/server-next/src/lib/videos/types'
import { makeSummary as makeMetadataStatus } from '../../../admin-ui/metadata-status/_fixtures'

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

// Drawer stub（保留真实 MetadataSourceIconCluster：仅替换 Drawer 容器）
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

function makeRow(over: Partial<VideoAdminRow> = {}): VideoAdminRow {
  return {
    id: 'v1', short_id: 'abc', title: '某番', title_en: null, cover_url: null,
    type: 'anime', year: 2024, is_published: true, source_count: '1',
    visibility_status: 'public', review_status: 'approved',
    created_at: '2024-01-01T00:00:00Z',
    // META-36-B：meta 列 cell 消费 metadataStatus（四源簇）；默认 douban 已应用 + bangumi 候选
    metadataStatus: makeMetadataStatus(
      { douban: { state: 'applied' }, bangumi: { state: 'candidate' } },
      { overall: 'partial', score: 72, enrichedAt: '2026-05-30T12:00:00Z', primaryProvider: 'douban' },
    ),
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

describe('META-36 Face 1 — 视频库 meta 列注册', () => {
  it('VIDEO_COLUMN_DESCRIPTORS 含 meta 元数据列（默认可见）', () => {
    const col = VIDEO_COLUMN_DESCRIPTORS.find((c) => c.id === 'meta')
    expect(col).toBeTruthy()
    expect(col!.defaultVisible).toBe(true)
  })

  it('douban_status / meta_score 隐藏列保留（排序契约）', () => {
    const douban = VIDEO_COLUMN_DESCRIPTORS.find((c) => c.id === 'douban_status')
    const meta = VIDEO_COLUMN_DESCRIPTORS.find((c) => c.id === 'meta_score')
    expect(douban?.defaultVisible).toBe(false)
    expect(meta?.defaultVisible).toBe(false)
  })
})

// ── Face 1b：视频库行渲染四来源图标簇 ─────────────────────────────

describe('META-36-B Face 1 — 视频库行渲染 MetadataSourceIconCluster（density=table）', () => {
  beforeEach(() => vi.clearAllMocks())

  it('行渲染簇（density=table）+ 固定四来源图标（D-201-B 全渲染含灰显）', async () => {
    listVideosMock.mockResolvedValue({ data: [makeRow()], total: 1, page: 1, limit: 20 })
    const { container } = render(<VideoListClient />)
    await waitFor(() => {
      expect(container.querySelector('[data-metadata-source-icon-cluster][data-density="table"]')).toBeTruthy()
    })
    const cluster = container.querySelector('[data-metadata-source-icon-cluster]')!
    for (const provider of ['douban', 'bangumi', 'tmdb', 'imdb']) {
      expect(cluster.querySelector(`[data-provider="${provider}"]`)).toBeTruthy()
    }
  })

  it('movie 行同样渲染四源图标（不再有 anime-only bangumi 门控）', async () => {
    listVideosMock.mockResolvedValue({ data: [makeRow({ type: 'movie' })], total: 1, page: 1, limit: 20 })
    const { container } = render(<VideoListClient />)
    await waitFor(() => expect(container.querySelector('[data-metadata-source-icon-cluster]')).toBeTruthy())
    expect(container.querySelector('[data-provider="bangumi"]')).toBeTruthy()
    expect(container.querySelector('[data-provider="douban"]')).toBeTruthy()
  })

  it('table 密度不挤占图标：无完整度微文案（showScore 默认 false / table 忽略）', async () => {
    listVideosMock.mockResolvedValue({ data: [makeRow()], total: 1, page: 1, limit: 20 })
    const { container } = render(<VideoListClient />)
    await waitFor(() => expect(container.querySelector('[data-metadata-source-icon-cluster]')).toBeTruthy())
    expect(container.querySelector('[data-metadata-cluster-score]')).toBeNull()
  })

  it('行无 metadataStatus（旧行/未派生）→ 不渲染簇', async () => {
    listVideosMock.mockResolvedValue({ data: [makeRow({ metadataStatus: undefined })], total: 1, page: 1, limit: 20 })
    const { container } = render(<VideoListClient />)
    // title 列始终可见，作渲染锚点
    await screen.findByText('某番')
    expect(container.querySelector('[data-metadata-source-icon-cluster]')).toBeNull()
  })
})

// ── Face 2：编辑抽屉 QUICK_HEAD 簇 ────────────────────────────────

describe('META-36-B Face 2 — 编辑抽屉头部 MetadataSourceIconCluster（density=header）', () => {
  beforeEach(() => vi.clearAllMocks())

  it('详情 → header 簇含四来源 + 完整度微文案（showScore）', async () => {
    getVideoMock.mockResolvedValue(makeDetail())
    const { container } = render(<VideoEditDrawer open videoId="v1" onClose={vi.fn()} onSaved={vi.fn()} />)
    await waitFor(() => expect(container.querySelector('[data-metadata-source-icon-cluster][data-density="header"]')).toBeTruthy())
    const cluster = container.querySelector('[data-metadata-source-icon-cluster]')!
    for (const provider of ['douban', 'bangumi', 'tmdb', 'imdb']) {
      expect(cluster.querySelector(`[data-provider="${provider}"]`)).toBeTruthy()
    }
    // header 密度 + showScore + score=72 → 完整度微文案可见
    expect(container.querySelector('[data-metadata-cluster-score]')?.textContent).toBe('72')
  })

  it('score=null → header 不渲染完整度微文案', async () => {
    getVideoMock.mockResolvedValue(makeDetail({ metadataStatus: makeMetadataStatus({}, { score: null }) }))
    const { container } = render(<VideoEditDrawer open videoId="v1" onClose={vi.fn()} onSaved={vi.fn()} />)
    await waitFor(() => expect(container.querySelector('[data-metadata-source-icon-cluster]')).toBeTruthy())
    expect(container.querySelector('[data-metadata-cluster-score]')).toBeNull()
  })

  it('详情无 metadataStatus → 无簇', async () => {
    getVideoMock.mockResolvedValue(makeDetail({ metadataStatus: undefined }))
    const { container } = render(<VideoEditDrawer open videoId="v1" onClose={vi.fn()} onSaved={vi.fn()} />)
    await waitFor(() => expect(screen.getByTestId('drawer-stub')).toBeTruthy())
    expect(container.querySelector('[data-metadata-source-icon-cluster]')).toBeNull()
  })
})

/**
 * HomeCanvas.test.tsx — 前台同构画布测试（CHG-HOME-CANVAS-A / 方案 §3）
 *
 * 覆盖（视图卡 ≥9 用例规范）：
 * - loading / error+retry / 7 区块渲染序
 * - 区块形态：banner wide / top10 rank 角标 / type_shortcuts chips / featured 网格
 * - 卡片：source pill（pinned/auto·origin/fallback）/ flags 警示 / empty 占位
 * - 区块选中高亮回调
 * - generatedAt 工具条 + 刷新重拉
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

vi.mock('../../../../../../apps/server-next/src/lib/home-curation/api', () => ({
  getHomePreview: vi.fn(),
  listHomeSections: vi.fn(),
  updateHomeSectionSettings: vi.fn(),
}))

import { getHomePreview } from '../../../../../../apps/server-next/src/lib/home-curation/api'
import { HomeCanvas } from '../../../../../../apps/server-next/src/app/admin/home/_client/canvas/HomeCanvas'
import type { HomePreview, HomePreviewCard, HomePreviewSection, HomeSectionKey, HomeSectionSettings } from '../../../../../../apps/server-next/src/lib/home-curation/types'

const mockedPreview = vi.mocked(getHomePreview)

const SECTION_KEYS: HomeSectionKey[] = ['banner', 'type_shortcuts', 'featured', 'top10', 'hot_movies', 'hot_series', 'hot_anime']

function settings(section: HomeSectionKey): HomeSectionSettings {
  return {
    id: `s-${section}`,
    section,
    autofillMode: 'manual_plus_autofill',
    refreshIntervalMinutes: 60,
    displayCount: 3,
    allowDuplicates: false,
    pinnedLimit: null,
    settings: {},
    updatedAt: '2026-06-06T00:00:00Z',
  }
}

function card(over: Partial<HomePreviewCard> = {}): HomePreviewCard {
  return {
    source: 'pinned',
    refId: 'r-1',
    videoId: 'v-1',
    title: '示例卡片',
    imageUrl: 'https://cdn.example.com/c.jpg',
    linkHint: 'slug-v-1',
    startAt: null,
    endAt: null,
    enabled: true,
    flags: [],
    explain: null,
    ...over,
  }
}

const EMPTY: HomePreviewCard = card({ source: 'empty', refId: null, videoId: null, title: null, imageUrl: null, linkHint: null })

function preview(sectionsOver: Partial<Record<HomeSectionKey, HomePreviewCard[]>> = {}): HomePreview {
  const sections: HomePreviewSection[] = SECTION_KEYS.map((key) => ({
    key,
    settings: settings(key),
    cards: sectionsOver[key] ?? [card({ refId: `r-${key}` })],
  }))
  return {
    sections,
    generatedAt: '2026-06-06T01:00:00Z',
    context: { brandSlug: null, locale: null, at: null, device: 'desktop' },
  }
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  mockedPreview.mockResolvedValue(preview())
})

describe('HomeCanvas — 加载与布局', () => {
  it('加载中渲染 skeleton（无画布容器）', () => {
    mockedPreview.mockReturnValue(new Promise(() => {}))
    const { container } = render(<HomeCanvas />)
    expect(container.querySelector('[data-testid="home-canvas"]')).toBeNull()
  })

  it('加载失败 → ErrorState + 重试重拉 preview', async () => {
    mockedPreview.mockRejectedValue(new Error('boom'))
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByText('画布加载失败')).not.toBeNull())
    mockedPreview.mockReset()
    mockedPreview.mockResolvedValue(preview())
    fireEvent.click(screen.getByText('重试'))
    await waitFor(() => expect(screen.queryByTestId('home-canvas')).not.toBeNull())
  })

  it('7 区块按前台渲染序展示', async () => {
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('home-canvas')).not.toBeNull())
    const sections = screen.getAllByTestId(/^canvas-section-/)
    expect(sections.map((s) => s.getAttribute('data-testid'))).toEqual(
      SECTION_KEYS.map((k) => `canvas-section-${k}`),
    )
  })

  it('generatedAt 工具条渲染 + 刷新按钮重拉 preview', async () => {
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-generated-at')).not.toBeNull())
    expect(mockedPreview).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('canvas-refresh-btn'))
    await waitFor(() => expect(mockedPreview).toHaveBeenCalledTimes(2))
  })
})

describe('HomeCanvas — 区块形态与卡片语义', () => {
  it('top10 非空卡渲染 rank 角标序号', async () => {
    mockedPreview.mockResolvedValue(preview({ top10: [card({ refId: 'r-t1' }), card({ refId: 'r-t2' })] }))
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-section-top10')).not.toBeNull())
    const top10 = screen.getByTestId('canvas-section-top10')
    expect(top10.textContent).toContain('1')
    expect(top10.textContent).toContain('2')
  })

  it('type_shortcuts 渲染 chips（含空位虚线 chip）', async () => {
    mockedPreview.mockResolvedValue(preview({ type_shortcuts: [card({ title: '电影' }), EMPTY] }))
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-chips-type_shortcuts')).not.toBeNull())
    const chips = screen.getByTestId('canvas-chips-type_shortcuts')
    expect(chips.textContent).toContain('电影')
    expect(chips.textContent).toContain('+ 空位')
  })

  it('auto 卡 source pill 携带 explain.origin；fallback 卡显示「兜底」', async () => {
    mockedPreview.mockResolvedValue(preview({
      featured: [card({ source: 'auto', refId: null, explain: { origin: 'trending', rank: 1, score: 8.5 } })],
      hot_movies: [card({ source: 'fallback', refId: null, videoId: 'v-f1', explain: { origin: 'trending', rank: 1, score: null } })],
    }))
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-section-featured')).not.toBeNull())
    expect(screen.getByTestId('canvas-section-featured').textContent).toContain('自动·trending')
    expect(screen.getByTestId('canvas-section-hot_movies').textContent).toContain('兜底·trending')
  })

  it('flags 警示 Pill 渲染（ref_broken / missing_image / pending）', async () => {
    mockedPreview.mockResolvedValue(preview({
      featured: [card({ flags: ['ref_broken', 'missing_image', 'pending'], imageUrl: null })],
    }))
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-section-featured')).not.toBeNull())
    const featured = screen.getByTestId('canvas-section-featured')
    expect(featured.textContent).toContain('引用失效')
    expect(featured.textContent).toContain('缺图')
    expect(featured.textContent).toContain('待生效')
  })

  it('empty 占位卡渲染「空位」虚线框', async () => {
    mockedPreview.mockResolvedValue(preview({ hot_anime: [EMPTY, EMPTY] }))
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-section-hot_anime')).not.toBeNull())
    expect(screen.getByTestId('canvas-card-empty-0')).not.toBeNull()
    expect(screen.getByTestId('canvas-card-empty-1')).not.toBeNull()
  })

  it('区块点击 → onSelectSection 回调 + 选中高亮态', async () => {
    const onSelect = vi.fn()
    render(<HomeCanvas onSelectSection={onSelect} />)
    await waitFor(() => expect(screen.queryByTestId('canvas-section-featured')).not.toBeNull())
    fireEvent.click(screen.getByTestId('canvas-section-featured'))
    expect(onSelect).toHaveBeenCalledWith('featured')
  })

  it('槽位计数：非 empty 卡数 / displayCount', async () => {
    mockedPreview.mockResolvedValue(preview({ featured: [card(), card({ refId: 'r-2' }), EMPTY] }))
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-section-featured')).not.toBeNull())
    expect(screen.getByTestId('canvas-section-featured').textContent).toContain('2/3 位')
  })
})

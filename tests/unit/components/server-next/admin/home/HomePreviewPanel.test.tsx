/**
 * HomePreviewPanel.test.tsx — 前台预览面板单元测试（CHG-SN-7-MISC-HOME-1）
 *
 * 覆盖：
 * - header 渲染：slot label + enabled/total 计数
 * - empty state（modules 为空）
 * - banner slot → BannerPreviewItem 渲染
 * - type_shortcuts slot → pill 渲染 + VIDEO_TYPE_LABEL 映射
 * - featured/top10 slot → PosterPreviewItem 渲染
 * - disabled 模块 → opacity + line-through 样式
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HomePreviewPanel } from '../../../../../../apps/server-next/src/app/admin/home/_client/HomePreviewPanel'
import type { HomeModule } from '../../../../../../apps/server-next/src/lib/home-modules/types'

const BASE_MODULE: HomeModule = {
  id: 'm-001',
  slot: 'banner',
  brandScope: 'all-brands',
  brandSlug: null,
  ordering: 0,
  contentRefType: 'video',
  contentRefId: 'v-abc',
  startAt: null,
  endAt: null,
  enabled: true,
  metadata: {},
  createdAt: '2026-05-12T00:00:00Z',
  updatedAt: '2026-05-12T00:00:00Z',
}

describe('HomePreviewPanel — header', () => {
  it('渲染 slot label「轮播广告」', () => {
    render(<HomePreviewPanel slot="banner" modules={[BASE_MODULE]} />)
    expect(screen.queryByText(/轮播广告/)).not.toBeNull()
  })

  it('渲染 enabled/total 计数 badge', () => {
    const modules = [BASE_MODULE, { ...BASE_MODULE, id: 'm-002', enabled: false }]
    render(<HomePreviewPanel slot="banner" modules={modules} />)
    expect(screen.queryByText('1/2')).not.toBeNull()
  })

  it('全 enabled → badge 显示 N/N', () => {
    const modules = [BASE_MODULE, { ...BASE_MODULE, id: 'm-002' }]
    render(<HomePreviewPanel slot="banner" modules={modules} />)
    expect(screen.queryByText('2/2')).not.toBeNull()
  })
})

describe('HomePreviewPanel — empty state', () => {
  it('modules 为空 → 显示「暂无模块」', () => {
    render(<HomePreviewPanel slot="banner" modules={[]} />)
    expect(screen.queryByText('暂无模块')).not.toBeNull()
  })

  it('空 modules badge 显示 0/0', () => {
    render(<HomePreviewPanel slot="featured" modules={[]} />)
    expect(screen.queryByText('0/0')).not.toBeNull()
  })
})

describe('HomePreviewPanel — banner slot', () => {
  it('渲染 BannerPreviewItem（data-preview-banner-item）', () => {
    const { container } = render(<HomePreviewPanel slot="banner" modules={[BASE_MODULE]} />)
    expect(container.querySelector('[data-preview-banner-item]')).not.toBeNull()
  })

  it('多个模块 → 按顺序渲染多个 banner item', () => {
    const modules = [BASE_MODULE, { ...BASE_MODULE, id: 'm-002', contentRefId: 'v-def' }]
    const { container } = render(<HomePreviewPanel slot="banner" modules={modules} />)
    expect(container.querySelectorAll('[data-preview-banner-item]').length).toBe(2)
  })

  it('banner item 显示 contentRefId', () => {
    render(<HomePreviewPanel slot="banner" modules={[BASE_MODULE]} />)
    expect(screen.queryByText('v-abc')).not.toBeNull()
  })
})

describe('HomePreviewPanel — featured/top10 slot → PosterPreviewItem', () => {
  it('featured slot → 渲染 data-preview-poster-item', () => {
    const module = { ...BASE_MODULE, slot: 'featured' as const }
    const { container } = render(<HomePreviewPanel slot="featured" modules={[module]} />)
    expect(container.querySelector('[data-preview-poster-item]')).not.toBeNull()
  })

  it('top10 slot → 渲染 data-preview-poster-item + rank 数字', () => {
    const module = { ...BASE_MODULE, slot: 'top10' as const }
    const { container } = render(<HomePreviewPanel slot="top10" modules={[module]} />)
    expect(container.querySelector('[data-preview-poster-item]')).not.toBeNull()
    expect(screen.queryByText('1')).not.toBeNull()
  })
})

describe('HomePreviewPanel — type_shortcuts slot', () => {
  it('渲染 data-preview-shortcuts 容器', () => {
    const module = { ...BASE_MODULE, slot: 'type_shortcuts' as const, contentRefId: 'movie' }
    const { container } = render(<HomePreviewPanel slot="type_shortcuts" modules={[module]} />)
    expect(container.querySelector('[data-preview-shortcuts]')).not.toBeNull()
  })

  it('contentRefId=movie → 显示「电影」label', () => {
    const module = { ...BASE_MODULE, slot: 'type_shortcuts' as const, contentRefId: 'movie' }
    render(<HomePreviewPanel slot="type_shortcuts" modules={[module]} />)
    expect(screen.queryByText('电影')).not.toBeNull()
  })

  it('未知 contentRefId → fallback 显示原始 id', () => {
    const module = { ...BASE_MODULE, slot: 'type_shortcuts' as const, contentRefId: 'unknown_type' }
    render(<HomePreviewPanel slot="type_shortcuts" modules={[module]} />)
    expect(screen.queryByText('unknown_type')).not.toBeNull()
  })

  it('多个 shortcuts → 渲染多个 pill', () => {
    const modules = [
      { ...BASE_MODULE, id: 'm-1', slot: 'type_shortcuts' as const, contentRefId: 'movie' },
      { ...BASE_MODULE, id: 'm-2', slot: 'type_shortcuts' as const, contentRefId: 'series' },
    ]
    const { container } = render(<HomePreviewPanel slot="type_shortcuts" modules={modules} />)
    expect(container.querySelectorAll('[data-preview-pill]').length).toBe(2)
  })
})

describe('HomePreviewPanel — disabled 模块样式', () => {
  it('disabled banner item → opacity 0.4 + textDecoration line-through', () => {
    const disabled = { ...BASE_MODULE, enabled: false }
    const { container } = render(<HomePreviewPanel slot="banner" modules={[disabled]} />)
    const item = container.querySelector('[data-preview-banner-item]') as HTMLElement
    expect(item).not.toBeNull()
    expect(item.style.opacity).toBe('0.4')
    expect(item.style.textDecoration).toBe('line-through')
  })

  it('disabled pill → opacity 0.4', () => {
    const disabled = { ...BASE_MODULE, slot: 'type_shortcuts' as const, contentRefId: 'anime', enabled: false }
    const { container } = render(<HomePreviewPanel slot="type_shortcuts" modules={[disabled]} />)
    const pill = container.querySelector('[data-preview-pill]') as HTMLElement
    expect(pill).not.toBeNull()
    expect(pill.style.opacity).toBe('0.4')
  })
})

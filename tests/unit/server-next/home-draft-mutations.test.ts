/**
 * home-draft-mutations.test.ts — 草稿整页配置纯变异函数
 * （CHG-HOME-DRAFT-PUBLISH-B / ADR-185 D-185-2.1 画布操作逐映射）
 */

import { describe, it, expect } from 'vitest'
import {
  addBannerToConfig,
  addVideosToConfig,
  applyCandidatesToConfig,
  moveModuleInConfig,
  reorderSectionInConfig,
  updateSettingsInConfig,
} from '../../../apps/server-next/src/lib/home-curation/draft-mutations'
import type {
  AutofillCandidate,
  HomeConfigBannerEntry,
  HomeConfigModuleEntry,
  HomeConfigSectionSettingsEntry,
  HomePageConfig,
  HomeSectionKey,
} from '@resovo/types'

// ── 工厂 ─────────────────────────────────────────────────────────

function moduleEntry(id: string, slot: HomeConfigModuleEntry['slot'], ordering: number, over: Partial<HomeConfigModuleEntry> = {}): HomeConfigModuleEntry {
  return {
    id, slot, ordering,
    brandScope: 'all-brands', brandSlug: null,
    contentRefType: 'video', contentRefId: `v-${id}`,
    title: {}, imageUrl: null, startAt: null, endAt: null,
    enabled: true, metadata: {},
    ...over,
  }
}

function bannerEntry(id: string, sortOrder: number): HomeConfigBannerEntry {
  return {
    id, sortOrder,
    title: { en: id }, imageUrl: `https://img/${id}.jpg`,
    linkType: 'external', linkTarget: 'https://x',
    activeFrom: null, activeTo: null, isActive: true,
    brandScope: 'all-brands', brandSlug: null,
  }
}

function settingsEntry(section: HomeSectionKey, over: Partial<HomeConfigSectionSettingsEntry> = {}): HomeConfigSectionSettingsEntry {
  return {
    section, autofillMode: 'manual_plus_autofill',
    refreshIntervalMinutes: 60, displayCount: 10,
    allowDuplicates: false, pinnedLimit: null, settings: {},
    ...over,
  }
}

function config(over: Partial<HomePageConfig> = {}): HomePageConfig {
  return {
    banners: [bannerEntry('b1', 0), bannerEntry('b2', 1)],
    modules: [
      moduleEntry('m1', 'hot_movies', 0),
      moduleEntry('m2', 'hot_movies', 1),
      moduleEntry('m3', 'featured', 0),
    ],
    settings: (['banner', 'type_shortcuts', 'featured', 'top10', 'hot_movies', 'hot_series', 'hot_anime'] as const)
      .map((s) => settingsEntry(s)),
    ...over,
  }
}

function candidate(videoId: string): AutofillCandidate {
  return {
    id: `cand-${videoId}`, videoId,
    videoSummary: { title: videoId, slug: null, coverUrl: null, type: 'movie', year: 2026, rating: 8, sourceCount: 2 },
    score: 0.9, rank: 1, origin: 'douban', filtered: false,
  }
}

// ── reorder ──────────────────────────────────────────────────────

describe('reorderSectionInConfig', () => {
  it('模块区：按 refId 序重写 ordering，他区块不动', () => {
    const next = reorderSectionInConfig(config(), 'hot_movies', ['m2', 'm1'])
    const byId = new Map(next.modules.map((m) => [m.id, m]))
    expect(byId.get('m2')!.ordering).toBe(0)
    expect(byId.get('m1')!.ordering).toBe(1)
    expect(byId.get('m3')!.ordering).toBe(0) // featured 不受影响
  })

  it('banner 区：重写 sortOrder', () => {
    const next = reorderSectionInConfig(config(), 'banner', ['b2', 'b1'])
    const byId = new Map(next.banners.map((b) => [b.id, b]))
    expect(byId.get('b2')!.sortOrder).toBe(0)
    expect(byId.get('b1')!.sortOrder).toBe(1)
  })

  it('不可变：原 config 不被修改', () => {
    const base = config()
    reorderSectionInConfig(base, 'hot_movies', ['m2', 'm1'])
    expect(base.modules.find((m) => m.id === 'm2')!.ordering).toBe(1)
  })
})

// ── move（跨区块原子）─────────────────────────────────────────────

describe('moveModuleInConfig', () => {
  it('slot 迁移 + 目标区块按落点序重排（单次变换原子完成）', () => {
    const next = moveModuleInConfig(config(), 'm3', 'hot_movies', ['m1', 'm3', 'm2'])
    const moved = next.modules.find((m) => m.id === 'm3')!
    expect(moved.slot).toBe('hot_movies')
    expect(moved.ordering).toBe(1)
    expect(next.modules.find((m) => m.id === 'm2')!.ordering).toBe(2)
  })
})

// ── settings ─────────────────────────────────────────────────────

describe('updateSettingsInConfig', () => {
  it('按 section 替换字段；settings JSONB 与其余区块保留', () => {
    const base = config({
      settings: config().settings.map((s) =>
        s.section === 'top10' ? { ...s, settings: { theme: 'dark' } } : s),
    })
    const next = updateSettingsInConfig(base, 'top10', { displayCount: 20, pinnedLimit: 3 })
    const top10 = next.settings.find((s) => s.section === 'top10')!
    expect(top10.displayCount).toBe(20)
    expect(top10.pinnedLimit).toBe(3)
    expect(top10.settings).toEqual({ theme: 'dark' }) // 未触字段保留
    expect(next.settings.find((s) => s.section === 'featured')!.displayCount).toBe(10)
  })
})

// ── 添加视频 / 候选应用 ───────────────────────────────────────────

describe('addVideosToConfig', () => {
  it('追加 pinned 条目：ordering 续接 max+1、id 预生成 UUID、默认值对账 insertPinnedHomeModulesBatch', () => {
    const { config: next, added, skipped } = addVideosToConfig(config(), 'hot_movies', ['v-new'])
    expect(added).toBe(1)
    expect(skipped).toEqual([])
    const entry = next.modules.find((m) => m.contentRefId === 'v-new')!
    expect(entry.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(entry.ordering).toBe(2) // m1=0 m2=1 → 续接
    expect(entry).toMatchObject({
      slot: 'hot_movies', brandScope: 'all-brands', brandSlug: null,
      contentRefType: 'video', title: {}, enabled: true, metadata: {},
    })
  })

  it('slot 内去重：已 pinned 同 video 与本批重复均跳过', () => {
    const { added, skipped } = addVideosToConfig(config(), 'hot_movies', ['v-m1', 'v-x', 'v-x'])
    expect(added).toBe(1)
    expect(skipped).toEqual(['v-m1', 'v-x'])
  })

  it('空区块 ordering 从 0 起', () => {
    const { config: next } = addVideosToConfig(config(), 'hot_anime', ['v-a'])
    expect(next.modules.find((m) => m.contentRefId === 'v-a')!.ordering).toBe(0)
  })
})

describe('applyCandidatesToConfig', () => {
  it('候选 → 草稿 pinned（重校验挪 publish 时点，仅 slot 去重）', () => {
    const { config: next, added, skipped } = applyCandidatesToConfig(
      config(), 'hot_series', [candidate('v-c1'), candidate('v-c2')],
    )
    expect(added).toBe(2)
    expect(skipped).toEqual([])
    const series = next.modules.filter((m) => m.slot === 'hot_series')
    expect(series.map((m) => m.contentRefId)).toEqual(['v-c1', 'v-c2'])
    expect(series.map((m) => m.ordering)).toEqual([0, 1])
  })
})

// ── banner 创建 ──────────────────────────────────────────────────

describe('addBannerToConfig', () => {
  it('sortOrder = 草稿内 max+1，id 预生成', () => {
    const next = addBannerToConfig(config(), {
      title: { 'zh-CN': '新横幅' }, imageUrl: 'https://img/new.jpg',
      linkType: 'video', linkTarget: 'short-1',
      activeFrom: null, activeTo: null, isActive: true,
      brandScope: 'all-brands', brandSlug: null,
    })
    expect(next.banners).toHaveLength(3)
    const created = next.banners[2]
    expect(created.sortOrder).toBe(2)
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(created.title['zh-CN']).toBe('新横幅')
  })
})

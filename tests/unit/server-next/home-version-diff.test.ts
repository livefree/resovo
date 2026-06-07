/**
 * home-version-diff.test.ts — 版本快照间 section 粒度 diff 纯函数
 * （CHG-HOME-AUDIT-ROLLBACK / ADR-185 D-185-4.2 消费端计算）
 */

import { describe, it, expect } from 'vitest'
import { computeVersionDiff } from '../../../apps/server-next/src/lib/home-curation/version-diff'
import type {
  HomeConfigBannerEntry,
  HomeConfigModuleEntry,
  HomeConfigSectionSettingsEntry,
  HomePageConfig,
  HomeSectionKey,
} from '@resovo/types'

function moduleEntry(id: string, slot: HomeConfigModuleEntry['slot'], over: Partial<HomeConfigModuleEntry> = {}): HomeConfigModuleEntry {
  return {
    id, slot, ordering: 0,
    brandScope: 'all-brands', brandSlug: null,
    contentRefType: 'video', contentRefId: `v-${id}`,
    title: {}, imageUrl: null, startAt: null, endAt: null,
    enabled: true, metadata: {},
    createdAt: '2026-06-07 00:00:00+00', updatedAt: '2026-06-07 00:00:00+00',
    ...over,
  }
}

function bannerEntry(id: string, over: Partial<HomeConfigBannerEntry> = {}): HomeConfigBannerEntry {
  return {
    id, sortOrder: 0,
    title: { en: id }, imageUrl: `https://img/${id}.jpg`,
    linkType: 'external', linkTarget: 'https://x',
    activeFrom: null, activeTo: null, isActive: true,
    brandScope: 'all-brands', brandSlug: null,
    createdAt: '2026-06-07 00:00:00+00', updatedAt: '2026-06-07 00:00:00+00',
    ...over,
  }
}

function settingsEntry(section: HomeSectionKey, over: Partial<HomeConfigSectionSettingsEntry> = {}): HomeConfigSectionSettingsEntry {
  return {
    id: `s-${section}`, section,
    autofillMode: 'manual_plus_autofill', refreshIntervalMinutes: 60,
    displayCount: 10, allowDuplicates: false, pinnedLimit: null, settings: {},
    updatedAt: '2026-06-07 00:00:00+00',
    ...over,
  }
}

function config(over: Partial<HomePageConfig> = {}): HomePageConfig {
  return {
    banners: [bannerEntry('b1')],
    modules: [moduleEntry('m1', 'hot_movies'), moduleEntry('m2', 'featured')],
    settings: (['banner', 'type_shortcuts', 'featured', 'top10', 'hot_movies', 'hot_series', 'hot_anime'] as const)
      .map((s) => settingsEntry(s)),
    ...over,
  }
}

describe('computeVersionDiff', () => {
  it('恒等快照 → []（时间戳元数据漂移剥离——发布重写恒刷新 updatedAt）', () => {
    const from = config()
    const to = config({
      modules: [
        moduleEntry('m1', 'hot_movies', { updatedAt: '2026-06-07 09:00:00+00' }),
        moduleEntry('m2', 'featured', { createdAt: '2026-06-07 09:00:00.123+00' }),
      ],
      settings: config().settings.map((s) => ({ ...s, updatedAt: '2026-06-07 09:00:00+00' })),
    })
    expect(computeVersionDiff(from, to)).toEqual([])
  })

  it('模块新增/移除/变更按 id 计数（slot 分组）', () => {
    const from = config({
      modules: [moduleEntry('m1', 'hot_movies'), moduleEntry('m2', 'hot_movies'), moduleEntry('m3', 'featured')],
    })
    const to = config({
      modules: [
        moduleEntry('m1', 'hot_movies', { ordering: 5 }),       // 变更
        moduleEntry('m4', 'hot_movies'),                        // 新增（m2 移除）
        moduleEntry('m3', 'featured'),                          // featured 不变
      ],
    })
    const diff = computeVersionDiff(from, to)
    expect(diff).toEqual([
      { section: 'hot_movies', added: 1, removed: 1, changed: 1, settingsChanged: false },
    ])
  })

  it('banner 区独立比较（真源 home_banners）', () => {
    const to = config({ banners: [bannerEntry('b1', { sortOrder: 3 }), bannerEntry('b2')] })
    const diff = computeVersionDiff(config(), to)
    expect(diff).toEqual([
      { section: 'banner', added: 1, removed: 0, changed: 1, settingsChanged: false },
    ])
  })

  it('settings 字段变化 → settingsChanged（条目零变化也上报该 section）', () => {
    const to = config({
      settings: config().settings.map((s) =>
        s.section === 'top10' ? { ...s, displayCount: 20 } : s),
    })
    expect(computeVersionDiff(config(), to)).toEqual([
      { section: 'top10', added: 0, removed: 0, changed: 0, settingsChanged: true },
    ])
  })

  it('嵌套字段（title JSONB）变化可检出——normalize 不丢非顶层键', () => {
    const to = config({
      modules: [
        moduleEntry('m1', 'hot_movies', { title: { 'zh-CN': '新标题' } }),
        moduleEntry('m2', 'featured'),
      ],
    })
    const diff = computeVersionDiff(config(), to)
    expect(diff).toEqual([
      { section: 'hot_movies', added: 0, removed: 0, changed: 1, settingsChanged: false },
    ])
  })

  it('多 section 变化按 HOME_SECTION_KEYS 渲染序输出', () => {
    const to = config({
      banners: [],
      modules: [moduleEntry('m1', 'hot_movies'), moduleEntry('m2', 'featured'), moduleEntry('m9', 'hot_anime')],
    })
    const diff = computeVersionDiff(config(), to)
    expect(diff.map((d) => d.section)).toEqual(['banner', 'hot_anime'])
  })
})

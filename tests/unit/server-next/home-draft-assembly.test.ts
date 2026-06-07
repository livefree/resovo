/**
 * home-draft-assembly.test.ts — 首次编辑惰性建稿整页装配
 * （CHG-HOME-DRAFT-PUBLISH-B-FIX / Codex stop-time review：
 * publish 全量替换语义下，装配缺行 = 发布即删行——分页聚合至 total，
 * 不完整/超上限显式失败，禁静默截断）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Banner, HomeModule, HomeSectionKey, HomeSectionSettings } from '@resovo/types'

vi.mock('../../../apps/server-next/src/lib/banners/api', () => ({
  listBanners: vi.fn(),
}))
vi.mock('../../../apps/server-next/src/lib/home-modules/api', () => ({
  listHomeModules: vi.fn(),
}))
vi.mock('../../../apps/server-next/src/lib/home-curation/api', () => ({
  listHomeSections: vi.fn(),
}))

import { listBanners } from '../../../apps/server-next/src/lib/banners/api'
import { listHomeModules } from '../../../apps/server-next/src/lib/home-modules/api'
import { listHomeSections } from '../../../apps/server-next/src/lib/home-curation/api'
import { assembleBaseConfig } from '../../../apps/server-next/src/lib/home-curation/draft-assembly'

const mockedBanners = vi.mocked(listBanners)
const mockedModules = vi.mocked(listHomeModules)
const mockedSections = vi.mocked(listHomeSections)

const SECTION_KEYS: readonly HomeSectionKey[] = [
  'banner', 'type_shortcuts', 'featured', 'top10', 'hot_movies', 'hot_series', 'hot_anime',
]

function moduleRow(id: string): HomeModule {
  return {
    id, slot: 'featured', brandScope: 'all-brands', brandSlug: null, ordering: 0,
    contentRefType: 'video', contentRefId: `v-${id}`, title: {}, imageUrl: null,
    startAt: null, endAt: null, enabled: true, metadata: {},
    createdAt: '2026-06-07T00:00:00Z', updatedAt: '2026-06-07T00:00:00Z',
  }
}

function bannerRow(id: string): Banner {
  return {
    id, title: { en: id }, imageUrl: `https://img/${id}.jpg`, linkType: 'external',
    linkTarget: 'https://x', sortOrder: 0, activeFrom: null, activeTo: null,
    isActive: true, brandScope: 'all-brands', brandSlug: null,
    createdAt: '2026-06-07T00:00:00Z', updatedAt: '2026-06-07T00:00:00Z',
  }
}

function settingsRow(section: HomeSectionKey): HomeSectionSettings {
  return {
    id: `s-${section}`, section, autofillMode: 'manual_plus_autofill',
    refreshIntervalMinutes: 60, displayCount: 10, allowDuplicates: false,
    pinnedLimit: null, settings: {}, updatedAt: '2026-06-07T00:00:00Z',
  }
}

function bannersPage(rows: Banner[], total: number) {
  return { data: rows, pagination: { total, page: 1, limit: 100, hasNext: rows.length < total } }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedSections.mockResolvedValue(SECTION_KEYS.map((s) => ({
    settings: settingsRow(s), pinnedCount: 0, lastSnapshotAt: null, candidateCount: null, frontendWired: true,
  })))
  mockedBanners.mockResolvedValue(bannersPage([bannerRow('b1')], 1))
  mockedModules.mockResolvedValue({ data: [moduleRow('m1')], total: 1, page: 1, limit: 100 })
})

describe('assembleBaseConfig（全量替换语义下的装配完整性）', () => {
  it('单页全量：三键装配（settings 7 区块 + modules/banners 全行）', async () => {
    const config = await assembleBaseConfig()
    expect(config.settings).toHaveLength(7)
    expect(config.modules.map((m) => m.id)).toEqual(['m1'])
    expect(config.banners.map((b) => b.id)).toEqual(['b1'])
    expect(mockedModules).toHaveBeenCalledWith({ page: 1, limit: 100 })
  })

  it('存量 > 100：分页聚合至 total，零截断（Codex review 修复点）', async () => {
    const pageA = Array.from({ length: 100 }, (_, i) => moduleRow(`m-${i}`))
    const pageB = Array.from({ length: 100 }, (_, i) => moduleRow(`m-${100 + i}`))
    const pageC = Array.from({ length: 50 }, (_, i) => moduleRow(`m-${200 + i}`))
    mockedModules
      .mockResolvedValueOnce({ data: pageA, total: 250, page: 1, limit: 100 })
      .mockResolvedValueOnce({ data: pageB, total: 250, page: 2, limit: 100 })
      .mockResolvedValueOnce({ data: pageC, total: 250, page: 3, limit: 100 })

    const config = await assembleBaseConfig()
    expect(config.modules).toHaveLength(250)
    expect(config.modules[249]!.id).toBe('m-249')
    expect(mockedModules).toHaveBeenNthCalledWith(2, { page: 2, limit: 100 })
    expect(mockedModules).toHaveBeenNthCalledWith(3, { page: 3, limit: 100 })
  })

  it('modules 超装配上限（>500，HomePageConfigSchema 同源）→ 显式失败不静默截断', async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) => moduleRow(`m-${i}`))
    mockedModules.mockImplementation(async (filter) => {
      const page = filter?.page ?? 1
      return {
        data: fullPage.map((m) => ({ ...m, id: `m-${page}-${m.id}` })),
        total: 600, page, limit: 100,
      }
    })
    await expect(assembleBaseConfig()).rejects.toThrow(/超出整页装配上限/)
  })

  it('装配不完整（空页提前终止 / 聚合 < total）→ 显式失败重试，禁带缺行建稿', async () => {
    mockedModules
      .mockResolvedValueOnce({ data: [moduleRow('m1')], total: 5, page: 1, limit: 100 })
      .mockResolvedValueOnce({ data: [], total: 5, page: 2, limit: 100 })
    await expect(assembleBaseConfig()).rejects.toThrow(/装配不完整（1\/5）/)
  })

  it('banners 同款分页聚合（pagination 包络）', async () => {
    mockedBanners
      .mockResolvedValueOnce(bannersPage(Array.from({ length: 100 }, (_, i) => bannerRow(`b-${i}`)), 100))
    const config = await assembleBaseConfig()
    expect(config.banners).toHaveLength(100)
    expect(mockedBanners).toHaveBeenCalledTimes(1) // 100/100 一页即满
  })
})

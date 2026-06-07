/**
 * tests/e2e/admin/home/_helpers.ts
 *
 * CHG-HOME-E2E-SPEC（SEQ-20260605-05 卡 21）：/admin/home 域 e2e 共享 mock helper
 *
 * 范式（test-rules E2E 运行环境规程第 4/5 条）：
 *   - installAdminShellMocks 基座先注册（shell 端点契约形状 + 兜底 404）
 *   - 业务 catch-all 后注册（优先匹配），未知路径 route.fallback() 下沉基座
 *   - mock 数据类型全部绑定 @resovo/types 真源（编译期锁契约，防三代漂移重演）
 *
 * 真源参考：
 *   - apps/server-next/src/lib/home-curation/api.ts（ADR-182 端点 #1/#3/#4/#5/#6/#7 信封）
 *   - apps/server-next/src/lib/home-modules/api.ts（ADR-104 资源级 6 端点）
 *   - apps/server-next/src/lib/banners/api.ts（/admin/banners，v1 pagination 包络）
 */

import type { BrowserContext, Page } from '@playwright/test'
import type {
  AutofillCandidate,
  Banner,
  ContentGap,
  HomeModule,
  HomePreview,
  HomePreviewCard,
  HomePreviewSection,
  HomeSectionKey,
  HomeSectionSettings,
} from '@resovo/types'
import { HOME_SECTION_KEYS } from '@resovo/types'
import { installAdminShellMocks } from '../_shared/shell-mocks'

export const API_BASE = 'http://localhost:4000/v1'

// ── Mock auth（/admin/home 为 admin only，ADR-182 D-182-1）─────────────

export async function setAdminCookies(context: BrowserContext) {
  await context.addCookies([
    {
      name: 'refresh_token',
      value: 'mock-admin-rt',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Strict',
    },
    {
      name: 'user_role',
      value: 'admin',
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Strict',
    },
  ])
}

// ── 类型绑定工厂（@resovo/types 真源）──────────────────────────────────

export function makeSettings(section: HomeSectionKey, over: Partial<HomeSectionSettings> = {}): HomeSectionSettings {
  return {
    id: `s-${section}`,
    section,
    autofillMode: 'manual_plus_autofill',
    refreshIntervalMinutes: 60,
    displayCount: 3,
    allowDuplicates: false,
    pinnedLimit: null,
    settings: {},
    updatedAt: '2026-06-07T00:00:00Z',
    ...over,
  }
}

export function makeModule(over: Partial<HomeModule> = {}): HomeModule {
  return {
    id: 'm-1',
    slot: 'featured',
    brandScope: 'all-brands',
    brandSlug: null,
    ordering: 0,
    contentRefType: 'video',
    contentRefId: 'v-1',
    title: { 'zh-CN': '模块卡片' },
    imageUrl: 'https://cdn.example.com/m-1.jpg',
    startAt: null,
    endAt: null,
    enabled: true,
    metadata: {},
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    ...over,
  }
}

export function makeBanner(over: Partial<Banner> = {}): Banner {
  return {
    id: 'bn-1',
    title: { 'zh-CN': '首屏横幅' },
    imageUrl: 'https://cdn.example.com/hero.jpg',
    linkType: 'external',
    linkTarget: 'https://promo.example.com',
    sortOrder: 0,
    activeFrom: null,
    activeTo: null,
    isActive: true,
    brandScope: 'all-brands',
    brandSlug: null,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    ...over,
  }
}

export function makeCandidate(id: string, over: Partial<AutofillCandidate> = {}): AutofillCandidate {
  return {
    id,
    videoId: `v-${id}`,
    videoSummary: {
      title: `候选视频 ${id}`,
      slug: `slug-${id}`,
      coverUrl: null,
      type: 'movie',
      year: 2026,
      rating: 8.2,
      sourceCount: 2,
    },
    score: 0.88,
    rank: 1,
    origin: 'douban',
    filtered: false,
    ...over,
  }
}

// ── Mock 状态 ─────────────────────────────────────────────────────────

export interface CandidatePool {
  candidates: AutofillCandidate[]
  snapshotAt: string | null
  policyVersion: string | null
  gaps: ContentGap[]
}

export interface HomeOpsMockState {
  /** ADR-104 资源级列表（list 视图按 slot 消费） */
  modules: HomeModule[]
  /** home_banners（banner tab + preview banner section） */
  banners: Banner[]
  /** 7 区块 settings（preview 内嵌消费） */
  settings: Map<HomeSectionKey, HomeSectionSettings>
  /** 端点 #4 候选池（按 section） */
  pools: Map<HomeSectionKey, CandidatePool>
  /** 写路径 spy 日志（method + path + body） */
  writes: Array<{ method: string; path: string; body: unknown }>
}

export function freshState(over: Partial<Omit<HomeOpsMockState, 'writes'>> = {}): HomeOpsMockState {
  const settings = new Map<HomeSectionKey, HomeSectionSettings>(
    HOME_SECTION_KEYS.map((s) => [s, makeSettings(s)]),
  )
  return {
    modules: [],
    banners: [makeBanner()],
    settings,
    pools: new Map(),
    writes: [],
    ...over,
  }
}

/** spy 便捷断言：按 method+path 前缀取写记录 */
export function findWrites(state: HomeOpsMockState, method: string, pathPrefix: string) {
  return state.writes.filter((w) => w.method === method && w.path.startsWith(pathPrefix))
}

// ── preview 合成（端点 #1：从 state 构造，画布渲染数据源）────────────────

function moduleToPinnedCard(m: HomeModule): HomePreviewCard {
  return {
    source: 'pinned',
    refId: m.id,
    videoId: m.contentRefType === 'video' ? m.contentRefId : null,
    title: m.title['zh-CN'] ?? null,
    imageUrl: m.imageUrl,
    linkHint: m.contentRefId,
    startAt: m.startAt,
    endAt: m.endAt,
    enabled: m.enabled,
    flags: [],
    explain: null,
  }
}

function bannerToPinnedCard(b: Banner): HomePreviewCard {
  return {
    source: 'pinned',
    refId: b.id,
    videoId: null,
    title: b.title['zh-CN'] ?? null,
    imageUrl: b.imageUrl,
    linkHint: b.linkTarget,
    startAt: b.activeFrom,
    endAt: b.activeTo,
    enabled: b.isActive,
    flags: [],
    explain: null,
  }
}

const EMPTY_CARD: HomePreviewCard = {
  source: 'empty',
  refId: null,
  videoId: null,
  title: null,
  imageUrl: null,
  linkHint: null,
  startAt: null,
  endAt: null,
  enabled: true,
  flags: [],
  explain: null,
}

export function buildPreview(state: HomeOpsMockState): HomePreview {
  const sections: HomePreviewSection[] = HOME_SECTION_KEYS.map((key) => {
    const settings = state.settings.get(key) ?? makeSettings(key)
    const pinned =
      key === 'banner'
        ? state.banners.map(bannerToPinnedCard)
        : state.modules.filter((m) => m.slot === key).map(moduleToPinnedCard)
    const cards = [...pinned]
    while (cards.length < settings.displayCount) cards.push({ ...EMPTY_CARD })
    return { key, settings, cards, consumedSnapshotAt: null }
  })
  return {
    sections,
    generatedAt: '2026-06-07T01:00:00.000Z',
    context: { brandSlug: null, locale: null, at: null, device: 'desktop' },
  }
}

// ── 路由安装（基座先注册，业务 catch-all 后注册优先匹配）────────────────

export async function installHomeOpsMocks(page: Page, state: HomeOpsMockState) {
  await installAdminShellMocks(page)

  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    const recordWrite = () => {
      state.writes.push({ method, path, body: request.postDataJSON() as unknown })
    }

    // ── 端点 #1：整页预览（画布数据源）──
    if (path === '/v1/admin/home/preview' && method === 'GET') {
      return json({ data: buildPreview(state) })
    }

    // ── 端点 #3：settings PATCH ──
    const settingsMatch = path.match(/^\/v1\/admin\/home\/sections\/([a-z0-9_]+)\/settings$/)
    if (settingsMatch && method === 'PATCH') {
      recordWrite()
      const section = settingsMatch[1] as HomeSectionKey
      const prev = state.settings.get(section) ?? makeSettings(section)
      const next = { ...prev, ...(request.postDataJSON() as Partial<HomeSectionSettings>) }
      state.settings.set(section, next)
      return json({ data: next })
    }

    // ── 端点 #4：候选快照只读（信封：data 数组 + snapshotAt/policyVersion 同级）──
    const candMatch = path.match(/^\/v1\/admin\/home\/sections\/([a-z0-9_]+)\/autofill-candidates$/)
    if (candMatch && method === 'GET') {
      const pool = state.pools.get(candMatch[1] as HomeSectionKey)
      const includeFiltered = url.searchParams.get('include_filtered') === 'true'
      if (!pool) {
        return json({ data: [], snapshotAt: null, policyVersion: null })
      }
      return json({
        data: includeFiltered ? pool.candidates : pool.candidates.filter((c) => !c.filtered),
        snapshotAt: pool.snapshotAt,
        policyVersion: pool.policyVersion,
        ...(includeFiltered ? { gaps: pool.gaps } : {}),
      })
    }

    // ── 端点 #5：候选转 pinned ──
    const applyMatch = path.match(/^\/v1\/admin\/home\/sections\/([a-z0-9_]+)\/apply-autofill$/)
    if (applyMatch && method === 'POST') {
      recordWrite()
      const body = request.postDataJSON() as { candidateIds: string[] }
      return json({ data: { applied: body.candidateIds.length, modules: [] } })
    }

    // ── 端点 #7：手动重算入队 ──
    if (/^\/v1\/admin\/home\/sections\/[a-z0-9_]+\/refresh-candidates$/.test(path) && method === 'POST') {
      recordWrite()
      return json({ data: { enqueued: true } }, 202)
    }

    // ── 端点 #6：区块内排序门面 ──
    if (/^\/v1\/admin\/home\/sections\/[a-z0-9_]+\/reorder$/.test(path) && method === 'POST') {
      recordWrite()
      const body = request.postDataJSON() as { items: unknown[] }
      return json({ data: { updated: body.items.length } })
    }

    // ── ADR-104 资源级：home-modules ──
    if (path === '/v1/admin/home-modules' && method === 'GET') {
      const slot = url.searchParams.get('slot')
      const rows = slot ? state.modules.filter((m) => m.slot === slot) : state.modules
      return json({ data: rows, total: rows.length, page: 1, limit: 100 })
    }
    if (path === '/v1/admin/home-modules/reorder' && method === 'POST') {
      recordWrite()
      const body = request.postDataJSON() as { items: Array<{ id: string; ordering: number }> }
      return json({ data: { updated: body.items.length } })
    }
    const toggleMatch = path.match(/^\/v1\/admin\/home-modules\/([^/]+)\/publish-toggle$/)
    if (toggleMatch && method === 'POST') {
      recordWrite()
      const mod = state.modules.find((m) => m.id === toggleMatch[1])
      const enabled = (request.postDataJSON() as { enabled: boolean }).enabled
      if (mod) {
        const next = { ...mod, enabled }
        state.modules = state.modules.map((m) => (m.id === mod.id ? next : m))
        return json({ data: next })
      }
      return json({ error: { code: 'NOT_FOUND', message: 'module not found' } }, 404)
    }
    const moduleIdMatch = path.match(/^\/v1\/admin\/home-modules\/([^/]+)$/)
    if (moduleIdMatch && method === 'DELETE') {
      recordWrite()
      state.modules = state.modules.filter((m) => m.id !== moduleIdMatch[1])
      return json({ data: { deleted: true } })
    }

    // ── /admin/banners（v1 pagination 包络）──
    if (path === '/v1/admin/banners' && method === 'GET') {
      return json({
        data: state.banners,
        pagination: { total: state.banners.length, page: 1, limit: 50 },
      })
    }
    if (path === '/v1/admin/banners' && method === 'POST') {
      recordWrite()
      const created = makeBanner({ id: `bn-new-${state.banners.length + 1}` })
      state.banners = [...state.banners, created]
      return json({ data: created })
    }

    // 未知路径下沉基座（shell 端点契约形状 + 兜底 404；禁错误形状 200）
    await route.fallback()
  })
}

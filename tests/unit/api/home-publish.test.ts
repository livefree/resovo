/**
 * home-publish.test.ts — 发布治理端点 #1–#4
 * （CHG-HOME-DRAFT-PUBLISH-A / ADR-185 D-185-1/-2/-3）
 *
 * 覆盖：
 *   - GET    /admin/home/draft   无草稿 data:null 语义 / 有草稿回读 / 鉴权 401
 *   - PUT    /admin/home/draft   happy path / 整页校验 422 ×4（缺区块·slot 兼容·brand·strict）
 *   - DELETE /admin/home/draft   deleted true/false
 *   - POST   /admin/home/publish 无草稿 422 / 陈旧双信号 409 ×2 / 整页重校验 409 /
 *       乐观锁竞态 409 / 冷启动 happy path + audit R-MID-1 payload 内容断言
 *   - computeSectionsChanged     section 粒度摘要（updatedAt 剥离 / banner·modules·settings 三源）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import { signAccessToken } from '@/api/lib/auth'
import type {
  HomeConfigDraft,
  HomePageConfig,
  HomeConfigBannerEntry,
  HomeConfigModuleEntry,
  HomeConfigSectionSettingsEntry,
  HomeSectionKey,
} from '@resovo/types'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/api/lib/redis', () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') },
}))
vi.mock('@/api/lib/postgres', () => ({ db: {} }))

const mockFindDraft = vi.fn()
const mockUpsertDraft = vi.fn()
const mockDeleteDraft = vi.fn()
const mockLatestVersionNo = vi.fn()
const mockTablesMaxUpdatedAt = vi.fn()
const mockPublish = vi.fn()

vi.mock('@/api/db/queries/home-publish', () => ({
  findHomeConfigDraft: (...args: unknown[]) => mockFindDraft(...args),
  upsertHomeConfigDraft: (...args: unknown[]) => mockUpsertDraft(...args),
  deleteHomeConfigDraft: (...args: unknown[]) => mockDeleteDraft(...args),
  findLatestVersionNo: (...args: unknown[]) => mockLatestVersionNo(...args),
  findTruthTablesMaxUpdatedAt: (...args: unknown[]) => mockTablesMaxUpdatedAt(...args),
  publishHomeConfig: (...args: unknown[]) => mockPublish(...args),
}))

const mockListVideoCards = vi.fn()
vi.mock('@/api/db/queries/videos.status', () => ({
  listVideoCardsByIds: (...args: unknown[]) => mockListVideoCards(...args),
}))

const mockAuditWrite = vi.fn()
vi.mock('@/api/services/AuditLogService', () => ({
  AuditLogService: class {
    write = mockAuditWrite
  },
}))

// ── Fixtures ───────────────────────────────────────────────────────────────

const ALL_SECTIONS: readonly HomeSectionKey[] = [
  'banner', 'type_shortcuts', 'featured', 'top10', 'hot_movies', 'hot_series', 'hot_anime',
]

function settingsEntry(section: HomeSectionKey, over: Partial<HomeConfigSectionSettingsEntry> = {}): HomeConfigSectionSettingsEntry {
  return {
    section,
    autofillMode: 'manual_plus_autofill',
    refreshIntervalMinutes: 60,
    displayCount: 10,
    allowDuplicates: false,
    pinnedLimit: null,
    settings: {},
    ...over,
  }
}

function moduleEntry(over: Partial<HomeConfigModuleEntry> = {}): HomeConfigModuleEntry {
  return {
    slot: 'hot_movies',
    brandScope: 'all-brands',
    brandSlug: null,
    ordering: 0,
    contentRefType: 'video',
    contentRefId: 'v-1',
    title: {},
    imageUrl: null,
    startAt: null,
    endAt: null,
    enabled: true,
    metadata: {},
    ...over,
  }
}

function bannerEntry(over: Partial<HomeConfigBannerEntry> = {}): HomeConfigBannerEntry {
  return {
    title: { en: 'Hero' },
    imageUrl: 'https://img.example.com/hero.jpg',
    linkType: 'external',
    linkTarget: 'https://example.com',
    sortOrder: 0,
    activeFrom: null,
    activeTo: null,
    isActive: true,
    brandScope: 'all-brands',
    brandSlug: null,
    ...over,
  }
}

function pageConfig(over: Partial<HomePageConfig> = {}): HomePageConfig {
  return {
    banners: [bannerEntry()],
    modules: [moduleEntry()],
    settings: ALL_SECTIONS.map((s) => settingsEntry(s)),
    ...over,
  }
}

function draftRow(over: Partial<HomeConfigDraft> = {}): HomeConfigDraft {
  return {
    id: 'draft-1',
    scope: 'global',
    config: pageConfig(),
    baseVersionNo: null,
    createdBy: 'u-admin',
    updatedBy: 'u-admin',
    createdAt: '2026-06-07T00:00:00Z',
    updatedAt: '2026-06-07T01:00:00Z',
    ...over,
  }
}

async function buildApp() {
  const { adminHomePublishRoutes } = await import('@/api/routes/admin/home-publish')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminHomePublishRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

async function adminToken() {
  return `Bearer ${await signAccessToken({ userId: 'u-admin', role: 'admin' })}`
}

let app: Awaited<ReturnType<typeof buildApp>>

beforeEach(async () => {
  vi.clearAllMocks()
  app = await buildApp()
})

// ── GET /admin/home/draft ──────────────────────────────────────────────────

describe('GET /admin/home/draft', () => {
  it('无草稿 → 200 data:null + staleness:null（存在性非错误，D-185-3.1）', async () => {
    mockFindDraft.mockResolvedValue(null)
    const res = await app.inject({
      method: 'GET', url: '/v1/admin/home/draft',
      headers: { authorization: await adminToken() },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ data: null, staleness: null })
  })

  it('有草稿基线一致 → 200 全行回读 + staleness.stale=false', async () => {
    mockFindDraft.mockResolvedValue(draftRow({ baseVersionNo: 3, updatedAt: '2026-06-07T01:00:00Z' }))
    mockLatestVersionNo.mockResolvedValue(3)
    mockTablesMaxUpdatedAt.mockResolvedValue('2026-06-07T00:30:00Z')
    const res = await app.inject({
      method: 'GET', url: '/v1/admin/home/draft',
      headers: { authorization: await adminToken() },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.baseVersionNo).toBe(3)
    expect(res.json().data.scope).toBe('global')
    expect(res.json().staleness).toEqual({
      stale: false,
      baseMismatch: false,
      tablesNewer: false,
      latestVersionNo: 3,
      tablesMaxUpdatedAt: '2026-06-07T00:30:00Z',
    })
  })

  it('陈旧双信号 additive：base 失配 / 三表直写晚于草稿 → stale=true（D-185-2.2 编辑器提示）', async () => {
    mockFindDraft.mockResolvedValue(draftRow({ baseVersionNo: 2, updatedAt: '2026-06-07T01:00:00Z' }))
    mockLatestVersionNo.mockResolvedValue(3)
    mockTablesMaxUpdatedAt.mockResolvedValue('2026-06-07T02:00:00Z')
    const res = await app.inject({
      method: 'GET', url: '/v1/admin/home/draft',
      headers: { authorization: await adminToken() },
    })
    expect(res.json().staleness).toMatchObject({ stale: true, baseMismatch: true, tablesNewer: true })
  })

  it('未认证 → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/admin/home/draft' })
    expect(res.statusCode).toBe(401)
  })
})

// ── PUT /admin/home/draft ──────────────────────────────────────────────────

describe('PUT /admin/home/draft', () => {
  it('整页保存 → 200 + upsert 传 config/actorId（不计 audit，D-185-3.1）', async () => {
    const config = pageConfig()
    mockUpsertDraft.mockResolvedValue(draftRow({ config }))
    const res = await app.inject({
      method: 'PUT', url: '/v1/admin/home/draft',
      headers: { authorization: await adminToken() },
      payload: { config },
    })
    expect(res.statusCode).toBe(200)
    expect(mockUpsertDraft).toHaveBeenCalledWith(expect.anything(), {
      config: expect.objectContaining({ modules: config.modules }),
      actorId: 'u-admin',
    })
    expect(mockAuditWrite).not.toHaveBeenCalled()
  })

  it('settings 缺区块 → 422（整页语义：7 区块各一次）', async () => {
    const config = pageConfig({ settings: ALL_SECTIONS.slice(1).map((s) => settingsEntry(s)) })
    const res = await app.inject({
      method: 'PUT', url: '/v1/admin/home/draft',
      headers: { authorization: await adminToken() },
      payload: { config },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')
  })

  it('slot × contentRefType 不兼容 → 422（migration 094 CHECK 镜像）', async () => {
    const config = pageConfig({
      modules: [moduleEntry({ slot: 'type_shortcuts', contentRefType: 'video' })],
    })
    const res = await app.inject({
      method: 'PUT', url: '/v1/admin/home/draft',
      headers: { authorization: await adminToken() },
      payload: { config },
    })
    expect(res.statusCode).toBe(422)
  })

  it('brand-specific 缺 brandSlug → 422', async () => {
    const config = pageConfig({
      banners: [bannerEntry({ brandScope: 'brand-specific', brandSlug: null })],
    })
    const res = await app.inject({
      method: 'PUT', url: '/v1/admin/home/draft',
      headers: { authorization: await adminToken() },
      payload: { config },
    })
    expect(res.statusCode).toBe(422)
  })

  it('unknown key → 422（.strict()）', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/v1/admin/home/draft',
      headers: { authorization: await adminToken() },
      payload: { config: pageConfig(), force: true },
    })
    expect(res.statusCode).toBe(422)
  })
})

// ── DELETE /admin/home/draft ───────────────────────────────────────────────

describe('DELETE /admin/home/draft', () => {
  it.each([[true], [false]])('丢弃 → 200 deleted=%s（幂等，不计 audit）', async (deleted) => {
    mockDeleteDraft.mockResolvedValue(deleted)
    const res = await app.inject({
      method: 'DELETE', url: '/v1/admin/home/draft',
      headers: { authorization: await adminToken() },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ data: { deleted } })
    expect(mockAuditWrite).not.toHaveBeenCalled()
  })
})

// ── POST /admin/home/publish ───────────────────────────────────────────────

describe('POST /admin/home/publish', () => {
  it('无草稿 → 422（无可发布内容，D-185-3.2）', async () => {
    mockFindDraft.mockResolvedValue(null)
    const res = await app.inject({
      method: 'POST', url: '/v1/admin/home/publish',
      headers: { authorization: await adminToken() },
      payload: {},
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')
  })

  it('陈旧信号①：base_version_no 失配 → 409 携 base/当前版本信息', async () => {
    mockFindDraft.mockResolvedValue(draftRow({ baseVersionNo: 1 }))
    mockLatestVersionNo.mockResolvedValue(2)
    const res = await app.inject({
      method: 'POST', url: '/v1/admin/home/publish',
      headers: { authorization: await adminToken() },
      payload: {},
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().error.code).toBe('STATE_CONFLICT')
    expect(res.json().error.message).toContain('1')
    expect(res.json().error.message).toContain('2')
    expect(mockPublish).not.toHaveBeenCalled()
  })

  it('陈旧信号②：三表直写晚于草稿 → 409（资源级紧急通道 / 门面旁路检测）', async () => {
    mockFindDraft.mockResolvedValue(draftRow({ updatedAt: '2026-06-07T01:00:00Z' }))
    mockLatestVersionNo.mockResolvedValue(null)
    mockTablesMaxUpdatedAt.mockResolvedValue('2026-06-07T02:00:00Z')
    const res = await app.inject({
      method: 'POST', url: '/v1/admin/home/publish',
      headers: { authorization: await adminToken() },
      payload: {},
    })
    expect(res.statusCode).toBe(409)
    expect(mockPublish).not.toHaveBeenCalled()
  })

  it('整页重校验失败（video 不可见 / 无可播源）→ 409 携失效 ids（D-182-4.5 口径挪点）', async () => {
    mockFindDraft.mockResolvedValue(draftRow({
      config: pageConfig({
        modules: [
          moduleEntry({ contentRefId: 'v-ok' }),
          moduleEntry({ slot: 'hot_series', contentRefId: 'v-dead', ordering: 1 }),
        ],
      }),
    }))
    mockLatestVersionNo.mockResolvedValue(null)
    mockTablesMaxUpdatedAt.mockResolvedValue('2026-06-07T00:30:00Z')
    mockListVideoCards.mockResolvedValue([
      { id: 'v-ok', sourceCount: 3 },
      { id: 'v-dead', sourceCount: 0 },
    ])
    const res = await app.inject({
      method: 'POST', url: '/v1/admin/home/publish',
      headers: { authorization: await adminToken() },
      payload: {},
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().error.message).toContain('v-dead')
    expect(res.json().error.message).not.toContain('v-ok,')
    expect(mockPublish).not.toHaveBeenCalled()
  })

  it('乐观锁竞态（publishHomeConfig null）→ 409', async () => {
    mockFindDraft.mockResolvedValue(draftRow())
    mockLatestVersionNo.mockResolvedValue(null)
    mockTablesMaxUpdatedAt.mockResolvedValue(null)
    mockListVideoCards.mockResolvedValue([{ id: 'v-1', sourceCount: 2 }])
    mockPublish.mockResolvedValue(null)
    const res = await app.inject({
      method: 'POST', url: '/v1/admin/home/publish',
      headers: { authorization: await adminToken() },
      payload: {},
    })
    expect(res.statusCode).toBe(409)
    expect(mockAuditWrite).not.toHaveBeenCalled()
  })

  it('冷启动 happy path：单事务参数 + versionNo 返回 + audit home_page.publish 内容断言（R-MID-1）', async () => {
    const draft = draftRow()
    const publishedConfig = pageConfig({
      modules: [moduleEntry({ id: 'm-1', createdAt: '2026-06-07T01:30:00Z', updatedAt: '2026-06-07T01:30:00Z' })],
    })
    mockFindDraft.mockResolvedValue(draft)
    mockLatestVersionNo.mockResolvedValue(null)
    mockTablesMaxUpdatedAt.mockResolvedValue('2026-06-07T00:30:00Z')
    mockListVideoCards.mockResolvedValue([{ id: 'v-1', sourceCount: 2 }])
    mockPublish.mockResolvedValue({
      versionId: 'ver-uuid-1',
      versionNo: 1,
      prevConfig: pageConfig({ modules: [] }),
      publishedConfig,
    })

    const res = await app.inject({
      method: 'POST', url: '/v1/admin/home/publish',
      headers: { authorization: await adminToken() },
      payload: { note: '首次发布' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ data: { versionNo: 1 } })
    // 单事务入参：草稿乐观锁（id + updatedAt）+ source/note
    expect(mockPublish).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      draft: { id: 'draft-1', updatedAt: draft.updatedAt },
      source: 'publish',
      note: '首次发布',
      actorId: 'u-admin',
    }))
    // D-185-4.1 轻量摘要 + D-185-3.5 targetId = 版本行 UUID
    expect(mockAuditWrite).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'home_page.publish',
      targetKind: 'home_page',
      targetId: 'ver-uuid-1',
      actorId: 'u-admin',
      beforeJsonb: null,
      afterJsonb: expect.objectContaining({
        versionNo: 1,
        baseVersionNo: null,
        sectionsChanged: expect.arrayContaining(['hot_movies']),
        counts: { banners: 1, modules: 1 },
      }),
    }))
  })

  it('note 非法（空串）→ 422，service 不被触达', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/admin/home/publish',
      headers: { authorization: await adminToken() },
      payload: { note: '' },
    })
    expect(res.statusCode).toBe(422)
    expect(mockFindDraft).not.toHaveBeenCalled()
  })
})

// ── computeSectionsChanged（audit 摘要纯函数，D-185-4.1）────────────────────

describe('computeSectionsChanged', () => {
  async function subject() {
    const { computeSectionsChanged } = await import('@/api/services/HomePublishService')
    return computeSectionsChanged
  }

  it('无内容变化 → []（createdAt/updatedAt 元数据漂移剥离不计入——ms 精度截断伪报防御）', async () => {
    const fn = await subject()
    const prev = pageConfig({
      modules: [moduleEntry({ id: 'm-1', createdAt: '2026-06-07 00:00:00.123456+00', updatedAt: '2026-06-07T00:00:00Z' })],
    })
    const next = pageConfig({
      modules: [moduleEntry({ id: 'm-1', createdAt: '2026-06-07 00:00:00.123+00', updatedAt: '2026-06-07T09:00:00Z' })],
    })
    expect(fn(prev, next)).toEqual([])
  })

  it('settings 字段变化 → 对应 section', async () => {
    const fn = await subject()
    const prev = pageConfig()
    const next = pageConfig({
      settings: ALL_SECTIONS.map((s) =>
        settingsEntry(s, s === 'top10' ? { displayCount: 20 } : {})),
    })
    expect(fn(prev, next)).toEqual(['top10'])
  })

  it('模块增删 → 对应 slot section', async () => {
    const fn = await subject()
    const prev = pageConfig({ modules: [] })
    const next = pageConfig({ modules: [moduleEntry({ id: 'm-1', slot: 'hot_anime' })] })
    expect(fn(prev, next)).toEqual(['hot_anime'])
  })

  it('banner 行变化 → banner section（真源 home_banners）', async () => {
    const fn = await subject()
    const prev = pageConfig({ modules: [] })
    const next = pageConfig({
      modules: [],
      banners: [bannerEntry({ id: 'b-1', sortOrder: 5 })],
    })
    expect(fn(prev, next)).toEqual(['banner'])
  })
})

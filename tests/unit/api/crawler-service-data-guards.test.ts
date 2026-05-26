/**
 * crawler-service-data-guards.test.ts — CW2-A
 * P0 数据丢失三合一守卫单测
 *
 * 覆盖：
 *   Fix-1 (R1) #1 empty sources → 不调 replaceSourcesForSite，emit warn 'crawl.upsert.empty_sources'
 *   Fix-2A (R3) #2 增量模式首页满载（>=10）→ emit warn 'crawl.page.truncated'
 *   Fix-2A (R3) #3 增量模式首页未满（<10）→ 不 emit 截断告警
 *   Fix-3 (R2) #4 空 title item → errors++, emit warn 'crawl.skip.empty_title', 不调 upsertVideo
 *   assertion  #5 replaceSourcesForSite(empty) → throw（由 CrawlerService 的 empty sources 守卫触发，
 *                                                   验证 upsertVideo 没有穿透调用 replaceSourcesForSite）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── 顶层 hoisted mocks ──────────────────────────────────────────────
const {
  replaceSourcesForSiteMock,
  upsertSourcesMock,
  upsertVideoAliasesMock,
  insertCrawledVideoMock,
  bumpEpisodeCountIfHigherMock,
  findOrCreateMock,
  updateTaskStatusMock,
  updateTaskProgressMock,
  createTaskMock,
  syncVideoMock,
} = vi.hoisted(() => ({
  replaceSourcesForSiteMock: vi.fn(),
  upsertSourcesMock: vi.fn(),
  upsertVideoAliasesMock: vi.fn(),
  insertCrawledVideoMock: vi.fn(),
  bumpEpisodeCountIfHigherMock: vi.fn(),
  findOrCreateMock: vi.fn(),
  updateTaskStatusMock: vi.fn(),
  updateTaskProgressMock: vi.fn(),
  createTaskMock: vi.fn(),
  syncVideoMock: vi.fn(),
}))

vi.mock('@/api/db/queries/sources', () => ({
  replaceSourcesForSite: replaceSourcesForSiteMock,
  upsertSources: upsertSourcesMock,
}))
vi.mock('@/api/db/queries/videos', () => ({
  METADATA_SOURCE_PRIORITY: { tmdb: 4, douban: 3, manual: 2, crawler: 1 },
  insertCrawledVideo: insertCrawledVideoMock,
  upsertVideoAliases: upsertVideoAliasesMock,
  bumpEpisodeCountIfHigher: bumpEpisodeCountIfHigherMock,
}))
vi.mock('@/api/services/MediaCatalogService', () => ({
  MediaCatalogService: class {
    findOrCreate = findOrCreateMock
  },
}))
vi.mock('@/api/services/TitleNormalizer', () => ({
  normalizeTitle: vi.fn((t: string) => t.toLowerCase()),
}))
vi.mock('@/api/services/VideoIndexSyncService', () => ({
  VideoIndexSyncService: class {
    syncVideo = syncVideoMock
  },
}))
vi.mock('@/api/db/queries/crawlerTasks', () => ({
  createTask: createTaskMock,
  updateTaskStatus: updateTaskStatusMock,
  updateTaskProgress: updateTaskProgressMock,
}))
vi.mock('@/api/lib/config', () => ({
  config: { AUTO_PUBLISH_CRAWLED: 'false' },
}))
vi.mock('@/api/lib/queue', () => ({
  enrichmentQueue: { add: vi.fn().mockResolvedValue(undefined) },
  imageHealthQueue: { add: vi.fn().mockResolvedValue(undefined) },
}))

import { CrawlerService } from '@/api/services/CrawlerService'

// ── 共享 helpers ──────────────────────────────────────────────────

const MOCK_ES = {} as never
/** 基础 db mock，提供 query 方法（返回空行） */
function makeMockDb() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  }
}

function makeParsed(overrides: {
  title?: string
  sourceVodId?: string
  sources?: unknown[]
} = {}) {
  return {
    video: {
      title: overrides.title ?? '测试视频',
      titleEn: null,
      sourceVodId: overrides.sourceVodId ?? 'vod-001',
      type: 'movie' as const,
      year: 2024,
      country: 'CN',
      genre: null,
      description: null,
      coverUrl: null,
      category: null,
      contentRating: 'general' as const,
      director: [],
      cast: [],
      writers: [],
      status: 'completed' as const,
    },
    sources: (overrides.sources ?? []) as {
      episodeNumber: number
      sourceUrl: string
      sourceName: string
      type: 'hls' | 'mp4'
      seasonNumber?: number
    }[],
  }
}

const SOURCE_CONFIG = {
  name: 'test-site',
  base: 'https://example.com',
  format: 'json' as const,
  ingestPolicy: { allow_auto_publish: false, source_update: 'replace' as const },
}

// ── Tests ─────────────────────────────────────────────────────────

describe('Fix-1 (R1): empty sources 守卫 — upsertVideo', () => {
  beforeEach(() => {
    findOrCreateMock.mockReset().mockResolvedValue({ id: 'cat-1', title: '测试视频' })
    insertCrawledVideoMock.mockReset().mockResolvedValue({ id: 'vid-1' })
    bumpEpisodeCountIfHigherMock.mockReset().mockResolvedValue(undefined)
    upsertVideoAliasesMock.mockReset().mockResolvedValue(undefined)
    replaceSourcesForSiteMock.mockReset()
    syncVideoMock.mockReset().mockResolvedValue(undefined)
  })

  it('#1 empty sources → 不调 replaceSourcesForSite，emit warn crawl.upsert.empty_sources', async () => {
    const db = makeMockDb()
    const service = new CrawlerService(db as never, MOCK_ES)
    const emitLogs: Array<{ level: string; stage: string }> = []
    const emit = vi.fn(async (level: string, stage: string) => {
      emitLogs.push({ stage, level })
    })

    const parsed = makeParsed({ sources: [] })
    await service.upsertVideo(parsed as never, SOURCE_CONFIG.ingestPolicy, 'test-site', emit as never)

    expect(replaceSourcesForSiteMock).not.toHaveBeenCalled()
    expect(emit).toHaveBeenCalledWith(
      'warn',
      'crawl.upsert.empty_sources',
      expect.stringContaining('跳过 replace'),
      expect.objectContaining({ siteKey: 'test-site' }),
    )
  })
})

describe('Fix-2A (R3): 增量截断告警 — crawl()', () => {
  beforeEach(() => {
    createTaskMock.mockReset().mockResolvedValue({ id: 'task-1' })
    updateTaskStatusMock.mockReset().mockResolvedValue(undefined)
    updateTaskProgressMock.mockReset().mockResolvedValue(undefined)
    findOrCreateMock.mockReset().mockResolvedValue({ id: 'cat-1', title: '测试' })
    insertCrawledVideoMock.mockReset().mockResolvedValue({ id: 'vid-1' })
    bumpEpisodeCountIfHigherMock.mockReset().mockResolvedValue(undefined)
    upsertVideoAliasesMock.mockReset().mockResolvedValue(undefined)
    upsertSourcesMock.mockReset().mockResolvedValue(0)
    syncVideoMock.mockReset().mockResolvedValue(undefined)
    replaceSourcesForSiteMock.mockReset().mockResolvedValue({
      sourcesAdded: 0, sourcesKept: 0, sourcesRemoved: 0,
    })
  })

  it('#2 增量模式首页 >= 10 条 → emit crawl.page.truncated warn', async () => {
    const db = makeMockDb()
    const service = new CrawlerService(db as never, MOCK_ES)
    // 10 个视频（触发告警阈值）
    const items = Array.from({ length: 10 }, (_, i) =>
      makeParsed({ title: `视频${i}`, sourceVodId: `v${i}` })
    )
    vi.spyOn(service as never, 'fetchPage').mockResolvedValue(items as never)

    const logs: Array<{ level: string; stage: string }> = []
    await service.crawl(SOURCE_CONFIG, {
      hoursAgo: 24,
      taskId: 'task-1',
      onLog: async ({ level, stage }) => { logs.push({ level, stage }) },
    })

    const truncLog = logs.find((l) => l.stage === 'crawl.page.truncated')
    expect(truncLog).toBeDefined()
    expect(truncLog?.level).toBe('warn')
  })

  it('#3 增量模式首页 < 10 条 → 不 emit 截断告警', async () => {
    const db = makeMockDb()
    const service = new CrawlerService(db as never, MOCK_ES)
    // 5 个视频（未满载）
    const items = Array.from({ length: 5 }, (_, i) =>
      makeParsed({ title: `视频${i}`, sourceVodId: `v${i}` })
    )
    vi.spyOn(service as never, 'fetchPage').mockResolvedValue(items as never)

    const logs: Array<{ stage: string }> = []
    await service.crawl(SOURCE_CONFIG, {
      hoursAgo: 24,
      taskId: 'task-1',
      onLog: async ({ stage }) => { logs.push({ stage }) },
    })

    expect(logs.find((l) => l.stage === 'crawl.page.truncated')).toBeUndefined()
  })
})

describe('Fix-3 (R2): 空 title 过滤 — crawl()', () => {
  beforeEach(() => {
    createTaskMock.mockReset().mockResolvedValue({ id: 'task-1' })
    updateTaskStatusMock.mockReset().mockResolvedValue(undefined)
    updateTaskProgressMock.mockReset().mockResolvedValue(undefined)
    findOrCreateMock.mockReset().mockResolvedValue({ id: 'cat-1', title: '' })
    insertCrawledVideoMock.mockReset()
    upsertVideoAliasesMock.mockReset().mockResolvedValue(undefined)
    upsertSourcesMock.mockReset().mockResolvedValue(0)
    syncVideoMock.mockReset().mockResolvedValue(undefined)
  })

  it('#4 空 title → errors++，emit crawl.skip.empty_title warn，不入库', async () => {
    const db = makeMockDb()
    const service = new CrawlerService(db as never, MOCK_ES)
    const emptyTitleItem = makeParsed({ title: '', sourceVodId: 'empty-1' })
    // 第一页返回 1 个空 title 项；第二页返回 [] 触发 items.length===0 break，终止 while 循环
    vi.spyOn(service as never, 'fetchPage')
      .mockResolvedValueOnce([emptyTitleItem] as never)
      .mockResolvedValueOnce([] as never)

    const logs: Array<{ stage: string; level: string }> = []
    const result = await service.crawl(SOURCE_CONFIG, {
      taskId: 'task-1',
      onLog: async ({ level, stage }) => { logs.push({ level, stage }) },
    })

    expect(result.errors).toBe(1)
    expect(result.videosUpserted).toBe(0)
    // 不调 MediaCatalogService / insertCrawledVideo
    expect(insertCrawledVideoMock).not.toHaveBeenCalled()
    expect(findOrCreateMock).not.toHaveBeenCalled()
    // 有告警日志
    const skipLog = logs.find((l) => l.stage === 'crawl.skip.empty_title')
    expect(skipLog).toBeDefined()
    expect(skipLog?.level).toBe('warn')
  })
})

describe('Fix-1 守卫完整性: empty sources 不穿透到 replaceSourcesForSite', () => {
  /**
   * #5 验证：当 sources = [] 时，CrawlerService.upsertVideo 的守卫使
   * replaceSourcesForSiteMock 永远不被调用（即使 mock 实现为 throw，守卫也应先拦截）
   */
  it('#5 empty sources 守卫先于 replaceSourcesForSite 调用生效', async () => {
    // 如果守卫失效，会穿透到 replaceSourcesForSiteMock；
    // 在本次 beforeEach 里把 mock 设置为 throw，验证守卫已阻断
    replaceSourcesForSiteMock.mockReset().mockRejectedValue(
      new Error('replaceSourcesForSite called with empty newSources — refuse to wipe site sources')
    )
    findOrCreateMock.mockReset().mockResolvedValue({ id: 'cat-1', title: '测试' })
    insertCrawledVideoMock.mockReset().mockResolvedValue({ id: 'vid-1' })
    bumpEpisodeCountIfHigherMock.mockReset().mockResolvedValue(undefined)
    upsertVideoAliasesMock.mockReset().mockResolvedValue(undefined)
    syncVideoMock.mockReset().mockResolvedValue(undefined)

    const db = makeMockDb()
    const service = new CrawlerService(db as never, MOCK_ES)
    const parsed = makeParsed({ sources: [] })

    // 守卫应阻止调用，不 throw
    await expect(
      service.upsertVideo(parsed as never, SOURCE_CONFIG.ingestPolicy, 'test-site')
    ).resolves.not.toThrow()

    // 确认 replaceSourcesForSite 从未被调用
    expect(replaceSourcesForSiteMock).not.toHaveBeenCalled()
  })
})

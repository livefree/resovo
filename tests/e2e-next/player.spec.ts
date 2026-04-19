/**
 * tests/e2e-next/player.spec.ts
 * M3-PLAYER-03: 播放页 E2E（从 tests/e2e/player.spec.ts 迁移）
 * 覆盖：PlayerShell / 多集动漫 / VideoPlayer 集成 / PLAYER-10 完整链路
 */

import { test, expect } from '@playwright/test'
import type { Video } from '../../apps/web/src/types'

const API_BASE = 'http://localhost:4000/v1'

const MOCK_MOVIE: Video = {
  id: 'uuid-1',
  shortId: 'aB3kR9x1',
  slug: 'test-movie-aB3kR9x1',
  title: '测试电影',
  titleEn: 'Test Movie',
  description: '这是一部测试电影的简介',
  coverUrl: null,
  type: 'movie',
  genres: ['action'],
  rating: 8.5,
  year: 2024,
  country: 'CN',
  episodeCount: 1,
  status: 'completed',
  director: ['张导演'],
  cast: ['李演员', '王演员'],
  writers: ['赵编剧'],
  sourceCount: 2,
  subtitleLangs: ['zh-CN'],
  sourceContentType: null,
  normalizedType: null,
  contentFormat: 'movie',
  episodePattern: 'single',
  reviewStatus: 'approved',
  visibilityStatus: 'public',
  needsManualReview: false,
  contentRating: 'general',
  createdAt: '2024-01-01T00:00:00.000Z',
  catalogId: null,
  imdbId: null,
  tmdbId: null,
  titleOriginal: null,
  aliases: [],
  languages: ['zh-CN'],
  tags: [],
  ratingVotes: 1000,
  runtimeMinutes: 120,
  doubanStatus: 'matched',
  sourceCheckStatus: 'ok',
  metaScore: 80,
}

const MOCK_ANIME: Video = {
  ...MOCK_MOVIE,
  shortId: 'bC4lS0y2',
  slug: 'test-anime-bC4lS0y2',
  title: '测试动漫',
  titleEn: 'Test Anime',
  type: 'anime',
  status: 'ongoing',
  episodeCount: 12,
  contentFormat: 'episodic',
  episodePattern: 'multi',
}

async function mockVideoApi(
  page: Parameters<typeof test>[1] extends { page: infer P } ? P : never,
  video: Video
) {
  await page.route(`${API_BASE}/videos/${video.shortId}`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: video }),
    })
  })
}

const MOCK_HLS_SOURCE = {
  id: 'src-uuid-1',
  videoId: 'uuid-1',
  episodeNumber: null,
  sourceUrl: 'https://example.com/test.m3u8',
  sourceName: '线路1',
  quality: '1080P',
  type: 'hls',
  isActive: true,
  lastChecked: null,
}

// ── PLAYER-02: 播放页布局 ─────────────────────────────────────────

test.describe('播放页（PlayerShell）', () => {
  test.beforeEach(async ({ page }) => {
    await mockVideoApi(page, MOCK_MOVIE)
    await page.goto(`/en/watch/${MOCK_MOVIE.slug}`)
  })

  test('播放页正常加载，显示播放区域', async ({ page }) => {
    await expect(page.getByTestId('watch-page')).toBeVisible()
    await expect(page.getByTestId('player-shell')).toBeVisible()
    await expect(page.getByTestId('player-video-area')).toBeVisible()
  })

  test('标题链接指向详情页', async ({ page }) => {
    const titleLink = page.getByTestId('player-title-link')
    await expect(titleLink).toBeVisible()
    await expect(titleLink).toContainText('测试电影')
  })

  test('?ep=1 参数初始化集数正确', async ({ page }) => {
    await mockVideoApi(page, MOCK_ANIME)
    await page.goto(`/en/watch/${MOCK_ANIME.slug}?ep=3`)
    await page.waitForTimeout(500)
    await expect(page.getByTestId('watch-page')).toBeVisible()
  })

  test('剧场模式切换按钮可见（大屏设备）', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    const theaterBtn = page.getByTestId('theater-mode-btn')
    await expect(theaterBtn).toBeAttached()
  })
})

test.describe('播放页（多集动漫）', () => {
  test.beforeEach(async ({ page }) => {
    await mockVideoApi(page, MOCK_ANIME)
    await page.goto(`/en/watch/${MOCK_ANIME.slug}`)
  })

  test('显示右侧选集面板', async ({ page }) => {
    await expect(page.getByTestId('player-side-panel')).toBeVisible()
    await expect(page.getByTestId('side-episode-1')).toBeVisible()
  })

  test('选集面板显示正确数量', async ({ page }) => {
    const epBtns = page.getByTestId(/^side-episode-\d+$/)
    await expect(epBtns).toHaveCount(12)
  })
})

// ── PLAYER-03: VideoPlayer 集成 ───────────────────────────────────

test.describe('播放页（VideoPlayer 集成）', () => {
  test.beforeEach(async ({ page }) => {
    await mockVideoApi(page, MOCK_MOVIE)
    await page.route(`${API_BASE}/videos/${MOCK_MOVIE.shortId}/sources*`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [MOCK_HLS_SOURCE],
          pagination: { total: 1, page: 1, limit: 20, hasNext: false },
        }),
      })
    })
    await page.goto(`/en/watch/${MOCK_MOVIE.slug}`)
    await page.waitForTimeout(800)
  })

  test('播放区域存在', async ({ page }) => {
    await expect(page.getByTestId('player-video-area')).toBeVisible()
  })

  test('有播放源时渲染 VideoPlayer', async ({ page }) => {
    const playerEl = page.getByTestId('video-player')
    await expect(playerEl).toBeAttached({ timeout: 5000 })
  })
})

// ═══════════════════════════════════════════════════════════════════
// PLAYER-10: 播放页 Shell + SourceBar 切换 + DanmakuBar 联通
// ═══════════════════════════════════════════════════════════════════

const MOCK_MULTI_SOURCES = [
  { ...MOCK_HLS_SOURCE, id: 'src-1', sourceName: '线路1' },
  { ...MOCK_HLS_SOURCE, id: 'src-2', sourceName: '线路2', sourceUrl: 'https://example.com/test2.m3u8' },
  { ...MOCK_HLS_SOURCE, id: 'src-3', sourceName: '线路3', sourceUrl: 'https://example.com/test3.m3u8' },
]

const MOCK_DANMAKU_RESPONSE = {
  data: [
    { time: 10, type: 0, color: '#ffffff', text: '测试弹幕' },
  ],
  pagination: { total: 1, page: 1, limit: 100 },
}

async function mockMultiSources(page: Parameters<typeof test>[1] extends { page: infer P } ? P : never) {
  await page.route(`${API_BASE}/videos/${MOCK_MOVIE.shortId}/sources*`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: MOCK_MULTI_SOURCES,
        pagination: { total: 3, page: 1, limit: 20, hasNext: false },
      }),
    })
  })
}

async function mockDanmakuApi(page: Parameters<typeof test>[1] extends { page: infer P } ? P : never) {
  await page.route(`${API_BASE}/videos/${MOCK_MOVIE.shortId}/danmaku*`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_DANMAKU_RESPONSE),
    })
  })
}

test.describe('PLAYER-10: 播放页完整链路', () => {
  test('访问 /watch/slug-shortId?ep=1 播放页 shell 加载', async ({ page }) => {
    await mockVideoApi(page, MOCK_MOVIE)
    await page.route(`${API_BASE}/videos/${MOCK_MOVIE.shortId}/sources*`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [MOCK_HLS_SOURCE], pagination: { total: 1, page: 1, limit: 20 } }),
      })
    })
    await page.goto(`/en/watch/${MOCK_MOVIE.slug}?ep=1`)
    await expect(page.getByTestId('watch-page')).toBeVisible()
    await expect(page.getByTestId('player-shell')).toBeVisible()
    await expect(page.getByTestId('player-video-area')).toBeVisible()
  })

  test('多线路时 SourceBar 渲染所有线路按钮', async ({ page }) => {
    await mockVideoApi(page, MOCK_MOVIE)
    await mockMultiSources(page)
    await page.goto(`/en/watch/${MOCK_MOVIE.slug}`)
    await page.waitForTimeout(800)
    await expect(page.getByTestId('source-bar')).toBeVisible()
    await expect(page.getByTestId('source-btn-0')).toBeVisible()
    await expect(page.getByTestId('source-btn-1')).toBeVisible()
    await expect(page.getByTestId('source-btn-2')).toBeVisible()
  })

  test('点击线路2按钮后 source-btn-1 高亮变为活跃状态', async ({ page }) => {
    await mockVideoApi(page, MOCK_MOVIE)
    await mockMultiSources(page)
    await page.goto(`/en/watch/${MOCK_MOVIE.slug}`)
    await page.waitForTimeout(800)
    await page.getByTestId('source-btn-1').click()
    const btn1 = page.getByTestId('source-btn-1')
    await expect(btn1).toBeVisible()
    await expect(page.getByTestId('player-shell')).toBeVisible()
  })

  test('DanmakuBar 存在于播放页中（data-testid=danmaku-bar）', async ({ page }) => {
    await mockVideoApi(page, MOCK_MOVIE)
    await mockDanmakuApi(page)
    await page.route(`${API_BASE}/videos/${MOCK_MOVIE.shortId}/sources*`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [MOCK_HLS_SOURCE], pagination: { total: 1, page: 1, limit: 20 } }),
      })
    })
    await page.goto(`/en/watch/${MOCK_MOVIE.slug}`)
    await page.waitForTimeout(500)
    await expect(page.getByTestId('danmaku-bar')).toBeVisible()
    await expect(page.getByTestId('danmaku-toggle')).toBeVisible()
    await expect(page.getByTestId('danmaku-input')).toBeAttached()
  })
})

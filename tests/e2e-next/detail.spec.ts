/**
 * tests/e2e-next/detail.spec.ts
 * M3-DETAIL-03: 详情页 E2E（从 tests/e2e/player.spec.ts 迁移）
 * 覆盖：电影详情页 + 动漫详情页（多集）
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

// ── 电影详情页 ─────────────────────────────────────────────────────

test.describe('电影详情页', () => {
  test.beforeEach(async ({ page }) => {
    await mockVideoApi(page, MOCK_MOVIE)
    await page.goto(`/en/movie/${MOCK_MOVIE.slug}`)
  })

  test('详情页正常加载，显示标题', async ({ page }) => {
    await expect(page.getByTestId('video-detail-hero')).toBeVisible()
    await expect(page.getByTestId('detail-title')).toContainText('测试电影')
  })

  test('显示视频描述', async ({ page }) => {
    await expect(page.getByTestId('detail-description')).toContainText('简介')
  })

  test('显示导演/演员 MetaChip', async ({ page }) => {
    await expect(page.getByTestId('video-detail-meta')).toBeVisible()
    await expect(page.getByTestId('meta-chip-director')).toBeVisible()
    await expect(page.getByTestId('meta-chip-actor').first()).toBeVisible()
  })

  test('点击导演 MetaChip 跳转到搜索页', async ({ page }) => {
    await page.getByTestId('meta-chip-director').first().click()
    await expect(page).toHaveURL(/search\?director=/)
  })

  test('立即观看按钮指向播放页', async ({ page }) => {
    const watchBtn = page.getByTestId('detail-watch-btn')
    await expect(watchBtn).toBeVisible()
    const href = await watchBtn.getAttribute('href')
    expect(href).toContain(`/watch/${MOCK_MOVIE.shortId}`)
    expect(href).toContain('ep=1')
  })

  test('电影类型不显示选集网格', async ({ page }) => {
    await expect(page.getByTestId('episode-grid')).not.toBeVisible()
  })
})

// ── 动漫详情页（多集） ─────────────────────────────────────────────

test.describe('动漫详情页（多集）', () => {
  test.beforeEach(async ({ page }) => {
    await mockVideoApi(page, MOCK_ANIME)
    await page.goto(`/en/anime/${MOCK_ANIME.slug}`)
  })

  test('详情页正常加载', async ({ page }) => {
    await expect(page.getByTestId('video-detail-hero')).toBeVisible()
    await expect(page.getByTestId('detail-title')).toContainText('测试动漫')
  })

  test('显示选集网格', async ({ page }) => {
    await expect(page.getByTestId('episode-grid')).toBeVisible()
  })

  test('选集按钮数量正确', async ({ page }) => {
    const episodes = page.getByTestId(/^episode-\d+$/)
    await expect(episodes).toHaveCount(12)
  })

  test('点击第 3 集跳转到播放页 ep=3', async ({ page }) => {
    const ep3 = page.getByTestId('episode-3')
    const href = await ep3.getAttribute('href')
    expect(href).toContain('ep=3')
    expect(href).toContain(`/watch/${MOCK_ANIME.shortId}`)
  })
})

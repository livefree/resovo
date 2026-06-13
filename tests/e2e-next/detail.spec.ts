/**
 * tests/e2e-next/detail.spec.ts
 * M3-DETAIL-03: 详情页 E2E（从 tests/e2e/player.spec.ts 迁移）
 * 覆盖：电影详情页 + 动漫详情页（多集）
 */

import { test, expect } from './_fixtures'
import type { Video } from '@resovo/types'

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
    await expect(page.getByTestId('detail-hero')).toBeVisible()
    await expect(page.getByTestId('detail-title')).toContainText('测试电影')
  })

  test('显示视频描述', async ({ page }) => {
    await expect(page.getByTestId('detail-description')).toContainText('简介')
  })

  test('显示导演/演员 MetaChip', async ({ page }) => {
    await expect(page.getByTestId('detail-hero-meta')).toBeVisible()
    await expect(page.getByTestId('meta-chip-director')).toBeVisible()
    await expect(page.getByTestId('meta-chip-actor').first()).toBeVisible()
  })

  test('点击导演 MetaChip 跳转到搜索页', async ({ page }) => {
    await page.getByTestId('meta-chip-director').first().click()
    await expect(page).toHaveURL(/search\?director=/)
  })

  test('点击立即播放后 URL 进入 /watch/...', async ({ page }) => {
    const playBtn = page.getByTestId('detail-play-btn')
    await expect(playBtn).toBeVisible()
    await playBtn.click()
    // 规范 watch 链接 = /watch/{base-slug}-{shortId}?ep=1（DetailHero watchSlug）。MOCK_MOVIE.slug
    // 已是 base-shortId 形式（= seed DB slug 'test-movie' + shortId），故精确匹配该段；锚定
    // (?:[?#/]|$) 确保 slug 段后紧跟 ?/#// 或结尾——畸形如双 shortId `/watch/...-{shortId}-{shortId}`
    // 会因 slug 段后随 '-' 而不匹配，**不掩盖 watch URL 畸形**（Codex 复审）。
    await expect(page).toHaveURL(new RegExp(`/watch/${MOCK_MOVIE.slug}(?:[?#/]|$)`))
  })

  test('电影类型不显示选集选择器', async ({ page }) => {
    await expect(page.getByTestId('episode-picker')).not.toBeVisible()
  })
})

// ── 动漫详情页（多集） ─────────────────────────────────────────────

test.describe('动漫详情页（多集）', () => {
  test.beforeEach(async ({ page }) => {
    await mockVideoApi(page, MOCK_ANIME)
    await page.goto(`/en/anime/${MOCK_ANIME.slug}`)
  })

  test('详情页正常加载', async ({ page }) => {
    await expect(page.getByTestId('detail-hero')).toBeVisible()
    await expect(page.getByTestId('detail-title')).toContainText('测试动漫')
  })

  test('显示选集选择器', async ({ page }) => {
    await expect(page.getByTestId('episode-picker')).toBeVisible()
  })

  test('选集按钮数量正确', async ({ page }) => {
    // EpisodePicker RANGE_SIZE=10：>10 集分段，首段显前 10 集按钮（其余经分段选择器切换）。
    // 12 集 → 首段 10 个 episode-btn（侧栏 side-episode 才显全 12，见 player.spec）。
    const episodes = page.getByTestId(/^episode-btn-\d+$/)
    await expect(episodes).toHaveCount(10)
  })

  test('点击第 3 集更新 URL ep=3（不重载页面）', async ({ page }) => {
    const ep3 = page.getByTestId('episode-btn-3')
    await ep3.click()
    await expect(page).toHaveURL(/ep=3/)
  })
})

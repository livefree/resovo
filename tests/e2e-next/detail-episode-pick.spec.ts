/**
 * tests/e2e-next/detail-episode-pick.spec.ts
 * M5-CLEANUP-11 ↔ BLOCKER #9 固化：详情页选集链路
 *
 * CLEANUP-10 修复：
 *   - EpisodePicker 点击按钮 → router.replace(?ep=N, scroll:false) + 本地 activeEp 更新
 *   - DetailHero 从 VideoDetailClient 读 activeEpisode，点"立即播放"跳 /watch/...?ep=N
 */

import { test, expect } from './_fixtures'

const API_BASE = 'http://localhost:4000/v1'

const MOCK_DETAIL_ANIME = {
  id: 'uuid-detail-ep',
  shortId: 'DetailEp',
  slug: 'detail-episode-anime',
  title: '详情选集测试动漫',
  titleEn: 'Detail Episode Anime',
  type: 'anime',
  coverUrl: null,
  rating: 8.3,
  year: 2024,
  sourceCount: 1,
  episodeCount: 12,
  status: 'ongoing',
  contentFormat: 'episodic',
  episodePattern: 'multi',
  director: ['张导'],
  cast: ['李演员'],
  writers: [],
  genres: ['anime'],
  subtitleLangs: ['zh-CN'],
  country: 'CN',
  description: '测试详情简介',
  languages: ['zh-CN'],
  aliases: [],
  tags: [],
  posterBlurhash: null,
}

test.describe('详情页选集链路（BLOCKER #9 固化）', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`${API_BASE}/videos/${MOCK_DETAIL_ANIME.shortId}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_DETAIL_ANIME }),
      }),
    )
    // RelatedVideos 可能请求 /videos?... 推荐相关，空返回兜底
    await page.route(`${API_BASE}/videos?*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [],
          pagination: { total: 0, page: 1, limit: 40, hasNext: false },
        }),
      }),
    )
  })

  test('点击选集 3 → URL 追加 ?ep=3 且该集 aria-pressed=true', async ({ page }) => {
    await page.goto(
      `/en/anime/${MOCK_DETAIL_ANIME.slug}-${MOCK_DETAIL_ANIME.shortId}`,
    )
    await expect(page.getByTestId('episode-picker')).toBeVisible({ timeout: 10_000 })

    const btn3 = page.getByTestId('episode-btn-3')
    await expect(btn3).toBeVisible()
    await btn3.click()

    await page.waitForURL(/[?&]ep=3/, { timeout: 5_000 })
    expect(page.url()).toMatch(/[?&]ep=3/)
    await expect(btn3).toHaveAttribute('aria-pressed', 'true')
  })

  test('选 5 → 点"立即播放" → URL 跳到 /watch/...?ep=5', async ({ page }) => {
    await page.goto(
      `/en/anime/${MOCK_DETAIL_ANIME.slug}-${MOCK_DETAIL_ANIME.shortId}`,
    )
    await expect(page.getByTestId('episode-picker')).toBeVisible({ timeout: 10_000 })

    await page.getByTestId('episode-btn-5').click()
    await page.waitForURL(/[?&]ep=5/, { timeout: 5_000 })

    const playBtn = page.getByTestId('detail-play-btn')
    await expect(playBtn).toBeVisible()
    await playBtn.click()

    await page.waitForURL(/\/watch\/.*[?&]ep=5/, { timeout: 5_000 })
    expect(page.url()).toMatch(/\/watch\/.*[?&]ep=5/)
  })
})

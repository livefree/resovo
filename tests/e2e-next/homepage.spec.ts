/**
 * tests/e2e-next/homepage.spec.ts
 * M2: 首页加载、导航、主题切换、语言切换 E2E 测试
 * 使用 page.route() 拦截 API 请求，不依赖真实后端
 */

import { test, expect } from './_fixtures'
import type { VideoCard } from '@resovo/types'

const API_BASE = 'http://localhost:4000/v1'

// mock 类型绑定 @resovo/types 真源（test-rules E2E 规程第 5 条）——
// 历史漂移实证：mock 缺 subtitleLangs → VideoCard deriveSpecs 运行时崩 →
// Next dev overlay 全屏盖断言（CHG-HOME-FE-CONSUME-B 定界：clean HEAD 同样 17 failed）
const MOCK_MOVIE: VideoCard = {
  id: 'uuid-movie-1',
  shortId: 'aB3kR9x1',
  slug: 'test-movie-aB3kR9x1',
  title: '测试电影',
  titleEn: 'Test Movie',
  coverUrl: null,
  posterBlurhash: null,
  posterStatus: null,
  type: 'movie',
  rating: 8.5,
  year: 2024,
  status: 'completed',
  episodeCount: 1,
  sourceCount: 2,
  subtitleLangs: [],
}

const MOCK_SERIES: VideoCard = {
  id: 'uuid-series-1',
  shortId: 'bC4lS0y2',
  slug: 'test-series-bC4lS0y2',
  title: '测试剧集',
  titleEn: 'Test Series',
  coverUrl: null,
  posterBlurhash: null,
  posterStatus: null,
  type: 'series',
  rating: 9.0,
  year: 2024,
  status: 'ongoing',
  episodeCount: 24,
  sourceCount: 1,
  subtitleLangs: [],
}

const MOCK_BANNERS = [
  {
    id: 'ban-001',
    title: '精选推荐电影',
    imageUrl: '',
    linkType: 'video',
    linkTarget: 'aB3kR9x1',
    sortOrder: 0,
    videoType: 'movie',
    videoSlug: 'test-movie-aB3kR9x1',
  },
  {
    id: 'ban-002',
    title: '热门剧集',
    imageUrl: '',
    linkType: 'video',
    linkTarget: 'bC4lS0y2',
    sortOrder: 1,
    videoType: 'series',
    videoSlug: 'test-series-bC4lS0y2',
  },
]

async function mockApiRoutes(
  page: import('@playwright/test').Page,
  options: { readonly emptyShelf?: boolean } = {},
) {
  // 兜底 404（test-rules E2E 规程第 4 条：先注册 = 最低优先级）。
  // 本 spec 自述「不依赖真实后端」，但 CHG-E2E-GATE-AUDIT-A 后 :4000 API 恒起——
  // 未 mock 端点（/home/top10 等）会漏真实数据，真实 coverUrl 指向外部 CDN，
  // 慢图阻塞 'load' 事件 → goto 30s 超时级联（CHG-HOME-FE-CONSUME-B 定界实证）。
  await page.route(`${API_BASE}/**`, (route) => {
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'not mocked (homepage spec)', status: 404 } }),
    })
  })

  await page.route(`${API_BASE}/banners*`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_BANNERS }),
    })
  })

  // CHG-HOME-FE-CONSUME-B（ADR-184）：3 个 hot shelf 切换聚合消费
  await page.route(`${API_BASE}/home/shelf*`, (route) => {
    const section = new URL(route.request().url()).searchParams.get('section')
    const item = section === 'hot_series' ? MOCK_SERIES : MOCK_MOVIE
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          items: options.emptyShelf ? [] : [{ video: item, rank: 1, isPinned: false }],
          snapshotAt: options.emptyShelf ? null : '2026-06-06T12:00:00Z',
          generatedAt: '2026-06-06T12:00:30Z',
        },
      }),
    })
  })

  await page.route(`${API_BASE}/videos/trending*`, (route) => {
    const url = route.request().url()
    const type = new URL(url).searchParams.get('type')
    const item = type === 'series' ? MOCK_SERIES : MOCK_MOVIE

    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [item],
        pagination: { total: 1, page: 1, limit: 10, hasNext: false },
      }),
    })
  })
}

// ═══════════════════════════════════════════════════════════════════
// 首页加载
// ═══════════════════════════════════════════════════════════════════

test.describe('首页', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto('/en')
  })

  test('首页正常加载，显示导航栏', async ({ page }) => {
    await expect(page.getByTestId('nav-logo')).toBeVisible()
    await expect(page.getByTestId('nav-logo')).toContainText('Resovo')
  })

  test('导航栏显示分类标签', async ({ page }) => {
    await expect(page.getByTestId('nav-cat-movie')).toBeVisible()
    await expect(page.getByTestId('nav-cat-series')).toBeVisible()
    await expect(page.getByTestId('nav-cat-anime')).toBeVisible()
  })

  test('Hero Banner 区域存在', async ({ page }) => {
    await expect(page.getByTestId('hero-banner')).toBeVisible()
  })

  test('HeroBanner 渲染 banner 标题', async ({ page }) => {
    await expect(page.getByTestId('hero-banner')).toBeVisible()
    await expect(page.getByTestId('hero-banner')).toContainText('精选推荐电影')
  })

  test('HeroBanner 视频 banner 显示"立即播放"和"详情信息"双 CTA', async ({ page }) => {
    // HeroBanner 响应式双布局（PC md:flex + mobile md:hidden）均渲染 CTA，
    // 用 :visible 限定当前视口（1280，PC）可见的那套，避免 strict mode 双匹配
    await expect(page.locator('[data-testid="hero-watch-btn"]:visible')).toBeVisible()
    await expect(page.locator('[data-testid="hero-detail-btn"]:visible')).toBeVisible()
  })

  test('HeroBanner 指示点数量与 banner 数量一致', async ({ page }) => {
    // 双布局：仅数当前视口可见的 dots（PC 一套），mobile md:hidden 不计
    const dots = page.locator('[data-testid^="banner-dot-"]:visible')
    await expect(dots).toHaveCount(2)
  })

  test('点击第二个指示点切换到第二条 banner', async ({ page }) => {
    await page.locator('[data-testid="banner-dot-1"]:visible').click()
    await expect(page.getByTestId('hero-banner')).toContainText('热门剧集')
  })

  test('电影网格区域存在', async ({ page }) => {
    await expect(page.getByTestId('movie-grid')).toBeVisible()
  })

  test('剧集网格区域存在', async ({ page }) => {
    await expect(page.getByTestId('series-grid')).toBeVisible()
  })

  test('hot shelf 消费聚合端点渲染卡片（ADR-184）', async ({ page }) => {
    await expect(page.getByTestId('movie-grid')).toContainText('测试电影')
    await expect(page.getByTestId('series-grid')).toContainText('测试剧集')
  })

  test('底部页脚常驻显示', async ({ page }) => {
    // footer-disclaimer testid 已退役 → Footer 顶层 global-footer（含免责声明区）
    await expect(page.getByTestId('global-footer')).toBeVisible()
  })

})

// ═══════════════════════════════════════════════════════════════════
// hot shelf 降级（ADR-184 D-184 消费侧兜底：聚合空 → 趋势 query）
// ═══════════════════════════════════════════════════════════════════

test.describe('hot shelf 空降级', () => {
  test('聚合 items 为空时降级趋势 query，网格仍渲染内容', async ({ page }) => {
    await mockApiRoutes(page, { emptyShelf: true })
    await page.goto('/en')
    // shelf 空 → fetchTrending 降级 → trending mock 的 MOCK_MOVIE/MOCK_SERIES 渲染
    await expect(page.getByTestId('movie-grid')).toContainText('测试电影')
    await expect(page.getByTestId('series-grid')).toContainText('测试剧集')
  })
})

// ═══════════════════════════════════════════════════════════════════
// 主题切换
// ═══════════════════════════════════════════════════════════════════

test.describe('主题切换', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto('/en')
  })

  test('主题切换容器存在并包含三个选项', async ({ page }) => {
    await expect(page.getByTestId('theme-toggle')).toBeVisible()
    await expect(page.getByTestId('theme-toggle-light')).toBeVisible()
    await expect(page.getByTestId('theme-toggle-system')).toBeVisible()
    await expect(page.getByTestId('theme-toggle-dark')).toBeVisible()
  })

  test('点击深色按钮切换到深色主题', async ({ page }) => {
    await page.getByTestId('theme-toggle-dark').click()
    const checked = await page.getByTestId('theme-toggle-dark').getAttribute('aria-checked')
    expect(checked).toBe('true')
    const dataTheme = await page.locator('html').getAttribute('data-theme')
    expect(dataTheme).toBe('dark')
  })

  test('点击浅色按钮切换到浅色主题', async ({ page }) => {
    await page.getByTestId('theme-toggle-light').click()
    const checked = await page.getByTestId('theme-toggle-light').getAttribute('aria-checked')
    expect(checked).toBe('true')
    const dataTheme = await page.locator('html').getAttribute('data-theme')
    expect(dataTheme).toBe('light')
  })

  test('点击系统按钮回到系统主题', async ({ page }) => {
    await page.getByTestId('theme-toggle-dark').click()
    await page.getByTestId('theme-toggle-system').click()
    const checked = await page.getByTestId('theme-toggle-system').getAttribute('aria-checked')
    expect(checked).toBe('true')
  })
})

// ═══════════════════════════════════════════════════════════════════
// 语言切换
// ═══════════════════════════════════════════════════════════════════

// 语言切换功能当前未实装：SettingsDrawer「语言偏好」为 comingSoon 占位，全站无 LocaleSwitcher。
// 旧 nav-locale-trigger/lang-* 交互已退役 → skip，待功能实装后删 .skip 恢复
// （CHORE-E2E-HOMEPAGE-SEARCH-E2E triage 2026-06-18）。
test.describe.skip('语言切换', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto('/en')
  })

  test('切换到中文后页面为中文内容', async ({ page }) => {
    await page.getByTestId('nav-locale-trigger').click()
    await page.getByTestId('lang-zh-CN').click()
    await expect(page).toHaveURL('/zh-CN')
    await expect(page.getByTestId('nav-cat-movie')).toHaveText('电影')
  })

  test('切换回英文后页面为英文内容', async ({ page }) => {
    await page.getByTestId('nav-locale-trigger').click()
    await page.getByTestId('lang-zh-CN').click()
    await page.getByTestId('nav-locale-trigger').click()
    await page.getByTestId('lang-en').click()
    await expect(page).toHaveURL('/en')
    await expect(page.getByTestId('nav-cat-movie')).toHaveText('Movies')
  })
})

// ═══════════════════════════════════════════════════════════════════
// 导航跳转
// ═══════════════════════════════════════════════════════════════════

test.describe('导航跳转', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto('/en')
  })

  test('点击 Logo 返回首页', async ({ page }) => {
    await page.getByTestId('nav-logo').click()
    await expect(page).toHaveURL('/en')
  })

})

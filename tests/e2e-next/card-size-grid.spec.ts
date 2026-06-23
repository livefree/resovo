/**
 * tests/e2e-next/card-size-grid.spec.ts
 * 卡片尺寸体系端到端视觉链路回归（SEQ-20260622-03 Phase 4 / ADR-214 D-214-4/7/9）
 *
 * 验证 SSR 注入 → 前台渲染的完整链路：
 *   ① CARD-SIZE-SSR：`[locale]/layout.tsx` 经 `fetchCardSizeSettings()` + `buildCardSizeRootCss()`
 *      在 SSR 注入 `<style data-card-size-vars>` → `:root` 卡片尺寸 CSS 变量（D-214-6/9）。
 *   ② CARD-SIZE-CARDGRID：FeaturedRow 的 `featured-grid`（CardGrid sizeClass="standard"）桌面消费
 *      `--card-cols-standard-desktop`（≥1024px = 5 列）+ gap `--card-gap-standard`（D-214-7）。
 *   ③ 防溢出（D-214-4 / Codex-R2）：`repeat(…, minmax(0,1fr))` + `.card-grid > * { min-width:0 }`
 *      → 长标题卡片不撑破轨道、网格不水平溢出。
 *   ④ 响应式级联：窄视口（<640px）降至 2 列（globals.css `.card-grid--standard` 默认 --cg-cols:2）。
 *
 * 取值稳定性：SSR `fetchCardSizeSettings` 取数失败（apps/api 无 card_size_settings / 不可达）降级
 *   `CARD_SIZE_DEFAULTS`（standard 5 列/16px），与 migration 124 seed 同值 → 无论后端是否就绪，
 *   注入值恒为 5/16，断言稳定（仅需 web dev server，不强依赖 apps/api DB 状态）。
 *
 * admin PUT→公开读新鲜度（D-214-9 R3 mutation 侧）契约层已由 card-size-admin/public 单测覆盖，
 *   端到端实跑随合并 main 前 e2e gate（依赖 admin 鉴权 + DB 写）。
 */

import { test, expect } from './_fixtures'

/** 长标题确保 line-clamp + min-width:0 防溢出路径被覆盖（D-214-4） */
const LONG_TITLE = '卡片尺寸体系端到端视觉回归用超长标题确保 line-clamp 生效且不撑破网格轨道导致水平溢出'

function mockItem(i: number, title: string) {
  return {
    id: `uuid-cs-${i}`,
    shortId: `CsCard${i}`,
    slug: `card-size-test-${i}`,
    title,
    titleEn: `Card Size Test ${i}`,
    coverUrl: null,
    posterBlurhash: null,
    posterStatus: null,
    type: 'movie',
    rating: 8.0,
    year: 2024,
    status: 'ongoing',
    episodeCount: 1,
    sourceCount: 1,
    subtitleLangs: ['zh-CN'],
  }
}

// 5 张趋势卡（对齐 FEATURED_SLOTS=5 / standard 默认列数）；首张超长标题验证防溢出
const MOCK_ITEMS = [
  mockItem(1, LONG_TITLE),
  mockItem(2, '卡片二'),
  mockItem(3, '卡片三'),
  mockItem(4, '卡片四'),
  mockItem(5, '卡片五'),
]

async function mockHomeRoutes(page: import('@playwright/test').Page) {
  await page.route(/\/banners(\?|$)/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }),
  )
  await page.route(/\/videos\/trending/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: MOCK_ITEMS,
        pagination: { total: MOCK_ITEMS.length, page: 1, limit: 5, hasNext: false },
      }),
    }),
  )
}

/** 计算 grid-template-columns 的轨道数（computed 返回 "Npx Npx …" 空格分隔像素值） */
function trackCount(gridTemplateColumns: string): number {
  return gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length
}

test.describe('卡片尺寸体系 SSR→视觉链路（ADR-214 D-214-4/7/9）', () => {
  test.beforeEach(async ({ page }) => {
    await mockHomeRoutes(page)
    await page.goto('/en')
    await page.waitForSelector('[data-testid="featured-grid"]', { timeout: 10_000 })
  })

  test('① SSR 注入 :root 卡片尺寸 CSS 变量（D-214-6/9）', async ({ page }) => {
    // `<style data-card-size-vars>` 由 layout.tsx SSR 注入
    expect(await page.locator('style[data-card-size-vars]').count()).toBeGreaterThanOrEqual(1)

    const read = (name: string) =>
      page.evaluate(
        (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
        name,
      )

    // 网格档变量（值 == seed == CARD_SIZE_DEFAULTS，断言稳定）
    expect(await read('--card-cols-standard-desktop')).toBe('5')
    expect(await read('--card-gap-standard')).toBe('16px')
    expect(await read('--card-cols-compact-desktop')).toBe('3')
    expect(await read('--card-gap-compact')).toBe('12px')
    // scroll 档变量（横滚定宽 + gap）
    expect(await read('--card-w-scroll')).toBe('170px')
    expect(await read('--card-gap-scroll')).toBe('16px')
    // 档位×单位绑定：网格档不得有 --card-w-*、scroll 不得有 --card-cols-*（无倒置变量，D-214-10）
    expect(await read('--card-w-standard')).toBe('')
    expect(await read('--card-cols-scroll-desktop')).toBe('')
  })

  test('② featured-grid 桌面消费 DB 列数 = 5 列 + gap 16px（D-214-7）', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 }) // ≥1024 → --cg-cols = var(--card-cols-standard-desktop)
    const grid = page.locator('[data-testid="featured-grid"]')
    const { cols, gap } = await grid.evaluate((el) => {
      const cs = getComputedStyle(el)
      return { cols: cs.gridTemplateColumns, gap: cs.columnGap }
    })
    expect(trackCount(cols)).toBe(5)
    expect(gap).toBe('16px')
  })

  test('③ 长标题不撑破网格轨道、无水平溢出（D-214-4 min-width:0）', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    const grid = page.locator('[data-testid="featured-grid"]')
    // 等首张卡 poster 2:3 布局就位
    await expect
      .poll(async () => (await grid.locator('[data-testid="video-card"] div.group\\/poster').first().boundingBox())?.height ?? 0, { timeout: 5_000 })
      .toBeGreaterThan(100)
    // minmax(0,1fr) + 子项 min-width:0 → grid 内容不超出可视宽度
    const noOverflow = await grid.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)
    expect(noOverflow).toBe(true)
    // 含超长标题的首张卡宽度 ≤ 单列宽上界（gridWidth/5 + 容差），证明未被标题撑破
    const gridBox = await grid.boundingBox()
    const firstCard = await grid.locator('[data-testid="video-card"]').first().boundingBox()
    expect(gridBox).not.toBeNull()
    expect(firstCard).not.toBeNull()
    if (gridBox && firstCard) {
      expect(firstCard.width).toBeLessThanOrEqual(gridBox.width / 5 + 4)
    }
  })

  test('④ 窄视口降至 2 列（响应式级联 + 仍不溢出）', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 }) // <640 → --cg-cols 默认 2
    const grid = page.locator('[data-testid="featured-grid"]')
    const cols = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns)
    expect(trackCount(cols)).toBe(2)
    const noOverflow = await grid.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)
    expect(noOverflow).toBe(true)
  })
})

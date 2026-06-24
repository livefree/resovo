/**
 * tests/e2e-next/card-size-grid.spec.ts
 * 卡片尺寸体系端到端视觉链路回归（ADR-214 Amendment A1 D-214-A1-1/2/3 / SEQ-20260623-01 Phase 7）
 *
 * 验证 SSR 注入 → 前台渲染的完整 size-driven 链路：
 *   ① CARD-SIZE-SSR：`[locale]/layout.tsx` 经 `fetchCardSizeSettings()` + `buildCardSizeRootCss()`
 *      在 SSR 注入 `<style data-card-size-vars>` → `:root` 卡片尺寸 CSS 变量（D-214-6/9）。
 *      Amendment A1：standard 出 `--card-w-standard`（卡宽 px，非列数）；**compact 全栈退役、无残留变量**。
 *   ② size-driven 网格（D-214-A1-1）：FeaturedRow 的 `featured-grid`（CardGrid sizeClass="standard"）
 *      ≥1024px 消费 `--card-w-standard` 做 `repeat(auto-fill, minmax(min(--card-w-standard,100%),1fr))`
 *      → 卡宽恒定（最小 ~200px）、列数由容器宽自动派生（非固定 5 列）+ gap `--card-gap-standard`。
 *   ③ 防溢出（D-214-4 / Codex-R2）：`minmax(min(W,100%),1fr)` + `.card-grid > * { min-width:0 }`
 *      → 长标题卡片不撑破轨道、网格不水平溢出。
 *   ④ 响应式级联（D-214-A1-2）：窄视口（<640px）保留 2 列计数（仅 ≥1024px size-driven）。
 *
 * 取值稳定性：SSR `fetchCardSizeSettings` 取数失败降级 `CARD_SIZE_DEFAULTS`（A1：standard 卡宽 200/16px、
 *   scroll 170/16），与 migration 124+125 净 seed 同值 → 注入值恒为 200/16，断言稳定（仅需 web dev server）。
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

// 5 张趋势卡（对齐 FEATURED_SLOTS=5）；首张超长标题验证防溢出
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

/** 解析 grid-template-columns 轨道（computed 返回 "Npx Npx …" 空格分隔像素值） */
function tracks(gridTemplateColumns: string): number[] {
  return gridTemplateColumns
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => parseFloat(t))
    .filter((n) => !Number.isNaN(n))
}

test.describe('卡片尺寸体系 SSR→size-driven 视觉链路（ADR-214 Amendment A1）', () => {
  test.beforeEach(async ({ page }) => {
    await mockHomeRoutes(page)
    await page.goto('/en')
    await page.waitForSelector('[data-testid="featured-grid"]', { timeout: 10_000 })
  })

  test('① SSR 注入 :root 卡片尺寸变量：standard 出卡宽、compact 退役无残留（D-214-A1-1/3）', async ({ page }) => {
    // `<style data-card-size-vars>` 由 layout.tsx SSR 注入
    expect(await page.locator('style[data-card-size-vars]').count()).toBeGreaterThanOrEqual(1)

    const read = (name: string) =>
      page.evaluate(
        (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
        name,
      )

    // standard size-driven：出卡宽（非列数），值 == 净 seed == CARD_SIZE_DEFAULTS（200/16，断言稳定）
    expect(await read('--card-w-standard')).toBe('200px')
    expect(await read('--card-gap-standard')).toBe('16px')
    // scroll 档：横滚定宽 + gap
    expect(await read('--card-w-scroll')).toBe('170px')
    expect(await read('--card-gap-scroll')).toBe('16px')
    // standard 不再出列数（desktopColumns 本轮 null）
    expect(await read('--card-cols-standard-desktop')).toBe('')
    // compact 全栈退役：任何 compact 变量均无（D-214-A1-3）
    expect(await read('--card-cols-compact-desktop')).toBe('')
    expect(await read('--card-gap-compact')).toBe('')
    expect(await read('--card-w-compact')).toBe('')
  })

  test('② featured-grid 桌面 size-driven：卡宽恒定 ~200px + 列数容器派生 + gap 16px（D-214-A1-1）', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 }) // ≥1024 → size-driven auto-fill
    const grid = page.locator('[data-testid="featured-grid"]')
    const { cols, firstTrack, gap } = await grid.evaluate((el) => {
      const cs = getComputedStyle(el)
      const t = cs.gridTemplateColumns.trim().split(/\s+/).filter(Boolean)
      return { cols: t.length, firstTrack: parseFloat(t[0]), gap: cs.columnGap }
    })
    // size-driven：列数由容器宽派生（≥1024 宽容器多列），非固定 5
    expect(cols).toBeGreaterThanOrEqual(3)
    // 卡宽恒定最小 ~200px（auto-fill minmax(min(200,100%),1fr)，1fr 略拉伸 → [~195, ~300]）
    expect(firstTrack).toBeGreaterThanOrEqual(195)
    expect(firstTrack).toBeLessThanOrEqual(300)
    expect(gap).toBe('16px')
  })

  test('③ 长标题不撑破网格轨道、无水平溢出（D-214-4 min-width:0）', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    const grid = page.locator('[data-testid="featured-grid"]')
    // 等首张卡 poster 2:3 布局就位
    await expect
      .poll(async () => (await grid.locator('[data-testid="video-card"] div.group\\/poster').first().boundingBox())?.height ?? 0, { timeout: 5_000 })
      .toBeGreaterThan(100)
    // minmax(min(W,100%),1fr) + 子项 min-width:0 → grid 内容不超出可视宽度
    const noOverflow = await grid.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)
    expect(noOverflow).toBe(true)
    // size-driven：含超长标题首卡宽 ≤ 单轨道宽上界（~200 卡宽 1fr 拉伸 ≤ 300），证明未被标题撑破
    const firstCard = await grid.locator('[data-testid="video-card"]').first().boundingBox()
    expect(firstCard).not.toBeNull()
    if (firstCard) {
      expect(firstCard.width).toBeLessThanOrEqual(300)
    }
  })

  test('④ 窄视口保留 2 列计数（响应式级联，仅 ≥1024 size-driven，D-214-A1-2）', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 }) // <640 → --cg-cols 默认 2（移动保留）
    const grid = page.locator('[data-testid="featured-grid"]')
    const cols = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns)
    expect(tracks(cols).length).toBe(2)
    const noOverflow = await grid.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)
    expect(noOverflow).toBe(true)
  })
})

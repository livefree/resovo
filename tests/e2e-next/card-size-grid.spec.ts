/**
 * tests/e2e-next/card-size-grid.spec.ts
 * 卡片尺寸体系端到端视觉链路回归（ADR-214 Amendment A2 D-214-A2-1/2/3/4 / SEQ-20260623-02 Phase A2-5）
 *
 * 验证 SSR 注入 → 前台渲染的完整「单一全局卡宽 + 全站精确定宽」链路：
 *   ① CARD-SIZE-SSR：`[locale]/layout.tsx` 经 `fetchCardSizeSettings()` + `buildCardSizeRootCss()`
 *      在 SSR 注入 `<style data-card-size-vars>` → `:root` 单一全局变量 `--card-w` / `--card-gap`（D-214-6/9）。
 *      Amendment A2：**无 `--card-w-standard` / `--card-w-scroll` / compact 等分档变量残留**（D-214-A2-7）。
 *   ② 精确定宽网格（D-214-A2-2）：FeaturedRow 的 `featured-grid`（CardGrid sizeClass="global"）
 *      `repeat(auto-fit, min(var(--card-w),100%))` → 卡片轨道宽**精确 = W**（非弹性浮动）；列数由容器宽派生；
 *      `justify-content: center` 末列留白居中（D-214-A2-3）；gap = `--card-gap`。
 *   ③ 防溢出（Codex-R2）：`min(W,100%)` + `.card-grid > * { min-width:0 }` → 长标题不撑破轨道、网格不溢出。
 *   ④ **全站精确一致（D-214-A2-2，Codex-A2-R1）**：网格卡 border-box 宽（getBoundingClientRect）**像素级 = 注入 --card-w**；
 *      全站所有区域（网格 auto-fit 轨道 / 横滚 width:var(--card-w)）同源单一变量 → 跨区卡宽结构性恒等。
 *   ⑤ 手机端列数由 W 派生（D-214-A2-4）：375 屏 W=160 → 2 列（auto-fit 自然派生），无水平溢出。
 *
 * 取值稳定性：SSR `fetchCardSizeSettings` 取数失败降级 `CARD_SIZE_DEFAULTS.global`（W=160 / gap=16），
 *   与 migration 124+125+126 净 seed 同值 → 注入值恒为 160/16，断言稳定（仅需 web dev server）。
 *
 * admin PUT→公开读新鲜度（D-214-9）契约层已由 card-size-admin/public 单测覆盖，
 *   端到端实跑随合并 main 前 e2e gate（依赖 admin 鉴权 + DB 写）。
 */

import { test, expect } from './_fixtures'

/** A2 全局默认卡宽 / gap（== CARD_SIZE_DEFAULTS.global == 净 seed） */
const EXPECT_CARD_W = 160
const EXPECT_GAP = 16

/** 长标题确保 line-clamp + min-width:0 防溢出路径被覆盖 */
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

/**
 * 解析 grid-template-columns **真实列**轨道宽（computed 返回 "Npx Npx …" 空格分隔像素值）。
 * 过滤 0px：auto-fit 折叠的空轨道在 computed 值里序列化为 `0px`（Codex-A2-R7-D），
 * 真实列数 = 非零轨道数（防 0px 折叠轨道污染列计数断言）。
 */
function tracks(gridTemplateColumns: string): number[] {
  return gridTemplateColumns
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => parseFloat(t))
    .filter((n) => !Number.isNaN(n) && n > 0)
}

test.describe('卡片尺寸体系 SSR→精确定宽视觉链路（ADR-214 Amendment A2）', () => {
  test.beforeEach(async ({ page }) => {
    await mockHomeRoutes(page)
    await page.goto('/en')
    await page.waitForSelector('[data-testid="featured-grid"]', { timeout: 10_000 })
  })

  test('① SSR 注入 :root 单一全局变量：--card-w / --card-gap，无分档残留（D-214-A2-1/7）', async ({ page }) => {
    expect(await page.locator('style[data-card-size-vars]').count()).toBeGreaterThanOrEqual(1)

    const read = (name: string) =>
      page.evaluate(
        (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
        name,
      )

    // 单一全局：注入值 == 净 seed == CARD_SIZE_DEFAULTS.global（160/16，断言稳定）
    expect(await read('--card-w')).toBe(`${EXPECT_CARD_W}px`)
    expect(await read('--card-gap')).toBe(`${EXPECT_GAP}px`)
    // A2 分档变量全栈回收：standard/scroll/compact 任何后缀变量均无（D-214-A2-7）
    expect(await read('--card-w-standard')).toBe('')
    expect(await read('--card-w-scroll')).toBe('')
    expect(await read('--card-gap-standard')).toBe('')
    expect(await read('--card-gap-scroll')).toBe('')
    expect(await read('--card-cols-standard-desktop')).toBe('')
    expect(await read('--card-w-compact')).toBe('')
  })

  test('② featured-grid 桌面精确定宽：轨道宽 = W(160) + 列数容器派生 + 居中 + gap 16（D-214-A2-2/3）', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    const grid = page.locator('[data-testid="featured-grid"]')
    const { cols, firstTrack, gap, justify } = await grid.evaluate((el) => {
      const cs = getComputedStyle(el)
      const t = cs.gridTemplateColumns.trim().split(/\s+/).filter(Boolean).map(parseFloat)
      // 真实列 = 非零轨道（auto-fit 折叠空轨道序列化为 0px，Codex-A2-R7-D）
      const real = t.filter((n) => !Number.isNaN(n) && n > 0)
      return { cols: real.length, firstTrack: real[0], gap: cs.columnGap, justify: cs.justifyContent }
    })
    // 精确定宽：轨道宽恒 = W（非弹性，无 1fr 拉伸）
    expect(firstTrack).toBe(EXPECT_CARD_W)
    // 列数由容器宽派生（1280 宽容器 ≥ 3 列）
    expect(cols).toBeGreaterThanOrEqual(3)
    expect(gap).toBe(`${EXPECT_GAP}px`)
    // 末列留白居中（D-214-A2-3）
    expect(justify).toBe('center')
  })

  test('③ 长标题不撑破网格轨道、无水平溢出（Codex-R2 min-width:0）', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    const grid = page.locator('[data-testid="featured-grid"]')
    await expect
      .poll(async () => (await grid.locator('[data-testid="video-card"] div.group\\/poster').first().boundingBox())?.height ?? 0, { timeout: 5_000 })
      .toBeGreaterThan(100)
    // min(W,100%) + 子项 min-width:0 → grid 内容不超出可视宽度
    const noOverflow = await grid.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)
    expect(noOverflow).toBe(true)
    // 精确定宽：含超长标题首卡 border-box 宽精确 = W（未被标题撑破、未弹性拉伸）
    const firstCard = await grid.locator('[data-testid="video-card"]').first().boundingBox()
    expect(firstCard).not.toBeNull()
    if (firstCard) {
      expect(Math.round(firstCard.width)).toBe(EXPECT_CARD_W)
    }
  })

  test('④ 全站精确一致：网格卡 border-box 宽像素级 = 注入 --card-w（D-214-A2-2 / Codex-A2-R1）', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    const grid = page.locator('[data-testid="featured-grid"]')
    const injected = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--card-w')),
    )
    const cardWidth = await grid
      .locator('[data-testid="video-card"]')
      .first()
      .evaluate((el) => el.getBoundingClientRect().width)
    // border-box 宽像素级相等：网格卡 == 注入 --card-w（== 横滚 width:var(--card-w)，跨区结构性恒等）
    expect(injected).toBe(EXPECT_CARD_W)
    expect(Math.round(cardWidth)).toBe(injected)
  })

  test('⑤ 手机端列数由 W 派生：375 屏 W=160 → 2 列 + 无溢出（D-214-A2-4）', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    const grid = page.locator('[data-testid="featured-grid"]')
    const cols = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns)
    // auto-fit 在 375 屏内容宽（约 343）下 W=160/gap16 → 2 列（D-214-A2-4 算术）
    expect(tracks(cols).length).toBe(2)
    const noOverflow = await grid.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)
    expect(noOverflow).toBe(true)
  })
})

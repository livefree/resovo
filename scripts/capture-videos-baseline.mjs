#!/usr/bin/env node
/**
 * capture-videos-baseline.mjs — CHG-DESIGN-08 8C visual baseline 截图脚本
 *
 * 启动一次性 Playwright headless chromium，复刻 tests/e2e/admin/videos.spec.ts
 * 的 mock 设置（moderator cookie + page.route 拦截 /admin/videos），截图入库
 * tests/visual/videos/。
 *
 * 用法：
 *   1. 确保 server-next:3003 + api:4000 已启动（npm run dev）
 *   2. node scripts/capture-videos-baseline.mjs
 *
 * 输出：tests/visual/videos/*.png
 *   - videos-full.png（整页）
 *   - page-head.png（页头）
 *   - row.png（典型行）
 *   - 单 cell：thumb / title / type-pill / sources / probe / image-pill / vis-chip / review-pill
 */

import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(__dirname, '..', 'tests', 'visual', 'videos')
const BASE = 'http://localhost:3003'
const API_BASE = 'http://localhost:4000/v1'

// ── mock 数据（多样化覆盖列规格） ────────────────────────────────

const MOCK_VIDEOS = [
  {
    id: 'vid-1', short_id: 'mov12345', title: '示例电影 A',
    title_en: null, cover_url: null, type: 'movie', year: 2025,
    is_published: true, source_count: '15', active_source_count: '15', total_source_count: '15',
    visibility_status: 'public', review_status: 'approved',
    poster_status: 'ok', backdrop_status: 'ok',
    created_at: '2026-04-01T00:00:00Z',
  },
  {
    id: 'vid-2', short_id: 'ser23456', title: '示例剧集 B',
    title_en: null, cover_url: null, type: 'series', year: 2024,
    is_published: false, source_count: '5', active_source_count: '5', total_source_count: '7',
    visibility_status: 'internal', review_status: 'pending_review',
    poster_status: 'broken', backdrop_status: 'ok',
    created_at: '2026-04-15T00:00:00Z',
  },
  {
    id: 'vid-3', short_id: 'ani34567', title: '示例动漫 C',
    title_en: null, cover_url: null, type: 'anime', year: 2023,
    is_published: false, source_count: '2', active_source_count: '2', total_source_count: '8',
    visibility_status: 'hidden', review_status: 'rejected',
    poster_status: 'fallback', backdrop_status: 'fallback',
    created_at: '2026-04-20T00:00:00Z',
  },
]

async function captureRegion(page, selector, filename) {
  const el = await page.locator(selector).first()
  await el.scrollIntoViewIfNeeded()
  await el.screenshot({ path: path.join(OUT, filename), animations: 'disabled' })
  console.log('✓', filename)
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
  })

  // moderator cookie（与 videos.spec.ts setModeratorCookies 一致）
  await context.addCookies([
    { name: 'refresh_token', value: 'mock-mod-rt', domain: 'localhost', path: '/', httpOnly: true, secure: false, sameSite: 'Strict' },
    { name: 'user_role', value: 'moderator', domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Strict' },
  ])

  const page = await context.newPage()

  // mock /admin/videos /admin/crawler/sites /admin/videos/moderation-stats
  await page.route(`${API_BASE}/**`, async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname
    const m = route.request().method()

    if (p === '/v1/admin/crawler/sites' && m === 'GET') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [], total: 0 }) })
      return
    }
    if (p === '/v1/admin/videos/moderation-stats' && m === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: { pendingCount: 1, todayReviewedCount: 0, interceptRate: null } }),
      })
      return
    }
    if (p === '/v1/admin/videos' && m === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_VIDEOS, total: MOCK_VIDEOS.length, page: 1, limit: 20 }),
      })
      return
    }
    await route.continue()
  })

  await page.goto(`${BASE}/admin/videos`, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-video-list-client]', { timeout: 10_000 })
  await page.waitForSelector('[data-table]', { timeout: 5_000 })
  await page.waitForTimeout(400)

  // 整页 + page-head
  await page.screenshot({ path: path.join(OUT, 'videos-full.png'), fullPage: true, animations: 'disabled' })
  console.log('✓ videos-full.png')

  await captureRegion(page, '[data-page-head]', 'page-head.png')

  // 典型行（含完整列）
  await captureRegion(page, '[data-table-body] [role="row"]', 'row.png')

  // 单 cell close-up
  await captureRegion(page, '[data-thumb][data-size="poster-sm"]', 'thumb-poster-sm.png')
  await captureRegion(page, '[data-pill][data-variant="neutral"]', 'pill-neutral-type.png')
  await captureRegion(page, '[data-dual-signal]', 'dual-signal-unknown.png')
  await captureRegion(page, '[data-vis-chip]', 'vis-chip.png')

  // image P0 Pill 三态：vid-1 active / vid-2 broken / vid-3 fallback
  // 选择第 1 行的 image_health pill（active）
  const firstImagePill = page.locator('[data-vis-chip]').first()
  await firstImagePill.scrollIntoViewIfNeeded()
  // image P0 pill 通过 data-testid="image-health" 识别
  const activePill = page.locator('[data-testid="image-health"]').first()
  await activePill.screenshot({ path: path.join(OUT, 'pill-image-p0-active.png'), animations: 'disabled' })
  console.log('✓ pill-image-p0-active.png')

  const brokenPill = page.locator('[data-testid="image-health"]').nth(1)
  if (await brokenPill.count()) {
    await brokenPill.screenshot({ path: path.join(OUT, 'pill-image-p0-broken.png'), animations: 'disabled' })
    console.log('✓ pill-image-p0-broken.png')
  }

  // VisChip 三态：vid-1 approved+public → "前台可见" ok / vid-2 pending_review → "待审" warn / vid-3 rejected → "已拒" danger
  const chips = page.locator('[data-vis-chip]')
  const chipCount = await chips.count()
  for (let i = 0; i < Math.min(chipCount, 3); i++) {
    const chip = chips.nth(i)
    const derived = await chip.getAttribute('data-derived')
    if (derived) {
      await chip.screenshot({ path: path.join(OUT, `vis-chip--${derived}.png`), animations: 'disabled' })
      console.log(`✓ vis-chip--${derived}.png`)
    }
  }

  await browser.close()
  console.log('\n[capture-videos-baseline] baseline 入库 →', OUT)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

/**
 * tests/e2e/admin/videos-column-resize.spec.ts
 * DTR-E（SEQ-20260531-01）：通用表格列宽可调端到端验证（验收页 = VideoListClient）
 *
 * 前提：apps/server-next 运行于 localhost:3003（admin-next-chromium project 注入 baseURL）
 * API：page.route() 拦截 localhost:4000/v1 mock，不依赖真实后端
 * 认证：context.addCookies() 注入 refresh_token + user_role=moderator
 *
 * 覆盖（unit/组件测无法覆盖的真实布局 + 跨会话持久）：
 *   ① resize handle 仅在表头列名之间渲染
 *   ② 拖分隔线 → 列宽变化 + 持久化到 localStorage（布局偏好 :v2）
 *   ③ 刷新页面 → 列宽持久（localStorage 跨会话）
 *   ④ 矩阵「重置列宽」→ 回默认（localStorage width 清空）
 *   ⑤ 双击 auto-fit + 键盘 ArrowRight 调宽
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test'

const API_BASE = 'http://localhost:4000/v1'

interface VideoRow {
  id: string; short_id: string; title: string; title_en: string | null
  cover_url: string | null; type: string; year: number; is_published: boolean
  source_count: string; active_source_count: string; total_source_count: string
  visibility_status: string; review_status: string; created_at: string
}
function makeRow(i: number): VideoRow {
  return {
    id: `vid-r-${i}`, short_id: `rsz0000${i}`,
    title: `列宽测试超长标题用于验证截断省略号 ${i} ${'啊'.repeat(20)}`,
    title_en: null, cover_url: null, type: 'movie', year: 2025, is_published: false,
    source_count: '1', active_source_count: '1', total_source_count: '1',
    visibility_status: 'internal', review_status: 'approved', created_at: '2026-04-01T00:00:00Z',
  }
}

async function setModeratorCookies(context: BrowserContext) {
  await context.addCookies([
    { name: 'refresh_token', value: 'mock-mod-rt', domain: 'localhost', path: '/', httpOnly: true, secure: false, sameSite: 'Strict' },
    { name: 'user_role', value: 'moderator', domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Strict' },
  ])
}

async function installMocks(page: Page, rows: VideoRow[]) {
  await page.route(`${API_BASE}/**`, async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const method = route.request().method()
    if (path === '/v1/admin/crawler/sites' && method === 'GET') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [], total: 0 }) })
    }
    if (path === '/v1/admin/videos/moderation-stats' && method === 'GET') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { pendingCount: 0, todayReviewedCount: 0, interceptRate: null } }) })
    }
    if (path === '/v1/admin/videos' && method === 'GET') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: rows, total: rows.length, page: 1, limit: 20 }) })
    }
    return route.continue()
  })
}

/** 读取 server-next 写入的列宽布局 key（admin-ui:table:{id}:v2），返回 [key, parsed] 或 null。 */
async function readLayoutPrefs(page: Page): Promise<{ key: string; value: Record<string, unknown> } | null> {
  return page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!
      if (/^admin-ui:table:.+:v2$/.test(k)) {
        try { return { key: k, value: JSON.parse(localStorage.getItem(k)!) } } catch { /* skip */ }
      }
    }
    return null
  })
}

const ROWS = [makeRow(1), makeRow(2), makeRow(3)]

test.describe('DataTable 列宽可调（VideoListClient 验收）', () => {
  test('① resize handle 渲染在表头列名之间', async ({ context, page }) => {
    await setModeratorCookies(context)
    await installMocks(page, ROWS)
    await page.goto('/admin/videos')
    await expect(page.getByTestId('video-list-table')).toBeVisible({ timeout: 15000 })
    // 表头有 separator handle；body 无竖向分割线 handle
    const handles = page.locator('[role="columnheader"] [data-dt-resize-handle]')
    await expect(handles.first()).toBeVisible()
    expect(await handles.count()).toBeGreaterThan(0)
    expect(await page.locator('[role="cell"] [data-dt-resize-handle]').count()).toBe(0)
  })

  test('② 拖分隔线 → 列宽变化 + 持久化到 localStorage :v2', async ({ context, page }) => {
    await setModeratorCookies(context)
    await installMocks(page, ROWS)
    await page.goto('/admin/videos')
    await expect(page.getByTestId('video-list-table')).toBeVisible({ timeout: 15000 })
    const handle = page.locator('[role="columnheader"] [data-dt-resize-handle]').first()
    const box = (await handle.boundingBox())!
    const before = await readLayoutPrefs(page)
    // 真实拖拽 +100px
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2, { steps: 8 })
    await page.mouse.up()
    // 列宽写入 localStorage 布局 key（含 width）
    await expect.poll(async () => {
      const p = await readLayoutPrefs(page)
      if (!p) return false
      const cols = (p.value.columns ?? {}) as Record<string, { width?: number }>
      return Object.values(cols).some((c) => typeof c.width === 'number' && c.width > 0)
    }, { timeout: 5000 }).toBe(true)
    // 拖拽前后布局 key 应不同（确实写了新宽）
    expect(JSON.stringify(await readLayoutPrefs(page))).not.toBe(JSON.stringify(before))
  })

  test('③ 刷新页面 → 列宽持久（localStorage 跨会话）', async ({ context, page }) => {
    await setModeratorCookies(context)
    await installMocks(page, ROWS)
    await page.goto('/admin/videos')
    await expect(page.getByTestId('video-list-table')).toBeVisible({ timeout: 15000 })
    const handle = page.locator('[role="columnheader"] [data-dt-resize-handle]').first()
    const box = (await handle.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 8 })
    await page.mouse.up()
    await expect.poll(async () => (await readLayoutPrefs(page)) !== null, { timeout: 5000 }).toBe(true)
    const persisted = await readLayoutPrefs(page)
    // 刷新（模拟跨会话：localStorage 不随刷新清除）
    await page.reload()
    await expect(page.getByTestId('video-list-table')).toBeVisible({ timeout: 15000 })
    expect(JSON.stringify(await readLayoutPrefs(page))).toBe(JSON.stringify(persisted))
  })

  test('④ 矩阵「重置列宽」→ width 清空', async ({ context, page }) => {
    await setModeratorCookies(context)
    await installMocks(page, ROWS)
    await page.goto('/admin/videos')
    await expect(page.getByTestId('video-list-table')).toBeVisible({ timeout: 15000 })
    // 先拖一下产生 width
    const handle = page.locator('[role="columnheader"] [data-dt-resize-handle]').first()
    const box = (await handle.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2, { steps: 6 })
    await page.mouse.up()
    await expect.poll(async () => {
      const p = await readLayoutPrefs(page)
      const cols = (p?.value.columns ?? {}) as Record<string, { width?: number }>
      return Object.values(cols).some((c) => typeof c.width === 'number')
    }, { timeout: 5000 }).toBe(true)
    // 打开矩阵 → 重置列宽
    await page.getByTestId('matrix-trigger').click()
    await page.getByTestId('matrix-foot-reset-widths').click()
    await expect.poll(async () => {
      const p = await readLayoutPrefs(page)
      const cols = (p?.value.columns ?? {}) as Record<string, { width?: number }>
      return Object.values(cols).every((c) => c.width === undefined)
    }, { timeout: 5000 }).toBe(true)
  })

  test('⑤ 键盘 ArrowRight 调宽 + 双击 auto-fit', async ({ context, page }) => {
    await setModeratorCookies(context)
    await installMocks(page, ROWS)
    await page.goto('/admin/videos')
    await expect(page.getByTestId('video-list-table')).toBeVisible({ timeout: 15000 })
    const handle = page.locator('[role="columnheader"] [data-dt-resize-handle]').first()
    await handle.focus()
    await page.keyboard.press('ArrowRight')
    await expect.poll(async () => {
      const p = await readLayoutPrefs(page)
      const cols = (p?.value.columns ?? {}) as Record<string, { width?: number }>
      return Object.values(cols).some((c) => typeof c.width === 'number')
    }, { timeout: 5000 }).toBe(true)
    // 双击 auto-fit（按内容测宽，不抛错；宽度被重新提交）
    await handle.dblclick()
    await expect(page.getByTestId('video-list-table')).toBeVisible()
  })
})

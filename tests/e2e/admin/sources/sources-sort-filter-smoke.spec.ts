/**
 * tests/e2e/admin/sources/sources-sort-filter-smoke.spec.ts
 * CHG-SN-9-DT-AUTOFILTER-EP-4-SOURCES-E2E-SMOKE（2026-05-25）
 *
 * ADR-150 阶段 5 EP-4 sort + filter follow-up 收口 e2e smoke 3 case：
 *   1. page-load — 进入 /admin/sources → KPI + 表格行渲染 OK
 *   2. sort-click-video — 点击「视频」列 sort 切换（PATCH-2A §1-BUG-1 漏改回填验证）
 *   3. filter-probe-status — 列内 ⋯ DataTableAutoFilter → 选 probeStatus（PATCH-2A §2-EXT-1 全栈）
 *
 * 前提：apps/server-next 运行于 localhost:3003（baseURL 由 admin-next-chromium project 注入）
 * API：全部由 page.route() 拦截 localhost:4000/v1
 * 认证：context.addCookies() 注入 refresh_token + user_role=admin
 *
 * 注：siteKey distinct 端点（PATCH-2B）e2e 留 follow-up（涉及 /admin/_dt/distinct mock + 矩阵 popover 复杂交互）
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test'

const API_BASE = 'http://localhost:4000/v1'

// ── Mock 数据 ──────────────────────────────────────────────────────

interface VideoGroupRow {
  videoId: string
  title: string
  shortId: string
  type: string
  year: number | null
  coverUrl: string | null
  lineCount: number
  sourceCount: number
  probeStatus: 'ok' | 'partial' | 'dead' | 'pending'
  renderStatus: 'ok' | 'partial' | 'dead' | 'pending'
  updatedAt: string
  siteKeys: string[]
}

function makeGroup(overrides: Partial<VideoGroupRow> = {}): VideoGroupRow {
  return {
    videoId: '00000000-0000-0000-0000-000000000001',
    title: 'E2E 测试视频',
    shortId: 'e2E00001',
    type: 'movie',
    year: 2025,
    coverUrl: null,
    lineCount: 2,
    sourceCount: 5,
    probeStatus: 'ok',
    renderStatus: 'partial',
    updatedAt: '2026-05-25T00:00:00Z',
    siteKeys: ['bilibili', 'youku'],
    ...overrides,
  }
}

const STATS = { total: 50, active: 30, dead: 10, orphan: 5 }
const ROWS: VideoGroupRow[] = [
  makeGroup({ videoId: '00000000-0000-0000-0000-000000000001', title: '黑客帝国', lineCount: 3, sourceCount: 12 }),
  makeGroup({ videoId: '00000000-0000-0000-0000-000000000002', title: '盗梦空间', lineCount: 2, sourceCount: 8 }),
]

// ── 认证 helper ────────────────────────────────────────────────────

async function setAdminCookies(context: BrowserContext) {
  await context.addCookies([
    { name: 'refresh_token', value: 'mock-admin-rt', domain: 'localhost', path: '/', httpOnly: true, secure: false, sameSite: 'Strict' },
    { name: 'user_role',     value: 'admin',         domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Strict' },
  ])
}

// ── Mock 路由（含 URL params 捕获）────────────────────────────────

interface CapturedRequests {
  videoGroups: URL[] // 每次 GET /admin/sources/video-groups 的 URL
}

async function installSourcesMocks(page: Page, captured: CapturedRequests) {
  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()

    // GET /admin/sources/video-groups — 主列表（含 sort + filter URL params）
    if (path === '/v1/admin/sources/video-groups' && method === 'GET') {
      captured.videoGroups.push(url)
      // PATCH-2A §1-BUG-1 验证：sortField 透传后端 SQL ORDER BY（mock 不实施真排序）
      // PATCH-2A §2-EXT-1 验证：probeStatus 数组 EXISTS ANY 过滤（mock 仅捕获参数）
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: ROWS, total: ROWS.length, page: 1, limit: 20 }),
      })
      return
    }

    // GET /admin/sources/video-groups/stats — KPI
    if (path === '/v1/admin/sources/video-groups/stats' && method === 'GET') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: STATS }) })
      return
    }

    // GET /admin/source-line-aliases — 全局别名表（按 SourcesClient 加载顺序）
    if (path === '/v1/admin/source-line-aliases' && method === 'GET') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [] }) })
      return
    }

    // GET /admin/_dt/distinct?table=sources&col=site_key — PATCH-2B distinct 端点（fallback empty）
    if (path === '/v1/admin/_dt/distinct' && method === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ value: 'bilibili' }, { value: 'youku' }, { value: 'iqiyi' }] }),
      })
      return
    }

    // refresh-token / me（鉴权流程兜底）
    if ((path === '/v1/auth/refresh' || path === '/v1/auth/me') && method === 'POST') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ accessToken: 'mock-at', user: { id: 'u1', role: 'admin' } }) })
      return
    }
    if (path === '/v1/auth/me' && method === 'GET') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { id: 'u1', role: 'admin', email: 'admin@example.com' } }) })
      return
    }

    // 其他未拦截 → 404（隔离测试）
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not mocked' }) })
  })
}

// ── 测试 ────────────────────────────────────────────────────────────

test.describe('CHG-SN-9-DT-AUTOFILTER-EP-4-SOURCES-E2E-SMOKE / ADR-150 阶段 5 EP-4 收口', () => {
  test('1. page-load：/admin/sources KPI 4 卡 + 表格行渲染', async ({ page, context }) => {
    await setAdminCookies(context)
    const captured: CapturedRequests = { videoGroups: [] }
    await installSourcesMocks(page, captured)

    await page.goto('/admin/sources')

    // KPI 4 卡（pre-existing）
    await expect(page.getByText('黑客帝国')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('盗梦空间')).toBeVisible()

    // 第一次 fetch 应不带 sort/filter 参数（默认状态）
    expect(captured.videoGroups.length).toBeGreaterThanOrEqual(1)
    const firstUrl = captured.videoGroups[0]!
    expect(firstUrl.searchParams.get('sortField')).toBeNull()
    expect(firstUrl.searchParams.get('probeStatus')).toBeNull()
  })

  test('2. sort-click-video：点击「视频」列 sort → URL 透传 sortField=video（PATCH-2A §1-BUG-1 漏改回填）', async ({ page, context }) => {
    await setAdminCookies(context)
    const captured: CapturedRequests = { videoGroups: [] }
    await installSourcesMocks(page, captured)

    await page.goto('/admin/sources')
    await expect(page.getByText('黑客帝国')).toBeVisible({ timeout: 10000 })
    const baseline = captured.videoGroups.length

    // 点击「视频」列 header 触发 sort（ADR-149 D-149-4 列名点击 toggle asc/desc）
    // 列 header 有 data-testid 或 role=columnheader — 用文本定位
    await page.getByRole('button', { name: /视频/ }).first().click()

    // 等待 fetch 透传 sortField=video
    await expect.poll(
      () => {
        const last = captured.videoGroups[captured.videoGroups.length - 1]
        return last?.searchParams.get('sortField') ?? null
      },
      { timeout: 5000 },
    ).toBe('video')

    expect(captured.videoGroups.length).toBeGreaterThan(baseline)
    const lastUrl = captured.videoGroups[captured.videoGroups.length - 1]!
    // sortDir 应为 asc 或 desc（D-149 二态互斥 / 默认 asc 首次点击）
    expect(['asc', 'desc']).toContain(lastUrl.searchParams.get('sortDir'))
  })

  test('3. filter-probe-status：列内 ⋯ → DataTableAutoFilter → 选 probeStatus → URL 透传（PATCH-2A §2-EXT-1）', async ({ page, context }) => {
    await setAdminCookies(context)
    const captured: CapturedRequests = { videoGroups: [] }
    await installSourcesMocks(page, captured)

    await page.goto('/admin/sources')
    await expect(page.getByText('黑客帝国')).toBeVisible({ timeout: 10000 })
    const baseline = captured.videoGroups.length

    // 点击「探测」列名右侧 ⋯ 触发器（ADR-149 D-149-3 列级三点）
    // 选择器：列 header 内的 ⋯ button（filter trigger）
    // 复用 ADR-150 DataTableAutoFilter popover：filterKind='enum' 静态 filterOptions
    const probeColumnHeader = page.getByRole('columnheader').filter({ hasText: '探测' })
    const probeTrigger = probeColumnHeader.locator('button[aria-haspopup="menu"], button[aria-label*="⋯"], button[title*="更多"]').first()
    await probeTrigger.click()

    // popover 应显示 4 态 enum 选项：OK / 部分 / 失效 / 待测
    // 勾选 "OK"
    const okOption = page.getByRole('checkbox', { name: /OK/i }).or(page.locator('label').filter({ hasText: /^OK$/ })).first()
    await okOption.click()

    // 应用按钮（DataTableAutoFilter 内置 "应用" / "确定" / "确认"）
    const applyBtn = page.getByRole('button', { name: /应用|确定|确认/ }).last()
    await applyBtn.click()

    // 等待 fetch 透传 probeStatus=ok
    await expect.poll(
      () => {
        const last = captured.videoGroups[captured.videoGroups.length - 1]
        return last?.searchParams.get('probeStatus') ?? null
      },
      { timeout: 5000 },
    ).toMatch(/^ok(,|$)/)

    expect(captured.videoGroups.length).toBeGreaterThan(baseline)
  })
})

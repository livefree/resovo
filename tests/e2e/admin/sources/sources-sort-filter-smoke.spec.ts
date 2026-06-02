/**
 * tests/e2e/admin/sources/sources-sort-filter-smoke.spec.ts
 * CHG-SN-9-DT-AUTOFILTER-EP-4-SOURCES-E2E-SMOKE（2026-05-25）
 *
 * ADR-150 阶段 5 EP-4 sort + filter follow-up 收口 e2e smoke 4 case：
 *   1. page-load — 进入 /admin/sources → KPI + 表格行渲染 OK
 *   2. sort-click-video — 点击「视频」列 sort 切换（PATCH-2A §1-BUG-1 漏改回填验证）
 *   3. filter-probe-status — 列内 ⋯ DataTableAutoFilter → 选 probeStatus（PATCH-2A §2-EXT-1 全栈）
 *   4. filter-site-key-distinct — siteKey 走 distinct 端点首次消费实证（PATCH-2B 全栈）
 *
 * 前提：apps/server-next 运行于 localhost:3003（baseURL 由 admin-next-chromium project 注入）
 * API：全部由 page.route() 拦截 localhost:4000/v1
 * 认证：context.addCookies() 注入 refresh_token + user_role=admin
 *
 * 触发：用户起 dev server 后 `npm run test:e2e`（与 visual baseline 范式一致）
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
  distinct: URL[]   // 每次 GET /admin/_dt/distinct 的 URL（PATCH-2B distinct 端点首消费实证）
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

    // GET /admin/_dt/distinct?table=sources&col=site_key — PATCH-2B distinct 端点首消费实证
    if (path === '/v1/admin/_dt/distinct' && method === 'GET') {
      captured.distinct.push(url)
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
    const captured: CapturedRequests = { videoGroups: [], distinct: [] }
    await installSourcesMocks(page, captured)

    await page.goto('/admin/sources')

    // KPI 4 卡（pre-existing）
    await expect(page.getByText('黑客帝国')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('盗梦空间')).toBeVisible()

    // CHG-VSR-5-A §3.4：第一次 fetch 携带默认排序 sortField=lastChecked desc（取代旧"无 sort"默认 / 运维视角关注最近检测）；无 filter 参数
    expect(captured.videoGroups.length).toBeGreaterThanOrEqual(1)
    const firstUrl = captured.videoGroups[0]!
    expect(firstUrl.searchParams.get('sortField')).toBe('lastChecked')
    expect(firstUrl.searchParams.get('sortDir')).toBe('desc')
    expect(firstUrl.searchParams.get('probeStatus')).toBeNull()
  })

  test('2. sort-click-video：点击「视频」列 sort → URL 透传 sortField=video（PATCH-2A §1-BUG-1 漏改回填）', async ({ page, context }) => {
    await setAdminCookies(context)
    const captured: CapturedRequests = { videoGroups: [], distinct: [] }
    await installSourcesMocks(page, captured)

    await page.goto('/admin/sources')
    await expect(page.getByText('黑客帝国')).toBeVisible({ timeout: 10000 })
    const baseline = captured.videoGroups.length

    // 点击「视频」列 columnheader 触发 sort（ADR-149 D-149-4 列名整体可点 toggle asc/desc）
    // role=columnheader + data-th-interactive=true（packages/admin-ui DataTable thead）
    await page.getByRole('columnheader', { name: /视频/ }).click()

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

  test('3. filter-probe-status：列内 ⋯ → DataTableAutoFilter → 勾 OK → 应用 → URL 透传 probeStatus=ok（PATCH-2A §2-EXT-1）', async ({ page, context }) => {
    await setAdminCookies(context)
    const captured: CapturedRequests = { videoGroups: [], distinct: [] }
    await installSourcesMocks(page, captured)

    await page.goto('/admin/sources')
    await expect(page.getByText('黑客帝国')).toBeVisible({ timeout: 10000 })
    const baseline = captured.videoGroups.length

    // 点击「探测」列名右侧 ⋯ 触发器（data-testid=th-menu-trigger-probeStatus / ADR-149 D-149-3 列级三点）
    await page.getByTestId('th-menu-trigger-probeStatus').click()

    // popover 显 4 态 enum（PROBE_STATUS_OPTIONS：ok/partial/dead/pending / SourcesClient.tsx 静态注入）
    // 勾选 ok（data-testid=dt-autofilter-probeStatus-opt-ok / data-table-auto-filter.tsx L281）
    await page.getByTestId('dt-autofilter-probeStatus-opt-ok').check()

    // 点击「应用」（data-testid=dt-autofilter-probeStatus-apply）
    await page.getByTestId('dt-autofilter-probeStatus-apply').click()

    // 等待 fetch 透传 probeStatus=ok（前端 csv join 单值 → "ok"）
    await expect.poll(
      () => {
        const last = captured.videoGroups[captured.videoGroups.length - 1]
        return last?.searchParams.get('probeStatus') ?? null
      },
      { timeout: 5000 },
    ).toMatch(/^ok(,|$)/)

    expect(captured.videoGroups.length).toBeGreaterThan(baseline)
  })

  test('4. filter-site-key-distinct：列内 ⋯ → distinct 端点 fetch → 勾 bilibili → URL 透传 siteKey=bilibili（PATCH-2B distinct 首消费）', async ({ page, context }) => {
    await setAdminCookies(context)
    const captured: CapturedRequests = { videoGroups: [], distinct: [] }
    await installSourcesMocks(page, captured)

    await page.goto('/admin/sources')
    await expect(page.getByText('黑客帝国')).toBeVisible({ timeout: 10000 })
    const groupsBaseline = captured.videoGroups.length

    // 点击「站点」列名右侧 ⋯ 触发器（PATCH-2B-FIX1 后列可见 / data-testid=th-menu-trigger-siteKey）
    await page.getByTestId('th-menu-trigger-siteKey').click()

    // popover 打开后 DataTableAutoFilter useEffect 触发 distinct 端点 fetch（filterDistinctTable='sources'）
    // 等 distinct fetch 完成（mock 返回 bilibili/youku/iqiyi 3 选项）
    await expect.poll(
      () => captured.distinct.length,
      { timeout: 5000 },
    ).toBeGreaterThanOrEqual(1)

    // 验证 distinct URL params：table=sources & col=site_key（filterFieldName）
    const distinctUrl = captured.distinct[captured.distinct.length - 1]!
    expect(distinctUrl.searchParams.get('table')).toBe('sources')
    expect(distinctUrl.searchParams.get('col')).toBe('site_key')

    // 勾选 bilibili（distinct fetched options 渲染后 testid 可用）
    await page.getByTestId('dt-autofilter-siteKey-opt-bilibili').check()

    // 应用
    await page.getByTestId('dt-autofilter-siteKey-apply').click()

    // 等待 fetch 透传 siteKey=bilibili（前端 array csv join 单值）
    await expect.poll(
      () => {
        const last = captured.videoGroups[captured.videoGroups.length - 1]
        return last?.searchParams.get('siteKey') ?? null
      },
      { timeout: 5000 },
    ).toMatch(/^bilibili(,|$)/)

    expect(captured.videoGroups.length).toBeGreaterThan(groupsBaseline)
  })
})

/**
 * tests/e2e/admin/sources/codename-matrix-picker.spec.ts
 * CHG-SN-9-WAVE3-FOLLOWUP-CODENAME-MATRIX-E2E / Wave 4 #6
 *
 * Wave 3 验收期补丁 CHG-SN-9-CODENAME-MATRIX（801bd454）ship 了：
 *   - 52 山名字库预览（顶部 AdminCard + 小色块 grid）
 *   - 单元格内联代号分配（点击 codename 列 cell → CodenameMatrixPicker modal）
 *   - 重复使用建议（点击 occupied 山名 → "已占用 + 建议 X-2" 浮层）
 *
 * 本卡补 e2e 4 case（playwright headless）：
 *   1. page-load：进入 /admin/source-line-aliases → 表格行 + codename cell 渲染 → 点击 cell 打开 picker modal
 *   2. available-pick：点击 available 山名 → PUT /admin/source-line-aliases/.../codename → modal close
 *   3. occupied-suggest：点击 occupied 山名 → suggest modal 弹 + accept 走 PUT codename=X-2
 *   4. cooling-disabled：cooling 状态 button disabled + 不触发 onClick
 *
 * 前提：apps/server-next 运行于 localhost:3003（admin-next-chromium project 注入 baseURL）
 * API：全部由 page.route() 拦截 localhost:4000/v1
 * 认证：context.addCookies() 注入 refresh_token + user_role=admin
 *
 * 触发：用户起 dev server 后 `npm run test:e2e`
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test'

const API_BASE = 'http://localhost:4000/v1'

// ── Mock 数据 ──────────────────────────────────────────────────────

interface SourceLineRowMock {
  sourceSiteKey: string
  sourceName: string
  displayName: string
  codename: string | null
  priority: number
  retiredAt: string | null
  autoRetired: boolean
  assignedAt: string | null
  videoCount: number
  activeCount: number
  episodeCount: number
}

function makeRow(overrides: Partial<SourceLineRowMock> = {}): SourceLineRowMock {
  return {
    sourceSiteKey: 'bilibili',
    sourceName: '线路1',
    displayName: '哔哩哔哩主线',
    codename: null,
    priority: 0,
    retiredAt: null,
    autoRetired: false,
    assignedAt: null,
    videoCount: 10,
    activeCount: 8,
    episodeCount: 12,
    ...overrides,
  }
}

// 4 行 mock：
//   - row1: 已分配 '泰山'（base 占用 / 测占用建议 → '泰山-2'）
//   - row2: 已分配 '华山-1'（cooling 状态需 retiredAt 但本行为活跃 / 演示后缀变种已存在）
//   - row3: 未分配（测点击 cell → matrix open → pick available '昆仑'）
//   - row4: 已退役 30 天前用 '衡山'（cooling → 矩阵中 '衡山' button disabled）
const RETIRED_30_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
const NOW_ISO = new Date().toISOString()

const ROWS: SourceLineRowMock[] = [
  makeRow({
    sourceSiteKey: 'bilibili',
    sourceName: '线路A',
    displayName: '哔哩主线',
    codename: '泰山',
    priority: 50,
    assignedAt: NOW_ISO,
  }),
  makeRow({
    sourceSiteKey: 'bilibili',
    sourceName: '线路B',
    displayName: '哔哩备用',
    codename: '华山-1',
    priority: 20,
    assignedAt: NOW_ISO,
  }),
  makeRow({
    sourceSiteKey: 'youku',
    sourceName: '默认',
    displayName: '优酷默认',
    codename: null,
    priority: 0,
    assignedAt: null,
  }),
  makeRow({
    sourceSiteKey: 'iqiyi',
    sourceName: '老线路',
    displayName: '爱奇艺退役线',
    codename: '衡山',
    priority: 10,
    retiredAt: RETIRED_30_DAYS_AGO,
    assignedAt: RETIRED_30_DAYS_AGO,
  }),
]

// ── 认证 helper ────────────────────────────────────────────────────

async function setAdminCookies(context: BrowserContext) {
  await context.addCookies([
    { name: 'refresh_token', value: 'mock-admin-rt', domain: 'localhost', path: '/', httpOnly: true, secure: false, sameSite: 'Strict' },
    { name: 'user_role',     value: 'admin',         domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Strict' },
  ])
}

// ── Mock 路由（含捕获 PUT body）──────────────────────────────────

interface CapturedRequests {
  upsertCalls: Array<{ url: URL; method: string; body: Record<string, unknown> | null }>
}

async function installAliasMocks(page: Page, captured: CapturedRequests) {
  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()

    // GET /admin/source-line-aliases/all — 全线路视图（含 unassigned）
    if (path === '/v1/admin/source-line-aliases/all' && method === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: ROWS }),
      })
      return
    }

    // PUT /admin/source-line-aliases/{siteKey}/{sourceName} — upsert with fields
    if (/^\/v1\/admin\/source-line-aliases\/[^/]+\/[^/]+$/.test(path) && method === 'PUT') {
      let body: Record<string, unknown> | null = null
      try {
        body = JSON.parse(request.postData() ?? '{}')
      } catch {
        body = null
      }
      captured.upsertCalls.push({ url, method, body })
      // 返回更新后的 SourceLineAlias（前端 reload 后从 listAllSourceLines 二次获取）
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            sourceSiteKey: decodeURIComponent(path.split('/')[4] ?? ''),
            sourceName: decodeURIComponent(path.split('/')[5] ?? ''),
            displayName: (body?.displayName as string) ?? '',
            codename: (body?.codename as string | null) ?? null,
            priority: (body?.priority as number) ?? 0,
            retiredAt: null,
            autoRetired: false,
            updatedBy: 'u1',
            createdAt: NOW_ISO,
            updatedAt: NOW_ISO,
          },
        }),
      })
      return
    }

    // GET /admin/source-line-aliases — 兜底（部分组件可能仍调）
    if (path === '/v1/admin/source-line-aliases' && method === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      })
      return
    }

    // auth 兜底
    if ((path === '/v1/auth/refresh' || path === '/v1/auth/me') && method === 'POST') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ accessToken: 'mock-at', user: { id: 'u1', role: 'admin' } }),
      })
      return
    }
    if (path === '/v1/auth/me' && method === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: { id: 'u1', role: 'admin', email: 'admin@example.com' } }),
      })
      return
    }

    // 未拦截 → 404（隔离）
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'not mocked' }),
    })
  })
}

// ── 测试 ────────────────────────────────────────────────────────────

test.describe('CHG-SN-9-WAVE3-FOLLOWUP-CODENAME-MATRIX-E2E / Wave 4 #6 收尾', () => {
  test('1. page-load：进入 /admin/source-line-aliases → 行渲染 + 点击 codename cell 打开 picker', async ({ page, context }) => {
    await setAdminCookies(context)
    const captured: CapturedRequests = { upsertCalls: [] }
    await installAliasMocks(page, captured)

    await page.goto('/admin/source-line-aliases')

    // 表格行渲染
    await expect(page.getByText('哔哩主线')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('优酷默认')).toBeVisible()

    // 点击未分配的 codename cell（"＋ 分配代号"）
    const cellSelector = page.getByTestId('codename-cell-youku-默认')
    await expect(cellSelector).toBeVisible()
    await cellSelector.click()

    // picker modal 打开
    await expect(page.getByTestId('codename-matrix-picker')).toBeVisible()
    await expect(page.getByTestId('codename-matrix-grid')).toBeVisible()
    // 52 山名预览（验 5 个常见山名出现）
    await expect(page.getByTestId('codename-slot-泰山')).toBeVisible()
    await expect(page.getByTestId('codename-slot-华山')).toBeVisible()
    await expect(page.getByTestId('codename-slot-昆仑')).toBeVisible()
    await expect(page.getByTestId('codename-slot-衡山')).toBeVisible()
    await expect(page.getByTestId('codename-slot-嵩山')).toBeVisible()
  })

  test('2. available-pick：点击可用山名 → PUT codename + modal 关闭', async ({ page, context }) => {
    await setAdminCookies(context)
    const captured: CapturedRequests = { upsertCalls: [] }
    await installAliasMocks(page, captured)

    await page.goto('/admin/source-line-aliases')
    await expect(page.getByText('优酷默认')).toBeVisible({ timeout: 10000 })

    // 打开 picker for youku/默认
    await page.getByTestId('codename-cell-youku-默认').click()
    await expect(page.getByTestId('codename-matrix-picker')).toBeVisible()

    // 点击 '昆仑'（available / ROWS 内无人占用）
    await page.getByTestId('codename-slot-昆仑').click()

    // 等 PUT 请求
    await expect.poll(() => captured.upsertCalls.length, { timeout: 5000 }).toBeGreaterThanOrEqual(1)
    const call = captured.upsertCalls[0]!
    expect(call.method).toBe('PUT')
    // URL 含 youku + 默认
    expect(decodeURIComponent(call.url.pathname)).toContain('youku')
    expect(decodeURIComponent(call.url.pathname)).toContain('默认')
    // body 含 codename='昆仑'
    expect(call.body?.codename).toBe('昆仑')

    // modal 关闭
    await expect(page.getByTestId('codename-matrix-picker')).toBeHidden({ timeout: 5000 })
  })

  test('3. occupied-suggest：点击占用山名 → suggest modal 弹 + accept 走 PUT codename=X-2', async ({ page, context }) => {
    await setAdminCookies(context)
    const captured: CapturedRequests = { upsertCalls: [] }
    await installAliasMocks(page, captured)

    await page.goto('/admin/source-line-aliases')
    await expect(page.getByText('优酷默认')).toBeVisible({ timeout: 10000 })

    // 打开 picker for youku/默认（未分配）
    await page.getByTestId('codename-cell-youku-默认').click()
    await expect(page.getByTestId('codename-matrix-picker')).toBeVisible()

    // 点击 '泰山' — ROWS[0] 已占用 → 触发 suggest modal
    await page.getByTestId('codename-slot-泰山').click()

    // suggest modal 弹出
    await expect(page.getByTestId('codename-suggest-modal')).toBeVisible()
    // 模态文案含建议 "泰山-1" 或 "泰山-2"（codename-utils 后缀建议算法 / 测建议为 N≥1）
    const suggestModal = page.getByTestId('codename-suggest-modal')
    await expect(suggestModal).toContainText(/泰山-\d+/)

    // 点击 "使用 泰山-N" button（primary）
    await page.getByRole('button', { name: /使用 泰山-/ }).click()

    // PUT 请求触发
    await expect.poll(() => captured.upsertCalls.length, { timeout: 5000 }).toBeGreaterThanOrEqual(1)
    const call = captured.upsertCalls[0]!
    expect(call.method).toBe('PUT')
    expect(call.body?.codename).toMatch(/^泰山-\d+$/)
  })

  test('4. cooling-disabled：cooling 状态山名 button disabled', async ({ page, context }) => {
    await setAdminCookies(context)
    const captured: CapturedRequests = { upsertCalls: [] }
    await installAliasMocks(page, captured)

    await page.goto('/admin/source-line-aliases')
    await expect(page.getByText('优酷默认')).toBeVisible({ timeout: 10000 })

    // 打开 picker
    await page.getByTestId('codename-cell-youku-默认').click()
    await expect(page.getByTestId('codename-matrix-picker')).toBeVisible()

    // '衡山' 在 ROWS[3] 退役 30 天前（< 90 天冷却期）→ button disabled
    const coolingSlot = page.getByTestId('codename-slot-衡山')
    await expect(coolingSlot).toBeVisible()
    await expect(coolingSlot).toBeDisabled()

    // title 应含 "冷却" 或 "剩 X 天"
    const titleAttr = await coolingSlot.getAttribute('title')
    expect(titleAttr).toMatch(/冷却|剩.*天/)

    // 尝试点击不应触发 PUT
    await coolingSlot.click({ force: true })
    // 短等 500ms 防异步触发
    await page.waitForTimeout(500)
    expect(captured.upsertCalls.length).toBe(0)
    // modal 仍打开（未自动关闭）
    await expect(page.getByTestId('codename-matrix-picker')).toBeVisible()
  })
})

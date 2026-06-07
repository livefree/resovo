/**
 * tests/e2e/admin/_shared/shell-mocks.ts
 *
 * CHG-E2E-GATE-AUDIT-C：admin-next E2E 共享 shell 基座 mock
 *
 * 背景（SEQ-20260606-01 根因 (a)+(b)，实证见 changelog）：
 *   - admin-next spec 以假 cookie（refresh_token=mock-*-rt）运行；server-next
 *     admin shell 每页挂载 3 个轮询 hook（useAdminNotifications / useAdminTasks /
 *     useAdminNavCounts，见 apps/server-next/src/app/admin/admin-shell-client.tsx），
 *     共拉 5 个 shell 级端点。
 *   - 根因 (a)：spec 未拦截这些端点时直通真实 API（:4000）→ 假 token 401 →
 *     apiClient tryRefreshToken 又 401 → handleUnauthorized → 重定向 /login。
 *   - 根因 (b)：catch-all 兜底用错误形状（如 200 {data:null}）时违反 hook 契约
 *     （value.data.map / value.meta.degraded）→ Runtime TypeError → React 根崩溃
 *     （"Application error" 兜底页）+ Next dev overlay 全屏 modal → 断言全灭。
 *
 * 用法（注册顺序 = 匹配优先级反序，Playwright 后注册先匹配）：
 *   1. spec 先调 installAdminShellMocks(page)（先注册 → 兜底层）
 *   2. 再注册业务 mock（后注册 → 优先匹配）
 *   3. spec 自带 catch-all 的，其兜底分支改 route.fallback() 下沉到本基座
 *
 * 兜底 404 而非 200：404 ≠ 401 不触发鉴权重定向，shell hooks 全部带 degraded
 * 容忍路径（warn 降级）；200 + 错误形状才是毒（CHG-VSR-7 既验证范式）。
 *
 * 契约真源：apps/server-next/src/lib/admin-shell-notifications.ts（Notification/
 * Jobs/BackgroundEvents Response interface）+ admin-shell-nav-counts.ts（listCandidates
 * 读 total）+ api-client.ts（RefreshResponse 取 accessToken | data.accessToken）。
 */

import type { Page } from '@playwright/test'

export const API_BASE = 'http://localhost:4000/v1'

const json = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

/** shell 基座 mock：5 个 shell 级端点契约正确形状 + 兜底 404 */
export async function installAdminShellMocks(page: Page) {
  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()

    // POST /auth/refresh — 根因 (a) 防御：假 refresh_token 不打真实 API
    if (path === '/v1/auth/refresh' && method === 'POST') {
      await route.fulfill(json({ accessToken: 'e2e-mock-access-token' }))
      return
    }

    // GET /admin/notifications — useAdminNotifications（data 必须为数组）
    if (path === '/v1/admin/notifications' && method === 'GET') {
      await route.fulfill(json({
        data: [],
        meta: { total: 0, limit: 20, since: '1970-01-01T00:00:00.000Z' },
      }))
      return
    }

    // GET /admin/system/background-events — useAdminNotifications + useAdminTasks 双消费
    if (path === '/v1/admin/system/background-events' && method === 'GET') {
      await route.fulfill(json({
        data: [],
        meta: { total: 0, limit: 20, windowHours: 24, generatedAt: '1970-01-01T00:00:00.000Z' },
      }))
      return
    }

    // GET /admin/system/jobs — useAdminTasks（data 数组 + meta.degraded 双必需）
    if (path === '/v1/admin/system/jobs' && method === 'GET') {
      await route.fulfill(json({
        data: [],
        meta: {
          total: 0,
          limit: 20,
          since: '1970-01-01T00:00:00.000Z',
          queueCounts: { crawler: { waiting: 0, active: 0 }, maintenance: { waiting: 0, active: 0 } },
          degraded: false,
        },
      }))
      return
    }

    // GET /admin/video-merges/candidates — useAdminNavCounts（读 total 出 badge）
    if (path === '/v1/admin/video-merges/candidates' && method === 'GET') {
      await route.fulfill(json({ data: [], total: 0, page: 1, limit: 1, source: 'identity' }))
      return
    }

    // GET /admin/crawler/sites — sidebar / topbar 通用查询（videos.spec + moderation
    // _helpers 既有重复 mock 收编到基座）
    if (path === '/v1/admin/crawler/sites' && method === 'GET') {
      await route.fulfill(json({ data: [], total: 0 }))
      return
    }

    // 兜底 404 隔离（CHG-VSR-7 范式）：未 mock 端点不得漏到真实 API（防 401 重定向），
    // 也不得用错误形状 200 喂毒（防 TypeError 崩根）；404 走 hooks degraded 容忍路径。
    await route.fulfill(json({ error: { code: 'NOT_FOUND', message: 'not mocked (e2e shell base)' } }, 404))
  })
}

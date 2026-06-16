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
 * Jobs/BackgroundEvents Response interface）+ admin-shell-nav-counts.ts（消费
 * /admin/system/nav-counts，ADR-190 / NTLG-P0-1-B）+ api-client.ts（RefreshResponse 取 accessToken | data.accessToken）。
 */

import type { Page } from '@playwright/test'

export const API_BASE = 'http://localhost:4000/v1'

const json = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

/** shell 基座 mock：shell 级端点契约正确形状（含 NTLG-P2-c +unread-count/stream）+ 兜底 404 */
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

    // GET /admin/notifications — useAdminNotifications（data 必须为数组；NTLG-P1-c-C：meta.readAt 已读高水位线）
    if (path === '/v1/admin/notifications' && method === 'GET') {
      await route.fulfill(json({
        data: [],
        meta: { total: 0, limit: 20, since: '1970-01-01T00:00:00.000Z', readAt: '1970-01-01T00:00:00.000Z' },
      }))
      return
    }

    // POST /admin/notifications/read — markAllRead（NTLG-P1-c-C：cursor 单一已读源，替 localStorage）
    if (path === '/v1/admin/notifications/read' && method === 'POST') {
      await route.fulfill(json({ data: { readAt: new Date().toISOString() } }))
      return
    }

    // GET /admin/notifications/unread-count — useAdminNotifications 红点数字源（ADR-196 D-196-5② / NTLG-P2-c-C-2）
    if (path === '/v1/admin/notifications/unread-count' && method === 'GET') {
      await route.fulfill(json({ data: { count: 0 }, meta: { scope: 'self' } }))
      return
    }

    // GET /admin/notifications/stream — SSE 实时推送（ADR-196 D-196-1 / NTLG-P2-c-B）
    // 基座不模拟长连接流式 mock（Playwright route.fulfill 返完整响应、非长连接）：返 503
    // STREAM_UNAVAILABLE → 前端 connectNotificationStream 走 onStateChange(closed) →
    // 60s 轮询 fallback 接管（B-2 双模式 degraded 路径，与 404 同属已验证安全降级）。
    if (path === '/v1/admin/notifications/stream' && method === 'GET') {
      await route.fulfill(json({ error: { code: 'STREAM_UNAVAILABLE', message: 'sse not mocked (e2e shell base)' } }, 503))
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

    // GET /admin/system/jobs — useAdminTasks（data 数组 + meta.degraded）+ 仪表盘 QueueHealthCard
    // 消费 meta.queueCounts（ADR-147 AMENDMENT：全 9 队列 × 4 计数，缺队列键会令卡 c.active 崩）
    if (path === '/v1/admin/system/jobs' && method === 'GET') {
      const zero = { waiting: 0, active: 0, completed: 0, failed: 0 }
      await route.fulfill(json({
        data: [],
        meta: {
          total: 0,
          limit: 20,
          since: '1970-01-01T00:00:00.000Z',
          queueCounts: {
            crawler: zero, verify: zero, enrichment: zero, imageHealth: zero, maintenance: zero,
            identityCandidate: zero, homeAutofill: zero, doubanCollections: zero, bangumiCollections: zero,
          },
          degraded: false,
        },
      }))
      return
    }

    // GET /admin/system/nav-counts — useAdminNavCounts（5 模块计数批量；ADR-190 / NTLG-P0-1-B）
    if (path === '/v1/admin/system/nav-counts' && method === 'GET') {
      await route.fulfill(json({ data: {}, meta: { partial: false, omitted: [] } }))
      return
    }

    // POST /admin/tasks/:id/{cancel,retry} — 任务抽屉控制（ADR-191 / NTLG-P0-3-B）
    if (/^\/v1\/admin\/tasks\/[^/]+\/(cancel|retry)$/.test(path) && method === 'POST') {
      const action = path.endsWith('/cancel') ? 'cancelled' : 'retried'
      await route.fulfill(json({ data: { target: { kind: 'crawler_run', id: 'mock' }, [action]: true } }))
      return
    }

    // GET /admin/video-merges/candidates — merge 页候选列表（nav 计数已迁 nav-counts，本 mock 保留供 merge 页 e2e）
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

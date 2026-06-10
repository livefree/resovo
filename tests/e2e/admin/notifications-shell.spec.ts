/**
 * tests/e2e/admin/notifications-shell.spec.ts
 *
 * NTLG-P2-c-E2E（SEQ-20260609-01 P2-c follow-up）：admin shell 通知链路浏览器级验收
 *
 * 守护 P2-c 核心行为变更（此前仅单测/集成覆盖、缺真实链路）：
 *   - C-2（红点改读 unread-count，替 list-derived）：unread-count>0 + 全已读 list → 红点显示
 *     （旧 list-derived 逻辑 some(!read)=false 则无红点；新逻辑 count>0 仍亮）
 *   - C-2 0 守卫：unread-count=0 + list 含未读项 → 红点隐藏（证红点由 unread-count 驱动、非 list）
 *   - A-2 消息中心页 render：/admin/messages 挂载 + page-header 可见
 *
 * SSE degraded 双模式：基座 /stream 503 → onStateChange(closed) → 60s 轮询 fallback（shell 不崩，
 * 由 dashboard.spec 既有 shell smoke + 本 spec 红点断言间接覆盖）。真实 Redis SSE-push 端到端
 * 不在此（Playwright route 不支持长连接流式 mock，留独立 follow-up）。
 *
 * 认证：context.addCookies refresh_token + user_role=admin（同 dashboard.spec 范式）
 * mock：installAdminShellMocks 基座 + 本 spec 注册 notification 覆盖 catch-all（route.fallback 下沉基座）
 */

import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { installAdminShellMocks } from './_shared/shell-mocks'

const API_BASE = 'http://localhost:4000/v1'

const json = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

async function setAdminCookies(context: BrowserContext) {
  await context.addCookies([
    {
      name: 'refresh_token',
      value: 'mock-admin-rt',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Strict',
    },
    {
      name: 'user_role',
      value: 'admin',
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Strict',
    },
  ])
}

interface NotifMock {
  readonly id: string
  readonly title: string
  readonly level: 'info' | 'warn' | 'danger'
  /** ISO 8601；与 readAt 高水位线比较决定 list-derived read 态 */
  readonly createdAt: string
}

/**
 * 基座 + 通知覆盖：unread-count（红点数字源）/ list（readAt 高水位线决定 list-derived read）；
 * 其余端点 route.fallback() 下沉基座。注册顺序在基座之后 → Playwright 后注册先匹配 → 覆盖优先。
 */
async function installNotificationMocks(
  page: Page,
  opts: { unreadCount: number; readAt: string; items: readonly NotifMock[] },
) {
  await installAdminShellMocks(page)
  await page.route(`${API_BASE}/**`, async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const method = route.request().method()

    if (path === '/v1/admin/notifications/unread-count' && method === 'GET') {
      await route.fulfill(json({ data: { count: opts.unreadCount }, meta: { scope: 'self' } }))
      return
    }
    if (path === '/v1/admin/notifications' && method === 'GET') {
      await route.fulfill(
        json({
          data: opts.items,
          meta: { total: opts.items.length, limit: 20, since: '1970-01-01T00:00:00.000Z', readAt: opts.readAt },
        }),
      )
      return
    }
    await route.fallback()
  })
}

const NOTIF_BTN = '[data-topbar-icon-btn="notifications"]'
const NOTIF_DOT = '[data-topbar-icon-btn="notifications"] [data-topbar-icon-dot]'

test.describe('admin shell 通知红点 — unread-count 驱动（NTLG-P2-c-C-2 验收）', () => {
  test('unread-count>0 + 全已读 list → 红点显示（证 C-2 非 list-derived）', async ({ context, page }) => {
    await setAdminCookies(context)
    // readAt 高水位线设未来 → 所有 list 项 createdAt <= readAt → 全已读（旧 some(!read)=false → 旧逻辑无红点）
    await installNotificationMocks(page, {
      unreadCount: 3,
      readAt: '2099-01-01T00:00:00.000Z',
      items: [
        { id: 'n1', title: '已读通知 A', level: 'info', createdAt: '2026-06-01T00:00:00.000Z' },
        { id: 'n2', title: '已读通知 B', level: 'info', createdAt: '2026-06-02T00:00:00.000Z' },
      ],
    })
    await page.goto('/admin')
    // shell topbar 挂载（红点锚点宿主）
    await expect(page.locator(NOTIF_BTN)).toBeVisible({ timeout: 10000 })
    // 新逻辑：notificationUnreadCount=3 → dotVisible → 红点显示（即使 list 全已读）
    await expect(page.locator(NOTIF_DOT)).toBeVisible({ timeout: 10000 })
  })

  test('unread-count=0 + list 含未读项 → 红点隐藏（证红点由 unread-count 驱动）', async ({ context, page }) => {
    await setAdminCookies(context)
    // readAt=1970 + 项 createdAt=2026 → 项未读（旧 some(!read)=true → 旧逻辑会亮红点）
    await installNotificationMocks(page, {
      unreadCount: 0,
      readAt: '1970-01-01T00:00:00.000Z',
      items: [{ id: 'n3', title: '未读通知 C', level: 'warn', createdAt: '2026-06-03T00:00:00.000Z' }],
    })
    await page.goto('/admin')
    await expect(page.locator(NOTIF_BTN)).toBeVisible({ timeout: 10000 })
    // 新逻辑：notificationUnreadCount=0（0 守卫）→ 红点隐藏（即使 list 有未读项）
    await expect(page.locator(NOTIF_DOT)).toHaveCount(0, { timeout: 10000 })
  })
})

test.describe('消息中心页 render（NTLG-P2-c-A-2 验收）', () => {
  test('/admin/messages 挂载 + page-header 可见', async ({ context, page }) => {
    await setAdminCookies(context)
    await installNotificationMocks(page, {
      unreadCount: 0,
      readAt: '1970-01-01T00:00:00.000Z',
      items: [],
    })
    await page.goto('/admin/messages')
    await expect(page.getByTestId('messages-page-header')).toBeVisible({ timeout: 10000 })
  })
})

import { expect, test, type BrowserContext, type Page } from '@playwright/test'

const BASE_URL = ''
const API_BASE = 'http://localhost:4000/v1'

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

test('sources page supports filters, batch verify and status actions', async ({ context, page }) => {
  await setAdminCookies(context)
  const state = {
    rows: [
      {
        id: 'src-a',
        video_id: '11111111-1111-4111-8111-111111111111',
        source_url: 'https://media.example.com/a.m3u8',
        source_name: 'A',
        quality: null,
        type: 'hls',
        is_active: true,
        season_number: 1,
        episode_number: 1,
        last_checked: '2026-03-27T00:00:00Z',
        created_at: '2026-03-27T00:00:00Z',
        video_title: '全量视频A',
      },
      {
        id: 'src-b',
        video_id: '11111111-1111-4111-8111-111111111111',
        source_url: 'https://media.example.com/b.m3u8',
        source_name: 'B',
        quality: null,
        type: 'hls',
        is_active: false,
        season_number: 1,
        episode_number: 2,
        last_checked: null,
        created_at: '2026-03-27T00:00:00Z',
        video_title: '失效视频B',
      },
    ],
  }

  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname

    if (path === '/v1/admin/sources/shell-count' && request.method() === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            count: 1,
            videoIds: ['vid-1'],
            verifySchedulerEnabled: true,
          },
        }),
      })
      return
    }

    if (path === '/v1/admin/sources' && request.method() === 'GET') {
      const status = url.searchParams.get('status')
      const rows = status === 'inactive'
        ? state.rows.filter((row) => !row.is_active)
        : state.rows
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: rows, total: rows.length }),
      })
      return
    }

    if (path === '/v1/admin/sources/batch-verify' && request.method() === 'POST') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            scope: 'site',
            totalMatched: 2,
            processed: 2,
            activated: 1,
            inactivated: 1,
            timeout: 0,
            failed: 0,
          },
        }),
      })
      return
    }

    if (path === '/v1/admin/sources/batch-status' && request.method() === 'POST') {
      const body = request.postDataJSON() as { ids: string[]; isActive: boolean }
      state.rows = state.rows.map((row) => (
        body.ids.includes(row.id)
          ? { ...row, is_active: body.isActive }
          : row
      ))
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: { updated: body.ids.length, isActive: body.isActive } }),
      })
      return
    }

    if (path === '/v1/admin/sources/src-a/status' && request.method() === 'PATCH') {
      const body = request.postDataJSON() as { isActive: boolean }
      state.rows = state.rows.map((row) => (
        row.id === 'src-a' ? { ...row, is_active: body.isActive } : row
      ))
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: { updated: true, isActive: body.isActive } }),
      })
      return
    }

    if (path === '/v1/admin/submissions' && request.method() === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: [{
            id: 'sub-1',
            video_id: 'vid-3',
            source_url: 'https://media.example.com/fix.m3u8',
            source_name: 'fix',
            is_active: false,
            submitted_by_username: 'alice',
            created_at: '2026-03-27T00:00:00Z',
            video_title: '纠错视频',
          }],
          total: 1,
        }),
      })
      return
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'NOT_FOUND', message: path, status: 404 } }),
    })
  })

  await page.goto(`${BASE_URL}/admin/sources`)
  await expect(page.locator('[data-testid="admin-sources-page"]')).toBeVisible()
  await expect(page.locator('[data-testid="source-health-alert"]')).toBeVisible()
  await expect(page.locator('[data-testid="source-health-verify-status"]')).toContainText('运行中')
  await expect(page.locator('text=全量视频A')).toBeVisible()

  await page.getByTestId('source-filters-site-key').fill('site-a')

  const batchVerifyReq = page.waitForRequest(`${API_BASE}/admin/sources/batch-verify`)
  await page.getByTestId('source-batch-verify-site').click()
  const batchVerifyRequest = await batchVerifyReq
  expect(batchVerifyRequest.postDataJSON()).toEqual({
    scope: 'site',
    siteKey: 'site-a',
    activeOnly: false,
    limit: 500,
  })
  await expect(page.locator('[data-testid="source-batch-verify-summary"]')).toContainText('命中 2')

  const singleStatusReq = page.waitForRequest(`${API_BASE}/admin/sources/src-a/status`)
  await page.getByTestId('source-status-toggle-src-a').click()
  const singleStatusRequest = await singleStatusReq
  expect(singleStatusRequest.postDataJSON()).toEqual({ isActive: false })

  await page.getByTestId('source-tab-inactive').click()
  await expect(page.locator('text=失效视频B')).toBeVisible()

  await page.getByLabel('选择 失效视频B').click()
  const batchStatusReq = page.waitForRequest(`${API_BASE}/admin/sources/batch-status`)
  await page.getByTestId('source-batch-status-active').click()
  const batchStatusRequest = await batchStatusReq
  expect(batchStatusRequest.postDataJSON()).toEqual({
    ids: ['src-b'],
    isActive: true,
  })

  await page.getByTestId('source-tab-submissions').click()
  await expect(page.locator('text=纠错视频')).toBeVisible()
})

// CHG-E2E-GATE-AUDIT-B2（2026-06-06）：退役「video actions dropdown publish/douban sync」与
// 「moderation reject submits reason」——v1 冻结 UI 行为漂移（dropdown 端点不再触发 /
// reject 载荷不再携 reason），同流程由真源 admin-next moderation 套件（tests/e2e/admin/
// moderation/*）覆盖；v1 维护期不追 UI 漂移。

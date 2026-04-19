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

test('video actions dropdown triggers publish and douban sync endpoints', async ({ context, page }) => {
  await setAdminCookies(context)
  const state = { isPublished: true }

  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname

    if (path === '/v1/admin/videos' && request.method() === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: [{
            id: 'vid-1',
            short_id: 'short-1',
            title: '视频 A',
            title_en: null,
            cover_url: null,
            type: 'movie',
            year: 2025,
            is_published: state.isPublished,
            source_count: '1',
            active_source_count: '1',
            total_source_count: '1',
            visibility_status: state.isPublished ? 'public' : 'hidden',
            review_status: 'approved',
            created_at: '2026-03-27T00:00:00Z',
          }],
          total: 1,
        }),
      })
      return
    }

    if (path === '/v1/admin/crawler/sites' && request.method() === 'GET') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [] }) })
      return
    }

    if (path === '/v1/admin/videos/vid-1/publish' && request.method() === 'PATCH') {
      const body = request.postDataJSON() as { isPublished: boolean }
      state.isPublished = body.isPublished
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: { id: 'vid-1', is_published: state.isPublished } }),
      })
      return
    }

    if (path === '/v1/admin/videos/vid-1/douban-sync' && request.method() === 'POST') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: { updated: true } }),
      })
      return
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'NOT_FOUND', message: path, status: 404 } }),
    })
  })

  await page.goto(`${BASE_URL}/admin/videos`)
  await expect(page.locator('[data-testid="admin-videos-page"]')).toBeVisible()
  await expect(page.locator('[data-testid="modern-table-row-vid-1"]')).toBeVisible()

  const publishReq = page.waitForRequest(`${API_BASE}/admin/videos/vid-1/publish`)
  await page.getByTestId('video-publish-toggle-vid-1').click()
  const publishRequest = await publishReq
  expect(publishRequest.postDataJSON()).toEqual({ isPublished: false })

  const doubanReq = page.waitForRequest(`${API_BASE}/admin/videos/vid-1/douban-sync`)
  await page.getByTestId('douban-sync-vid-1').click()
  await doubanReq
})

test('moderation reject submits reason', async ({ context, page }) => {
  await setAdminCookies(context)
  const state = { rejected: false }

  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname

    if (path === '/v1/admin/videos/moderation-stats' && request.method() === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ pendingCount: state.rejected ? 0 : 1, todayReviewedCount: state.rejected ? 1 : 0, interceptRate: null }),
      })
      return
    }

    if (path === '/v1/admin/videos/pending-review' && request.method() === 'GET') {
      const rows = state.rejected ? [] : [{
        id: 'vid-1',
        shortId: 'short-1',
        title: '待审视频',
        type: 'movie',
        coverUrl: null,
        year: 2025,
        siteKey: 'site-1',
        siteName: 'Site 1',
        firstSourceUrl: 'https://media.example.com/a.m3u8',
        createdAt: '2026-03-27T00:00:00Z',
        doubanStatus: 'pending',
        sourceCheckStatus: 'pending',
        metaScore: 0,
        activeSourceCount: 1,
      }]
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: rows, total: rows.length }),
      })
      return
    }

    if (path === '/v1/admin/videos/vid-1' && request.method() === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'vid-1',
            title: '待审视频',
            type: 'movie',
            year: 2025,
            description: 'desc',
            cover_url: null,
            review_status: 'pending_review',
            visibility_status: 'internal',
            created_at: '2026-03-27T00:00:00Z',
            genres: [],
            director: [],
            cast: [],
            douban_status: 'pending',
            source_check_status: 'pending',
            meta_score: 0,
            douban_id: null,
            rating: null,
          },
        }),
      })
      return
    }

    if (path === '/v1/admin/sources' && request.method() === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: [{
            id: 'src-1',
            source_url: 'https://media.example.com/a.m3u8',
            source_name: 'A',
            is_active: true,
          }],
          total: 1,
        }),
      })
      return
    }

    if (path === '/v1/admin/videos/vid-1/review' && request.method() === 'POST') {
      state.rejected = true
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: { id: 'vid-1', review_status: 'rejected' } }),
      })
      return
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'NOT_FOUND', message: path, status: 404 } }),
    })
  })

  await page.goto(`${BASE_URL}/admin/moderation`)
  await expect(page.locator('[data-testid="admin-moderation-page"]')).toBeVisible()

  await page.getByTestId('moderation-list-item-vid-1').click()
  await page.getByTestId('moderation-reject-reason-input').fill('片源与标题不符')

  const rejectReq = page.waitForRequest(`${API_BASE}/admin/videos/vid-1/review`)
  await page.getByTestId('moderation-reject-btn').click()
  const rejectRequest = await rejectReq
  expect(rejectRequest.postDataJSON()).toEqual({ action: 'reject', reason: '片源与标题不符' })
})

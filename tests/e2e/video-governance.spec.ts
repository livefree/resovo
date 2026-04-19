import { test, expect, type Page } from '@playwright/test'

const BASE_URL = ''
const API_BASE = 'http://localhost:4000/v1'
const VIDEO_ID = 'vid-governance-1'
const VIDEO_SHORT_ID = 'gov12345'
const VIDEO_TITLE = '治理链路测试片'

interface VideoState {
  id: string
  short_id: string
  title: string
  type: string
  year: number
  cover_url: string | null
  description: string
  created_at: string
  review_status: 'pending_review' | 'approved' | 'rejected'
  visibility_status: 'internal' | 'public' | 'hidden'
  is_published: boolean
  active_source_count: string
  total_source_count: string
  source_url: string
}

async function setAdminCookies(context: Parameters<Parameters<typeof test>[1]>[0]['context']) {
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

function createInitialState(): VideoState {
  return {
    id: VIDEO_ID,
    short_id: VIDEO_SHORT_ID,
    title: VIDEO_TITLE,
    type: 'movie',
    year: 2025,
    cover_url: null,
    description: '用于验证入库后审核流转与可见性结果。',
    created_at: '2026-03-26T12:00:00Z',
    review_status: 'pending_review',
    visibility_status: 'internal',
    is_published: false,
    active_source_count: '1',
    total_source_count: '1',
    source_url: 'https://media.example.com/governance.m3u8',
  }
}

function matchesAdminVideoFilters(state: VideoState, url: URL): boolean {
  const visibilityStatus = url.searchParams.get('visibilityStatus')
  const reviewStatus = url.searchParams.get('reviewStatus')
  const q = url.searchParams.get('q')

  if (visibilityStatus && state.visibility_status !== visibilityStatus) return false
  if (reviewStatus && state.review_status !== reviewStatus) return false
  if (q && !state.title.includes(q) && !state.short_id.includes(q)) return false
  return true
}

async function installGovernanceMocks(page: Page, state: VideoState) {
  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname

    if (path === '/v1/admin/videos/moderation-stats' && request.method() === 'GET') {
      const todayReviewedCount = state.review_status === 'pending_review' ? 0 : 1
      const interceptRate = state.review_status === 'rejected' ? 100 : state.review_status === 'approved' ? 0 : null
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          pendingCount: state.review_status === 'pending_review' ? 1 : 0,
          todayReviewedCount,
          interceptRate,
        }),
      })
      return
    }

    if (path === '/v1/admin/videos/pending-review' && request.method() === 'GET') {
      const rows = state.review_status === 'pending_review'
        ? [{
            id: state.id,
            shortId: state.short_id,
            title: state.title,
            type: state.type,
            coverUrl: state.cover_url,
            year: state.year,
            siteKey: 'mock-site',
            siteName: 'Mock Site',
            firstSourceUrl: state.source_url,
            createdAt: state.created_at,
            doubanStatus: 'pending',
            sourceCheckStatus: 'pending',
            metaScore: 0,
            activeSourceCount: 1,
          }]
        : []
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: rows, total: rows.length, page: 1, limit: 30 }),
      })
      return
    }

    if (path === `/v1/admin/videos/${state.id}/review` && request.method() === 'POST') {
      const body = request.postDataJSON() as { action?: 'approve' | 'reject' }
      if (body.action === 'approve') {
        state.review_status = 'approved'
        state.visibility_status = 'public'
        state.is_published = true
      } else if (body.action === 'reject') {
        state.review_status = 'rejected'
        state.visibility_status = 'hidden'
        state.is_published = false
      }
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: state.id,
            review_status: state.review_status,
            visibility_status: state.visibility_status,
            is_published: state.is_published,
          },
        }),
      })
      return
    }

    if (path === `/v1/admin/videos/${state.id}` && request.method() === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: state.id,
            title: state.title,
            type: state.type,
            year: state.year,
            description: state.description,
            cover_url: state.cover_url,
            review_status: state.review_status,
            visibility_status: state.visibility_status,
            created_at: state.created_at,
            genres: [],
            director: [],
            cast: [],
            rating: null,
            douban_status: 'pending',
            source_check_status: 'pending',
            meta_score: 0,
            douban_id: null,
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
            id: 'source-1',
            source_url: state.source_url,
            source_name: 'Mock Source',
            is_active: true,
          }],
          total: 1,
        }),
      })
      return
    }

    if (path === '/v1/admin/videos' && request.method() === 'GET') {
      const rows = matchesAdminVideoFilters(state, url)
        ? [{
            id: state.id,
            short_id: state.short_id,
            title: state.title,
            title_en: null,
            cover_url: state.cover_url,
            type: state.type,
            year: state.year,
            is_published: state.is_published,
            source_count: state.total_source_count,
            active_source_count: state.active_source_count,
            total_source_count: state.total_source_count,
            visibility_status: state.visibility_status,
            review_status: state.review_status,
            created_at: state.created_at,
          }]
        : []
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: rows, total: rows.length, page: 1, limit: 20 }),
      })
      return
    }

    if (path === '/v1/admin/crawler/sites' && request.method() === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      })
      return
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'NOT_FOUND', message: `Unhandled mock: ${path}`, status: 404 } }),
    })
  })
}

async function gotoWithReloadRetry(page: Page, url: string, retries = 3): Promise<void> {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'load' })
      return
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const interrupted = message.includes('interrupted by another navigation')
      if (!interrupted || attempt === retries - 1) throw error
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(250)
    }
  }
}

test('happy path: 入库后在审核台按快捷键通过，并在视频列表中显示为公开/已通过', async ({ context, page }) => {
  const state = createInitialState()
  await setAdminCookies(context)
  await installGovernanceMocks(page, state)

  await page.goto(`${BASE_URL}/admin/moderation`)
  await expect(page.locator('[data-testid="admin-moderation-page"]')).toBeVisible()
  await expect(page.locator(`[data-testid="moderation-list-item-${VIDEO_ID}"]`)).toBeVisible()

  await page.locator(`[data-testid="moderation-list-item-${VIDEO_ID}"]`).click()
  await expect(page.locator('[data-testid="moderation-detail"]')).toBeVisible()

  const reviewReq = page.waitForRequest((req) => (
    req.url() === `${API_BASE}/admin/videos/${VIDEO_ID}/review` && req.method() === 'POST'
  ))
  await page.keyboard.press('a')
  const request = await reviewReq
  expect(request.postDataJSON()).toEqual({ action: 'approve' })

  await expect(page.locator(`[data-testid="moderation-list-item-${VIDEO_ID}"]`)).toHaveCount(0)

  await gotoWithReloadRetry(
    page,
    `${BASE_URL}/admin/videos?visibilityStatus=public&reviewStatus=approved`,
  )
  await expect(page.locator('[data-testid="admin-videos-page"]')).toBeVisible()
  const row = page.locator(`[data-testid="modern-table-row-${VIDEO_ID}"]`)
  await expect(row).toBeVisible()
  await expect(row).toContainText(VIDEO_TITLE)
  await expect(row).toContainText('公开')
  await expect(row).toContainText('已通过')
})

test('reject path: 入库后在审核台按快捷键拒绝，并且不会出现在公开视频列表中', async ({ context, page }) => {
  const state = createInitialState()
  await setAdminCookies(context)
  await installGovernanceMocks(page, state)

  await page.goto(`${BASE_URL}/admin/moderation`)
  await expect(page.locator('[data-testid="admin-moderation-page"]')).toBeVisible()
  await page.locator(`[data-testid="moderation-list-item-${VIDEO_ID}"]`).click()
  await expect(page.locator('[data-testid="moderation-detail"]')).toBeVisible()

  const reviewReq = page.waitForRequest((req) => (
    req.url() === `${API_BASE}/admin/videos/${VIDEO_ID}/review` && req.method() === 'POST'
  ))
  await page.keyboard.press('r')
  const request = await reviewReq
  expect(request.postDataJSON()).toEqual({ action: 'reject' })

  await expect(page.locator(`[data-testid="moderation-list-item-${VIDEO_ID}"]`)).toHaveCount(0)

  await gotoWithReloadRetry(page, `${BASE_URL}/admin/videos?visibilityStatus=public`)
  await expect(page.locator('[data-testid="admin-videos-page"]')).toBeVisible()
  await expect(page.locator(`[data-testid="modern-table-row-${VIDEO_ID}"]`)).toHaveCount(0)

  await gotoWithReloadRetry(
    page,
    `${BASE_URL}/admin/videos?visibilityStatus=hidden&reviewStatus=rejected`,
  )
  const hiddenRow = page.locator(`[data-testid="modern-table-row-${VIDEO_ID}"]`)
  await expect(hiddenRow).toBeVisible()
  await expect(hiddenRow).toContainText('隐藏')
  await expect(hiddenRow).toContainText('已拒绝')
})

/**
 * tests/e2e/admin/moderation/_helpers.ts
 *
 * CHG-SN-4-10-C：审核台 e2e 共享 fixture / mock helper
 *
 * 沿用 tests/e2e/admin/videos.spec.ts 模式：
 *   - cookie 注入 mock auth（refresh_token + user_role=moderator）
 *   - page.route() 拦截 localhost:4000/v1/admin/moderation/** 等端点
 *   - 不依赖真实后端 / DB
 *
 * 真源参考：
 *   - apps/server-next/src/lib/moderation/api.ts（API endpoint 列表）
 *   - packages/types/src/admin-moderation.types.ts（VideoQueueRow / PendingQueueResponse 等）
 *   - M-SN-4 plan v1.4 §11.1 黄金路径 / §11.2 状态保留 5 步
 */

import type { BrowserContext, Page } from '@playwright/test'

export const API_BASE = 'http://localhost:4000/v1'

// ── Mock auth ─────────────────────────────────────────────────────────

export async function setModeratorCookies(context: BrowserContext) {
  await context.addCookies([
    {
      name: 'refresh_token',
      value: 'mock-mod-rt',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Strict',
    },
    {
      name: 'user_role',
      value: 'moderator',
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Strict',
    },
  ])
}

// ── Mock 数据 helpers ─────────────────────────────────────────────────

export interface MockQueueRow {
  id: string
  // ADR-160 D-160-7：admin preview URL 派生（getVideoDetailHref + ?preview=admin）
  slug: string | null
  shortId: string
  title: string
  type: 'movie' | 'tvshow'
  year: number | null
  country: string | null
  episodeCount: number
  coverUrl: string | null
  rating: number | null
  category: string | null
  isPublished: boolean
  visibilityStatus: 'public' | 'internal' | 'hidden'
  reviewStatus: 'pending_review' | 'approved' | 'rejected'
  reviewReason: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  probe: 'green' | 'amber' | 'red' | 'unknown'
  render: 'green' | 'amber' | 'red' | 'unknown'
  sourceCheckStatus: 'ok' | 'partial' | 'broken' | 'unknown'
  metaScore: number
  needsManualReview: boolean
  badges: string[]
  staffNote: string | null
  reviewLabelKey: string | null
  doubanStatus: 'fetched' | 'pending' | 'no_match' | 'failed'
  reviewSource: 'manual' | 'auto' | 'system'
  trendingTag: string | null
  createdAt: string
  updatedAt: string
}

export function makeQueueRow(overrides: Partial<MockQueueRow> = {}): MockQueueRow {
  return {
    id: 'vid-mod-01',
    slug: 'shen-he-tai-e2e-shi-pin',
    shortId: 'abcd1234',
    title: '审核台 e2e 测试视频',
    type: 'movie',
    year: 2026,
    country: 'CN',
    episodeCount: 1,
    coverUrl: null,
    rating: null,
    category: null,
    isPublished: false,
    visibilityStatus: 'internal',
    reviewStatus: 'pending_review',
    reviewReason: null,
    reviewedBy: null,
    reviewedAt: null,
    probe: 'green',
    render: 'green',
    sourceCheckStatus: 'ok',
    metaScore: 80,
    needsManualReview: false,
    badges: [],
    staffNote: null,
    reviewLabelKey: null,
    doubanStatus: 'fetched',
    reviewSource: 'manual',
    trendingTag: null,
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
    ...overrides,
  }
}

export interface MockState {
  pending: MockQueueRow[]
  staging: MockQueueRow[]
  rejected: MockQueueRow[]
  /** 记录所有写操作，用于断言 audit / 调用次数 */
  writes: { method: string; path: string; body?: unknown }[]
}

export function freshState(init: Partial<MockState> = {}): MockState {
  return {
    pending: init.pending ?? [],
    staging: init.staging ?? [],
    rejected: init.rejected ?? [],
    writes: [],
  }
}

// ── 通用 mock：moderation 全 API endpoint ─────────────────────────────

export async function installModerationMocks(page: Page, state: MockState) {
  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()

    // GET /admin/crawler/sites — 通用 dashboard / topbar 可能查询
    if (path === '/v1/admin/crawler/sites' && method === 'GET') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [], total: 0 }) })
      return
    }

    // GET /admin/videos/moderation-stats
    if (path === '/v1/admin/videos/moderation-stats' && method === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: { pendingCount: state.pending.length, todayReviewedCount: 0, interceptRate: null } }),
      })
      return
    }

    // GET /admin/review-labels — RejectModal 标签字典（packages/types ReviewLabel 用 camelCase）
    if (path === '/v1/admin/review-labels' && method === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 'l1', labelKey: 'porn', label: '不适宜内容', appliesTo: 'reject', isActive: true, sortOrder: 1 },
            { id: 'l2', labelKey: 'incomplete_meta', label: '元数据缺失', appliesTo: 'reject', isActive: true, sortOrder: 2 },
          ],
        }),
      })
      return
    }

    // GET /admin/moderation/pending-queue
    if (path === '/v1/admin/moderation/pending-queue' && method === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: state.pending,
          nextCursor: null,
          total: state.pending.length,
          todayStats: { reviewed: 0, approveRate: null },
        }),
      })
      return
    }

    // GET /admin/staging — StagingApiRow shape（与 VideoQueueRow 不同）
    if (path === '/v1/admin/staging' && method === 'GET') {
      const rows = state.staging.map((v) => ({
        id: v.id,
        title: v.title,
        type: v.type,
        year: v.year,
        coverUrl: v.coverUrl,
        doubanStatus: v.doubanStatus,
        sourceCheckStatus: v.sourceCheckStatus,
        metaScore: v.metaScore,
        activeSourceCount: 1,
        qualityHighest: '1080p',
        approvedAt: v.reviewedAt,
        updatedAt: v.updatedAt,
        readiness: { ready: true, blockers: [] },
      }))
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: rows, total: rows.length }),
      })
      return
    }

    // GET /admin/moderation/rejected（备用，旧路径）
    if (path === '/v1/admin/moderation/rejected' && method === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: state.rejected,
          nextCursor: null,
          total: state.rejected.length,
        }),
      })
      return
    }

    // GET /admin/videos?reviewStatus=rejected — RejectedTabContent 的 fetchRejectedVideos
    if (path === '/v1/admin/videos' && method === 'GET' && url.searchParams.get('reviewStatus') === 'rejected') {
      // RejectedVideoRow 用 snake_case
      const rows = state.rejected.map((v) => ({
        id: v.id,
        title: v.title,
        type: v.type,
        year: v.year,
        review_status: v.reviewStatus,
        visibility_status: v.visibilityStatus,
        review_label_key: v.reviewLabelKey,
        douban_status: v.doubanStatus,
        source_check_status: v.sourceCheckStatus,
        created_at: v.createdAt,
        updated_at: v.updatedAt,
        cover_url: v.coverUrl,
      }))
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: rows, total: rows.length }),
      })
      return
    }

    // POST /admin/videos/:id/review (approve)
    if (/\/v1\/admin\/videos\/[^/]+\/review$/.test(path) && method === 'POST') {
      const id = path.split('/')[4]
      const body = request.postDataJSON() as { action: string }
      state.writes.push({ method, path, body })
      const idx = state.pending.findIndex((r) => r.id === id)
      if (idx >= 0) {
        const [row] = state.pending.splice(idx, 1)
        if (body.action === 'approve') {
          state.staging.push({ ...row, reviewStatus: 'approved', visibilityStatus: 'internal' })
        }
      }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { ok: true } }) })
      return
    }

    // POST /admin/moderation/:id/reject-labeled
    if (/\/v1\/admin\/moderation\/[^/]+\/reject-labeled$/.test(path) && method === 'POST') {
      const id = path.split('/')[4]
      const body = request.postDataJSON() as { labelKey: string; reason?: string }
      state.writes.push({ method, path, body })
      const idx = state.pending.findIndex((r) => r.id === id)
      if (idx >= 0) {
        const [row] = state.pending.splice(idx, 1)
        state.rejected.push({
          ...row,
          reviewStatus: 'rejected',
          reviewLabelKey: body.labelKey,
          reviewReason: body.reason ?? null,
        })
      }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { ok: true } }) })
      return
    }

    // POST /admin/moderation/:id/reopen
    if (/\/v1\/admin\/moderation\/[^/]+\/reopen$/.test(path) && method === 'POST') {
      const id = path.split('/')[4]
      state.writes.push({ method, path })
      const idx = state.rejected.findIndex((r) => r.id === id)
      if (idx >= 0) {
        const [row] = state.rejected.splice(idx, 1)
        state.pending.push({
          ...row,
          reviewStatus: 'pending_review',
          reviewLabelKey: null,
          reviewReason: null,
        })
      }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { ok: true } }) })
      return
    }

    // POST /admin/staging/:id/publish
    if (/\/v1\/admin\/staging\/[^/]+\/publish$/.test(path) && method === 'POST') {
      const id = path.split('/')[4]
      state.writes.push({ method, path })
      const idx = state.staging.findIndex((r) => r.id === id)
      if (idx >= 0) {
        state.staging[idx] = { ...state.staging[idx], isPublished: true, visibilityStatus: 'public' }
      }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { id, published: true } }) })
      return
    }

    // POST /admin/staging/:id/revert（D-01 状态机扩展）— 退回审核
    if (/\/v1\/admin\/staging\/[^/]+\/revert$/.test(path) && method === 'POST') {
      const id = path.split('/')[4]
      state.writes.push({ method, path })
      const idx = state.staging.findIndex((r) => r.id === id)
      if (idx >= 0) {
        const [row] = state.staging.splice(idx, 1)
        state.pending.push({
          ...row,
          reviewStatus: 'pending_review',
          isPublished: false,
        })
      }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { ok: true } }) })
      return
    }

    // POST /admin/videos/:id/refetch-sources（202 入队）
    if (/\/v1\/admin\/videos\/[^/]+\/refetch-sources$/.test(path) && method === 'POST') {
      const id = path.split('/')[4]
      state.writes.push({ method, path })
      // mock: 入队后 source_check_status 立即变 ok（实际由 worker 异步更新）
      const idx = state.rejected.findIndex((r) => r.id === id)
      if (idx >= 0) {
        state.rejected[idx] = { ...state.rejected[idx], sourceCheckStatus: 'ok', probe: 'green', render: 'green' }
      }
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ data: { runId: 'run-mock-01', triggerType: 'all' } }),
      })
      return
    }

    // GET /admin/sources?videoId=... (LinesPanel — fetchVideoSources)
    if (path === '/v1/admin/sources' && method === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: [], total: 0, page: 1, limit: 100 }),
      })
      return
    }

    // PATCH /admin/moderation/:id/staff-note
    if (/\/v1\/admin\/moderation\/[^/]+\/staff-note$/.test(path) && method === 'PATCH') {
      const id = path.split('/')[4]
      const body = request.postDataJSON() as { note: string | null }
      state.writes.push({ method, path, body })
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { ok: true } }) })
      return
    }

    // 兜底：未匹配端点 → 200 空 data（避免 SSR/CSR 报错阻塞 e2e）
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: null }),
    })
  })
}

/** 计算 spy：写操作匹配 */
export function findWrites(state: MockState, predicate: (w: { method: string; path: string }) => boolean) {
  return state.writes.filter(predicate)
}

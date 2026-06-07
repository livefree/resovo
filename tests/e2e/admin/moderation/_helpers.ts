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
import type { VideoQueueRow } from '@resovo/types'
import { installAdminShellMocks } from '../_shared/shell-mocks'

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

/**
 * CHG-E2E-GATE-AUDIT-C：mock 行类型直接绑定真源 VideoQueueRow（@resovo/types），
 * 编译期锁死契约——此前本地复制的 MockQueueRow 在 CHG-360/ADR-159（probeAggregate/
 * renderAggregate 必填）与 ADR-157（probe/render/doubanStatus/sourceCheckStatus/
 * reviewSource 值域规整）后全面漂移，ModListRow 渲染 `probe.state` 直接 TypeError
 * 崩 React 根（moderation 26 失败确定性真因之一）。
 */
export type MockQueueRow = VideoQueueRow

export function makeQueueRow(overrides: Partial<VideoQueueRow> = {}): VideoQueueRow {
  return {
    id: 'vid-mod-01',
    slug: 'shen-he-tai-e2e-shi-pin',
    shortId: 'abcd1234',
    title: '审核台 e2e 测试视频',
    type: 'movie',
    year: 2026,
    country: 'CN',
    episodeCount: 1,
    totalEpisodes: null,
    currentEpisodes: null,
    coverUrl: null,
    rating: null,
    category: null,
    isPublished: false,
    visibilityStatus: 'internal',
    reviewStatus: 'pending_review',
    reviewReason: null,
    reviewedBy: null,
    reviewedAt: null,
    probe: 'ok',
    render: 'ok',
    probeAggregate: { total: 1, ok: 1, state: 'ok' },
    renderAggregate: { total: 1, ok: 1, state: 'ok' },
    sourceCheckStatus: 'ok',
    metaScore: 80,
    needsManualReview: false,
    badges: [],
    staffNote: null,
    reviewLabelKey: null,
    doubanStatus: 'matched',
    reviewSource: 'manual',
    trendingTag: null,
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
    ...overrides,
  }
}

/**
 * 筛选预设 mock 行（ADR-144 / CHG-SN-8-FUP-PRESET-TEAM-EP-B：presets 已迁 DB 主源，
 * `/admin/filter-presets` 4 端点；localStorage 仅 offline fallback——e2e 改 mock 端点喂数）。
 * 形状对齐 apps/server-next/src/lib/moderation/filter-presets-api.ts ApiFilterPreset。
 */
export interface MockFilterPreset {
  id: string
  ownerUserId: string
  ownerUsername: string | null
  name: string
  scope: 'private' | 'shared'
  tab: 'pending' | 'rejected' | 'all'
  query: Record<string, unknown>
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export function makeFilterPreset(overrides: Partial<MockFilterPreset> = {}): MockFilterPreset {
  return {
    id: 'preset-e2e-01',
    ownerUserId: 'user-mod-e2e',
    ownerUsername: 'mod01',
    name: 'e2e 预设',
    scope: 'private',
    tab: 'pending',
    query: {},
    isDefault: false,
    createdAt: '2026-05-20T00:00:00Z',
    updatedAt: '2026-05-20T00:00:00Z',
    ...overrides,
  }
}

export interface MockState {
  pending: MockQueueRow[]
  staging: MockQueueRow[]
  rejected: MockQueueRow[]
  /** 筛选预设（DB 主源 mock；ADR-144） */
  filterPresets: MockFilterPreset[]
  /** 记录所有写操作，用于断言 audit / 调用次数 */
  writes: { method: string; path: string; body?: unknown }[]
}

export function freshState(init: Partial<MockState> = {}): MockState {
  return {
    pending: init.pending ?? [],
    staging: init.staging ?? [],
    rejected: init.rejected ?? [],
    filterPresets: init.filterPresets ?? [],
    writes: [],
  }
}

// ── 通用 mock：moderation 全 API endpoint ─────────────────────────────

export async function installModerationMocks(page: Page, state: MockState) {
  // CHG-E2E-GATE-AUDIT-C：shell 基座先注册（后注册的业务 mock 优先匹配；未匹配
  // 请求经下方 route.fallback() 下沉到基座 → shell 端点契约正确形状 + 兜底 404）
  await installAdminShellMocks(page)

  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()

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

    // GET /admin/staging/rules — 独立页规则卡（CHG-SN-7-REDO-04-B lib/staging/api.ts）
    if (path === '/v1/admin/staging/rules' && method === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: { minMetaScore: 0, requireDoubanMatched: false, requireCoverUrl: false, minActiveSourceCount: 0 },
        }),
      })
      return
    }

    // GET /admin/staging — StagingListResponse（CHG-E2E-GATE-AUDIT-C 契约对齐：
    // REDO-04 后响应含 rules + summary，缺失时 StagingPageClient 恒卡 skeleton）
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
        qualityHighest: '1080P',
        approvedAt: v.reviewedAt,
        updatedAt: v.updatedAt,
        readiness: { ready: true, blockers: [] },
      }))
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: rows,
          total: rows.length,
          rules: { minMetaScore: 0, requireDoubanMatched: false, requireCoverUrl: false, minActiveSourceCount: 0 },
          summary: { all: rows.length, ready: rows.length, warning: 0, blocked: 0 },
        }),
      })
      return
    }

    // GET /admin/moderation/:id/similar — TabSimilar（ADR-137 真实化 / CHG-VIR-9-C identity）
    if (/\/v1\/admin\/moderation\/[^/]+\/similar$/.test(path) && method === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: [], source: 'identity' }),
      })
      return
    }

    // ── /admin/filter-presets 4 端点（ADR-144 DB 主源）────────────────
    if (path === '/v1/admin/filter-presets' && method === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: state.filterPresets }),
      })
      return
    }
    if (path === '/v1/admin/filter-presets' && method === 'POST') {
      const body = request.postDataJSON() as Partial<MockFilterPreset> & { name: string; tab: MockFilterPreset['tab']; query: Record<string, unknown> }
      state.writes.push({ method, path, body })
      const created = makeFilterPreset({
        id: `preset-e2e-${state.filterPresets.length + 1}-${Date.now()}`,
        name: body.name,
        scope: body.scope ?? 'private',
        tab: body.tab,
        query: body.query ?? {},
        isDefault: body.isDefault ?? false,
      })
      state.filterPresets.push(created)
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: created }) })
      return
    }
    if (/\/v1\/admin\/filter-presets\/[^/]+$/.test(path) && method === 'PATCH') {
      const id = path.split('/').pop()!
      const body = request.postDataJSON() as Partial<MockFilterPreset>
      state.writes.push({ method, path, body })
      const idx = state.filterPresets.findIndex((p) => p.id === id)
      if (idx >= 0) {
        state.filterPresets[idx] = { ...state.filterPresets[idx], ...body, id, updatedAt: new Date().toISOString() }
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: state.filterPresets[idx] }) })
      } else {
        await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'preset not found' } }) })
      }
      return
    }
    if (/\/v1\/admin\/filter-presets\/[^/]+$/.test(path) && method === 'DELETE') {
      const id = path.split('/').pop()!
      state.writes.push({ method, path })
      state.filterPresets = state.filterPresets.filter((p) => p.id !== id)
      await route.fulfill({ status: 204 })
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
        state.rejected[idx] = {
          ...state.rejected[idx],
          sourceCheckStatus: 'ok',
          probe: 'ok',
          render: 'ok',
          probeAggregate: { total: 1, ok: 1, state: 'ok' },
          renderAggregate: { total: 1, ok: 1, state: 'ok' },
        }
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

    // 兜底：下沉 shell 基座（CHG-E2E-GATE-AUDIT-C 根因 (b)：原 200 {data:null}
    // 毒化 shell hooks 契约（value.data.map / value.meta.degraded）→ 3 个 Runtime
    // TypeError → React 根崩溃 + dev overlay 全屏 → moderation 26 失败确定性真因）
    await route.fallback()
  })
}

/** 计算 spy：写操作匹配 */
export function findWrites(state: MockState, predicate: (w: { method: string; path: string }) => boolean) {
  return state.writes.filter(predicate)
}

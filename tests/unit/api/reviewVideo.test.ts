/**
 * tests/unit/api/reviewVideo.test.ts
 * CHG-201: reviewVideo — 内容审核 approve/reject + ES 同步
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VideoService } from '@/api/services/VideoService'

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('@/api/db/queries/videos', () => ({
  reviewVideo: vi.fn(),
  publishVideo: vi.fn(),
  updateVisibility: vi.fn(),
  batchPublishVideos: vi.fn(),
  batchUnpublishVideos: vi.fn(),
}))

import * as videoQueries from '@/api/db/queries/videos'
const mockReviewVideo = videoQueries.reviewVideo as ReturnType<typeof vi.fn>

// ── Helpers ───────────────────────────────────────────────────────

function makeDb(overrides: Record<string, unknown> = {}) {
  const defaultRow = {
    id: 'vid-1',
    short_id: 'abCD1234',
    slug: 'test-abCD1234',
    title: '测试视频',
    title_en: null,
    cover_url: null,
    type: 'movie',
    genre: null,
    year: 2024,
    country: null,
    episode_count: 1,
    rating: null,
    status: 'completed',
    is_published: true,
    content_rating: 'general',
    review_status: 'approved',
    visibility_status: 'public',
    ...overrides,
  }
  return {
    query: vi.fn().mockResolvedValue({ rows: [defaultRow] }),
  } as unknown as import('pg').Pool
}

function makeEs() {
  return {
    index: vi.fn().mockResolvedValue({}),
  } as unknown as import('@elastic/elasticsearch').Client
}

// ── Tests ─────────────────────────────────────────────────────────

describe('VideoService.review', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('approve — 设置 review_status=approved, visibility_status=public', async () => {
    const db = makeDb({ review_status: 'approved', visibility_status: 'public' })
    const es = makeEs()
    mockReviewVideo.mockResolvedValue({
      id: 'vid-1',
      review_status: 'approved',
      visibility_status: 'public',
      is_published: true,
    })

    const svc = new VideoService(db, es)
    const result = await svc.review('vid-1', {
      action: 'approve',
      reviewedBy: 'admin-1',
    })

    expect(result).toEqual({
      id: 'vid-1',
      review_status: 'approved',
      visibility_status: 'public',
      is_published: true,
    })
    expect(mockReviewVideo).toHaveBeenCalledWith(db, 'vid-1', {
      action: 'approve',
      reviewedBy: 'admin-1',
    })

    // 验证 ES 同步
    await vi.waitFor(() => expect(es.index).toHaveBeenCalledTimes(1))
    const doc = (es.index as ReturnType<typeof vi.fn>).mock.calls[0][0].document
    expect(doc.review_status).toBe('approved')
    expect(doc.visibility_status).toBe('public')
  })

  it('reject — 设置 review_status=rejected, visibility_status=hidden', async () => {
    const db = makeDb({
      review_status: 'rejected',
      visibility_status: 'hidden',
      is_published: false,
    })
    const es = makeEs()
    mockReviewVideo.mockResolvedValue({
      id: 'vid-1',
      review_status: 'rejected',
      visibility_status: 'hidden',
      is_published: false,
    })

    const svc = new VideoService(db, es)
    const result = await svc.review('vid-1', {
      action: 'reject',
      reason: '内容低质',
      reviewedBy: 'admin-1',
    })

    expect(result).toEqual({
      id: 'vid-1',
      review_status: 'rejected',
      visibility_status: 'hidden',
      is_published: false,
    })
    expect(mockReviewVideo).toHaveBeenCalledWith(db, 'vid-1', {
      action: 'reject',
      reason: '内容低质',
      reviewedBy: 'admin-1',
    })

    await vi.waitFor(() => expect(es.index).toHaveBeenCalledTimes(1))
    const doc = (es.index as ReturnType<typeof vi.fn>).mock.calls[0][0].document
    expect(doc.review_status).toBe('rejected')
    expect(doc.visibility_status).toBe('hidden')
  })

  it('视频不存在 — 返回 null，不触发 ES 同步', async () => {
    const db = makeDb()
    const es = makeEs()
    mockReviewVideo.mockResolvedValue(null)

    const svc = new VideoService(db, es)
    const result = await svc.review('nonexistent', {
      action: 'approve',
      reviewedBy: 'admin-1',
    })

    expect(result).toBeNull()
    await new Promise((r) => setTimeout(r, 10))
    expect(es.index).not.toHaveBeenCalled()
  })

  it('无 ES 客户端 — 不抛出错误', async () => {
    const db = makeDb()
    mockReviewVideo.mockResolvedValue({
      id: 'vid-1',
      review_status: 'approved',
      visibility_status: 'public',
      is_published: true,
    })

    const svc = new VideoService(db) // 不传 es
    await expect(
      svc.review('vid-1', { action: 'approve', reviewedBy: 'admin-1' })
    ).resolves.not.toThrow()
  })

  it('approve 含 reason — reason 正确传递', async () => {
    const db = makeDb()
    const es = makeEs()
    mockReviewVideo.mockResolvedValue({
      id: 'vid-1',
      review_status: 'approved',
      visibility_status: 'public',
      is_published: true,
    })

    const svc = new VideoService(db, es)
    await svc.review('vid-1', {
      action: 'approve',
      reason: '内容优质',
      reviewedBy: 'admin-1',
    })

    expect(mockReviewVideo).toHaveBeenCalledWith(db, 'vid-1', {
      action: 'approve',
      reason: '内容优质',
      reviewedBy: 'admin-1',
    })
  })
})

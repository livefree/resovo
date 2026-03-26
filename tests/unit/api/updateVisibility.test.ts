/**
 * tests/unit/api/updateVisibility.test.ts
 * CHG-200: updateVisibility — 可见性切换 + is_published 同步 + ES 同步
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VideoService } from '@/api/services/VideoService'

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('@/api/db/queries/videos', () => ({
  updateVisibility: vi.fn(),
  publishVideo: vi.fn(),
  batchPublishVideos: vi.fn(),
  batchUnpublishVideos: vi.fn(),
}))

import * as videoQueries from '@/api/db/queries/videos'
const mockUpdateVisibility = videoQueries.updateVisibility as ReturnType<typeof vi.fn>

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

describe('VideoService.updateVisibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('切换到 public — DB 更新成功后触发 indexToES', async () => {
    const db = makeDb({ visibility_status: 'public', is_published: true })
    const es = makeEs()
    mockUpdateVisibility.mockResolvedValue({
      id: 'vid-1',
      visibility_status: 'public',
      is_published: true,
    })

    const svc = new VideoService(db, es)
    const result = await svc.updateVisibility('vid-1', 'public')

    expect(result).toEqual({
      id: 'vid-1',
      visibility_status: 'public',
      is_published: true,
    })
    expect(mockUpdateVisibility).toHaveBeenCalledWith(db, 'vid-1', 'public')

    // 验证 ES 同步被触发
    await vi.waitFor(() => expect(es.index).toHaveBeenCalledTimes(1))
    const call = (es.index as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.document.review_status).toBe('approved')
    expect(call.document.visibility_status).toBe('public')
    expect(call.document.is_published).toBe(true)
  })

  it('切换到 hidden — is_published 同步为 false', async () => {
    const db = makeDb({
      visibility_status: 'hidden',
      is_published: false,
      review_status: 'approved',
    })
    const es = makeEs()
    mockUpdateVisibility.mockResolvedValue({
      id: 'vid-1',
      visibility_status: 'hidden',
      is_published: false,
    })

    const svc = new VideoService(db, es)
    const result = await svc.updateVisibility('vid-1', 'hidden')

    expect(result).toEqual({
      id: 'vid-1',
      visibility_status: 'hidden',
      is_published: false,
    })

    await vi.waitFor(() => expect(es.index).toHaveBeenCalledTimes(1))
    const call = (es.index as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.document.visibility_status).toBe('hidden')
    expect(call.document.is_published).toBe(false)
  })

  it('视频不存在 — 返回 null，不触发 ES 同步', async () => {
    const db = makeDb()
    const es = makeEs()
    mockUpdateVisibility.mockResolvedValue(null)

    const svc = new VideoService(db, es)
    const result = await svc.updateVisibility('nonexistent', 'public')

    expect(result).toBeNull()
    await new Promise((r) => setTimeout(r, 10))
    expect(es.index).not.toHaveBeenCalled()
  })

  it('无 ES 客户端 — 不抛出错误', async () => {
    const db = makeDb()
    mockUpdateVisibility.mockResolvedValue({
      id: 'vid-1',
      visibility_status: 'public',
      is_published: true,
    })

    const svc = new VideoService(db) // 不传 es
    await expect(svc.updateVisibility('vid-1', 'public')).resolves.not.toThrow()
  })
})

describe('VideoService.indexToES — 新增字段验证', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('indexToES SELECT 包含 review_status 和 visibility_status', async () => {
    const db = makeDb({
      review_status: 'pending_review',
      visibility_status: 'internal',
    })
    const es = makeEs()
    mockUpdateVisibility.mockResolvedValue({
      id: 'vid-1',
      visibility_status: 'internal',
      is_published: false,
    })

    const svc = new VideoService(db, es)
    await svc.updateVisibility('vid-1', 'internal')

    await vi.waitFor(() => expect(es.index).toHaveBeenCalledTimes(1))
    const doc = (es.index as ReturnType<typeof vi.fn>).mock.calls[0][0].document

    // 验证新增字段存在于 ES 文档中
    expect(doc).toHaveProperty('review_status', 'pending_review')
    expect(doc).toHaveProperty('visibility_status', 'internal')
    expect(doc).toHaveProperty('content_rating', 'general')
  })
})

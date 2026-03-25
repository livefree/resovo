/**
 * tests/unit/api/video-service-publish.test.ts
 * CHG-160: publish/batchPublish/batchUnpublish 触发 ES 同步
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VideoService } from '@/api/services/VideoService'

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('@/api/db/queries/videos', () => ({
  publishVideo: vi.fn(),
  batchPublishVideos: vi.fn(),
  batchUnpublishVideos: vi.fn(),
}))

import * as videoQueries from '@/api/db/queries/videos'
const mockPublishVideo = videoQueries.publishVideo as ReturnType<typeof vi.fn>
const mockBatchPublish = videoQueries.batchPublishVideos as ReturnType<typeof vi.fn>
const mockBatchUnpublish = videoQueries.batchUnpublishVideos as ReturnType<typeof vi.fn>

// ── Helpers ───────────────────────────────────────────────────────

function makeDb(queryResult = { rows: [{ id: 'vid-1', short_id: 'abCD1234', slug: 'test-abCD1234', title: '测试', title_en: null, cover_url: null, type: 'movie', category: null, year: 2024, country: null, episode_count: 1, rating: null, status: 'completed', is_published: true }] }) {
  return { query: vi.fn().mockResolvedValue(queryResult) } as unknown as import('pg').Pool
}

function makeEs() {
  return { index: vi.fn().mockResolvedValue({}) } as unknown as import('@elastic/elasticsearch').Client
}

// ── Tests ─────────────────────────────────────────────────────────

describe('VideoService.publish — ES 同步', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('publish(true) — DB 更新成功后触发 indexToES', async () => {
    const db = makeDb()
    const es = makeEs()
    mockPublishVideo.mockResolvedValue({ id: 'vid-1', is_published: true })

    const svc = new VideoService(db, es)
    await svc.publish('vid-1', true)

    // 等待 fire-and-forget
    await vi.waitFor(() => expect(es.index).toHaveBeenCalledTimes(1))
    const call = (es.index as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.id).toBe('vid-1')
    expect(call.document.is_published).toBe(true)
  })

  it('publish(false) — 下架时也触发 indexToES（同步 is_published:false 到 ES）', async () => {
    const db = makeDb({ rows: [{ id: 'vid-1', short_id: 'abCD1234', slug: null, title: '测试', title_en: null, cover_url: null, type: 'movie', category: null, year: 2024, country: null, episode_count: 1, rating: null, status: 'completed', is_published: false }] })
    const es = makeEs()
    mockPublishVideo.mockResolvedValue({ id: 'vid-1', is_published: false })

    const svc = new VideoService(db, es)
    await svc.publish('vid-1', false)

    await vi.waitFor(() => expect(es.index).toHaveBeenCalledTimes(1))
    const call = (es.index as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.document.is_published).toBe(false)
  })

  it('publish — DB 返回 null（视频不存在）时不调用 indexToES', async () => {
    const db = makeDb()
    const es = makeEs()
    mockPublishVideo.mockResolvedValue(null)

    const svc = new VideoService(db, es)
    await svc.publish('nonexistent', true)

    // 等一个 tick 确认没有触发
    await new Promise((r) => setTimeout(r, 10))
    expect(es.index).not.toHaveBeenCalled()
  })

  it('publish — 无 ES 客户端时不抛出错误', async () => {
    const db = makeDb()
    mockPublishVideo.mockResolvedValue({ id: 'vid-1', is_published: true })

    const svc = new VideoService(db) // 不传 es
    await expect(svc.publish('vid-1', true)).resolves.not.toThrow()
  })
})

describe('VideoService.batchPublish — ES 同步', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('batchPublish — DB 更新 N 条后对每个 id 触发 indexToES', async () => {
    const ids = ['vid-1', 'vid-2', 'vid-3']
    const db = makeDb()
    const es = makeEs()
    mockBatchPublish.mockResolvedValue(3)

    const svc = new VideoService(db, es)
    const count = await svc.batchPublish(ids, true)

    expect(count).toBe(3)
    await vi.waitFor(() => expect(es.index).toHaveBeenCalledTimes(3))
  })

  it('batchPublish — DB 更新 0 条时不触发 indexToES', async () => {
    const ids = ['vid-1', 'vid-2']
    const db = makeDb()
    const es = makeEs()
    mockBatchPublish.mockResolvedValue(0)

    const svc = new VideoService(db, es)
    await svc.batchPublish(ids, true)

    await new Promise((r) => setTimeout(r, 10))
    expect(es.index).not.toHaveBeenCalled()
  })
})

describe('VideoService.batchUnpublish — ES 同步', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('batchUnpublish — DB 更新成功后触发 indexToES', async () => {
    const ids = ['vid-1', 'vid-2']
    const db = makeDb()
    const es = makeEs()
    mockBatchUnpublish.mockResolvedValue(2)

    const svc = new VideoService(db, es)
    const count = await svc.batchUnpublish(ids)

    expect(count).toBe(2)
    await vi.waitFor(() => expect(es.index).toHaveBeenCalledTimes(2))
  })

  it('batchUnpublish — DB 更新 0 条时不触发 indexToES', async () => {
    const ids = ['vid-nonexistent']
    const db = makeDb()
    const es = makeEs()
    mockBatchUnpublish.mockResolvedValue(0)

    const svc = new VideoService(db, es)
    await svc.batchUnpublish(ids)

    await new Promise((r) => setTimeout(r, 10))
    expect(es.index).not.toHaveBeenCalled()
  })
})

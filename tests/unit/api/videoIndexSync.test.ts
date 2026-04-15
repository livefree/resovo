/**
 * tests/unit/api/videoIndexSync.test.ts
 * CHG-401: VideoIndexSyncService 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VideoIndexSyncService } from '@/api/services/VideoIndexSyncService'

// ── Helpers ───────────────────────────────────────────────────────

const VIDEO_ROW = {
  id: 'vid-1',
  short_id: 'abCD1234',
  slug: 'test-abCD1234',
  catalog_id: 'cat-1',
  title: '测试视频',
  title_en: 'Test Video',
  title_original: null,
  cover_url: 'https://example.com/cover.jpg',
  type: 'movie',
  genres: ['action'],
  year: 2024,
  country: 'CN',
  episode_count: 1,
  rating: 8.5,
  status: 'completed',
  is_published: true,
  content_rating: 'general',
  review_status: 'approved',
  visibility_status: 'public',
  imdb_id: null,
  tmdb_id: null,
}

function makeDb(rows: unknown[] = [VIDEO_ROW]) {
  return {
    query: vi.fn().mockResolvedValue({ rows }),
  } as unknown as import('pg').Pool
}

function makeEs() {
  return {
    index: vi.fn().mockResolvedValue({}),
  } as unknown as import('@elastic/elasticsearch').Client
}

// ── Tests ─────────────────────────────────────────────────────────

describe('VideoIndexSyncService.syncVideo', () => {
  beforeEach(() => vi.clearAllMocks())

  it('正常同步：调用 es.index，使用 ES_INDEX 和正确文档结构', async () => {
    const db = makeDb()
    const es = makeEs()
    const svc = new VideoIndexSyncService(db, es)

    await svc.syncVideo('vid-1')

    expect(es.index).toHaveBeenCalledTimes(1)
    const call = (es.index as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.index).toBe('resovo_videos')
    expect(call.id).toBe('vid-1')
    expect(call.document.title).toBe('测试视频')
    expect(call.document.is_published).toBe(true)
    expect(call.document.genres).toEqual(['action'])
    expect(call.document.updated_at).toBeTruthy()
  })

  it('视频不存在（deleted_at 过滤后无行）：静默跳过，不调用 es.index', async () => {
    const db = makeDb([])
    const es = makeEs()
    const svc = new VideoIndexSyncService(db, es)

    await svc.syncVideo('vid-missing')

    expect(es.index).not.toHaveBeenCalled()
  })

  it('ES 写入失败：不抛异常，只写 stderr', async () => {
    const db = makeDb()
    const es = {
      index: vi.fn().mockRejectedValue(new Error('connection refused')),
    } as unknown as import('@elastic/elasticsearch').Client
    const svc = new VideoIndexSyncService(db, es)

    // 不应抛异常
    await expect(svc.syncVideo('vid-1')).resolves.toBeUndefined()
  })

  it('下架视频（is_published=false）：仍然 upsert（保留 is_published=false 文档）', async () => {
    const unpublishedRow = { ...VIDEO_ROW, is_published: false, visibility_status: 'internal' }
    const db = makeDb([unpublishedRow])
    const es = makeEs()
    const svc = new VideoIndexSyncService(db, es)

    await svc.syncVideo('vid-1')

    expect(es.index).toHaveBeenCalledTimes(1)
    const doc = (es.index as ReturnType<typeof vi.fn>).mock.calls[0][0].document
    expect(doc.is_published).toBe(false)
    expect(doc.visibility_status).toBe('internal')
  })
})

describe('VideoIndexSyncService.reconcilePublished', () => {
  beforeEach(() => vi.clearAllMocks())

  it('批量同步：多条视频均调用 es.index', async () => {
    const rows = [
      { ...VIDEO_ROW, id: 'vid-1' },
      { ...VIDEO_ROW, id: 'vid-2' },
      { ...VIDEO_ROW, id: 'vid-3' },
    ]
    const db = makeDb(rows)
    const es = makeEs()
    const svc = new VideoIndexSyncService(db, es)

    const result = await svc.reconcilePublished(10)

    expect(result.synced).toBe(3)
    expect(result.errors).toBe(0)
    expect(es.index).toHaveBeenCalledTimes(3)
  })

  it('部分 ES 写入失败：errors 计数正确，不中断整批', async () => {
    const rows = [
      { ...VIDEO_ROW, id: 'vid-1' },
      { ...VIDEO_ROW, id: 'vid-2' },
    ]
    const db = makeDb(rows)
    const esIndex = vi.fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('ES error'))
    const es = { index: esIndex } as unknown as import('@elastic/elasticsearch').Client
    const svc = new VideoIndexSyncService(db, es)

    const result = await svc.reconcilePublished(10)

    expect(result.synced).toBe(1)
    expect(result.errors).toBe(1)
  })

  it('空结果：synced=0 errors=0', async () => {
    const db = makeDb([])
    const es = makeEs()
    const svc = new VideoIndexSyncService(db, es)

    const result = await svc.reconcilePublished(10)

    expect(result.synced).toBe(0)
    expect(result.errors).toBe(0)
    expect(es.index).not.toHaveBeenCalled()
  })
})

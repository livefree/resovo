/**
 * tests/unit/api/videoIndexSync.test.ts
 * CHG-401: VideoIndexSyncService 单元测试
 * CHG-410: 补全字段断言（description/director/cast/writers/subtitle_langs/created_at）
 * CHG-411: reconcileStale 测试
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
  description: '这是一段简介',
  cover_url: 'https://example.com/cover.jpg',
  type: 'movie',
  genres: ['action'],
  year: 2024,
  country: 'CN',
  episode_count: 1,
  rating: 8.5,
  status: 'completed',
  director: ['张三'],
  cast: ['李四', '王五'],
  writers: ['赵六'],
  subtitle_langs: ['zh', 'en'],
  is_published: true,
  content_rating: 'general',
  review_status: 'approved',
  visibility_status: 'public',
  imdb_id: null,
  tmdb_id: null,
  created_at: '2024-01-01T00:00:00.000Z',
}

function makeDb(rows: unknown[] = [VIDEO_ROW]) {
  return {
    query: vi.fn().mockResolvedValue({ rows }),
  } as unknown as import('pg').Pool
}

function makeEs() {
  return {
    index: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  } as unknown as import('@elastic/elasticsearch').Client
}

// ── Tests: syncVideo ──────────────────────────────────────────────

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

  it('CHG-410: 文档包含 description / director / cast / writers / subtitle_langs / created_at', async () => {
    const db = makeDb()
    const es = makeEs()
    const svc = new VideoIndexSyncService(db, es)

    await svc.syncVideo('vid-1')

    const doc = (es.index as ReturnType<typeof vi.fn>).mock.calls[0][0].document
    expect(doc.description).toBe('这是一段简介')
    expect(doc.director).toEqual(['张三'])
    expect(doc.cast).toEqual(['李四', '王五'])
    expect(doc.writers).toEqual(['赵六'])
    expect(doc.subtitle_langs).toEqual(['zh', 'en'])
    expect(doc.created_at).toBe('2024-01-01T00:00:00.000Z')
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
      delete: vi.fn(),
    } as unknown as import('@elastic/elasticsearch').Client
    const svc = new VideoIndexSyncService(db, es)

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

// ── Tests: reconcilePublished ─────────────────────────────────────

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
    const es = { index: esIndex, delete: vi.fn() } as unknown as import('@elastic/elasticsearch').Client
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

// ── Tests: reconcileStale (CHG-411) ──────────────────────────────

describe('VideoIndexSyncService.reconcileStale', () => {
  beforeEach(() => vi.clearAllMocks())

  it('非上架视频：upsert 到 ES（is_published=false 写入）', async () => {
    const unpublishedRow = { ...VIDEO_ROW, id: 'vid-down', is_published: false }
    const db = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [unpublishedRow] }) // STALE_UNPUBLISHED_SQL
        .mockResolvedValueOnce({ rows: [] }),              // STALE_DELETED_SQL
    } as unknown as import('pg').Pool
    const es = makeEs()
    const svc = new VideoIndexSyncService(db, es)

    const result = await svc.reconcileStale(7, 200)

    expect(result.fixed).toBe(1)
    expect(result.deleted).toBe(0)
    expect(result.errors).toBe(0)
    expect(es.index).toHaveBeenCalledTimes(1)
    expect((es.index as ReturnType<typeof vi.fn>).mock.calls[0][0].document.is_published).toBe(false)
  })

  it('软删除视频：从 ES 删除文档', async () => {
    const db = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })                    // STALE_UNPUBLISHED_SQL
        .mockResolvedValueOnce({ rows: [{ id: 'vid-del' }] }), // STALE_DELETED_SQL
    } as unknown as import('pg').Pool
    const es = makeEs()
    const svc = new VideoIndexSyncService(db, es)

    const result = await svc.reconcileStale(7, 200)

    expect(result.deleted).toBe(1)
    expect(result.fixed).toBe(0)
    expect(result.errors).toBe(0)
    expect(es.delete).toHaveBeenCalledWith({ index: 'resovo_videos', id: 'vid-del' })
  })

  it('ES delete 返回 404：视为幂等成功，不计入 errors', async () => {
    const db = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'vid-gone' }] }),
    } as unknown as import('pg').Pool
    const es = {
      index: vi.fn(),
      delete: vi.fn().mockRejectedValue(Object.assign(new Error('not_found'), { meta: { statusCode: 404 } })),
    } as unknown as import('@elastic/elasticsearch').Client
    const svc = new VideoIndexSyncService(db, es)

    const result = await svc.reconcileStale(7, 200)

    expect(result.errors).toBe(0)
    expect(result.deleted).toBe(1)
  })

  it('两路均有结果：fixed 和 deleted 均正确计数', async () => {
    const unpublishedRow = { ...VIDEO_ROW, id: 'vid-down', is_published: false }
    const db = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [unpublishedRow] })
        .mockResolvedValueOnce({ rows: [{ id: 'vid-del' }] }),
    } as unknown as import('pg').Pool
    const es = makeEs()
    const svc = new VideoIndexSyncService(db, es)

    const result = await svc.reconcileStale()

    expect(result.fixed).toBe(1)
    expect(result.deleted).toBe(1)
    expect(result.errors).toBe(0)
  })
})

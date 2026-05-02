/**
 * tests/unit/api/videoIndexSyncUnindex.test.ts
 * CHG-SN-4-05: VideoIndexSyncService.unindexVideo — 404 视为成功 / 其他错误降级
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VideoIndexSyncService } from '@/api/services/VideoIndexSyncService'

const mockWarn = vi.hoisted(() => vi.fn())
vi.mock('@/api/lib/logger', () => ({
  baseLogger: { warn: mockWarn, error: vi.fn(), info: vi.fn() },
  createLogger: vi.fn(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() })),
  createFastifyLoggerOptions: vi.fn(() => ({})),
  withRequest: vi.fn(),
  withJob: vi.fn(),
}))

function makeEs(deleteImpl?: () => Promise<unknown>) {
  return {
    delete: vi.fn(deleteImpl ?? (() => Promise.resolve({}))),
    index: vi.fn().mockResolvedValue({}),
  } as unknown as import('@elastic/elasticsearch').Client
}

function makeDb() {
  return { query: vi.fn().mockResolvedValue({ rows: [] }) } as unknown as import('pg').Pool
}

describe('VideoIndexSyncService.unindexVideo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('成功删除 ES 文档', async () => {
    const es = makeEs()
    const svc = new VideoIndexSyncService(makeDb(), es)
    await svc.unindexVideo('vid-1')
    expect(es.delete).toHaveBeenCalledWith({ index: 'resovo_videos', id: 'vid-1' })
  })

  it('404 错误（meta.statusCode=404）视为成功（幂等），不调用 logger.warn', async () => {
    const err = Object.assign(new Error('not_found'), { meta: { statusCode: 404 } })
    const es = makeEs(() => Promise.reject(err))
    const svc = new VideoIndexSyncService(makeDb(), es)
    await expect(svc.unindexVideo('vid-gone')).resolves.toBeUndefined()
    expect(mockWarn).not.toHaveBeenCalled()
  })

  it('非 404 错误调用 baseLogger.warn，不抛异常', async () => {
    const err = Object.assign(new Error('service unavailable'), { meta: { statusCode: 503 } })
    const es = makeEs(() => Promise.reject(err))
    const svc = new VideoIndexSyncService(makeDb(), es)
    await expect(svc.unindexVideo('vid-1')).resolves.toBeUndefined()
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({ videoId: 'vid-1' }),
      expect.stringContaining('unindexVideo failed'),
    )
  })

  it('无 meta 属性的普通错误调用 baseLogger.warn，不抛异常', async () => {
    const es = makeEs(() => Promise.reject(new Error('network error')))
    const svc = new VideoIndexSyncService(makeDb(), es)
    await expect(svc.unindexVideo('vid-2')).resolves.toBeUndefined()
    expect(mockWarn).toHaveBeenCalled()
  })
})

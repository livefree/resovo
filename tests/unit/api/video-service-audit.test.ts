/**
 * video-service-audit.test.ts — VideoService.updateVisibility 的 audit payload
 * 内容断言（CHG-SN-6-10 / R-MID-1 第 7 次系统化 / legacy EXEMPT 补齐）
 *
 * 覆盖：video.visibility_patch（admin audit context 必传时写）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock 依赖 ─────────────────────────────────────────────────────

vi.mock('@/api/db/queries/videos', () => ({
  transitionVideoState: vi.fn(),
}))
vi.mock('@/api/services/MediaCatalogService', () => ({
  MediaCatalogService: vi.fn().mockImplementation(() => ({})),
}))
vi.mock('@/api/services/CacheService', () => ({
  CACHE_PREFIXES: {},
}))
vi.mock('@/api/services/AuditLogService', () => ({
  AuditLogService: vi.fn().mockImplementation(() => ({ write: vi.fn() })),
}))
vi.mock('@/api/services/VideoIndexSyncService', () => ({
  VideoIndexSyncService: vi.fn().mockImplementation(() => ({
    syncVideo: vi.fn().mockResolvedValue(undefined),
  })),
}))

import * as videoQueries from '@/api/db/queries/videos'
import { AuditLogService } from '@/api/services/AuditLogService'
import { VideoService } from '@/api/services/VideoService'

const ACTOR_ID = '00000000-0000-0000-0000-000000000001'
const VIDEO_ID = '00000000-0000-0000-0000-000000000aaa'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('VideoService.updateVisibility — video.visibility_patch audit', () => {
  it('audit context 存在 → 写 video.visibility_patch + afterJsonb { visibility }', async () => {
    vi.mocked(videoQueries.transitionVideoState).mockResolvedValueOnce({
      id: VIDEO_ID,
      visibility_status: 'public',
      is_published: true,
    } as unknown as Awaited<ReturnType<typeof videoQueries.transitionVideoState>>)

    const svc = new VideoService({} as unknown as import('pg').Pool, {} as unknown as import('@elastic/elasticsearch').Client)
    const auditSvc = (AuditLogService as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value

    await svc.updateVisibility(VIDEO_ID, 'public', { actorId: ACTOR_ID, requestId: 'req-vis-1' })

    expect(auditSvc.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: ACTOR_ID,
      actionType: 'video.visibility_patch',
      targetKind: 'video',
      targetId: VIDEO_ID,
      afterJsonb: expect.objectContaining({ visibility: 'public' }),
      requestId: 'req-vis-1',
    }))
  })

  it('audit context 缺失（非 admin 路径）→ 不写 audit', async () => {
    vi.mocked(videoQueries.transitionVideoState).mockResolvedValueOnce({
      id: VIDEO_ID,
      visibility_status: 'internal',
      is_published: false,
    } as unknown as Awaited<ReturnType<typeof videoQueries.transitionVideoState>>)

    const svc = new VideoService({} as unknown as import('pg').Pool, {} as unknown as import('@elastic/elasticsearch').Client)
    const auditSvc = (AuditLogService as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value

    await svc.updateVisibility(VIDEO_ID, 'internal')

    expect(auditSvc.write).not.toHaveBeenCalled()
  })

  it('visibility=hidden 同款 audit + afterJsonb visibility 字段值正确', async () => {
    vi.mocked(videoQueries.transitionVideoState).mockResolvedValueOnce({
      id: VIDEO_ID,
      visibility_status: 'hidden',
      is_published: false,
    } as unknown as Awaited<ReturnType<typeof videoQueries.transitionVideoState>>)

    const svc = new VideoService({} as unknown as import('pg').Pool, {} as unknown as import('@elastic/elasticsearch').Client)
    const auditSvc = (AuditLogService as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value

    await svc.updateVisibility(VIDEO_ID, 'hidden', { actorId: ACTOR_ID })

    expect(auditSvc.write).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'video.visibility_patch',
      afterJsonb: expect.objectContaining({ visibility: 'hidden' }),
    }))
  })
})

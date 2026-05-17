/**
 * moderation-service-audit.test.ts — ModerationService 6 个 action_type 的 audit payload 内容断言
 * （CHG-SN-6-10 / R-MID-1 第 7 次系统化 / plan §3.0.5 legacy EXEMPT 补齐）
 *
 * 覆盖 PAYLOAD_ASSERTION_EXEMPT 中 6 项 ModerationService 写入：
 *   - video.approve
 *   - video.reject_labeled
 *   - video.staff_note
 *   - video.reopen
 *   - staging.revert
 *   - video_source.toggle
 *   - video_source.disable_dead_batch
 *
 * 模式：参 sources-matrix-service.test.ts 模板：mock AuditLogService 类 +
 * 拉取最近实例 + expect.objectContaining 断言 actionType / targetKind / targetId
 * / beforeJsonb? / afterJsonb? / requestId
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock 依赖 ─────────────────────────────────────────────────────

vi.mock('@/api/db/queries/videos', () => ({
  transitionVideoState: vi.fn(),
}))
vi.mock('@/api/db/queries/reviewLabels', () => ({
  findReviewLabelByKey: vi.fn(),
}))
vi.mock('@/api/db/queries/video_sources', () => ({
  toggleVideoSource: vi.fn(),
  disableDeadSources: vi.fn(),
}))
vi.mock('@/api/services/AuditLogService', () => ({
  AuditLogService: vi.fn().mockImplementation(() => ({
    write: vi.fn(),
  })),
}))
vi.mock('@/api/services/VideoIndexSyncService', () => ({
  VideoIndexSyncService: vi.fn().mockImplementation(() => ({
    syncVideo: vi.fn().mockResolvedValue(undefined),
    unindexVideo: vi.fn().mockResolvedValue(undefined),
  })),
}))

import * as videoQueries from '@/api/db/queries/videos'
import * as reviewLabels from '@/api/db/queries/reviewLabels'
import * as videoSources from '@/api/db/queries/video_sources'
import { AuditLogService } from '@/api/services/AuditLogService'
import { ModerationService } from '@/api/services/ModerationService'

const ACTOR_ID = '00000000-0000-0000-0000-000000000001'
const VIDEO_ID = '00000000-0000-0000-0000-000000000aaa'
const SOURCE_ID = '00000000-0000-0000-0000-000000000bbb'

function makeMockSvc() {
  const db = {} as unknown as import('pg').Pool
  const es = {} as unknown as import('@elastic/elasticsearch').Client
  const svc = new ModerationService(db, es)
  const auditSvc = (AuditLogService as unknown as ReturnType<typeof vi.fn>)
    .mock.results.at(-1)!.value
  return { svc, auditSvc }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ModerationService.approve — audit payload 内容断言（R-MID-1）', () => {
  it('video.approve audit payload 包含 actorId / targetKind=video / targetId / requestId', async () => {
    vi.mocked(videoQueries.transitionVideoState).mockResolvedValueOnce({
      id: VIDEO_ID, updated_at: '2026-05-16T00:00:00Z',
    } as unknown as Awaited<ReturnType<typeof videoQueries.transitionVideoState>>)
    const { svc, auditSvc } = makeMockSvc()

    await svc.approve({ videoId: VIDEO_ID, actorId: ACTOR_ID, requestId: 'req-1' })

    expect(auditSvc.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: ACTOR_ID,
      actionType: 'video.approve',
      targetKind: 'video',
      targetId: VIDEO_ID,
      requestId: 'req-1',
    }))
  })
})

describe('ModerationService.rejectLabeled — audit payload 内容断言（R-MID-1）', () => {
  it('video.reject_labeled audit payload 含 afterJsonb { labelKey, reason }', async () => {
    vi.mocked(reviewLabels.findReviewLabelByKey).mockResolvedValueOnce({
      label_key: 'duplicate',
      label: '重复',
      is_active: true,
    } as unknown as Awaited<ReturnType<typeof reviewLabels.findReviewLabelByKey>>)
    vi.mocked(videoQueries.transitionVideoState).mockResolvedValueOnce({
      id: VIDEO_ID, updated_at: '2026-05-16T00:00:00Z',
    } as unknown as Awaited<ReturnType<typeof videoQueries.transitionVideoState>>)
    const { svc, auditSvc } = makeMockSvc()

    await svc.rejectLabeled({
      videoId: VIDEO_ID,
      labelKey: 'duplicate',
      reason: 'reason text',
      actorId: ACTOR_ID,
      requestId: 'req-2',
    })

    expect(auditSvc.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: ACTOR_ID,
      actionType: 'video.reject_labeled',
      targetKind: 'video',
      targetId: VIDEO_ID,
      afterJsonb: expect.objectContaining({
        labelKey: 'duplicate',
        reason: 'reason text',
      }),
      requestId: 'req-2',
    }))
  })
})

describe('ModerationService.updateStaffNote — audit payload 内容断言（R-MID-1）', () => {
  it('video.staff_note audit payload 含 afterJsonb { note }', async () => {
    const svc = new ModerationService({} as unknown as import('pg').Pool, {} as unknown as import('@elastic/elasticsearch').Client)
    const auditSvc = (AuditLogService as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value
    // 模拟 db.query 返回 UPDATE 行（service 直接走 db.query 而非 queries module）
    Object.assign(svc as unknown as { db: { query: ReturnType<typeof vi.fn> } }, {
      db: { query: vi.fn().mockResolvedValue({ rows: [{ id: VIDEO_ID, updated_at: 'now' }] }) },
    })

    await svc.updateStaffNote({
      videoId: VIDEO_ID,
      note: 'staff says hi',
      actorId: ACTOR_ID,
      requestId: 'req-3',
    })

    expect(auditSvc.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: ACTOR_ID,
      actionType: 'video.staff_note',
      targetKind: 'video',
      targetId: VIDEO_ID,
      afterJsonb: expect.objectContaining({ note: 'staff says hi' }),
      requestId: 'req-3',
    }))
  })
})

describe('ModerationService.reopen — audit payload 内容断言（R-MID-1）', () => {
  it('video.reopen audit payload 含 actorId / targetKind=video / targetId', async () => {
    vi.mocked(videoQueries.transitionVideoState).mockResolvedValueOnce({
      id: VIDEO_ID, updated_at: 'now',
    } as unknown as Awaited<ReturnType<typeof videoQueries.transitionVideoState>>)
    const { svc, auditSvc } = makeMockSvc()

    await svc.reopen({ videoId: VIDEO_ID, actorId: ACTOR_ID, requestId: 'req-4' })

    expect(auditSvc.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: ACTOR_ID,
      actionType: 'video.reopen',
      targetKind: 'video',
      targetId: VIDEO_ID,
      requestId: 'req-4',
    }))
  })
})

describe('ModerationService.stagingRevert — audit payload 内容断言（R-MID-1）', () => {
  it('staging.revert audit payload 含 actorId / targetKind=staging / targetId', async () => {
    vi.mocked(videoQueries.transitionVideoState).mockResolvedValueOnce({
      id: VIDEO_ID, updated_at: 'now',
    } as unknown as Awaited<ReturnType<typeof videoQueries.transitionVideoState>>)
    const { svc, auditSvc } = makeMockSvc()

    await svc.stagingRevert({ videoId: VIDEO_ID, actorId: ACTOR_ID, requestId: 'req-5' })

    expect(auditSvc.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: ACTOR_ID,
      actionType: 'staging.revert',
      targetKind: 'staging',
      targetId: VIDEO_ID,
      requestId: 'req-5',
    }))
  })
})

describe('ModerationService.toggleSource — audit payload 内容断言（R-MID-1）', () => {
  it('video_source.toggle audit payload 含 afterJsonb { isActive, videoId }', async () => {
    vi.mocked(videoSources.toggleVideoSource).mockResolvedValueOnce({
      id: SOURCE_ID, isActive: true, updated_at: 'now',
    } as unknown as Awaited<ReturnType<typeof videoSources.toggleVideoSource>>)
    const { svc, auditSvc } = makeMockSvc()

    await svc.toggleSource({
      videoId: VIDEO_ID,
      sourceId: SOURCE_ID,
      isActive: true,
      actorId: ACTOR_ID,
      requestId: 'req-6',
    })

    expect(auditSvc.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: ACTOR_ID,
      actionType: 'video_source.toggle',
      targetKind: 'video_source',
      targetId: SOURCE_ID,
      afterJsonb: expect.objectContaining({
        isActive: true,
        videoId: VIDEO_ID,
      }),
      requestId: 'req-6',
    }))
  })
})

describe('ModerationService.disableDead — audit payload 内容断言（R-MID-1）', () => {
  it('video_source.disable_dead_batch audit payload 含 afterJsonb { count, sourceIds }', async () => {
    vi.mocked(videoSources.disableDeadSources).mockResolvedValueOnce({
      disabled: 3,
      sourceIds: [SOURCE_ID, 'src-2', 'src-3'],
    } as unknown as Awaited<ReturnType<typeof videoSources.disableDeadSources>>)
    const { svc, auditSvc } = makeMockSvc()

    await svc.disableDead({
      videoId: VIDEO_ID,
      actorId: ACTOR_ID,
      requestId: 'req-7',
    })

    expect(auditSvc.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: ACTOR_ID,
      actionType: 'video_source.disable_dead_batch',
      targetKind: 'video',
      targetId: VIDEO_ID,
      afterJsonb: expect.objectContaining({
        count: 3,
        sourceIds: expect.arrayContaining([SOURCE_ID]),
      }),
      requestId: 'req-7',
    }))
  })
})

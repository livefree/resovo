/**
 * staging-publish-service-audit.test.ts — StagingPublishService 2 个 action_type
 * 的 audit payload 内容断言（CHG-SN-6-10 / R-MID-1 第 7 次系统化 / legacy EXEMPT 补齐）
 *
 * 覆盖：
 *   - staging.publish — publishSingle / single video publish audit
 *   - staging.batch_publish — publishReadyBatch with audit context
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock 依赖 ─────────────────────────────────────────────────────

vi.mock('@/api/db/queries/staging', () => ({
  listReadyStagingVideoIds: vi.fn(),
  DEFAULT_STAGING_RULES: {},
}))
vi.mock('@/api/db/queries/videos', () => ({
  transitionVideoState: vi.fn(),
}))
vi.mock('@/api/db/queries/systemSettings', () => ({
  getSetting: vi.fn(),
  setSetting: vi.fn().mockResolvedValue(undefined),
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
import * as stagingQueries from '@/api/db/queries/staging'
import { AuditLogService } from '@/api/services/AuditLogService'
import { StagingPublishService } from '@/api/services/StagingPublishService'
import { NotificationEmitter } from '@/api/services/NotificationEmitter'

const ACTOR_ID = '00000000-0000-0000-0000-000000000001'
const VIDEO_ID = '00000000-0000-0000-0000-000000000aaa'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('StagingPublishService.publishSingle — staging.publish audit', () => {
  it('staging.publish audit payload 含 afterJsonb { isPublished, transitionedAt } + requestId', async () => {
    const mockQuery = vi.fn().mockResolvedValue({ rows: [{ count: '1' }] })
    const db = { query: mockQuery } as unknown as import('pg').Pool

    vi.mocked(videoQueries.transitionVideoState).mockResolvedValueOnce({
      id: VIDEO_ID,
      updated_at: '2026-05-16T10:00:00Z',
    } as unknown as Awaited<ReturnType<typeof videoQueries.transitionVideoState>>)

    const svc = new StagingPublishService(db, {} as unknown as import('@elastic/elasticsearch').Client)
    const auditSvc = (AuditLogService as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value

    await svc.publishSingle(VIDEO_ID, ACTOR_ID, 'req-publish-1')

    expect(auditSvc.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: ACTOR_ID,
      actionType: 'staging.publish',
      targetKind: 'staging',
      targetId: VIDEO_ID,
      afterJsonb: expect.objectContaining({
        isPublished: true,
        transitionedAt: '2026-05-16T10:00:00Z',
      }),
      requestId: 'req-publish-1',
    }))
  })
})

describe('StagingPublishService.publishReadyBatch — staging.batch_publish audit', () => {
  it('audit 上下文存在时写 staging.batch_publish + afterJsonb { ids, skipped }', async () => {
    const db = {} as unknown as import('pg').Pool

    vi.mocked(stagingQueries.listReadyStagingVideoIds).mockResolvedValueOnce(['v1', 'v2', 'v3'])
    vi.mocked(videoQueries.transitionVideoState)
      .mockResolvedValueOnce({ id: 'v1', updated_at: 'now' } as unknown as Awaited<ReturnType<typeof videoQueries.transitionVideoState>>)
      .mockResolvedValueOnce({ id: 'v2', updated_at: 'now' } as unknown as Awaited<ReturnType<typeof videoQueries.transitionVideoState>>)
      .mockResolvedValueOnce(null) // v3 skipped

    const svc = new StagingPublishService(db, {} as unknown as import('@elastic/elasticsearch').Client)
    const auditSvc = (AuditLogService as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value
    const emitSpy = vi.spyOn(NotificationEmitter.prototype, 'emit').mockImplementation(() => {})

    // 重写 getRules 避免 db 调用
    vi.spyOn(svc, 'getRules').mockResolvedValue({} as unknown as Awaited<ReturnType<typeof svc.getRules>>)

    await svc.publishReadyBatch(50, { actorId: ACTOR_ID, requestId: 'req-batch-1' })

    expect(auditSvc.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: ACTOR_ID,
      actionType: 'staging.batch_publish',
      targetKind: 'staging',
      targetId: 'batch',
      afterJsonb: expect.objectContaining({
        ids: expect.arrayContaining(['v1', 'v2']),
        skipped: expect.arrayContaining(['v3']),
      }),
      requestId: 'req-batch-1',
    }))

    // NTLG-P1-c-B-2：解耦双写 emit（if(audit) 内）
    expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'staging.batch_publish',
      level: 'info',
      title: '批量上架完成',
      sourceKind: 'admin_action',
      scope: 'broadcast',
      href: '/admin/videos',
      sourceRef: 'batch',
    }))
    emitSpy.mockRestore()
  })

  it('audit 上下文缺失（系统 Job 触发）时不写 audit', async () => {
    const db = {} as unknown as import('pg').Pool
    vi.mocked(stagingQueries.listReadyStagingVideoIds).mockResolvedValueOnce(['v1'])
    vi.mocked(videoQueries.transitionVideoState).mockResolvedValueOnce({
      id: 'v1', updated_at: 'now',
    } as unknown as Awaited<ReturnType<typeof videoQueries.transitionVideoState>>)

    const svc = new StagingPublishService(db, {} as unknown as import('@elastic/elasticsearch').Client)
    const auditSvc = (AuditLogService as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value
    const emitSpy = vi.spyOn(NotificationEmitter.prototype, 'emit').mockImplementation(() => {})
    vi.spyOn(svc, 'getRules').mockResolvedValue({} as unknown as Awaited<ReturnType<typeof svc.getRules>>)

    await svc.publishReadyBatch(50) // 无 audit 参数

    expect(auditSvc.write).not.toHaveBeenCalled()
    // NTLG-P1-c-B-2 parity：系统 Job 无 audit → 也不 emit（置 if(audit) 内守护）
    expect(emitSpy).not.toHaveBeenCalled()
    emitSpy.mockRestore()
  })
})

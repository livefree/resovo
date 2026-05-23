/**
 * staging-batch-publish-webhook.test.ts —
 * ADR-146 / CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A2 触发点接入验证
 *
 * 覆盖（3 用例）：
 *   #1 admin 触发批量发布 → dispatcher.enqueue 被调用 + event=video.batch.complete
 *   #2 dispatcher 被调用时 payload 字段正确（operationType + totalCount + successCount + failedCount + publishedIds + skippedIds）
 *   #3 系统 Job 触发（无 audit）→ dispatcher.enqueue 不被调用（避免 cron 噪音）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/lib/postgres', () => ({ db: { query: vi.fn() } }))

vi.mock('@/api/db/queries/staging', async () => {
  const actual = await vi.importActual<typeof import('@/api/db/queries/staging')>('@/api/db/queries/staging')
  return {
    ...actual,
    listReadyStagingVideoIds: vi.fn(),
  }
})

vi.mock('@/api/db/queries/videos', () => ({
  transitionVideoState: vi.fn(),
}))

vi.mock('@/api/db/queries/systemSettings', () => ({
  setSetting: vi.fn().mockResolvedValue(undefined),
  getSetting: vi.fn().mockResolvedValue(null),
  getAll: vi.fn().mockResolvedValue([]),
}))

import { StagingPublishService } from '@/api/services/StagingPublishService'
import { db } from '@/api/lib/postgres'
import * as stagingQueries from '@/api/db/queries/staging'
import * as videoQueries from '@/api/db/queries/videos'
import type { WebhookDispatcher } from '@/api/services/WebhookDispatcher'
import type { AuditLogService } from '@/api/services/AuditLogService'

const mockListReady = stagingQueries.listReadyStagingVideoIds as ReturnType<typeof vi.fn>
const mockTransition = videoQueries.transitionVideoState as ReturnType<typeof vi.fn>

const ACTOR_ID = '11111111-1111-4111-8111-111111111111'

const webhookEnqueue = vi.fn()
const fakeDispatcher = { enqueue: webhookEnqueue } as unknown as WebhookDispatcher
const auditWrite = vi.fn()
const fakeAudit = { write: auditWrite } as unknown as AuditLogService

beforeEach(() => {
  vi.clearAllMocks()
})

function patchAuditSvc(svc: StagingPublishService) {
  ;(svc as unknown as { auditSvc: AuditLogService }).auditSvc = fakeAudit
}

describe('StagingPublishService.publishReadyBatch — webhook 触发 (ADR-146 EP-A2)', () => {
  it('#1 admin 触发 → dispatcher.enqueue 调用 + event=video.batch.complete', async () => {
    mockListReady.mockResolvedValueOnce(['v-1', 'v-2'])
    mockTransition.mockResolvedValueOnce({ id: 'v-1' }).mockResolvedValueOnce({ id: 'v-2' })
    const svc = new StagingPublishService(db, undefined, fakeDispatcher)
    patchAuditSvc(svc)
    await svc.publishReadyBatch(50, { actorId: ACTOR_ID })
    expect(webhookEnqueue).toHaveBeenCalledTimes(1)
    expect(webhookEnqueue).toHaveBeenCalledWith('video.batch.complete', expect.any(Object), ACTOR_ID)
  })

  it('#2 dispatcher payload 字段正确', async () => {
    mockListReady.mockResolvedValueOnce(['v-1', 'v-2', 'v-3'])
    mockTransition
      .mockResolvedValueOnce({ id: 'v-1' })
      .mockResolvedValueOnce(null)  // skipped
      .mockResolvedValueOnce({ id: 'v-3' })
    const svc = new StagingPublishService(db, undefined, fakeDispatcher)
    patchAuditSvc(svc)
    await svc.publishReadyBatch(50, { actorId: ACTOR_ID })
    const payload = webhookEnqueue.mock.calls[0]?.[1]
    expect(payload).toMatchObject({
      operationType: 'staging.batch_publish',
      totalCount: 3,
      successCount: 2,
      failedCount: 1,
      publishedIds: ['v-1', 'v-3'],
      skippedIds: ['v-2'],
    })
  })

  it('#3 系统 Job 触发（无 audit）→ dispatcher 不调用（避免 cron 噪音）', async () => {
    mockListReady.mockResolvedValueOnce(['v-1'])
    mockTransition.mockResolvedValueOnce({ id: 'v-1' })
    const svc = new StagingPublishService(db, undefined, fakeDispatcher)
    patchAuditSvc(svc)
    // 不传 audit 参数 = 系统 Job 触发
    await svc.publishReadyBatch(50)
    expect(webhookEnqueue).not.toHaveBeenCalled()
    expect(auditWrite).not.toHaveBeenCalled()
  })
})

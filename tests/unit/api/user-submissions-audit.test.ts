/**
 * user-submissions-audit.test.ts — CHG-SN-7-REDO-02-A audit RETRO content assertion
 *
 * ADR-124 / R-MID-1 系统化第 15 次：4 真源同步 RETRO 框架第 5 文件（content assertion test）
 *
 * 覆盖（A 卡 stub）：
 *   - writeUserSubmissionAction 4 路径 afterJsonb shape（process / reject / batch_process / batch_reject）
 *   - audit-log-coverage 守卫"actionType 必有对应 service test 含 audit payload 内容断言"满足
 *   - metadata zod schema 3 类 shape 锁定（D-124-5 / Y2）
 *
 * 注意：本卡 stub 测试 audit helper 直接调用；
 *   实际 6 端点 process/reject/batch_* 业务流程的 audit 写入在 REDO-02-B
 *   user-submissions-mutations-audit.test.ts 完整覆盖（含状态机校验 + 404/409 守卫）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'
import {
  UserSubmissionService,
  BadSourceMetadataSchema,
  WishListMetadataSchema,
  MetadataCorrectionMetadataSchema,
} from '@/api/services/UserSubmissionService'

function makePool(): Pool {
  return { query: vi.fn() } as unknown as Pool
}

function spyAuditOnService(svc: UserSubmissionService): ReturnType<typeof vi.fn> {
  const writeMock = vi.fn()
  ;(svc as unknown as { auditSvc: { write: typeof writeMock } }).auditSvc = { write: writeMock }
  return writeMock
}

describe('UserSubmissionService.writeUserSubmissionAction audit shape (REDO-02-A stub)', () => {
  let svc: UserSubmissionService
  let writeMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    svc = new UserSubmissionService(makePool())
    writeMock = spyAuditOnService(svc)
  })

  it('1. process 单条：actionType + targetKind + targetId + afterJsonb.action="process"', () => {
    svc.writeUserSubmissionAction({
      actorId: 'actor-1',
      targetId: 'sub-uuid-1',
      payload: { action: 'process', type: 'bad_source', action_taken: '已禁用 source' },
      requestId: 'req-1',
    })
    // R-MID-1 audit payload 内容断言（expect.objectContaining 形式 / audit-log-coverage 守卫要求）
    expect(writeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'user_submission.action',
        targetKind: 'user_submission',
        targetId: 'sub-uuid-1',
        beforeJsonb: null,
        afterJsonb: expect.objectContaining({
          action: 'process',
          type: 'bad_source',
          action_taken: '已禁用 source',
        }),
      }),
    )
  })

  it('2. reject 单条：afterJsonb.action="reject" + reason 必填', () => {
    svc.writeUserSubmissionAction({
      actorId: 'actor-1',
      targetId: 'sub-uuid-2',
      payload: { action: 'reject', type: 'wish_list', reason: '已在 backlog 中' },
    })
    expect(writeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'user_submission.action',
        targetKind: 'user_submission',
        targetId: 'sub-uuid-2',
        afterJsonb: expect.objectContaining({ action: 'reject', reason: '已在 backlog 中' }),
      }),
    )
  })

  it('3. batch_process：targetId=null + afterJsonb.ids + count', () => {
    svc.writeUserSubmissionAction({
      actorId: 'actor-1',
      targetId: null,
      payload: {
        action: 'batch_process',
        ids: ['sub-1', 'sub-2', 'sub-3'],
        count: 3,
        action_taken: '批量已处理',
      },
    })
    expect(writeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'user_submission.action',
        targetKind: 'user_submission',
        targetId: null,
        afterJsonb: expect.objectContaining({
          action: 'batch_process',
          ids: ['sub-1', 'sub-2', 'sub-3'],
          count: 3,
        }),
      }),
    )
  })

  it('4. batch_reject：targetId=null + afterJsonb.ids + reason', () => {
    svc.writeUserSubmissionAction({
      actorId: 'actor-1',
      targetId: null,
      payload: {
        action: 'batch_reject',
        ids: ['sub-4', 'sub-5'],
        count: 2,
        reason: '批量拒绝：重复举报',
      },
    })
    expect(writeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'user_submission.action',
        afterJsonb: expect.objectContaining({
          action: 'batch_reject',
          reason: '批量拒绝：重复举报',
          count: 2,
        }),
      }),
    )
  })
})

describe('metadata_jsonb zod 锁定（D-124-5 / Y2 / 3 类 shape）', () => {
  it('5. BadSourceMetadataSchema：source_id 必填 / source_url + last_played_at 可选', () => {
    expect(
      BadSourceMetadataSchema.safeParse({ source_id: '11111111-2222-3333-4444-555555555555' }).success,
    ).toBe(true)
    expect(
      BadSourceMetadataSchema.safeParse({
        source_id: '11111111-2222-3333-4444-555555555555',
        source_url: 'https://example.com/play.m3u8',
        last_played_at: '2026-05-19T10:00:00Z',
      }).success,
    ).toBe(true)
    // 缺 source_id 拒绝
    expect(BadSourceMetadataSchema.safeParse({ source_url: 'x' }).success).toBe(false)
    // 未知字段拒绝（.strict()）
    expect(
      BadSourceMetadataSchema.safeParse({
        source_id: '11111111-2222-3333-4444-555555555555',
        unknown_field: 'x',
      }).success,
    ).toBe(false)
  })

  it('6. WishListMetadataSchema：全可选 / type 4 值枚举', () => {
    expect(WishListMetadataSchema.safeParse({}).success).toBe(true)
    expect(
      WishListMetadataSchema.safeParse({
        title_zh: '拜伦勋爵传记片',
        year: 2026,
        douban_id: '123456',
        type: 'movie',
      }).success,
    ).toBe(true)
    // year 超范围拒绝
    expect(WishListMetadataSchema.safeParse({ year: 1800 }).success).toBe(false)
    // type 非枚举拒绝
    expect(WishListMetadataSchema.safeParse({ type: 'unknown' }).success).toBe(false)
  })

  it('7. MetadataCorrectionMetadataSchema：video_id + field + suggested_value 必填', () => {
    expect(
      MetadataCorrectionMetadataSchema.safeParse({
        video_id: '11111111-2222-3333-4444-555555555555',
        field: 'director',
        suggested_value: 'Simon Mirren',
      }).success,
    ).toBe(true)
    // field 非枚举拒绝
    expect(
      MetadataCorrectionMetadataSchema.safeParse({
        video_id: '11111111-2222-3333-4444-555555555555',
        field: 'unknown_field',
        suggested_value: 'x',
      }).success,
    ).toBe(false)
    // 缺字段拒绝
    expect(
      MetadataCorrectionMetadataSchema.safeParse({
        video_id: '11111111-2222-3333-4444-555555555555',
      }).success,
    ).toBe(false)
  })

  it('8. suggested_value 超长（>500）拒绝', () => {
    expect(
      MetadataCorrectionMetadataSchema.safeParse({
        video_id: '11111111-2222-3333-4444-555555555555',
        field: 'title',
        suggested_value: 'x'.repeat(501),
      }).success,
    ).toBe(false)
  })
})

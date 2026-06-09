/**
 * user-submissions-audit.test.ts — CHG-SN-7-REDO-02-A audit RETRO content assertion
 *                                  + CHG-SN-7-REDO-02-B 6 业务方法 audit 流程
 *
 * ADR-124 / R-MID-1 系统化第 15 次：4 真源同步 RETRO 框架第 5 文件（content assertion test）
 *
 * A 卡覆盖（case 1-8）：
 *   - writeUserSubmissionAction 4 路径 afterJsonb shape（process / reject / batch_process / batch_reject）
 *   - audit-log-coverage 守卫"actionType 必有对应 service test 含 audit payload 内容断言"满足
 *   - metadata zod schema 3 类 shape 锁定（D-124-5 / Y2）
 *
 * B 卡扩展（case 9+）：6 业务方法 mutation 流程 + 404/409 守卫 + audit 写入实证
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'
import {
  UserSubmissionService,
  BadSourceMetadataSchema,
  WishListMetadataSchema,
  MetadataCorrectionMetadataSchema,
} from '@/api/services/UserSubmissionService'
import { NotificationEmitter } from '@/api/services/NotificationEmitter'

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
    const emitSpy = vi.spyOn(NotificationEmitter.prototype, 'emit').mockImplementation(() => {})
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
    // NTLG-P1-c-B-2：解耦双写 emit（与 audit 互不依赖；sourceRef=targetId）
    expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'user_submission.action',
      level: 'info',
      title: '用户投稿处理',
      sourceKind: 'admin_action',
      scope: 'broadcast',
      href: '/admin/user-submissions',
      sourceRef: 'sub-uuid-1',
    }))
    emitSpy.mockRestore()
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

// ── REDO-02-B mutations 业务流程测试 ──────────────────────────────

import {
  listUserSubmissions,
  getUserSubmissionById,
  markUserSubmissionProcessed,
  markUserSubmissionRejected,
  batchMarkProcessed,
  batchMarkRejected,
} from '@/api/db/queries/userSubmissions'

type QueryArgs = { sql: string; params?: readonly unknown[] }

function makeQueryPool(impl: (args: QueryArgs) => { rows: Record<string, unknown>[] }): Pool {
  return {
    query: vi.fn((sql: string, params?: readonly unknown[]) =>
      Promise.resolve(impl({ sql, params })),
    ),
  } as unknown as Pool
}

const SUB_ROW_PENDING = {
  id: 'sub-1',
  type: 'bad_source',
  status: 'pending',
  video_id: 'vid-1',
  source_id: 'src-1',
  submitted_by: 'user-1',
  submitted_by_name: 'alice',
  quote: '换了线路也是一样的',
  metadata_jsonb: null,
  video_title: '危险关系',
  video_poster_url: 'https://example.com/poster.jpg',
  source_name: '线路2',
  source_site_key: 'jszyapi',
  created_at: '2026-05-19T10:00:00Z',
  processed_at: null,
  processed_by: null,
  processed_reason: null,
}

const SUB_ROW_PROCESSED = {
  ...SUB_ROW_PENDING,
  id: 'sub-2',
  status: 'processed',
  processed_at: '2026-05-19T11:00:00Z',
  processed_by: 'actor-1',
}

describe('Service.processUserSubmission (REDO-02-B)', () => {
  let writeMock: ReturnType<typeof vi.fn>

  it('9. id 不存在 → NOT_FOUND 404 / audit 不写', async () => {
    const pool = makeQueryPool((q) => {
      if (q.sql.includes('SELECT us.id') && q.sql.includes('WHERE us.id')) return { rows: [] }
      return { rows: [] }
    })
    const svc = new UserSubmissionService(pool)
    writeMock = spyAuditOnService(svc)
    await expect(svc.processUserSubmission('missing', 'actor-1')).rejects.toMatchObject({
      code: 'NOT_FOUND', httpStatus: 404,
    })
    expect(writeMock).not.toHaveBeenCalled()
  })

  it('10. status 非 pending → STATE_CONFLICT 409 / audit 不写', async () => {
    const pool = makeQueryPool((q) => {
      if (q.sql.includes('SELECT us.id') && q.sql.includes('WHERE us.id')) return { rows: [SUB_ROW_PROCESSED] }
      return { rows: [] }
    })
    const svc = new UserSubmissionService(pool)
    writeMock = spyAuditOnService(svc)
    await expect(svc.processUserSubmission('sub-2', 'actor-1')).rejects.toMatchObject({
      code: 'STATE_CONFLICT', httpStatus: 409,
    })
    expect(writeMock).not.toHaveBeenCalled()
  })

  it('11. pending → processed 成功 + audit afterJsonb.action="process" + type 注入', async () => {
    const pool = makeQueryPool((q) => {
      if (q.sql.includes('SELECT us.id') && q.sql.includes('WHERE us.id')) return { rows: [SUB_ROW_PENDING] }
      if (q.sql.includes('UPDATE user_submissions') && q.sql.includes("'processed'")) {
        return { rows: [{ type: 'bad_source' }] }
      }
      return { rows: [] }
    })
    const svc = new UserSubmissionService(pool)
    writeMock = spyAuditOnService(svc)
    const result = await svc.processUserSubmission('sub-1', 'actor-1', '已禁用 source', 'req-1')
    expect(result.processed).toBe(true)
    expect(writeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'user_submission.action',
        targetKind: 'user_submission',
        targetId: 'sub-1',
        afterJsonb: expect.objectContaining({
          action: 'process', type: 'bad_source', action_taken: '已禁用 source',
        }),
      }),
    )
  })

  it('12. 竞态：取行时 pending / UPDATE 时已被处理 → STATE_CONFLICT', async () => {
    const pool = makeQueryPool((q) => {
      if (q.sql.includes('SELECT us.id') && q.sql.includes('WHERE us.id')) return { rows: [SUB_ROW_PENDING] }
      if (q.sql.includes('UPDATE user_submissions')) return { rows: [] } // 0 行 RETURNING
      return { rows: [] }
    })
    const svc = new UserSubmissionService(pool)
    writeMock = spyAuditOnService(svc)
    await expect(svc.processUserSubmission('sub-1', 'actor-1')).rejects.toMatchObject({
      code: 'STATE_CONFLICT',
    })
    expect(writeMock).not.toHaveBeenCalled()
  })
})

describe('Service.rejectUserSubmission (REDO-02-B)', () => {
  it('13. pending → rejected + audit afterJsonb.action="reject" + reason', async () => {
    const pool = makeQueryPool((q) => {
      if (q.sql.includes('SELECT us.id') && q.sql.includes('WHERE us.id')) return { rows: [SUB_ROW_PENDING] }
      if (q.sql.includes('UPDATE user_submissions') && q.sql.includes("'rejected'")) {
        return { rows: [{ type: 'bad_source' }] }
      }
      return { rows: [] }
    })
    const svc = new UserSubmissionService(pool)
    const writeMock = spyAuditOnService(svc)
    const result = await svc.rejectUserSubmission('sub-1', 'actor-1', '已在 backlog')
    expect(result.rejected).toBe(true)
    expect(writeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'user_submission.action',
        afterJsonb: expect.objectContaining({
          action: 'reject', type: 'bad_source', reason: '已在 backlog',
        }),
      }),
    )
  })
})

describe('Service.batchProcessUserSubmissions (REDO-02-B)', () => {
  it('14. 批量 → afterJsonb.ids + count = 实际处理数；非 pending 静默跳过', async () => {
    const pool = makeQueryPool((q) => {
      if (q.sql.includes('UPDATE user_submissions') && q.sql.includes('ANY')) {
        return { rows: [{ id: 'sub-a' }, { id: 'sub-b' }] } // 3 input / 2 actual
      }
      return { rows: [] }
    })
    const svc = new UserSubmissionService(pool)
    const writeMock = spyAuditOnService(svc)
    const result = await svc.batchProcessUserSubmissions(['sub-a', 'sub-b', 'sub-c'], 'actor-1')
    expect(result.processed).toBe(2)
    expect(writeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'user_submission.action',
        targetId: null,
        afterJsonb: expect.objectContaining({
          action: 'batch_process', ids: ['sub-a', 'sub-b'], count: 2,
        }),
      }),
    )
  })

  it('15. 批量 0 行处理 → audit 不写', async () => {
    const pool = makeQueryPool(() => ({ rows: [] }))
    const svc = new UserSubmissionService(pool)
    const writeMock = spyAuditOnService(svc)
    const result = await svc.batchProcessUserSubmissions(['sub-a'], 'actor-1')
    expect(result.processed).toBe(0)
    expect(writeMock).not.toHaveBeenCalled()
  })
})

describe('Service.batchRejectUserSubmissions (REDO-02-B)', () => {
  it('16. 批量 reject → afterJsonb.action="batch_reject" + ids + reason', async () => {
    const pool = makeQueryPool((q) => {
      if (q.sql.includes('UPDATE user_submissions') && q.sql.includes('ANY')) {
        return { rows: [{ id: 'sub-x' }] }
      }
      return { rows: [] }
    })
    const svc = new UserSubmissionService(pool)
    const writeMock = spyAuditOnService(svc)
    const result = await svc.batchRejectUserSubmissions(['sub-x'], 'actor-1', '批量拒绝')
    expect(result.rejected).toBe(1)
    expect(writeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        afterJsonb: expect.objectContaining({
          action: 'batch_reject', ids: ['sub-x'], count: 1, reason: '批量拒绝',
        }),
      }),
    )
  })
})

describe('queries.listUserSubmissions + badges 聚合 (REDO-02-B)', () => {
  it('17. SQL 含 JOIN videos/users/video_sources + COALESCE site_key + ORDER BY DESC', async () => {
    const queryFn = vi.fn().mockResolvedValue({ rows: [] })
    const pool = { query: queryFn } as unknown as Pool
    queryFn.mockResolvedValueOnce({ rows: [] })  // list
                .mockResolvedValueOnce({ rows: [{ count: '0' }] })  // count
                .mockResolvedValueOnce({ rows: [{ bad_source: '5', wish_list: '2', metadata_correction: '1', processed: '100' }] })
    const result = await listUserSubmissions(pool, { page: 1, limit: 20, type: 'all', status: 'pending' })
    expect(result.badges).toEqual({ bad_source: 5, wish_list: 2, metadata_correction: 1, processed: 100 })
    const [listSql] = queryFn.mock.calls[0]
    expect(listSql).toContain('LEFT JOIN users')
    expect(listSql).toContain('LEFT JOIN videos')
    expect(listSql).toContain('LEFT JOIN video_sources')
    expect(listSql).toContain('COALESCE(vs.source_site_key, v.site_key)')
    expect(listSql).toContain('ORDER BY us.created_at DESC')
  })

  it('18. type=bad_source + status=pending 同时过滤 → WHERE 拼 2 条件', async () => {
    const queryFn = vi.fn().mockResolvedValue({ rows: [] })
    const pool = { query: queryFn } as unknown as Pool
    queryFn.mockResolvedValue({ rows: [{ count: '0', bad_source: '0', wish_list: '0', metadata_correction: '0', processed: '0' }] })
    await listUserSubmissions(pool, { page: 1, limit: 20, type: 'bad_source', status: 'pending' })
    const [listSql, listParams] = queryFn.mock.calls[0]
    expect(listParams).toContain('bad_source')
    expect(listParams).toContain('pending')
    expect(listSql).toContain('us.type = $1')
    expect(listSql).toContain('us.status = $2')
  })

  it('19. getUserSubmissionById 不存在 → null', async () => {
    const pool = makeQueryPool(() => ({ rows: [] }))
    const result = await getUserSubmissionById(pool, 'missing')
    expect(result).toBeNull()
  })

  it('20. markUserSubmissionProcessed 返回 RETURNING type', async () => {
    const pool = makeQueryPool((q) => {
      if (q.sql.includes('UPDATE user_submissions') && q.sql.includes("'processed'")) {
        return { rows: [{ type: 'wish_list' }] }
      }
      return { rows: [] }
    })
    const result = await markUserSubmissionProcessed(pool, 'sub-1', 'actor-1', '已入库')
    expect(result).toEqual({ type: 'wish_list' })
  })

  it('21. batchMarkProcessed 空 ids → 直接返回 []（不查 DB）', async () => {
    const queryFn = vi.fn()
    const pool = { query: queryFn } as unknown as Pool
    const result = await batchMarkProcessed(pool, [], 'actor-1')
    expect(result).toEqual([])
    expect(queryFn).not.toHaveBeenCalled()
  })

  it('22. batchMarkRejected 空 ids → 直接返回 []', async () => {
    const queryFn = vi.fn()
    const pool = { query: queryFn } as unknown as Pool
    const result = await batchMarkRejected(pool, [], 'actor-1', 'r')
    expect(result).toEqual([])
    expect(queryFn).not.toHaveBeenCalled()
  })

  it('23. markUserSubmissionRejected reason 写入 processed_reason 字段', async () => {
    const queryFn = vi.fn().mockResolvedValue({ rows: [{ type: 'metadata_correction' }] })
    const pool = { query: queryFn } as unknown as Pool
    await markUserSubmissionRejected(pool, 'sub-1', 'actor-1', '已忽略')
    const [, params] = queryFn.mock.calls[0]
    expect(params).toContain('已忽略')
  })

  it("24. status='processed_or_rejected' → SQL 拼 status IN ('processed', 'rejected')（CHG-SN-7-MISC-USER-SUBMISSIONS-PROCESSED-FILTER）", async () => {
    const queryFn = vi.fn().mockResolvedValue({ rows: [] })
    const pool = { query: queryFn } as unknown as Pool
    await listUserSubmissions(pool, { page: 1, limit: 20, type: 'all', status: 'processed_or_rejected' })
    const [listSql] = queryFn.mock.calls[0]
    expect(listSql).toContain("status IN ('processed', 'rejected')")
    // 不应出现 us.status = $N 形式（IN 走硬编码避免 $N 参数）
    expect(listSql).not.toMatch(/us\.status = \$\d/)
  })
})

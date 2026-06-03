/**
 * identity-candidates-reject.test.ts — IdentityCandidatesService 单元测试（CHG-VIR-9-B / ADR-178）
 *
 * 覆盖：
 * - reject: happy path（单事务 pending→rejected + decision(rejected, audit_id=null)）
 * - reject: NOT_FOUND / 非 pending STATE_CONFLICT / 并发兜底 / 事务异常 ROLLBACK
 * - validateForMerge: 404 / 409 / pair⊄集合 422 / 子集通过（D-178-3）
 * - attachConfirmedDecision: from-state 守卫（rowCount=0 → 409）+ decision(confirmed, audit_id)
 * - audit payload 内容断言（R-MID-1）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IdentityCandidatesService, RejectCandidateSchema } from '@/api/services/IdentityCandidatesService'
import { AppError } from '@/api/lib/errors'

vi.mock('@/api/db/queries/identity-candidate', () => ({
  findCandidateById: vi.fn(),
  findCandidateByIdReadonly: vi.fn(),
  updateCandidateStatus: vi.fn(),
}))

vi.mock('@/api/db/queries/identity-decision', () => ({
  insertIdentityDecision: vi.fn(),
}))

vi.mock('@/api/services/AuditLogService', () => ({
  AuditLogService: vi.fn().mockImplementation(() => ({
    write: vi.fn(),
  })),
}))

import {
  findCandidateById,
  findCandidateByIdReadonly,
  updateCandidateStatus,
} from '@/api/db/queries/identity-candidate'
import { insertIdentityDecision } from '@/api/db/queries/identity-decision'
import { AuditLogService } from '@/api/services/AuditLogService'

const CANDIDATE_ID = '00000000-0000-0000-0000-0000000000c1'
const ACTOR_ID = '00000000-0000-0000-0000-000000000001'
const DECISION_ID = '00000000-0000-0000-0000-0000000000d1'
const AUDIT_ID = '00000000-0000-0000-0000-0000000000a1'
const LEFT_ID = '00000000-0000-0000-0000-000000000011'
const RIGHT_ID = '00000000-0000-0000-0000-000000000012'
const OTHER_ID = '00000000-0000-0000-0000-000000000099'

function makeCandidateRow(status: 'pending' | 'confirmed' | 'rejected' | 'superseded' = 'pending') {
  return {
    id: CANDIDATE_ID,
    left_video_id: LEFT_ID,
    right_video_id: RIGHT_ID,
    canonical_pair_key: `${LEFT_ID}|${RIGHT_ID}`,
    status,
    parser_version: '1.0.0',
    scorer_version: '1.0.0',
    evidence_jsonb: [],
    evidence_hash: 'h',
    legacy_score: null,
    identity_score: '0.8500',
    strong_negative_reasons: [],
    trigger_source: 'offline-rescore' as const,
    group_key: null,
    revived_from_candidate_id: null,
    superseded_by_candidate_id: null,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
  }
}

function makeMockClient() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  }
}

function makeMockPool(client: ReturnType<typeof makeMockClient>) {
  return {
    connect: vi.fn().mockResolvedValue(client),
    query: vi.fn(),
  } as unknown as import('pg').Pool
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── reject ─────────────────────────────────────────────────────────

describe('IdentityCandidatesService.reject', () => {
  it('happy path：单事务 pending→rejected + decision(rejected, audit_id=null) + audit', async () => {
    const client = makeMockClient()
    const svc = new IdentityCandidatesService(makeMockPool(client))
    const auditSvcInstance = (AuditLogService as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value

    vi.mocked(findCandidateById).mockResolvedValueOnce(makeCandidateRow('pending'))
    vi.mocked(updateCandidateStatus).mockResolvedValueOnce(1)
    vi.mocked(insertIdentityDecision).mockResolvedValueOnce(DECISION_ID)

    const result = await svc.reject(CANDIDATE_ID, ACTOR_ID, '不是同一作品')

    expect(result).toEqual({ candidateId: CANDIDATE_ID, status: 'rejected', decisionId: DECISION_ID })

    // 单事务：BEGIN → FOR UPDATE 读 → 状态迁移 → decision → COMMIT
    expect(client.query).toHaveBeenCalledWith('BEGIN')
    expect(client.query).toHaveBeenCalledWith('COMMIT')
    expect(client.release).toHaveBeenCalled()
    expect(findCandidateById).toHaveBeenCalledWith(client, CANDIDATE_ID)
    expect(updateCandidateStatus).toHaveBeenCalledWith(client, CANDIDATE_ID, 'pending', 'rejected')
    expect(insertIdentityDecision).toHaveBeenCalledWith(client, expect.objectContaining({
      candidateId: CANDIDATE_ID,
      decision: 'rejected',
      videoMergeAuditId: null,  // D-178-2：rejected 不关联 audit
      performedBy: ACTOR_ID,
      reason: '不是同一作品',
    }))

    // fire-and-forget audit（COMMIT 后 / D-178-6）
    expect(auditSvcInstance.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: ACTOR_ID,
      actionType: 'identity_candidate.reject',
      targetKind: 'identity_candidate',
      targetId: CANDIDATE_ID,
      beforeJsonb: expect.objectContaining({ status: 'pending' }),
      afterJsonb: expect.objectContaining({ status: 'rejected', decisionId: DECISION_ID }),
    }))
  })

  it('candidate 不存在 → 404 + ROLLBACK', async () => {
    const client = makeMockClient()
    const svc = new IdentityCandidatesService(makeMockPool(client))
    vi.mocked(findCandidateById).mockResolvedValueOnce(null)

    await expect(svc.reject(CANDIDATE_ID, ACTOR_ID)).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 })
    expect(client.query).toHaveBeenCalledWith('ROLLBACK')
    expect(client.release).toHaveBeenCalled()
    expect(insertIdentityDecision).not.toHaveBeenCalled()
  })

  it.each(['confirmed', 'rejected', 'superseded'] as const)(
    'candidate 非 pending（%s）→ 409 STATE_CONFLICT（含重复 reject 幂等口径 / D-178-2）',
    async (status) => {
      const client = makeMockClient()
      const svc = new IdentityCandidatesService(makeMockPool(client))
      vi.mocked(findCandidateById).mockResolvedValueOnce(makeCandidateRow(status))

      await expect(svc.reject(CANDIDATE_ID, ACTOR_ID)).rejects.toMatchObject({ code: 'STATE_CONFLICT', httpStatus: 409 })
      expect(client.query).toHaveBeenCalledWith('ROLLBACK')
      expect(updateCandidateStatus).not.toHaveBeenCalled()
    },
  )

  it('并发兜底：updateCandidateStatus rowCount=0 → 409 + ROLLBACK', async () => {
    const client = makeMockClient()
    const svc = new IdentityCandidatesService(makeMockPool(client))
    vi.mocked(findCandidateById).mockResolvedValueOnce(makeCandidateRow('pending'))
    vi.mocked(updateCandidateStatus).mockResolvedValueOnce(0)

    await expect(svc.reject(CANDIDATE_ID, ACTOR_ID)).rejects.toMatchObject({ code: 'STATE_CONFLICT', httpStatus: 409 })
    expect(client.query).toHaveBeenCalledWith('ROLLBACK')
    expect(insertIdentityDecision).not.toHaveBeenCalled()
  })

  it('事务内异常 → ROLLBACK + release + 不写 audit', async () => {
    const client = makeMockClient()
    const svc = new IdentityCandidatesService(makeMockPool(client))
    const auditSvcInstance = (AuditLogService as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value
    vi.mocked(findCandidateById).mockResolvedValueOnce(makeCandidateRow('pending'))
    vi.mocked(updateCandidateStatus).mockResolvedValueOnce(1)
    vi.mocked(insertIdentityDecision).mockRejectedValueOnce(new Error('db down'))

    await expect(svc.reject(CANDIDATE_ID, ACTOR_ID)).rejects.toThrow('db down')
    expect(client.query).toHaveBeenCalledWith('ROLLBACK')
    expect(client.release).toHaveBeenCalled()
    expect(auditSvcInstance.write).not.toHaveBeenCalled()
  })
})

// ── validateForMerge（D-178-3 事务前快速失败）───────────────────────

describe('IdentityCandidatesService.validateForMerge', () => {
  const db = { query: vi.fn() } as unknown as import('pg').Pool

  it('candidate 不存在 → 404', async () => {
    vi.mocked(findCandidateByIdReadonly).mockResolvedValueOnce(null)
    await expect(
      IdentityCandidatesService.validateForMerge(db, CANDIDATE_ID, [LEFT_ID, RIGHT_ID]),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 })
  })

  it('candidate 非 pending → 409', async () => {
    vi.mocked(findCandidateByIdReadonly).mockResolvedValueOnce(makeCandidateRow('rejected'))
    await expect(
      IdentityCandidatesService.validateForMerge(db, CANDIDATE_ID, [LEFT_ID, RIGHT_ID]),
    ).rejects.toMatchObject({ code: 'STATE_CONFLICT', httpStatus: 409 })
  })

  it('pair ⊄ 合并集合 → 422 VALIDATION_ERROR', async () => {
    vi.mocked(findCandidateByIdReadonly).mockResolvedValueOnce(makeCandidateRow('pending'))
    await expect(
      IdentityCandidatesService.validateForMerge(db, CANDIDATE_ID, [LEFT_ID, OTHER_ID]),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', httpStatus: 422 })
  })

  it('pair ⊆ 合并集合（N→1 子集即合法 / D-105a-9）→ 通过', async () => {
    vi.mocked(findCandidateByIdReadonly).mockResolvedValueOnce(makeCandidateRow('pending'))
    await expect(
      IdentityCandidatesService.validateForMerge(db, CANDIDATE_ID, [LEFT_ID, RIGHT_ID, OTHER_ID]),
    ).resolves.toBeUndefined()
  })
})

// ── attachConfirmedDecision（merge 事务内挂载 / R8）──────────────────

describe('IdentityCandidatesService.attachConfirmedDecision', () => {
  it('happy path：candidate→confirmed + decision(confirmed, audit_id 非空 / R8)', async () => {
    const client = makeMockClient() as unknown as import('pg').PoolClient
    vi.mocked(updateCandidateStatus).mockResolvedValueOnce(1)
    vi.mocked(insertIdentityDecision).mockResolvedValueOnce(DECISION_ID)

    const decisionId = await IdentityCandidatesService.attachConfirmedDecision(client, {
      candidateId: CANDIDATE_ID,
      videoMergeAuditId: AUDIT_ID,
      performedBy: ACTOR_ID,
    })

    expect(decisionId).toBe(DECISION_ID)
    expect(updateCandidateStatus).toHaveBeenCalledWith(client, CANDIDATE_ID, 'pending', 'confirmed')
    expect(insertIdentityDecision).toHaveBeenCalledWith(client, expect.objectContaining({
      candidateId: CANDIDATE_ID,
      decision: 'confirmed',
      videoMergeAuditId: AUDIT_ID,  // R8：confirmed 必关联 audit
      performedBy: ACTOR_ID,
    }))
  })

  it('from-state 守卫：rowCount=0（并发被 reject）→ 409，不 insert decision', async () => {
    const client = makeMockClient() as unknown as import('pg').PoolClient
    vi.mocked(updateCandidateStatus).mockResolvedValueOnce(0)

    await expect(
      IdentityCandidatesService.attachConfirmedDecision(client, {
        candidateId: CANDIDATE_ID,
        videoMergeAuditId: AUDIT_ID,
        performedBy: ACTOR_ID,
      }),
    ).rejects.toMatchObject({ code: 'STATE_CONFLICT', httpStatus: 409 })
    expect(insertIdentityDecision).not.toHaveBeenCalled()
  })

  it('抛出的是 AppError（route isAppError 映射依赖）', async () => {
    const client = makeMockClient() as unknown as import('pg').PoolClient
    vi.mocked(updateCandidateStatus).mockResolvedValueOnce(0)
    await expect(
      IdentityCandidatesService.attachConfirmedDecision(client, {
        candidateId: CANDIDATE_ID,
        videoMergeAuditId: AUDIT_ID,
        performedBy: ACTOR_ID,
      }),
    ).rejects.toBeInstanceOf(AppError)
  })
})

// ── RejectCandidateSchema ───────────────────────────────────────────

describe('RejectCandidateSchema', () => {
  it('空 body 通过（reason optional）', () => {
    expect(RejectCandidateSchema.safeParse({}).success).toBe(true)
  })

  it('reason ≤500 通过 / >500 拒绝', () => {
    expect(RejectCandidateSchema.safeParse({ reason: 'x'.repeat(500) }).success).toBe(true)
    expect(RejectCandidateSchema.safeParse({ reason: 'x'.repeat(501) }).success).toBe(false)
  })
})

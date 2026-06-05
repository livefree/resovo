/**
 * identity-decisions-revive.test.ts — ADR-179 实施单测（CHG-VIR-13-C1）
 *
 * 覆盖：
 * - revive: happy path（复制原行新建 pending + revived_from 链 + 原 decision 置 reverted + 原行零修改）
 * - revive: NOT_FOUND / 非 rejected STATE_CONFLICT / pair 一侧软删 STATE_CONFLICT
 * - revive: 撞 pending unique 幂等（reused: true + **不**置 reverted / D-179-3）
 * - revive: 事务异常 ROLLBACK 不写 audit
 * - revive: audit payload 内容断言（R-MID-1 第 32 次 / D-179-5）
 * - listDecisions: 行映射 + 过滤透传 + 分页 offset（D-179-1）
 * - zod: ListIdentityDecisionsSchema（reverted transform / strict）+ ReviveCandidateSchema
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  IdentityCandidatesService,
  ReviveCandidateSchema,
  ListIdentityDecisionsSchema,
} from '@/api/services/IdentityCandidatesService'

vi.mock('@/api/db/queries/identity-candidate', () => ({
  findCandidateById: vi.fn(),
  findCandidateByIdReadonly: vi.fn(),
  findPendingByPairKey: vi.fn(),
  insertCandidate: vi.fn(),
  updateCandidateStatus: vi.fn(),
}))

vi.mock('@/api/db/queries/identity-decision', () => ({
  insertIdentityDecision: vi.fn(),
  listIdentityDecisions: vi.fn(),
  countIdentityDecisions: vi.fn(),
  findActiveRejectedDecisionByCandidateId: vi.fn(),
  markDecisionReverted: vi.fn(),
}))

vi.mock('@/api/db/queries/video-merge-mutations', () => ({
  fetchVideosByIds: vi.fn(),
}))

vi.mock('@/api/services/AuditLogService', () => ({
  AuditLogService: vi.fn().mockImplementation(() => ({
    write: vi.fn(),
  })),
}))

import {
  findCandidateById,
  findPendingByPairKey,
  insertCandidate,
} from '@/api/db/queries/identity-candidate'
import {
  listIdentityDecisions,
  countIdentityDecisions,
  findActiveRejectedDecisionByCandidateId,
  markDecisionReverted,
} from '@/api/db/queries/identity-decision'
import { fetchVideosByIds } from '@/api/db/queries/video-merge-mutations'
import { AuditLogService } from '@/api/services/AuditLogService'

const CANDIDATE_ID = '00000000-0000-0000-0000-0000000000c1'
const NEW_CANDIDATE_ID = '00000000-0000-0000-0000-0000000000c2'
const EXISTING_PENDING_ID = '00000000-0000-0000-0000-0000000000c3'
const DECISION_ID = '00000000-0000-0000-0000-0000000000d1'
const ACTOR_ID = '00000000-0000-0000-0000-000000000001'
const LEFT_ID = '00000000-0000-0000-0000-000000000011'
const RIGHT_ID = '00000000-0000-0000-0000-000000000012'

function makeCandidateRow(status: 'pending' | 'confirmed' | 'rejected' | 'superseded' = 'rejected') {
  return {
    id: CANDIDATE_ID,
    left_video_id: LEFT_ID,
    right_video_id: RIGHT_ID,
    canonical_pair_key: `${LEFT_ID}|${RIGHT_ID}`,
    status,
    parser_version: '1.2.0',
    scorer_version: '2.0.0',
    evidence_jsonb: [{ type: 'core_title_key_equal', hit: true }],
    evidence_hash: 'hash-abc',
    legacy_score: '0.7000',
    identity_score: '0.8500',
    strong_negative_reasons: [],
    trigger_source: 'offline-rescore' as const,
    group_key: 'gk-1',
    revived_from_candidate_id: null,
    superseded_by_candidate_id: null,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
  }
}

/** 双侧存活 video 行（fetchVideosByIds 仅消费 id/deleted_at） */
function aliveVideos(deletedLeft = false, deletedRight = false) {
  return [
    { id: LEFT_ID, deleted_at: deletedLeft ? '2026-06-01T00:00:00Z' : null },
    { id: RIGHT_ID, deleted_at: deletedRight ? '2026-06-01T00:00:00Z' : null },
  ] as Awaited<ReturnType<typeof fetchVideosByIds>>
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

// ── revive（D-179-2/3/4/5）──────────────────────────────────────────

describe('IdentityCandidatesService.revive', () => {
  it('happy path：复制原行新建 pending（revived_from 链 + manual-search）+ 原 decision 置 reverted + audit payload 内容断言（R-MID-1）', async () => {
    const client = makeMockClient()
    const svc = new IdentityCandidatesService(makeMockPool(client))
    const auditSvcInstance = (AuditLogService as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value

    vi.mocked(findCandidateById).mockResolvedValueOnce(makeCandidateRow('rejected'))
    vi.mocked(fetchVideosByIds).mockResolvedValueOnce(aliveVideos())
    vi.mocked(insertCandidate).mockResolvedValueOnce({ ...makeCandidateRow('pending'), id: NEW_CANDIDATE_ID })
    vi.mocked(findActiveRejectedDecisionByCandidateId).mockResolvedValueOnce({ id: DECISION_ID })

    const result = await svc.revive(CANDIDATE_ID, ACTOR_ID, '误拒恢复')

    expect(result).toEqual({
      newCandidateId: NEW_CANDIDATE_ID,
      revivedFromCandidateId: CANDIDATE_ID,
      reused: false,
    })
    // D-179-2：复制原行全字段 + 链字段 + D-179-4 trigger_source='manual-search'（CHECK 不扩枚举）
    expect(insertCandidate).toHaveBeenCalledWith(client, {
      leftVideoId: LEFT_ID,
      rightVideoId: RIGHT_ID,
      canonicalPairKey: `${LEFT_ID}|${RIGHT_ID}`,
      parserVersion: '1.2.0',
      scorerVersion: '2.0.0',
      evidenceJsonb: [{ type: 'core_title_key_equal', hit: true }],
      evidenceHash: 'hash-abc',
      legacyScore: 0.7,
      identityScore: 0.85,
      strongNegativeReasons: [],
      triggerSource: 'manual-search',
      groupKey: 'gk-1',
      revivedFromCandidateId: CANDIDATE_ID,
    })
    // 原 rejected decision 置 reverted（拒绝裁定被人工推翻）
    expect(markDecisionReverted).toHaveBeenCalledWith(client, DECISION_ID, ACTOR_ID, '误拒恢复')
    // 单事务（原行零修改 = 无 updateCandidateStatus 调用，仅 BEGIN/COMMIT）
    expect(client.query).toHaveBeenCalledWith('BEGIN')
    expect(client.query).toHaveBeenCalledWith('COMMIT')
    // D-179-5 / R-MID-1：audit payload 内容断言
    expect(auditSvcInstance.write).toHaveBeenCalledWith({
      actorId: ACTOR_ID,
      actionType: 'identity_candidate.revive',
      targetKind: 'identity_candidate',
      targetId: CANDIDATE_ID,
      beforeJsonb: { status: 'rejected', canonicalPairKey: `${LEFT_ID}|${RIGHT_ID}` },
      afterJsonb: {
        newCandidateId: NEW_CANDIDATE_ID,
        reused: false,
        revivedFromCandidateId: CANDIDATE_ID,
        reason: '误拒恢复',
      },
    })
  })

  it('NOT_FOUND：candidate 不存在 → 404 + ROLLBACK', async () => {
    const client = makeMockClient()
    const svc = new IdentityCandidatesService(makeMockPool(client))

    vi.mocked(findCandidateById).mockResolvedValueOnce(null)

    await expect(svc.revive(CANDIDATE_ID, ACTOR_ID)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      httpStatus: 404,
    })
    expect(client.query).toHaveBeenCalledWith('ROLLBACK')
    expect(insertCandidate).not.toHaveBeenCalled()
  })

  it('STATE_CONFLICT：非 rejected（pending）→ 409 含当前状态', async () => {
    const client = makeMockClient()
    const svc = new IdentityCandidatesService(makeMockPool(client))

    vi.mocked(findCandidateById).mockResolvedValueOnce(makeCandidateRow('pending'))

    await expect(svc.revive(CANDIDATE_ID, ACTOR_ID)).rejects.toMatchObject({
      code: 'STATE_CONFLICT',
      httpStatus: 409,
      message: expect.stringContaining('pending'),
    })
    expect(insertCandidate).not.toHaveBeenCalled()
  })

  it('STATE_CONFLICT：pair 一侧已软删 → 409「无法复活」', async () => {
    const client = makeMockClient()
    const svc = new IdentityCandidatesService(makeMockPool(client))

    vi.mocked(findCandidateById).mockResolvedValueOnce(makeCandidateRow('rejected'))
    vi.mocked(fetchVideosByIds).mockResolvedValueOnce(aliveVideos(false, true))  // right 已软删

    await expect(svc.revive(CANDIDATE_ID, ACTOR_ID)).rejects.toMatchObject({
      code: 'STATE_CONFLICT',
      httpStatus: 409,
      message: expect.stringContaining('无法复活'),
    })
    expect(insertCandidate).not.toHaveBeenCalled()
  })

  it('幂等（D-179-3）：撞 pending unique → reused: true + 既有 pending id + **不**置 reverted', async () => {
    const client = makeMockClient()
    const svc = new IdentityCandidatesService(makeMockPool(client))
    const auditSvcInstance = (AuditLogService as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value

    vi.mocked(findCandidateById).mockResolvedValueOnce(makeCandidateRow('rejected'))
    vi.mocked(fetchVideosByIds).mockResolvedValueOnce(aliveVideos())
    vi.mocked(insertCandidate).mockResolvedValueOnce(null)  // ON CONFLICT DO NOTHING 命中
    vi.mocked(findPendingByPairKey).mockResolvedValueOnce({
      ...makeCandidateRow('pending'),
      id: EXISTING_PENDING_ID,
    })

    const result = await svc.revive(CANDIDATE_ID, ACTOR_ID)

    expect(result).toEqual({
      newCandidateId: EXISTING_PENDING_ID,
      revivedFromCandidateId: CANDIDATE_ID,
      reused: true,
    })
    // 既有 pending 来自离线 job 非人工推翻 → 原 rejected decision 保持未 reverted
    expect(findActiveRejectedDecisionByCandidateId).not.toHaveBeenCalled()
    expect(markDecisionReverted).not.toHaveBeenCalled()
    // audit 仍写（reused 标志透出）
    expect(auditSvcInstance.write).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'identity_candidate.revive',
      afterJsonb: expect.objectContaining({ newCandidateId: EXISTING_PENDING_ID, reused: true }),
    }))
  })

  it('原 candidate 无未撤销 rejected decision（防御分支）→ 不调 markDecisionReverted 仍成功', async () => {
    const client = makeMockClient()
    const svc = new IdentityCandidatesService(makeMockPool(client))

    vi.mocked(findCandidateById).mockResolvedValueOnce(makeCandidateRow('rejected'))
    vi.mocked(fetchVideosByIds).mockResolvedValueOnce(aliveVideos())
    vi.mocked(insertCandidate).mockResolvedValueOnce({ ...makeCandidateRow('pending'), id: NEW_CANDIDATE_ID })
    vi.mocked(findActiveRejectedDecisionByCandidateId).mockResolvedValueOnce(null)

    const result = await svc.revive(CANDIDATE_ID, ACTOR_ID)

    expect(result.reused).toBe(false)
    expect(markDecisionReverted).not.toHaveBeenCalled()
  })

  it('事务异常 → ROLLBACK 且不写 audit', async () => {
    const client = makeMockClient()
    const svc = new IdentityCandidatesService(makeMockPool(client))
    const auditSvcInstance = (AuditLogService as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value

    vi.mocked(findCandidateById).mockResolvedValueOnce(makeCandidateRow('rejected'))
    vi.mocked(fetchVideosByIds).mockResolvedValueOnce(aliveVideos())
    vi.mocked(insertCandidate).mockRejectedValueOnce(new Error('DB error'))

    await expect(svc.revive(CANDIDATE_ID, ACTOR_ID)).rejects.toThrow('DB error')
    expect(client.query).toHaveBeenCalledWith('ROLLBACK')
    expect(auditSvcInstance.write).not.toHaveBeenCalled()
  })
})

// ── listDecisions（D-179-1）────────────────────────────────────────

describe('IdentityCandidatesService.listDecisions', () => {
  function makeRawListRow() {
    return {
      id: DECISION_ID,
      candidate_id: CANDIDATE_ID,
      decision: 'rejected' as const,
      actor_type: 'human' as const,
      performed_by: ACTOR_ID,
      performed_by_username: 'admin-user',
      reason: '不是同一作品',
      video_merge_audit_id: null,
      reverted_at: null,
      reverted_by: null,
      reverted_reason: null,
      created_at: '2026-06-04T00:00:00Z',
      left_video_id: LEFT_ID,
      right_video_id: RIGHT_ID,
      left_video_title: '左视频',
      left_video_deleted: false,
      right_video_title: '右视频',
      right_video_deleted: true,
      identity_score: '0.8500',
      candidate_status: 'rejected' as const,
    }
  }

  it('行映射（camelCase + identityScore 数值化 + deleted 标注）+ 包络', async () => {
    const svc = new IdentityCandidatesService(makeMockPool(makeMockClient()))
    vi.mocked(listIdentityDecisions).mockResolvedValueOnce([makeRawListRow()])
    vi.mocked(countIdentityDecisions).mockResolvedValueOnce(42)

    const result = await svc.listDecisions({ limit: 20, page: 1 })

    expect(result.total).toBe(42)
    expect(result.data[0]).toEqual({
      id: DECISION_ID,
      candidateId: CANDIDATE_ID,
      decision: 'rejected',
      actorType: 'human',
      performedBy: ACTOR_ID,
      performedByUsername: 'admin-user',
      reason: '不是同一作品',
      videoMergeAuditId: null,
      revertedAt: null,
      revertedBy: null,
      revertedReason: null,
      createdAt: '2026-06-04T00:00:00Z',
      leftVideoId: LEFT_ID,
      rightVideoId: RIGHT_ID,
      leftVideoTitle: '左视频',
      leftVideoDeleted: false,
      rightVideoTitle: '右视频',
      rightVideoDeleted: true,
      identityScore: 0.85,
      candidateStatus: 'rejected',
    })
  })

  it('过滤参数透传（decision/candidateId/reverted）+ 分页 offset', async () => {
    const svc = new IdentityCandidatesService(makeMockPool(makeMockClient()))
    vi.mocked(listIdentityDecisions).mockResolvedValueOnce([])
    vi.mocked(countIdentityDecisions).mockResolvedValueOnce(0)

    await svc.listDecisions({
      decision: 'confirmed',
      candidateId: CANDIDATE_ID,
      reverted: false,
      limit: 10,
      page: 3,
    })

    expect(listIdentityDecisions).toHaveBeenCalledWith(expect.anything(), {
      decision: 'confirmed',
      candidateId: CANDIDATE_ID,
      reverted: false,
      offset: 20,
      limit: 10,
    })
    expect(countIdentityDecisions).toHaveBeenCalledWith(expect.anything(), {
      decision: 'confirmed',
      candidateId: CANDIDATE_ID,
      reverted: false,
    })
  })

  it('缺省过滤 → null 透传（全量查询）', async () => {
    const svc = new IdentityCandidatesService(makeMockPool(makeMockClient()))
    vi.mocked(listIdentityDecisions).mockResolvedValueOnce([])
    vi.mocked(countIdentityDecisions).mockResolvedValueOnce(0)

    await svc.listDecisions({ limit: 20, page: 1 })

    expect(listIdentityDecisions).toHaveBeenCalledWith(expect.anything(), {
      decision: null,
      candidateId: null,
      reverted: null,
      offset: 0,
      limit: 20,
    })
  })
})

// ── zod schema（ADR-179 §端点契约）──────────────────────────────────

describe('ListIdentityDecisionsSchema', () => {
  it('合法输入 + reverted 字符串 transform boolean + 默认值', () => {
    const r = ListIdentityDecisionsSchema.parse({ decision: 'rejected', reverted: 'false' })
    expect(r).toEqual({ decision: 'rejected', reverted: false, limit: 20, page: 1 })
    expect(ListIdentityDecisionsSchema.parse({ reverted: 'true' }).reverted).toBe(true)
    expect(ListIdentityDecisionsSchema.parse({}).reverted).toBeUndefined()
  })

  it('strict：未知键 / 枚举外 decision / limit 超 100 → 报错', () => {
    expect(() => ListIdentityDecisionsSchema.parse({ unknown: 'x' })).toThrow()
    expect(() => ListIdentityDecisionsSchema.parse({ decision: 'reverted' })).toThrow()
    expect(() => ListIdentityDecisionsSchema.parse({ limit: '101' })).toThrow()
  })
})

describe('ReviveCandidateSchema', () => {
  it('空 body / 合法 reason 通过；reason 超 500 报错', () => {
    expect(ReviveCandidateSchema.parse({})).toEqual({})
    expect(ReviveCandidateSchema.parse({ reason: '误拒' })).toEqual({ reason: '误拒' })
    expect(() => ReviveCandidateSchema.parse({ reason: 'x'.repeat(501) })).toThrow()
  })
})

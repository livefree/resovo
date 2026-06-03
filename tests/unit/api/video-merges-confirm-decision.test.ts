/**
 * video-merges-confirm-decision.test.ts — confirmed→merge 单事务 + unmerge 联动（CHG-VIR-9-B / ADR-178）
 *
 * 覆盖：
 * - merge 无 candidateId → 行为逐值不变（不调 candidate/decision 任何函数）
 * - merge 有 candidateId → 单事务挂 decision(confirmed, audit_id) + candidate confirmed（R8）
 * - merge candidateId 校验失败（404/409/422）→ 事务前快速失败（BEGIN 未调用）
 * - merge 事务内 from-state 守卫冲突 → 整个 merge ROLLBACK（无半完成态）
 * - unmerge merge 分支：经 auditId 反查 decision → markDecisionReverted；无关联 decision 不报错
 * - unmerge 后 candidate 状态不被改（D-178-4）
 *
 * mock 范式仿 video-merge-mutations.test.ts。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VideoMergesService, MergeSchema } from '@/api/services/VideoMergesService'

vi.mock('@/api/db/queries/video-merge-mutations', () => ({
  fetchVideosByIds: vi.fn(),
  fetchSourcesByVideoId: vi.fn(),
  fetchSourcesByVideoIds: vi.fn(),
  detectMergeConflicts: vi.fn(),
  fetchAuditById: vi.fn(),
  insertMergeAudit: vi.fn(),
  transferSourcesToTarget: vi.fn(),
  softDeleteVideos: vi.fn(),
  restoreVideos: vi.fn(),
  reassignSourcesToOriginal: vi.fn(),
  markAuditReverted: vi.fn(),
  insertNewVideo: vi.fn(),
  assignSourcesToVideo: vi.fn(),
  updateAuditTargetIds: vi.fn(),
}))

vi.mock('@/api/db/queries/video-merge-candidates', () => ({
  fetchRawCandidateGroups: vi.fn(),
  countRawCandidateGroups: vi.fn(),
  fetchVideoDetailsForCandidates: vi.fn(),
}))

// CHG-VIR-9-B：candidate 校验 + 状态迁移（listPendingCandidatePairs 为 9-A source 切换依赖，需一并提供）
vi.mock('@/api/db/queries/identity-candidate', () => ({
  listPendingCandidatePairs: vi.fn(),
  findCandidateById: vi.fn(),
  findCandidateByIdReadonly: vi.fn(),
  updateCandidateStatus: vi.fn(),
}))

vi.mock('@/api/db/queries/identity-decision', () => ({
  insertIdentityDecision: vi.fn(),
  findConfirmedDecisionByAuditId: vi.fn(),
  markDecisionReverted: vi.fn(),
}))

vi.mock('@/api/services/AuditLogService', () => ({
  AuditLogService: vi.fn().mockImplementation(() => ({
    write: vi.fn(),
  })),
}))

vi.mock('@/api/services/MediaCatalogService', () => ({
  MediaCatalogService: vi.fn().mockImplementation(() => ({ findOrCreate: vi.fn() })),
}))

import * as mutations from '@/api/db/queries/video-merge-mutations'
import * as candidates from '@/api/db/queries/video-merge-candidates'
import {
  findCandidateByIdReadonly,
  updateCandidateStatus,
} from '@/api/db/queries/identity-candidate'
import {
  insertIdentityDecision,
  findConfirmedDecisionByAuditId,
  markDecisionReverted,
} from '@/api/db/queries/identity-decision'
import { AuditLogService } from '@/api/services/AuditLogService'

const ACTOR_ID = '00000000-0000-0000-0000-000000000001'
const TARGET_ID = '00000000-0000-0000-0000-000000000002'
const SOURCE_ID_1 = '00000000-0000-0000-0000-000000000003'
const AUDIT_ID = '00000000-0000-0000-0000-000000000005'
const CANDIDATE_ID = '00000000-0000-0000-0000-0000000000c1'
const DECISION_ID = '00000000-0000-0000-0000-0000000000d1'
const OTHER_ID = '00000000-0000-0000-0000-000000000099'

function makeVideoRow(id: string, deletedAt: string | null = null) {
  return {
    id,
    short_id: id.slice(0, 8),
    slug: null,
    title: `Video ${id}`,
    title_en: null,
    description: null,
    cover_url: null,
    type: 'movie',
    category: null,
    rating: null,
    year: 2020,
    country: null,
    episode_count: 1,
    status: 'completed',
    director: [],
    cast: [],
    writers: [],
    is_published: false,
    title_normalized: `video ${id}`,
    catalog_id: null,
    deleted_at: deletedAt,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

function makeCandidateRow(
  status: 'pending' | 'confirmed' | 'rejected' | 'superseded',
  left = SOURCE_ID_1,
  right = TARGET_ID,
) {
  return {
    id: CANDIDATE_ID,
    left_video_id: left,
    right_video_id: right,
    canonical_pair_key: `${left}|${right}`,
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

function makeAuditRow(action: 'merge' | 'split' = 'merge', revertedAt: string | null = null) {
  return {
    id: AUDIT_ID,
    action,
    source_video_ids: [SOURCE_ID_1],
    target_video_ids: action === 'merge' ? [TARGET_ID] : [OTHER_ID],
    snapshot_jsonb: {
      videos: [makeVideoRow(SOURCE_ID_1)],
      sources: [{ id: 'src1', video_id: SOURCE_ID_1 }],
    },
    performed_by: ACTOR_ID,
    reason: null,
    performed_at: '2026-06-01T00:00:00Z',
    reverted_at: revertedAt,
    reverted_by: null,
    reverted_reason: null,
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

/** merge happy path 公共 mock（video 校验 + 冲突探测 + snapshot + audit + COMMIT 后 target 详情） */
function arrangeMergeHappyPath() {
  vi.mocked(mutations.fetchVideosByIds).mockResolvedValueOnce([
    makeVideoRow(SOURCE_ID_1),
    makeVideoRow(TARGET_ID),
  ])
  vi.mocked(mutations.detectMergeConflicts).mockResolvedValueOnce(0)
  vi.mocked(mutations.fetchSourcesByVideoIds).mockResolvedValueOnce([])
  vi.mocked(mutations.insertMergeAudit).mockResolvedValueOnce(AUDIT_ID)
  vi.mocked(candidates.fetchVideoDetailsForCandidates).mockResolvedValueOnce([{
    id: TARGET_ID,
    title: `Video ${TARGET_ID}`,
    title_normalized: `video ${TARGET_ID}`,
    year: 2020,
    type: 'movie',
    created_at: '2026-01-01T00:00:00Z',
    source_count: '2',
    site_keys: ['iqiyi'],
  }])
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── merge：candidateId 路径 ──────────────────────────────────────────

describe('VideoMergesService.merge + candidateId（ADR-178 D-178-3）', () => {
  it('无 candidateId → 不触发任何 candidate/decision 调用（主路径零变更）', async () => {
    const client = makeMockClient()
    const svc = new VideoMergesService(makeMockPool(client))
    arrangeMergeHappyPath()

    const result = await svc.merge({ sourceVideoIds: [SOURCE_ID_1], targetVideoId: TARGET_ID }, ACTOR_ID)

    expect(result.auditId).toBe(AUDIT_ID)
    expect(findCandidateByIdReadonly).not.toHaveBeenCalled()
    expect(updateCandidateStatus).not.toHaveBeenCalled()
    expect(insertIdentityDecision).not.toHaveBeenCalled()
  })

  it('有 candidateId（pending + pair⊆集合）→ 单事务挂 candidate confirmed + decision(confirmed, audit_id / R8)', async () => {
    const client = makeMockClient()
    const svc = new VideoMergesService(makeMockPool(client))
    const auditSvcInstance = (AuditLogService as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value
    vi.mocked(findCandidateByIdReadonly).mockResolvedValueOnce(makeCandidateRow('pending'))
    vi.mocked(updateCandidateStatus).mockResolvedValueOnce(1)
    vi.mocked(insertIdentityDecision).mockResolvedValueOnce(DECISION_ID)
    arrangeMergeHappyPath()

    const result = await svc.merge(
      { sourceVideoIds: [SOURCE_ID_1], targetVideoId: TARGET_ID, candidateId: CANDIDATE_ID },
      ACTOR_ID,
    )

    expect(result.auditId).toBe(AUDIT_ID)
    // 单事务：BEGIN/COMMIT 各一次（R8 / D-105a-11）
    const txCalls = client.query.mock.calls.map((c) => c[0])
    expect(txCalls.filter((q) => q === 'BEGIN')).toHaveLength(1)
    expect(txCalls.filter((q) => q === 'COMMIT')).toHaveLength(1)
    expect(txCalls).not.toContain('ROLLBACK')
    // 事务内挂载：candidate confirmed（事务 client）+ decision(confirmed, 本次 auditId / R8 非空)
    expect(updateCandidateStatus).toHaveBeenCalledWith(client, CANDIDATE_ID, 'pending', 'confirmed')
    expect(insertIdentityDecision).toHaveBeenCalledWith(client, expect.objectContaining({
      candidateId: CANDIDATE_ID,
      decision: 'confirmed',
      videoMergeAuditId: AUDIT_ID,
      performedBy: ACTOR_ID,
    }))
    // afterJsonb 纯增量补 candidateId/decisionId（D-178-6）
    expect(auditSvcInstance.write).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'video.merge',
      afterJsonb: expect.objectContaining({
        auditId: AUDIT_ID,
        candidateId: CANDIDATE_ID,
        decisionId: DECISION_ID,
      }),
    }))
  })

  it('candidateId 不存在 → 404，BEGIN 未调用（事务前快速失败）', async () => {
    const client = makeMockClient()
    const svc = new VideoMergesService(makeMockPool(client))
    vi.mocked(mutations.fetchVideosByIds).mockResolvedValueOnce([
      makeVideoRow(SOURCE_ID_1),
      makeVideoRow(TARGET_ID),
    ])
    vi.mocked(mutations.detectMergeConflicts).mockResolvedValueOnce(0)
    vi.mocked(findCandidateByIdReadonly).mockResolvedValueOnce(null)

    await expect(
      svc.merge({ sourceVideoIds: [SOURCE_ID_1], targetVideoId: TARGET_ID, candidateId: CANDIDATE_ID }, ACTOR_ID),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 })
    expect(client.query).not.toHaveBeenCalledWith('BEGIN')
    expect(mutations.insertMergeAudit).not.toHaveBeenCalled()
  })

  it('candidate 非 pending → 409，BEGIN 未调用', async () => {
    const client = makeMockClient()
    const svc = new VideoMergesService(makeMockPool(client))
    vi.mocked(mutations.fetchVideosByIds).mockResolvedValueOnce([
      makeVideoRow(SOURCE_ID_1),
      makeVideoRow(TARGET_ID),
    ])
    vi.mocked(mutations.detectMergeConflicts).mockResolvedValueOnce(0)
    vi.mocked(findCandidateByIdReadonly).mockResolvedValueOnce(makeCandidateRow('rejected'))

    await expect(
      svc.merge({ sourceVideoIds: [SOURCE_ID_1], targetVideoId: TARGET_ID, candidateId: CANDIDATE_ID }, ACTOR_ID),
    ).rejects.toMatchObject({ code: 'STATE_CONFLICT', httpStatus: 409 })
    expect(client.query).not.toHaveBeenCalledWith('BEGIN')
  })

  it('candidate pair ⊄ 合并集合 → 422，BEGIN 未调用', async () => {
    const client = makeMockClient()
    const svc = new VideoMergesService(makeMockPool(client))
    vi.mocked(mutations.fetchVideosByIds).mockResolvedValueOnce([
      makeVideoRow(SOURCE_ID_1),
      makeVideoRow(TARGET_ID),
    ])
    vi.mocked(mutations.detectMergeConflicts).mockResolvedValueOnce(0)
    vi.mocked(findCandidateByIdReadonly).mockResolvedValueOnce(
      makeCandidateRow('pending', SOURCE_ID_1, OTHER_ID),  // OTHER_ID 不在合并集合
    )

    await expect(
      svc.merge({ sourceVideoIds: [SOURCE_ID_1], targetVideoId: TARGET_ID, candidateId: CANDIDATE_ID }, ACTOR_ID),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', httpStatus: 422 })
    expect(client.query).not.toHaveBeenCalledWith('BEGIN')
  })

  it('事务内 from-state 守卫冲突（并发被 reject）→ 409 + 整个 merge ROLLBACK（R8 无半完成态）', async () => {
    const client = makeMockClient()
    const svc = new VideoMergesService(makeMockPool(client))
    vi.mocked(findCandidateByIdReadonly).mockResolvedValueOnce(makeCandidateRow('pending'))
    vi.mocked(updateCandidateStatus).mockResolvedValueOnce(0)  // 校验后被并发 reject
    arrangeMergeHappyPath()

    await expect(
      svc.merge({ sourceVideoIds: [SOURCE_ID_1], targetVideoId: TARGET_ID, candidateId: CANDIDATE_ID }, ACTOR_ID),
    ).rejects.toMatchObject({ code: 'STATE_CONFLICT', httpStatus: 409 })
    expect(client.query).toHaveBeenCalledWith('BEGIN')
    expect(client.query).toHaveBeenCalledWith('ROLLBACK')
    expect(client.query).not.toHaveBeenCalledWith('COMMIT')
    expect(insertIdentityDecision).not.toHaveBeenCalled()
  })
})

// ── unmerge：decision 联动 ──────────────────────────────────────────

describe('VideoMergesService.unmerge decision 联动（ADR-178 D-178-4）', () => {
  it('merge 分支：经 auditId 反查 confirmed decision → markDecisionReverted（事务 client）', async () => {
    const client = makeMockClient()
    const svc = new VideoMergesService(makeMockPool(client))
    vi.mocked(mutations.fetchAuditById).mockResolvedValueOnce(makeAuditRow('merge'))
    vi.mocked(findConfirmedDecisionByAuditId).mockResolvedValueOnce({
      id: DECISION_ID,
      candidate_id: CANDIDATE_ID,
      decision: 'confirmed',
      video_merge_audit_id: AUDIT_ID,
      performed_by: ACTOR_ID,
      actor_type: 'human',
      reason: null,
      reverted_at: null,
      reverted_by: null,
      reverted_reason: null,
      created_at: '2026-06-01T00:00:00Z',
    })

    await svc.unmerge(AUDIT_ID, ACTOR_ID, '撤销')

    expect(findConfirmedDecisionByAuditId).toHaveBeenCalledWith(client, AUDIT_ID)
    expect(markDecisionReverted).toHaveBeenCalledWith(client, DECISION_ID, ACTOR_ID, '撤销')
    // candidate 状态不被改（保持 confirmed，避撞 uq_identity_candidate_pending / D-178-4）
    expect(updateCandidateStatus).not.toHaveBeenCalled()
    expect(client.query).toHaveBeenCalledWith('COMMIT')
  })

  it('merge 分支无关联 decision（legacy merge）→ 不调 markDecisionReverted、不报错', async () => {
    const client = makeMockClient()
    const svc = new VideoMergesService(makeMockPool(client))
    vi.mocked(mutations.fetchAuditById).mockResolvedValueOnce(makeAuditRow('merge'))
    vi.mocked(findConfirmedDecisionByAuditId).mockResolvedValueOnce(null)

    const result = await svc.unmerge(AUDIT_ID, ACTOR_ID)

    expect(result.restoredVideoIds).toEqual([SOURCE_ID_1])
    expect(markDecisionReverted).not.toHaveBeenCalled()
    expect(client.query).toHaveBeenCalledWith('COMMIT')
  })

  it('split 分支：不触发 decision 联动（decision 仅挂 merge）', async () => {
    const client = makeMockClient()
    const svc = new VideoMergesService(makeMockPool(client))
    vi.mocked(mutations.fetchAuditById).mockResolvedValueOnce(makeAuditRow('split'))

    await svc.unmerge(AUDIT_ID, ACTOR_ID)

    expect(findConfirmedDecisionByAuditId).not.toHaveBeenCalled()
    expect(markDecisionReverted).not.toHaveBeenCalled()
  })
})

// ── MergeSchema candidateId 扩参 ────────────────────────────────────

describe('MergeSchema candidateId（纯增量向后兼容）', () => {
  const base = {
    sourceVideoIds: [SOURCE_ID_1],
    targetVideoId: TARGET_ID,
  }

  it('无 candidateId 通过（向后兼容）', () => {
    expect(MergeSchema.safeParse(base).success).toBe(true)
  })

  it('合法 uuid candidateId 通过', () => {
    expect(MergeSchema.safeParse({ ...base, candidateId: CANDIDATE_ID }).success).toBe(true)
  })

  it('非 uuid candidateId 拒绝', () => {
    expect(MergeSchema.safeParse({ ...base, candidateId: 'not-a-uuid' }).success).toBe(false)
  })
})

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
  // CHG-MERGE-DEDUP-EP（D-105-13~16）：自动去重取并集
  dedupeSourcesForMerge: vi.fn(),
  detectResidualTargetConflicts: vi.fn(),
  dedupeSourcesForSplitTarget: vi.fn(),
  detectResidualSplitTargetConflicts: vi.fn(),
  restoreSourcesByIds: vi.fn(),
  setAuditDedupedSourceIds: vi.fn(),
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
  fetchVideoDetailsForCandidates: vi.fn(),
}))

// CHG-VIR-9-B：candidate 校验 + 状态迁移（listPendingCandidatePairs 为 9-A source 切换依赖，需一并提供）
// CHG-VIR-9-C FIX-4：countPendingCandidatePairs 为 FIX-2 新增顶层 import，工厂缺 key → import undefined 潜伏
vi.mock('@/api/db/queries/identity-candidate', () => ({
  listPendingCandidatePairs: vi.fn(),
  countPendingCandidatePairs: vi.fn(),
  findCandidateById: vi.fn(),
  findCandidateByIdReadonly: vi.fn(),
  updateCandidateStatus: vi.fn(),
}))

vi.mock('@/api/db/queries/identity-decision', () => ({
  insertIdentityDecision: vi.fn(),
  findConfirmedDecisionsByAuditId: vi.fn(),
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
  findConfirmedDecisionsByAuditId,
  markDecisionReverted,
} from '@/api/db/queries/identity-decision'
import { AuditLogService } from '@/api/services/AuditLogService'
import { NotificationEmitter } from '@/api/services/NotificationEmitter'

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
  // CHG-MERGE-DEDUP-EP 默认零去重路径
  vi.mocked(mutations.dedupeSourcesForMerge).mockResolvedValue([])
  vi.mocked(mutations.detectResidualTargetConflicts).mockResolvedValue(0)
  vi.mocked(mutations.restoreSourcesByIds).mockResolvedValue()
})

// ── merge：candidateId 路径 ──────────────────────────────────────────

describe('VideoMergesService.merge + candidateId（ADR-178 D-178-3）', () => {
  it('无 candidateId → 不触发任何 candidate/decision 调用（主路径零变更）', async () => {
    const client = makeMockClient()
    const svc = new VideoMergesService(makeMockPool(client))
    const emitSpy = vi.spyOn(NotificationEmitter.prototype, 'emit').mockImplementation(() => {})
    arrangeMergeHappyPath()

    const result = await svc.merge({ sourceVideoIds: [SOURCE_ID_1], targetVideoId: TARGET_ID }, ACTOR_ID)

    expect(result.auditId).toBe(AUDIT_ID)
    expect(findCandidateByIdReadonly).not.toHaveBeenCalled()
    expect(updateCandidateStatus).not.toHaveBeenCalled()
    expect(insertIdentityDecision).not.toHaveBeenCalled()
    // NTLG-P1-c-B-2：解耦双写 emit（COMMIT 后；sourceRef=targetVideoId）
    expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'video.merge',
      level: 'info',
      title: '视频合并完成',
      sourceKind: 'admin_action',
      scope: 'broadcast',
      href: '/admin/merge',
      sourceRef: TARGET_ID,
    }))
    emitSpy.mockRestore()
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
    // afterJsonb 纯增量补 candidateIds/decisionIds（D-178-6 / CHG-VIR-9-D 数组化）
    expect(auditSvcInstance.write).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'video.merge',
      afterJsonb: expect.objectContaining({
        auditId: AUDIT_ID,
        candidateIds: [CANDIDATE_ID],
        decisionIds: [DECISION_ID],
      }),
    }))
  })

  it('candidateIds 数组（折叠组 / CHG-VIR-9-D D-105a-18）→ 同事务循环挂 K 个 decision 同一 audit_id', async () => {
    const CANDIDATE_ID_2 = '00000000-0000-0000-0000-0000000000c2'
    const DECISION_ID_2 = '00000000-0000-0000-0000-0000000000d2'
    const client = makeMockClient()
    const svc = new VideoMergesService(makeMockPool(client))
    vi.mocked(findCandidateByIdReadonly)
      .mockResolvedValueOnce(makeCandidateRow('pending'))
      .mockResolvedValueOnce({ ...makeCandidateRow('pending'), id: CANDIDATE_ID_2 })
    vi.mocked(updateCandidateStatus).mockResolvedValue(1)
    vi.mocked(insertIdentityDecision)
      .mockResolvedValueOnce(DECISION_ID)
      .mockResolvedValueOnce(DECISION_ID_2)
    arrangeMergeHappyPath()

    const result = await svc.merge(
      { sourceVideoIds: [SOURCE_ID_1], targetVideoId: TARGET_ID, candidateIds: [CANDIDATE_ID, CANDIDATE_ID_2] },
      ACTOR_ID,
    )

    expect(result.auditId).toBe(AUDIT_ID)
    // 单事务：BEGIN/COMMIT 各一次（R8），K 个 decision 全部挂同一 auditId
    const txCalls = client.query.mock.calls.map((c) => c[0])
    expect(txCalls.filter((q) => q === 'BEGIN')).toHaveLength(1)
    expect(txCalls.filter((q) => q === 'COMMIT')).toHaveLength(1)
    expect(updateCandidateStatus).toHaveBeenCalledTimes(2)
    expect(insertIdentityDecision).toHaveBeenCalledTimes(2)
    expect(insertIdentityDecision).toHaveBeenNthCalledWith(1, client, expect.objectContaining({
      candidateId: CANDIDATE_ID, videoMergeAuditId: AUDIT_ID,
    }))
    expect(insertIdentityDecision).toHaveBeenNthCalledWith(2, client, expect.objectContaining({
      candidateId: CANDIDATE_ID_2, videoMergeAuditId: AUDIT_ID,
    }))
  })

  it('candidateIds 任一校验失败（非 pending）→ 409，BEGIN 未调用（逐个事务前校验）', async () => {
    const CANDIDATE_ID_2 = '00000000-0000-0000-0000-0000000000c2'
    const client = makeMockClient()
    const svc = new VideoMergesService(makeMockPool(client))
    vi.mocked(mutations.fetchVideosByIds).mockResolvedValueOnce([
      makeVideoRow(SOURCE_ID_1),
      makeVideoRow(TARGET_ID),
    ])
      vi.mocked(findCandidateByIdReadonly)
      .mockResolvedValueOnce(makeCandidateRow('pending'))
      .mockResolvedValueOnce({ ...makeCandidateRow('rejected'), id: CANDIDATE_ID_2 })

    await expect(
      svc.merge(
        { sourceVideoIds: [SOURCE_ID_1], targetVideoId: TARGET_ID, candidateIds: [CANDIDATE_ID, CANDIDATE_ID_2] },
        ACTOR_ID,
      ),
    ).rejects.toMatchObject({ code: 'STATE_CONFLICT', httpStatus: 409 })
    expect(client.query).not.toHaveBeenCalledWith('BEGIN')
  })

  it('candidateId 不存在 → 404，BEGIN 未调用（事务前快速失败）', async () => {
    const client = makeMockClient()
    const svc = new VideoMergesService(makeMockPool(client))
    vi.mocked(mutations.fetchVideosByIds).mockResolvedValueOnce([
      makeVideoRow(SOURCE_ID_1),
      makeVideoRow(TARGET_ID),
    ])
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
  function makeDecisionRow(id: string, candidateId = CANDIDATE_ID) {
    return {
      id,
      candidate_id: candidateId,
      decision: 'confirmed' as const,
      video_merge_audit_id: AUDIT_ID,
      performed_by: ACTOR_ID,
      actor_type: 'human' as const,
      reason: null,
      reverted_at: null,
      reverted_by: null,
      reverted_reason: null,
      created_at: '2026-06-01T00:00:00Z',
    }
  }

  it('merge 分支：经 auditId 反查 confirmed decision → markDecisionReverted（事务 client）', async () => {
    const client = makeMockClient()
    const svc = new VideoMergesService(makeMockPool(client))
    vi.mocked(mutations.fetchAuditById).mockResolvedValueOnce(makeAuditRow('merge'))
    vi.mocked(findConfirmedDecisionsByAuditId).mockResolvedValueOnce([makeDecisionRow(DECISION_ID)])

    await svc.unmerge(AUDIT_ID, ACTOR_ID, '撤销')

    expect(findConfirmedDecisionsByAuditId).toHaveBeenCalledWith(client, AUDIT_ID)
    expect(markDecisionReverted).toHaveBeenCalledWith(client, DECISION_ID, ACTOR_ID, '撤销')
    // candidate 状态不被改（保持 confirmed，避撞 uq_identity_candidate_pending / D-178-4）
    expect(updateCandidateStatus).not.toHaveBeenCalled()
    expect(client.query).toHaveBeenCalledWith('COMMIT')
  })

  it('折叠组 merge：一个 audit 挂 K 个 decision → 全部 revert（CHG-VIR-9-D / R8 对称）', async () => {
    const DECISION_ID_2 = '00000000-0000-0000-0000-0000000000d2'
    const client = makeMockClient()
    const svc = new VideoMergesService(makeMockPool(client))
    vi.mocked(mutations.fetchAuditById).mockResolvedValueOnce(makeAuditRow('merge'))
    vi.mocked(findConfirmedDecisionsByAuditId).mockResolvedValueOnce([
      makeDecisionRow(DECISION_ID),
      makeDecisionRow(DECISION_ID_2, '00000000-0000-0000-0000-0000000000c2'),
    ])

    await svc.unmerge(AUDIT_ID, ACTOR_ID, '撤销')

    expect(markDecisionReverted).toHaveBeenCalledTimes(2)
    expect(markDecisionReverted).toHaveBeenNthCalledWith(1, client, DECISION_ID, ACTOR_ID, '撤销')
    expect(markDecisionReverted).toHaveBeenNthCalledWith(2, client, DECISION_ID_2, ACTOR_ID, '撤销')
    expect(client.query).toHaveBeenCalledWith('COMMIT')
  })

  it('merge 分支无关联 decision（legacy merge）→ 不调 markDecisionReverted、不报错', async () => {
    const client = makeMockClient()
    const svc = new VideoMergesService(makeMockPool(client))
    vi.mocked(mutations.fetchAuditById).mockResolvedValueOnce(makeAuditRow('merge'))
    vi.mocked(findConfirmedDecisionsByAuditId).mockResolvedValueOnce([])

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

    expect(findConfirmedDecisionsByAuditId).not.toHaveBeenCalled()
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

  // CHG-VIR-9-D / D-105a-18：candidateIds 数组扩参
  it('合法 candidateIds 数组通过', () => {
    expect(MergeSchema.safeParse({ ...base, candidateIds: [CANDIDATE_ID] }).success).toBe(true)
  })

  it('candidateId 与 candidateIds 同时提供 → 拒绝（互斥）', () => {
    expect(MergeSchema.safeParse({
      ...base, candidateId: CANDIDATE_ID, candidateIds: [CANDIDATE_ID],
    }).success).toBe(false)
  })

  it('candidateIds 含重复值 → 拒绝', () => {
    expect(MergeSchema.safeParse({
      ...base, candidateIds: [CANDIDATE_ID, CANDIDATE_ID],
    }).success).toBe(false)
  })

  it('candidateIds 空数组 → 拒绝（min 1）', () => {
    expect(MergeSchema.safeParse({ ...base, candidateIds: [] }).success).toBe(false)
  })

  // Codex review FIX：cap = C(11,2) = 55（merge 集合上限 11 视频的完全图 pair 数；
  // 原 cap 20 会把合法 11-video 折叠组 confirm 误拒）
  it('candidateIds 55 个（11-video 完全图上限）通过 / 56 个拒绝', () => {
    const ids = (n: number) =>
      Array.from({ length: n }, (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`)
    expect(MergeSchema.safeParse({ ...base, candidateIds: ids(55) }).success).toBe(true)
    expect(MergeSchema.safeParse({ ...base, candidateIds: ids(56) }).success).toBe(false)
  })
})

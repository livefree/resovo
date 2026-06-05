/**
 * merge-audit-derive.test.ts — listAudit D-105-8 派生单测（CHG-VIR-13-C2）
 *
 * 覆盖：
 * - actorType：有关联 decision → actor_type 透出；无 → 'human'
 * - relatedCandidateIds / relatedDecisionIds：页内批量反查聚合（零 N+1：单次 ANY 调用断言）
 * - videoTitlesSnapshot：source 取 snapshot 投影 / target 实时查 / 缺失兜底「(已删除视频)」
 * - R-105-T4：既有字段逐值不变 + 分页参数透传不变
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VideoMergesService } from '@/api/services/VideoMergesService'

vi.mock('@/api/db/queries/video-merge-mutations', () => ({
  fetchVideosByIds: vi.fn(),
  fetchSourcesByVideoId: vi.fn(),
  fetchSourcesByVideoIds: vi.fn(),
  detectMergeConflicts: vi.fn(),
  detectSplitConflictsForTarget: vi.fn(),
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
  listAuditTimeline: vi.fn(),
  countAuditTimeline: vi.fn(),
  fetchVideoTitles: vi.fn(),
}))

vi.mock('@/api/db/queries/video-merge-candidates', () => ({
  fetchRawCandidateGroups: vi.fn(),
  countRawCandidateGroups: vi.fn(),
  fetchVideoDetailsForCandidates: vi.fn(),
}))

vi.mock('@/api/db/queries/identity-decision', () => ({
  insertIdentityDecision: vi.fn(),
  findConfirmedDecisionsByAuditId: vi.fn(),
  markDecisionReverted: vi.fn(),
  findDecisionsByAuditIds: vi.fn(),
}))

vi.mock('@/api/db/queries/videos.mutations', () => ({
  transitionVideoState: vi.fn(),
}))

vi.mock('@/api/services/AuditLogService', () => ({
  AuditLogService: vi.fn().mockImplementation(() => ({ write: vi.fn() })),
}))

vi.mock('@/api/services/MediaCatalogService', () => ({
  MediaCatalogService: vi.fn().mockImplementation(() => ({ findOrCreate: vi.fn() })),
}))

vi.mock('@/api/lib/logger', () => ({
  baseLogger: { child: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }) },
}))

import {
  listAuditTimeline,
  countAuditTimeline,
  fetchVideoTitles,
} from '@/api/db/queries/video-merge-mutations'
import { findDecisionsByAuditIds } from '@/api/db/queries/identity-decision'

const AUDIT_1 = '00000000-0000-0000-0000-0000000000a1'
const AUDIT_2 = '00000000-0000-0000-0000-0000000000a2'
const SRC_A = '00000000-0000-0000-0000-000000000001'
const SRC_B = '00000000-0000-0000-0000-000000000002'
const TGT_1 = '00000000-0000-0000-0000-000000000003'
const TGT_2 = '00000000-0000-0000-0000-000000000004'
const CAND_1 = '00000000-0000-0000-0000-0000000000c1'
const DEC_1 = '00000000-0000-0000-0000-0000000000d1'

function makeTimelineRow(overrides: Record<string, unknown> = {}) {
  return {
    id: AUDIT_1,
    action: 'merge' as const,
    source_video_ids: [SRC_A],
    target_video_ids: [TGT_1],
    performed_by: 'actor-1',
    performed_by_username: 'admin',
    reason: '同作品',
    performed_at: '2026-06-04T00:00:00Z',
    reverted_at: null,
    reverted_by: null,
    reverted_reason: null,
    snapshot_video_titles: [{ videoId: SRC_A, title: '源视频甲' }],
    ...overrides,
  }
}

const db = { query: vi.fn() } as unknown as import('pg').Pool

beforeEach(() => {
  vi.clearAllMocks()
})

describe('VideoMergesService.listAudit — D-105-8 派生（CHG-VIR-13-C2）', () => {
  it('actorType：有关联 decision → actor_type 透出 + relatedIds 聚合；无 decision → human + 空数组', async () => {
    const svc = new VideoMergesService(db)
    vi.mocked(listAuditTimeline).mockResolvedValueOnce([
      makeTimelineRow(),                                     // AUDIT_1：有 decision（system）
      makeTimelineRow({ id: AUDIT_2, target_video_ids: [TGT_2] }),  // AUDIT_2：无 decision
    ])
    vi.mocked(countAuditTimeline).mockResolvedValueOnce(2)
    vi.mocked(findDecisionsByAuditIds).mockResolvedValueOnce([
      { id: DEC_1, candidate_id: CAND_1, video_merge_audit_id: AUDIT_1, actor_type: 'system' },
    ])
    vi.mocked(fetchVideoTitles).mockResolvedValueOnce([
      { id: TGT_1, title: '目标实时标题' },
      { id: TGT_2, title: '目标乙' },
    ])

    const result = await svc.listAudit({ limit: 20, page: 1 })

    expect(result.data[0]).toMatchObject({
      actorType: 'system',
      relatedCandidateIds: [CAND_1],
      relatedDecisionIds: [DEC_1],
    })
    expect(result.data[1]).toMatchObject({
      actorType: 'human',
      relatedCandidateIds: [],
      relatedDecisionIds: [],
    })
    // 零 N+1：页内单次 ANY 批量反查 + 单次 target 标题查
    expect(findDecisionsByAuditIds).toHaveBeenCalledExactlyOnceWith(db, [AUDIT_1, AUDIT_2])
    expect(fetchVideoTitles).toHaveBeenCalledExactlyOnceWith(db, [TGT_1, TGT_2])
  })

  it('videoTitlesSnapshot：source 取 snapshot 投影 / target 实时查 / 缺失兜底「(已删除视频)」', async () => {
    const svc = new VideoMergesService(db)
    vi.mocked(listAuditTimeline).mockResolvedValueOnce([
      makeTimelineRow({
        source_video_ids: [SRC_A, SRC_B],  // SRC_B 不在 snapshot 投影 → 兜底
        snapshot_video_titles: [{ videoId: SRC_A, title: '源视频甲' }],
      }),
    ])
    vi.mocked(countAuditTimeline).mockResolvedValueOnce(1)
    vi.mocked(findDecisionsByAuditIds).mockResolvedValueOnce([])
    vi.mocked(fetchVideoTitles).mockResolvedValueOnce([{ id: TGT_1, title: '目标实时标题' }])

    const result = await svc.listAudit({ limit: 20, page: 1 })

    expect(result.data[0]!.videoTitlesSnapshot).toEqual([
      { videoId: SRC_A, title: '源视频甲' },
      { videoId: SRC_B, title: '(已删除视频)' },
      { videoId: TGT_1, title: '目标实时标题' },
    ])
  })

  it('target 已物理缺失（实时查不到）→ 回退 snapshot 投影 → 仍无则兜底', async () => {
    const svc = new VideoMergesService(db)
    vi.mocked(listAuditTimeline).mockResolvedValueOnce([
      makeTimelineRow({ snapshot_video_titles: null }),  // 老 snapshot 无投影
    ])
    vi.mocked(countAuditTimeline).mockResolvedValueOnce(1)
    vi.mocked(findDecisionsByAuditIds).mockResolvedValueOnce([])
    vi.mocked(fetchVideoTitles).mockResolvedValueOnce([])  // target 查不到

    const result = await svc.listAudit({ limit: 20, page: 1 })

    expect(result.data[0]!.videoTitlesSnapshot).toEqual([
      { videoId: SRC_A, title: '(已删除视频)' },
      { videoId: TGT_1, title: '(已删除视频)' },
    ])
  })

  it('R-105-T4：既有字段逐值不变 + 分页/过滤参数透传不变', async () => {
    const svc = new VideoMergesService(db)
    vi.mocked(listAuditTimeline).mockResolvedValueOnce([makeTimelineRow()])
    vi.mocked(countAuditTimeline).mockResolvedValueOnce(7)
    vi.mocked(findDecisionsByAuditIds).mockResolvedValueOnce([])
    vi.mocked(fetchVideoTitles).mockResolvedValueOnce([])

    const result = await svc.listAudit({ action: 'merge', videoId: SRC_A, limit: 10, page: 2 })

    // 分页/过滤透传逐值不变
    expect(listAuditTimeline).toHaveBeenCalledWith(db, {
      action: 'merge', videoId: SRC_A, offset: 10, limit: 10,
    })
    expect(countAuditTimeline).toHaveBeenCalledWith(db, { action: 'merge', videoId: SRC_A })
    expect(result.total).toBe(7)
    // 既有字段逐值
    expect(result.data[0]).toMatchObject({
      id: AUDIT_1,
      action: 'merge',
      sourceVideoIds: [SRC_A],
      targetVideoIds: [TGT_1],
      performedBy: 'actor-1',
      performedByUsername: 'admin',
      reason: '同作品',
      performedAt: '2026-06-04T00:00:00Z',
      revertedAt: null,
      revertedBy: null,
      revertedReason: null,
    })
  })
})

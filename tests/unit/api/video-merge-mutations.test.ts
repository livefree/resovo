/**
 * video-merge-mutations.test.ts — VideoMergesService merge/unmerge/split 单元测试
 * （ADR-105 / CHG-SN-5-10）
 *
 * 覆盖：
 * - merge: happy path + NOT_FOUND + STATE_CONFLICT（target 已删 / source 已删 / 冲突探测）
 * - unmerge: happy path（merge + split action）+ NOT_FOUND + STATE_CONFLICT（已撤销）
 * - split: happy path + NOT_FOUND + STATE_CONFLICT + VALIDATION_ERROR（不完整划分）
 * - audit payload 内容断言（ADR-105 §audit log 协议 + R-MID-1 教训）
 * - MergeSchema / UnmergeSchema / SplitSchema zod 校验
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VideoMergesService, MergeSchema, UnmergeSchema, SplitSchema } from '@/api/services/VideoMergesService'

// ── mock DB 查询模块 ──────────────────────────────────────────────

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
  updateAuditTargetIds: vi.fn(),  // CHG-SN-5-10-PATCH P2
}))

vi.mock('@/api/db/queries/video-merge-candidates', () => ({
  fetchRawCandidateGroups: vi.fn(),
  countRawCandidateGroups: vi.fn(),
  fetchVideoDetailsForCandidates: vi.fn(),
}))

vi.mock('@/api/services/AuditLogService', () => ({
  AuditLogService: vi.fn().mockImplementation(() => ({
    write: vi.fn(),
  })),
}))

vi.mock('@/api/services/TitleNormalizer', () => ({
  normalizeTitle: (t: string) => t.toLowerCase(),
  // ADR-174：VideoMergesService.split 新建 video 归并键改用 normalizeMergeKey（剥标点）
  normalizeMergeKey: (t: string) => t.toLowerCase().replace(/[\p{P}\p{S}\s]/gu, ''),
}))

import * as mutations from '@/api/db/queries/video-merge-mutations'
import * as candidates from '@/api/db/queries/video-merge-candidates'
import { AuditLogService } from '@/api/services/AuditLogService'

// ── helpers ──────────────────────────────────────────────────────

const ACTOR_ID = '00000000-0000-0000-0000-000000000001'
const TARGET_ID = '00000000-0000-0000-0000-000000000002'
const SOURCE_ID_1 = '00000000-0000-0000-0000-000000000003'
const SOURCE_ID_2 = '00000000-0000-0000-0000-000000000004'
const AUDIT_ID = '00000000-0000-0000-0000-000000000005'
const NEW_VIDEO_ID_1 = '00000000-0000-0000-0000-000000000006'
const NEW_VIDEO_ID_2 = '00000000-0000-0000-0000-000000000007'
const SRC_1 = '00000000-0000-0000-0001-000000000001'
const SRC_2 = '00000000-0000-0000-0001-000000000002'
const SRC_3 = '00000000-0000-0000-0001-000000000003'
const SRC_4 = '00000000-0000-0000-0001-000000000004'
const SRC_FOREIGN = '00000000-0000-0000-0001-000000000099'

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

function makeSourceRow(id: string, videoId: string) {
  return {
    id,
    video_id: videoId,
    episode_number: null,
    source_url: `https://example.com/${id}`,
    source_name: '线路1',
    source_site_key: 'iqiyi',
    quality: '1080P',
    type: 'hls',
    is_active: true,
    deleted_at: null,
    created_at: '2026-01-01T00:00:00Z',
  }
}

function makeAuditRow(action: 'merge' | 'split', revertedAt: string | null = null) {
  return {
    id: AUDIT_ID,
    action,
    source_video_ids: [SOURCE_ID_1, SOURCE_ID_2],
    target_video_ids: action === 'merge' ? [TARGET_ID] : [NEW_VIDEO_ID_1, NEW_VIDEO_ID_2],
    snapshot_jsonb: {
      videos: [makeVideoRow(SOURCE_ID_1), makeVideoRow(SOURCE_ID_2)],
      sources: [
        { id: SRC_1, video_id: SOURCE_ID_1 },
        { id: SRC_2, video_id: SOURCE_ID_2 },
      ],
    },
    performed_by: ACTOR_ID,
    reason: null,
    performed_at: '2026-05-12T00:00:00Z',
    reverted_at: revertedAt,
    reverted_by: null,
    reverted_reason: null,
  }
}

/** 创建 mock PoolClient（事务内操作） */
function makeMockClient() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  }
}

/** 创建 mock Pool（含 connect() → PoolClient） */
function makeMockPool(client: ReturnType<typeof makeMockClient>) {
  return {
    connect: vi.fn().mockResolvedValue(client),
    query: vi.fn(),
  } as unknown as import('pg').Pool
}

// ── 设置 ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// ── merge ─────────────────────────────────────────────────────────

describe('VideoMergesService.merge', () => {
  it('happy path：返回 auditId + targetVideo（ADR-105 §端点契约 row 2 / CHG-SN-5-10-PATCH P0-1），调用正确的 DB 函数', async () => {
    const mockClient = makeMockClient()
    const mockPool = makeMockPool(mockClient)
    const svc = new VideoMergesService(mockPool)
    const auditSvcInstance = (AuditLogService as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value

    vi.mocked(mutations.fetchVideosByIds).mockResolvedValueOnce([
      makeVideoRow(SOURCE_ID_1),
      makeVideoRow(SOURCE_ID_2),
      makeVideoRow(TARGET_ID),
    ])
    vi.mocked(mutations.detectMergeConflicts).mockResolvedValueOnce(0)
    vi.mocked(mutations.fetchSourcesByVideoIds).mockResolvedValueOnce([
      makeSourceRow(SRC_1, SOURCE_ID_1),
      makeSourceRow(SRC_2, SOURCE_ID_2),
    ])
    vi.mocked(mutations.insertMergeAudit).mockResolvedValueOnce(AUDIT_ID)
    vi.mocked(mutations.transferSourcesToTarget).mockResolvedValueOnce()
    vi.mocked(mutations.softDeleteVideos).mockResolvedValueOnce()
    // COMMIT 后查 target 详情拼装 VideoSummaryForMerge（CHG-SN-5-10-PATCH P0-1）
    vi.mocked(candidates.fetchVideoDetailsForCandidates).mockResolvedValueOnce([{
      id: TARGET_ID,
      title: `Video ${TARGET_ID}`,
      title_normalized: `video ${TARGET_ID}`,
      year: 2020,
      type: 'movie',
      created_at: '2026-01-01T00:00:00Z',
      source_count: '5',
      site_keys: ['iqiyi', 'youku'],
    }])

    const result = await svc.merge(
      { sourceVideoIds: [SOURCE_ID_1, SOURCE_ID_2], targetVideoId: TARGET_ID },
      ACTOR_ID,
    )

    expect(result.auditId).toBe(AUDIT_ID)
    // P0-1：返回完整 VideoSummaryForMerge 而非仅 ID
    expect(result.targetVideo).toEqual(expect.objectContaining({
      id: TARGET_ID,
      title: `Video ${TARGET_ID}`,
      year: 2020,
      type: 'movie',
      sourceCount: 5,
      sourceSiteKeys: ['iqiyi', 'youku'],
    }))

    // P0-2：detectMergeConflicts 接收合并后集合 [...sources, target]
    expect(mutations.detectMergeConflicts).toHaveBeenCalledWith(
      mockPool, [SOURCE_ID_1, SOURCE_ID_2, TARGET_ID],
    )

    // 事务正确开始和提交
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN')
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT')
    expect(mockClient.release).toHaveBeenCalled()

    // audit payload 内容断言（ADR-105 §audit log 协议 + R-MID-1 教训）
    expect(mutations.insertMergeAudit).toHaveBeenCalledWith(mockClient, expect.objectContaining({
      action: 'merge',
      sourceVideoIds: [SOURCE_ID_1, SOURCE_ID_2],
      targetVideoIds: [TARGET_ID],
      performedBy: ACTOR_ID,
      snapshotJsonb: expect.objectContaining({
        videos: expect.arrayContaining([expect.objectContaining({ id: SOURCE_ID_1 })]),
        sources: expect.arrayContaining([expect.objectContaining({ id: SRC_1, video_id: SOURCE_ID_1 })]),
      }),
    }))

    // fire-and-forget admin_audit_log
    expect(auditSvcInstance.write).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'video.merge',
      targetKind: 'video',
      targetId: TARGET_ID,
      afterJsonb: expect.objectContaining({ auditId: AUDIT_ID, targetVideoId: TARGET_ID }),
    }))
  })

  it('NOT_FOUND：任一 video 不存在时抛 AppError', async () => {
    const mockPool = makeMockPool(makeMockClient())
    const svc = new VideoMergesService(mockPool)

    vi.mocked(mutations.fetchVideosByIds).mockResolvedValueOnce([makeVideoRow(SOURCE_ID_1)])

    await expect(
      svc.merge({ sourceVideoIds: [SOURCE_ID_1], targetVideoId: TARGET_ID }, ACTOR_ID),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 })
  })

  it('STATE_CONFLICT：target video 已删除', async () => {
    const mockPool = makeMockPool(makeMockClient())
    const svc = new VideoMergesService(mockPool)

    vi.mocked(mutations.fetchVideosByIds).mockResolvedValueOnce([
      makeVideoRow(SOURCE_ID_1),
      makeVideoRow(TARGET_ID, '2026-05-01T00:00:00Z'),  // target 已删
    ])

    await expect(
      svc.merge({ sourceVideoIds: [SOURCE_ID_1], targetVideoId: TARGET_ID }, ACTOR_ID),
    ).rejects.toMatchObject({ code: 'STATE_CONFLICT', httpStatus: 409 })
  })

  it('STATE_CONFLICT：source video 已删除（已被合并）→ message 文案为 sourceVideoId 专用（CHG-SN-5-10-PATCH P1-3）', async () => {
    const mockPool = makeMockPool(makeMockClient())
    const svc = new VideoMergesService(mockPool)

    vi.mocked(mutations.fetchVideosByIds).mockResolvedValueOnce([
      makeVideoRow(SOURCE_ID_1, '2026-05-01T00:00:00Z'),  // source 已删
      makeVideoRow(TARGET_ID),
    ])

    // P1-3：单次拒绝同时匹配 sourceVideoId 前缀 + 无法作为合并源 后缀，避免 copy-paste targetVideoId 文案
    await expect(
      svc.merge({ sourceVideoIds: [SOURCE_ID_1], targetVideoId: TARGET_ID }, ACTOR_ID),
    ).rejects.toMatchObject({
      code: 'STATE_CONFLICT',
      httpStatus: 409,
      message: expect.stringMatching(/sourceVideoId.*无法作为合并源/),
    })
  })

  it('STATE_CONFLICT：uq_sources_video_episode_url 冲突（冲突数 > 0）+ 合并后集合传参（P0-2）', async () => {
    const mockPool = makeMockPool(makeMockClient())
    const svc = new VideoMergesService(mockPool)

    vi.mocked(mutations.fetchVideosByIds).mockResolvedValueOnce([
      makeVideoRow(SOURCE_ID_1),
      makeVideoRow(TARGET_ID),
    ])
    vi.mocked(mutations.detectMergeConflicts).mockResolvedValueOnce(3)  // 3 条冲突

    await expect(
      svc.merge({ sourceVideoIds: [SOURCE_ID_1], targetVideoId: TARGET_ID }, ACTOR_ID),
    ).rejects.toMatchObject({ code: 'STATE_CONFLICT', httpStatus: 409, message: expect.stringContaining('3 条') })

    // P0-2：探测调用接收合并后集合 [source, target]，覆盖 source-vs-source + source-vs-target
    expect(mutations.detectMergeConflicts).toHaveBeenCalledWith(
      mockPool, [SOURCE_ID_1, TARGET_ID],
    )
  })

  it('STATE_CONFLICT：source-vs-source 内部冲突（CHG-SN-5-10-PATCH P0-2，R-105-1 漏检修复）', async () => {
    const mockPool = makeMockPool(makeMockClient())
    const svc = new VideoMergesService(mockPool)

    vi.mocked(mutations.fetchVideosByIds).mockResolvedValueOnce([
      makeVideoRow(SOURCE_ID_1),
      makeVideoRow(SOURCE_ID_2),
      makeVideoRow(TARGET_ID),
    ])
    // 假设两 source video 内部含相同 (episode_number, source_url) 行 → detectMergeConflicts > 0
    vi.mocked(mutations.detectMergeConflicts).mockResolvedValueOnce(2)

    await expect(
      svc.merge(
        { sourceVideoIds: [SOURCE_ID_1, SOURCE_ID_2], targetVideoId: TARGET_ID },
        ACTOR_ID,
      ),
    ).rejects.toMatchObject({ code: 'STATE_CONFLICT', httpStatus: 409, message: expect.stringContaining('2 条') })

    // 探测调用接收合并后集合 [...sources, target] 完整 3 ID
    expect(mutations.detectMergeConflicts).toHaveBeenCalledWith(
      mockPool, [SOURCE_ID_1, SOURCE_ID_2, TARGET_ID],
    )
  })

  it('事务失败时 ROLLBACK 且不写 admin_audit_log', async () => {
    const mockClient = makeMockClient()
    const mockPool = makeMockPool(mockClient)
    const svc = new VideoMergesService(mockPool)
    const auditSvcInstance = (AuditLogService as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value

    vi.mocked(mutations.fetchVideosByIds).mockResolvedValueOnce([
      makeVideoRow(SOURCE_ID_1),
      makeVideoRow(TARGET_ID),
    ])
    vi.mocked(mutations.detectMergeConflicts).mockResolvedValueOnce(0)
    vi.mocked(mutations.fetchSourcesByVideoIds).mockResolvedValueOnce([])
    vi.mocked(mutations.insertMergeAudit).mockRejectedValueOnce(new Error('DB error'))

    await expect(
      svc.merge({ sourceVideoIds: [SOURCE_ID_1], targetVideoId: TARGET_ID }, ACTOR_ID),
    ).rejects.toThrow('DB error')

    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
    expect(auditSvcInstance.write).not.toHaveBeenCalled()
  })
})

// ── unmerge ───────────────────────────────────────────────────────

describe('VideoMergesService.unmerge', () => {
  it('happy path（action=merge）：还原 source videos，返回 restoredVideoIds', async () => {
    const mockClient = makeMockClient()
    const mockPool = makeMockPool(mockClient)
    const svc = new VideoMergesService(mockPool)
    const auditSvcInstance = (AuditLogService as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value

    vi.mocked(mutations.fetchAuditById).mockResolvedValueOnce(makeAuditRow('merge'))
    vi.mocked(mutations.restoreVideos).mockResolvedValueOnce()
    vi.mocked(mutations.reassignSourcesToOriginal).mockResolvedValueOnce()
    vi.mocked(mutations.markAuditReverted).mockResolvedValueOnce()

    const result = await svc.unmerge(AUDIT_ID, ACTOR_ID, '撤销原因')

    expect(result.restoredVideoIds).toEqual([SOURCE_ID_1, SOURCE_ID_2])
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN')
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT')

    // audit payload 内容断言
    expect(mutations.markAuditReverted).toHaveBeenCalledWith(
      mockClient, AUDIT_ID, ACTOR_ID, '撤销原因',
    )
    expect(auditSvcInstance.write).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'video.unmerge',
      targetKind: 'video',
      targetId: SOURCE_ID_1,
      beforeJsonb: expect.objectContaining({ auditId: AUDIT_ID, action: 'merge' }),
      afterJsonb: expect.objectContaining({ restoredVideoIds: [SOURCE_ID_1, SOURCE_ID_2] }),
    }))
  })

  it('happy path（action=split）：还原原始 video + 软删除拆分后 new videos', async () => {
    const mockClient = makeMockClient()
    const mockPool = makeMockPool(mockClient)
    const svc = new VideoMergesService(mockPool)

    const splitAudit = makeAuditRow('split')
    vi.mocked(mutations.fetchAuditById).mockResolvedValueOnce(splitAudit)
    vi.mocked(mutations.restoreVideos).mockResolvedValueOnce()
    vi.mocked(mutations.reassignSourcesToOriginal).mockResolvedValueOnce()
    vi.mocked(mutations.softDeleteVideos).mockResolvedValueOnce()
    vi.mocked(mutations.markAuditReverted).mockResolvedValueOnce()

    const result = await svc.unmerge(AUDIT_ID, ACTOR_ID)

    expect(result.restoredVideoIds).toEqual([SOURCE_ID_1, SOURCE_ID_2])
    expect(mutations.restoreVideos).toHaveBeenCalledWith(mockClient, [SOURCE_ID_1, SOURCE_ID_2])
    expect(mutations.softDeleteVideos).toHaveBeenCalledWith(mockClient, [NEW_VIDEO_ID_1, NEW_VIDEO_ID_2])
  })

  it('NOT_FOUND：audit 不存在', async () => {
    const mockPool = makeMockPool(makeMockClient())
    const svc = new VideoMergesService(mockPool)

    vi.mocked(mutations.fetchAuditById).mockResolvedValueOnce(null)

    await expect(svc.unmerge('nonexistent-id', ACTOR_ID)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      httpStatus: 404,
    })
  })

  it('STATE_CONFLICT：audit 已被撤销（reverted_at IS NOT NULL）', async () => {
    const mockPool = makeMockPool(makeMockClient())
    const svc = new VideoMergesService(mockPool)

    vi.mocked(mutations.fetchAuditById).mockResolvedValueOnce(
      makeAuditRow('merge', '2026-05-12T01:00:00Z'),
    )

    await expect(svc.unmerge(AUDIT_ID, ACTOR_ID)).rejects.toMatchObject({
      code: 'STATE_CONFLICT',
      httpStatus: 409,
      message: expect.stringContaining('已被撤销'),
    })
  })

  it('事务失败时 ROLLBACK 且不写 admin_audit_log', async () => {
    const mockClient = makeMockClient()
    const mockPool = makeMockPool(mockClient)
    const svc = new VideoMergesService(mockPool)
    const auditSvcInstance = (AuditLogService as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value

    vi.mocked(mutations.fetchAuditById).mockResolvedValueOnce(makeAuditRow('merge'))
    vi.mocked(mutations.restoreVideos).mockRejectedValueOnce(new Error('DB error'))

    await expect(svc.unmerge(AUDIT_ID, ACTOR_ID)).rejects.toThrow('DB error')
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
    expect(auditSvcInstance.write).not.toHaveBeenCalled()
  })
})

// ── split ─────────────────────────────────────────────────────────

describe('VideoMergesService.split', () => {
  const SPLIT_GROUPS = [
    { sourceIds: [SRC_1, SRC_3], newVideoMeta: { title: '分集 A', year: 2020, type: 'movie' as const } },
    { sourceIds: [SRC_2, SRC_4], newVideoMeta: { title: '分集 B', year: 2021, type: 'movie' as const } },
  ]

  it('happy path：创建 2 个新 video，返回 auditId + newVideoIds', async () => {
    const mockClient = makeMockClient()
    const mockPool = makeMockPool(mockClient)
    const svc = new VideoMergesService(mockPool)
    const auditSvcInstance = (AuditLogService as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value

    vi.mocked(mutations.fetchVideosByIds).mockResolvedValueOnce([makeVideoRow(TARGET_ID)])
    vi.mocked(mutations.fetchSourcesByVideoId).mockResolvedValueOnce([
      makeSourceRow(SRC_1, TARGET_ID),
      makeSourceRow(SRC_2, TARGET_ID),
      makeSourceRow(SRC_3, TARGET_ID),
      makeSourceRow(SRC_4, TARGET_ID),
    ])
    vi.mocked(mutations.insertMergeAudit).mockResolvedValueOnce(AUDIT_ID)
    vi.mocked(mutations.insertNewVideo)
      .mockResolvedValueOnce(NEW_VIDEO_ID_1)
      .mockResolvedValueOnce(NEW_VIDEO_ID_2)
    vi.mocked(mutations.assignSourcesToVideo).mockResolvedValue()
    vi.mocked(mutations.softDeleteVideos).mockResolvedValueOnce()

    const result = await svc.split(
      { videoId: TARGET_ID, groups: SPLIT_GROUPS },
      ACTOR_ID,
    )

    expect(result.auditId).toBe(AUDIT_ID)
    expect(result.newVideoIds).toEqual([NEW_VIDEO_ID_1, NEW_VIDEO_ID_2])

    // 事务开启和提交
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN')
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT')

    // 创建了 2 个新 video
    expect(mutations.insertNewVideo).toHaveBeenCalledTimes(2)
    expect(mutations.insertNewVideo).toHaveBeenCalledWith(mockClient, expect.objectContaining({
      title: '分集 A',
      year: 2020,
      type: 'movie',
    }))

    // sources 分配
    expect(mutations.assignSourcesToVideo).toHaveBeenCalledWith(
      mockClient, [SRC_1, SRC_3], NEW_VIDEO_ID_1,
    )
    expect(mutations.assignSourcesToVideo).toHaveBeenCalledWith(
      mockClient, [SRC_2, SRC_4], NEW_VIDEO_ID_2,
    )

    // 原 video 软删除
    expect(mutations.softDeleteVideos).toHaveBeenCalledWith(mockClient, [TARGET_ID])

    // audit payload 内容断言
    expect(mutations.insertMergeAudit).toHaveBeenCalledWith(mockClient, expect.objectContaining({
      action: 'split',
      sourceVideoIds: [TARGET_ID],
      performedBy: ACTOR_ID,
    }))

    // fire-and-forget admin_audit_log
    expect(auditSvcInstance.write).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'video.split',
      targetKind: 'video',
      targetId: TARGET_ID,
      afterJsonb: expect.objectContaining({ auditId: AUDIT_ID, newVideoIds: [NEW_VIDEO_ID_1, NEW_VIDEO_ID_2] }),
    }))
  })

  it('NOT_FOUND：video 不存在', async () => {
    const mockPool = makeMockPool(makeMockClient())
    const svc = new VideoMergesService(mockPool)

    vi.mocked(mutations.fetchVideosByIds).mockResolvedValueOnce([])

    await expect(
      svc.split({ videoId: TARGET_ID, groups: SPLIT_GROUPS }, ACTOR_ID),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 })
  })

  it('STATE_CONFLICT：video 已被合并（deleted_at IS NOT NULL）', async () => {
    const mockPool = makeMockPool(makeMockClient())
    const svc = new VideoMergesService(mockPool)

    vi.mocked(mutations.fetchVideosByIds).mockResolvedValueOnce([
      makeVideoRow(TARGET_ID, '2026-05-01T00:00:00Z'),
    ])

    await expect(
      svc.split({ videoId: TARGET_ID, groups: SPLIT_GROUPS }, ACTOR_ID),
    ).rejects.toMatchObject({ code: 'STATE_CONFLICT', httpStatus: 409, message: expect.stringContaining('已被合并') })
  })

  it('VALIDATION_ERROR：groups.sourceIds 含不属于该 video 的 source', async () => {
    const mockPool = makeMockPool(makeMockClient())
    const svc = new VideoMergesService(mockPool)

    vi.mocked(mutations.fetchVideosByIds).mockResolvedValueOnce([makeVideoRow(TARGET_ID)])
    vi.mocked(mutations.fetchSourcesByVideoId).mockResolvedValueOnce([
      makeSourceRow(SRC_1, TARGET_ID),
      makeSourceRow(SRC_2, TARGET_ID),
    ])

    await expect(
      svc.split({
        videoId: TARGET_ID,
        groups: [
          { sourceIds: [SRC_1, SRC_FOREIGN], newVideoMeta: { title: 'A', type: 'movie' } },
          { sourceIds: [SRC_2], newVideoMeta: { title: 'B', type: 'movie' } },
        ],
      }, ACTOR_ID),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', httpStatus: 422 })
  })

  it('VALIDATION_ERROR：groups.sourceIds 有孤儿（未分配的 source）', async () => {
    const mockPool = makeMockPool(makeMockClient())
    const svc = new VideoMergesService(mockPool)

    vi.mocked(mutations.fetchVideosByIds).mockResolvedValueOnce([makeVideoRow(TARGET_ID)])
    vi.mocked(mutations.fetchSourcesByVideoId).mockResolvedValueOnce([
      makeSourceRow(SRC_1, TARGET_ID),
      makeSourceRow(SRC_2, TARGET_ID),
      makeSourceRow(SRC_3, TARGET_ID),  // SRC_3 未分配
    ])

    await expect(
      svc.split({
        videoId: TARGET_ID,
        groups: [
          { sourceIds: [SRC_1], newVideoMeta: { title: 'A', type: 'movie' } },
          { sourceIds: [SRC_2], newVideoMeta: { title: 'B', type: 'movie' } },
        ],
      }, ACTOR_ID),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', httpStatus: 422, message: expect.stringContaining('孤儿或重复') })
  })

  it('VALIDATION_ERROR：groups.sourceIds 含重复 source', async () => {
    const mockPool = makeMockPool(makeMockClient())
    const svc = new VideoMergesService(mockPool)

    vi.mocked(mutations.fetchVideosByIds).mockResolvedValueOnce([makeVideoRow(TARGET_ID)])
    vi.mocked(mutations.fetchSourcesByVideoId).mockResolvedValueOnce([
      makeSourceRow(SRC_1, TARGET_ID),
      makeSourceRow(SRC_2, TARGET_ID),
    ])

    await expect(
      svc.split({
        videoId: TARGET_ID,
        groups: [
          { sourceIds: [SRC_1, SRC_1], newVideoMeta: { title: 'A', type: 'movie' } },  // 重复
          { sourceIds: [SRC_2], newVideoMeta: { title: 'B', type: 'movie' } },
        ],
      }, ACTOR_ID),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', httpStatus: 422 })
  })

  it('事务失败时 ROLLBACK 且不写 admin_audit_log', async () => {
    const mockClient = makeMockClient()
    const mockPool = makeMockPool(mockClient)
    const svc = new VideoMergesService(mockPool)
    const auditSvcInstance = (AuditLogService as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value

    vi.mocked(mutations.fetchVideosByIds).mockResolvedValueOnce([makeVideoRow(TARGET_ID)])
    vi.mocked(mutations.fetchSourcesByVideoId).mockResolvedValueOnce([
      makeSourceRow(SRC_1, TARGET_ID),
      makeSourceRow(SRC_2, TARGET_ID),
      makeSourceRow(SRC_3, TARGET_ID),
      makeSourceRow(SRC_4, TARGET_ID),
    ])
    vi.mocked(mutations.insertMergeAudit).mockRejectedValueOnce(new Error('DB error'))

    await expect(
      svc.split({ videoId: TARGET_ID, groups: SPLIT_GROUPS }, ACTOR_ID),
    ).rejects.toThrow()

    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
    expect(auditSvcInstance.write).not.toHaveBeenCalled()
  })
})

// ── MergeSchema zod 校验 ──────────────────────────────────────────

describe('MergeSchema', () => {
  it('合法输入通过', () => {
    const result = MergeSchema.parse({ sourceVideoIds: [SOURCE_ID_1], targetVideoId: TARGET_ID })
    expect(result.sourceVideoIds).toEqual([SOURCE_ID_1])
    expect(result.targetVideoId).toBe(TARGET_ID)
  })

  it('targetVideoId 在 sourceVideoIds 中 → 报错', () => {
    expect(() => MergeSchema.parse({
      sourceVideoIds: [TARGET_ID],
      targetVideoId: TARGET_ID,
    })).toThrow()
  })

  it('sourceVideoIds 含重复值 → 报错', () => {
    expect(() => MergeSchema.parse({
      sourceVideoIds: [SOURCE_ID_1, SOURCE_ID_1],
      targetVideoId: TARGET_ID,
    })).toThrow()
  })

  it('sourceVideoIds 超 10 条 → 报错', () => {
    const ids = Array.from({ length: 11 }, (_, i) => `${i.toString().padStart(8, '0')}-0000-0000-0000-000000000000`)
    expect(() => MergeSchema.parse({ sourceVideoIds: ids, targetVideoId: TARGET_ID })).toThrow()
  })

  it('reason 超 500 字符 → 报错', () => {
    expect(() => MergeSchema.parse({
      sourceVideoIds: [SOURCE_ID_1],
      targetVideoId: TARGET_ID,
      reason: 'x'.repeat(501),
    })).toThrow()
  })
})

// ── SplitSchema zod 校验 ─────────────────────────────────────────

describe('SplitSchema', () => {
  it('合法输入通过', () => {
    const result = SplitSchema.parse({
      groups: [
        { sourceIds: [SRC_1, SRC_2], newVideoMeta: { title: '分集 A', year: 2020, type: 'movie' } },
        { sourceIds: [SRC_3], newVideoMeta: { title: '分集 B', type: 'anime' } },
      ],
    })
    expect(result.groups).toHaveLength(2)
  })

  it('groups < 2 → 报错', () => {
    expect(() => SplitSchema.parse({
      groups: [
        { sourceIds: [SRC_1], newVideoMeta: { title: 'A', type: 'movie' } },
      ],
    })).toThrow()
  })

  it('groups > 20 → 报错', () => {
    const groups = Array.from({ length: 21 }, (_, i) => ({
      sourceIds: [`00000000-0000-0000-0001-${String(i).padStart(12, '0')}`],
      newVideoMeta: { title: `分集 ${i}`, type: 'movie' as const },
    }))
    expect(() => SplitSchema.parse({ groups })).toThrow()
  })

  it('newVideoMeta.year 超范围（<1800）→ 报错', () => {
    expect(() => SplitSchema.parse({
      groups: [
        { sourceIds: [SRC_1], newVideoMeta: { title: 'A', year: 1700, type: 'movie' } },
        { sourceIds: [SRC_2], newVideoMeta: { title: 'B', type: 'movie' } },
      ],
    })).toThrow()
  })

  it('无效 type → 报错', () => {
    expect(() => SplitSchema.parse({
      groups: [
        { sourceIds: [SRC_1], newVideoMeta: { title: 'A', type: 'invalid_type' } },
        { sourceIds: [SRC_2], newVideoMeta: { title: 'B', type: 'movie' } },
      ],
    })).toThrow()
  })
})

// ── UnmergeSchema zod 校验 ────────────────────────────────────────

describe('UnmergeSchema', () => {
  it('空输入通过（reason 可选）', () => {
    const result = UnmergeSchema.parse({})
    expect(result.reason).toBeUndefined()
  })

  it('reason 超 500 字符 → 报错', () => {
    expect(() => UnmergeSchema.parse({ reason: 'x'.repeat(501) })).toThrow()
  })
})

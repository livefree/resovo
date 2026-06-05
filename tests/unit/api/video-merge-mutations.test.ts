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

// CHG-VIR-PRE-1: split 新建 video 前先 findOrCreate 作品层 catalog（catalog_id NOT NULL / migration 029）
const { mockFindOrCreate } = vi.hoisted(() => ({ mockFindOrCreate: vi.fn() }))

// ── mock DB 查询模块 ──────────────────────────────────────────────

vi.mock('@/api/db/queries/video-merge-mutations', () => ({
  fetchVideosByIds: vi.fn(),
  fetchSourcesByVideoId: vi.fn(),
  fetchSourcesByVideoIds: vi.fn(),
  // ADR-105 AMENDMENT 2026-06-05 D-105-13~16（CHG-MERGE-DEDUP-EP）：自动去重取并集
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
  updateAuditTargetIds: vi.fn(),  // CHG-SN-5-10-PATCH P2
}))

vi.mock('@/api/db/queries/video-merge-candidates', () => ({
  fetchRawCandidateGroups: vi.fn(),
  countRawCandidateGroups: vi.fn(),
  fetchVideoDetailsForCandidates: vi.fn(),
}))

// CHG-VIR-13-D1 / D-105-10：post-COMMIT 状态写入唯一通道（status-helpers 经此调状态机）
vi.mock('@/api/db/queries/videos.mutations', () => ({
  transitionVideoState: vi.fn(),
}))

// status-helpers 失败路径 statusLog.warn 留痕（沿 auditLogService.test 静默范式）
vi.mock('@/api/lib/logger', () => ({
  baseLogger: { child: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }) },
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

// CHG-VIR-PRE-1: VideoMergesService 构造注入 MediaCatalogService；split 用 findOrCreate 建 catalog
vi.mock('@/api/services/MediaCatalogService', () => ({
  MediaCatalogService: vi.fn().mockImplementation(() => ({ findOrCreate: mockFindOrCreate })),
}))

import * as mutations from '@/api/db/queries/video-merge-mutations'
import * as candidates from '@/api/db/queries/video-merge-candidates'
import * as videosMutations from '@/api/db/queries/videos.mutations'
import { AuditLogService } from '@/api/services/AuditLogService'

// ── helpers ──────────────────────────────────────────────────────

const ACTOR_ID = '00000000-0000-0000-0000-000000000001'
const TARGET_ID = '00000000-0000-0000-0000-000000000002'
const SOURCE_ID_1 = '00000000-0000-0000-0000-000000000003'
const SOURCE_ID_2 = '00000000-0000-0000-0000-000000000004'
const AUDIT_ID = '00000000-0000-0000-0000-000000000005'
const NEW_VIDEO_ID_1 = '00000000-0000-0000-0000-000000000006'
const NEW_VIDEO_ID_2 = '00000000-0000-0000-0000-000000000007'
const CATALOG_A = '00000000-0000-0000-0002-00000000000a'
const CATALOG_B = '00000000-0000-0000-0002-00000000000b'
const SRC_1 = '00000000-0000-0000-0001-000000000001'
const SRC_2 = '00000000-0000-0000-0001-000000000002'
const SRC_3 = '00000000-0000-0000-0001-000000000003'
const SRC_4 = '00000000-0000-0000-0001-000000000004'
const SRC_FOREIGN = '00000000-0000-0000-0001-000000000099'

function makeVideoRow(
  id: string,
  deletedAt: string | null = null,
  // CHG-VIR-13-D1 / D-105-9：状态 2 列（默认 = insertNewVideo DB DEFAULT 同款 pending|internal|0）
  state: { review?: string; visibility?: string; isPublished?: boolean } = {},
) {
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
    is_published: state.isPublished ?? false,
    review_status: state.review ?? 'pending_review',
    visibility_status: state.visibility ?? 'internal',
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
  // CHG-MERGE-DEDUP-EP 默认零去重路径（用例按需覆写）
  vi.mocked(mutations.dedupeSourcesForMerge).mockResolvedValue([])
  vi.mocked(mutations.detectResidualTargetConflicts).mockResolvedValue(0)
  vi.mocked(mutations.dedupeSourcesForSplitTarget).mockResolvedValue([])
  vi.mocked(mutations.detectResidualSplitTargetConflicts).mockResolvedValue(0)
  vi.mocked(mutations.restoreSourcesByIds).mockResolvedValue()
  vi.mocked(mutations.setAuditDedupedSourceIds).mockResolvedValue()
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

    // D-105-13（CHG-MERGE-DEDUP-EP）：事务内去重 + 残余预检调用（client 级）
    expect(mutations.dedupeSourcesForMerge).toHaveBeenCalledWith(
      mockClient, [SOURCE_ID_1, SOURCE_ID_2], TARGET_ID,
    )
    expect(mutations.detectResidualTargetConflicts).toHaveBeenCalledWith(
      mockClient, [SOURCE_ID_1, SOURCE_ID_2], TARGET_ID,
    )
    // 零去重 → 不写 snapshot 字段 + 响应无 dedupedCount
    expect(mutations.setAuditDedupedSourceIds).not.toHaveBeenCalled()
    expect('dedupedCount' in result).toBe(false)

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

  it('D-105-13/14（CHG-MERGE-DEDUP-EP）：重复 (ep,url) 自动去重——snapshot 补 dedupedSourceIds + dedupedCount 透出 + 转移仍执行', async () => {
    const mockClient = makeMockClient()
    const mockPool = makeMockPool(mockClient)
    const svc = new VideoMergesService(mockPool)
    const auditSvcInstance = (AuditLogService as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value

    vi.mocked(mutations.fetchVideosByIds).mockResolvedValueOnce([
      makeVideoRow(SOURCE_ID_1),
      makeVideoRow(TARGET_ID),
    ])
    vi.mocked(mutations.fetchSourcesByVideoIds).mockResolvedValueOnce([makeSourceRow(SRC_1, SOURCE_ID_1)])
    vi.mocked(mutations.insertMergeAudit).mockResolvedValueOnce(AUDIT_ID)
    vi.mocked(mutations.dedupeSourcesForMerge).mockResolvedValueOnce([SRC_1, SRC_2, SRC_3])  // 3 条去重
    vi.mocked(candidates.fetchVideoDetailsForCandidates).mockResolvedValueOnce([{
      id: TARGET_ID, title: `Video ${TARGET_ID}`, title_normalized: `video ${TARGET_ID}`,
      year: 2020, type: 'movie', created_at: '2026-01-01T00:00:00Z', source_count: '2', site_keys: ['iqiyi'],
    }])

    const result = await svc.merge({ sourceVideoIds: [SOURCE_ID_1], targetVideoId: TARGET_ID }, ACTOR_ID)

    // 不再 409：合并成功 + dedupedCount 透出（D-105-16）
    expect(result.auditId).toBe(AUDIT_ID)
    expect(result.dedupedCount).toBe(3)
    // D-105-14：snapshot 补 dedupedSourceIds（unmerge 还原依据）
    expect(mutations.setAuditDedupedSourceIds).toHaveBeenCalledWith(mockClient, AUDIT_ID, [SRC_1, SRC_2, SRC_3])
    // 去重在转移之前（Y-105-D4 时序）且转移仍执行
    expect(mutations.transferSourcesToTarget).toHaveBeenCalledWith(mockClient, [SOURCE_ID_1], TARGET_ID)
    const dedupeOrder = vi.mocked(mutations.dedupeSourcesForMerge).mock.invocationCallOrder[0]!
    const transferOrder = vi.mocked(mutations.transferSourcesToTarget).mock.invocationCallOrder[0]!
    expect(dedupeOrder).toBeLessThan(transferOrder)
    // afterJsonb 补记（audit jsonb 非契约字段）
    expect(auditSvcInstance.write).toHaveBeenCalledWith(expect.objectContaining({
      afterJsonb: expect.objectContaining({ dedupedSourceIds: [SRC_1, SRC_2, SRC_3] }),
    }))
  })

  it('Y-105-D3：残余冲突（target 含软删占槽位）→ 409 + ROLLBACK，转移未执行', async () => {
    const mockClient = makeMockClient()
    const mockPool = makeMockPool(mockClient)
    const svc = new VideoMergesService(mockPool)

    vi.mocked(mutations.fetchVideosByIds).mockResolvedValueOnce([
      makeVideoRow(SOURCE_ID_1),
      makeVideoRow(TARGET_ID),
    ])
    vi.mocked(mutations.fetchSourcesByVideoIds).mockResolvedValueOnce([])
    vi.mocked(mutations.insertMergeAudit).mockResolvedValueOnce(AUDIT_ID)
    vi.mocked(mutations.detectResidualTargetConflicts).mockResolvedValueOnce(2)

    await expect(
      svc.merge({ sourceVideoIds: [SOURCE_ID_1], targetVideoId: TARGET_ID }, ACTOR_ID),
    ).rejects.toMatchObject({
      code: 'STATE_CONFLICT', httpStatus: 409,
      message: expect.stringContaining('历史软删线路'),
    })

    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
    expect(mutations.transferSourcesToTarget).not.toHaveBeenCalled()
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
    mockFindOrCreate
      .mockResolvedValueOnce({ id: CATALOG_A })
      .mockResolvedValueOnce({ id: CATALOG_B })
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

    // CHG-VIR-PRE-1: 每组先 findOrCreate 作品层 catalog（manual 来源），再以 catalogId 建 video
    expect(mockFindOrCreate).toHaveBeenCalledTimes(2)
    expect(mockFindOrCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      title: '分集 A', year: 2020, type: 'movie', metadataSource: 'manual',
    }))

    // 创建了 2 个新 video；insertNewVideo 携带 catalogId，不再传已下沉 catalog 的 year/title_normalized
    expect(mutations.insertNewVideo).toHaveBeenCalledTimes(2)
    expect(mutations.insertNewVideo).toHaveBeenCalledWith(mockClient, expect.objectContaining({
      title: '分集 A',
      catalogId: CATALOG_A,
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
    // CHG-VIR-PRE-1: catalog 先行就绪（事务前），失败发生在事务内 insertMergeAudit → ROLLBACK
    mockFindOrCreate.mockResolvedValue({ id: CATALOG_A })
    vi.mocked(mutations.insertMergeAudit).mockRejectedValueOnce(new Error('DB error'))

    await expect(
      svc.split({ videoId: TARGET_ID, groups: SPLIT_GROUPS }, ACTOR_ID),
    ).rejects.toThrow()

    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
    expect(auditSvcInstance.write).not.toHaveBeenCalled()
  })
})

// ── split 拆到已有 video（ADR-105 AMENDMENT 2026-06-03 D-105-2/3/4/5 / CHG-VIR-11-B）──

describe('VideoMergesService.split — 拆到已有 video', () => {
  const EXISTING_ID = '00000000-0000-0000-0000-00000000000e'
  const EXISTING_ID_2 = '00000000-0000-0000-0000-00000000000f'

  /** 公共 mock：原 video + 4 sources 就绪 */
  function setupBaseMocks() {
    vi.mocked(mutations.fetchSourcesByVideoId).mockResolvedValueOnce([
      makeSourceRow(SRC_1, TARGET_ID),
      makeSourceRow(SRC_2, TARGET_ID),
      makeSourceRow(SRC_3, TARGET_ID),
      makeSourceRow(SRC_4, TARGET_ID),
    ])
  }

  it('happy path 混合组（1 新建 + 1 已有）：已有 target 不 insertNewVideo / 不 findOrCreate，audit 回填 created 与全部 target', async () => {
    const mockClient = makeMockClient()
    const mockPool = makeMockPool(mockClient)
    const svc = new VideoMergesService(mockPool)
    const auditSvcInstance = (AuditLogService as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value

    vi.mocked(mutations.fetchVideosByIds)
      .mockResolvedValueOnce([makeVideoRow(TARGET_ID)])      // 原 video 校验
      .mockResolvedValueOnce([makeVideoRow(EXISTING_ID)])    // targetVideoId 校验
    setupBaseMocks()
    vi.mocked(mutations.insertMergeAudit).mockResolvedValueOnce(AUDIT_ID)
    mockFindOrCreate.mockResolvedValueOnce({ id: CATALOG_A })
    vi.mocked(mutations.insertNewVideo).mockResolvedValueOnce(NEW_VIDEO_ID_1)

    const result = await svc.split({
      videoId: TARGET_ID,
      groups: [
        { sourceIds: [SRC_1, SRC_3], newVideoMeta: { title: '新作品', type: 'movie' } },
        { sourceIds: [SRC_2, SRC_4], targetVideoId: EXISTING_ID },
      ],
    }, ACTOR_ID)

    expect(result.newVideoIds).toEqual([NEW_VIDEO_ID_1])
    // D-105-5：已有 target 不建 catalog / 不建 video
    expect(mockFindOrCreate).toHaveBeenCalledTimes(1)
    expect(mutations.insertNewVideo).toHaveBeenCalledTimes(1)
    // D-105-15（CHG-MERGE-DEDUP-EP）：转入前去重 + 残余预检（事务内 client 级 / Y-105-D4 时序）
    expect(mutations.dedupeSourcesForSplitTarget).toHaveBeenCalledWith(
      mockClient, [SRC_2, SRC_4], EXISTING_ID,
    )
    expect(mutations.detectResidualSplitTargetConflicts).toHaveBeenCalledWith(
      mockClient, [SRC_2, SRC_4], EXISTING_ID,
    )
    // sources 转入已有 video
    expect(mutations.assignSourcesToVideo).toHaveBeenCalledWith(mockClient, [SRC_2, SRC_4], EXISTING_ID)
    // D-105-4：target_video_ids 含全部目标 + created 仅新建
    expect(mutations.updateAuditTargetIds).toHaveBeenCalledWith(
      mockClient, AUDIT_ID, [NEW_VIDEO_ID_1, EXISTING_ID], [NEW_VIDEO_ID_1],
    )
    // D-105-6：afterJsonb 扩 existingTargetVideoIds
    expect(auditSvcInstance.write).toHaveBeenCalledWith(expect.objectContaining({
      afterJsonb: expect.objectContaining({
        newVideoIds: [NEW_VIDEO_ID_1],
        existingTargetVideoIds: [EXISTING_ID],
      }),
    }))
  })

  it('全组 targetVideoId（0 新建）合法：newVideoIds=[] + created=[]（Y-A1 裁定）', async () => {
    const mockClient = makeMockClient()
    const mockPool = makeMockPool(mockClient)
    const svc = new VideoMergesService(mockPool)

    vi.mocked(mutations.fetchVideosByIds)
      .mockResolvedValueOnce([makeVideoRow(TARGET_ID)])
      .mockResolvedValueOnce([makeVideoRow(EXISTING_ID), makeVideoRow(EXISTING_ID_2)])
    setupBaseMocks()
    vi.mocked(mutations.insertMergeAudit).mockResolvedValueOnce(AUDIT_ID)

    const result = await svc.split({
      videoId: TARGET_ID,
      groups: [
        { sourceIds: [SRC_1, SRC_3], targetVideoId: EXISTING_ID },
        { sourceIds: [SRC_2, SRC_4], targetVideoId: EXISTING_ID_2 },
      ],
    }, ACTOR_ID)

    expect(result.newVideoIds).toEqual([])
    expect(mockFindOrCreate).not.toHaveBeenCalled()
    expect(mutations.insertNewVideo).not.toHaveBeenCalled()
    expect(mutations.updateAuditTargetIds).toHaveBeenCalledWith(
      mockClient, AUDIT_ID, [EXISTING_ID, EXISTING_ID_2], [],
    )
  })

  it('VALIDATION_ERROR：targetVideoId = 被拆 videoId', async () => {
    const mockPool = makeMockPool(makeMockClient())
    const svc = new VideoMergesService(mockPool)
    vi.mocked(mutations.fetchVideosByIds).mockResolvedValueOnce([makeVideoRow(TARGET_ID)])
    setupBaseMocks()

    await expect(svc.split({
      videoId: TARGET_ID,
      groups: [
        { sourceIds: [SRC_1, SRC_3], newVideoMeta: { title: 'A', type: 'movie' } },
        { sourceIds: [SRC_2, SRC_4], targetVideoId: TARGET_ID },
      ],
    }, ACTOR_ID)).rejects.toMatchObject({ code: 'VALIDATION_ERROR', httpStatus: 422 })
  })

  it('NOT_FOUND：targetVideoId 不存在', async () => {
    const mockPool = makeMockPool(makeMockClient())
    const svc = new VideoMergesService(mockPool)
    vi.mocked(mutations.fetchVideosByIds)
      .mockResolvedValueOnce([makeVideoRow(TARGET_ID)])
      .mockResolvedValueOnce([])  // targetVideoId 查无
    setupBaseMocks()

    await expect(svc.split({
      videoId: TARGET_ID,
      groups: [
        { sourceIds: [SRC_1, SRC_3], newVideoMeta: { title: 'A', type: 'movie' } },
        { sourceIds: [SRC_2, SRC_4], targetVideoId: EXISTING_ID },
      ],
    }, ACTOR_ID)).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 })
  })

  it('STATE_CONFLICT：targetVideoId 已软删', async () => {
    const mockPool = makeMockPool(makeMockClient())
    const svc = new VideoMergesService(mockPool)
    vi.mocked(mutations.fetchVideosByIds)
      .mockResolvedValueOnce([makeVideoRow(TARGET_ID)])
      .mockResolvedValueOnce([makeVideoRow(EXISTING_ID, '2026-05-01T00:00:00Z')])
    setupBaseMocks()

    await expect(svc.split({
      videoId: TARGET_ID,
      groups: [
        { sourceIds: [SRC_1, SRC_3], newVideoMeta: { title: 'A', type: 'movie' } },
        { sourceIds: [SRC_2, SRC_4], targetVideoId: EXISTING_ID },
      ],
    }, ACTOR_ID)).rejects.toMatchObject({ code: 'STATE_CONFLICT', httpStatus: 409 })
  })

  it('D-105-15（CHG-MERGE-DEDUP-EP）：转入重复 → 自动去重 + snapshot 补 dedupedSourceIds + dedupedCount 透出', async () => {
    const mockClient = makeMockClient()
    const mockPool = makeMockPool(mockClient)
    const svc = new VideoMergesService(mockPool)
    vi.mocked(mutations.fetchVideosByIds)
      .mockResolvedValueOnce([makeVideoRow(TARGET_ID)])
      .mockResolvedValueOnce([makeVideoRow(EXISTING_ID)])
    setupBaseMocks()
    vi.mocked(mutations.insertMergeAudit).mockResolvedValueOnce(AUDIT_ID)
    mockFindOrCreate.mockResolvedValueOnce({ id: CATALOG_A })
    vi.mocked(mutations.insertNewVideo).mockResolvedValueOnce(NEW_VIDEO_ID_1)
    vi.mocked(mutations.dedupeSourcesForSplitTarget).mockResolvedValueOnce([SRC_2])  // 1 条转入去重

    const result = await svc.split({
      videoId: TARGET_ID,
      groups: [
        { sourceIds: [SRC_1, SRC_3], newVideoMeta: { title: 'A', type: 'movie' } },
        { sourceIds: [SRC_2, SRC_4], targetVideoId: EXISTING_ID },
      ],
    }, ACTOR_ID)

    // 不再 409：拆分成功 + dedupedCount 透出（D-105-16）
    expect(result.dedupedCount).toBe(1)
    expect(mutations.setAuditDedupedSourceIds).toHaveBeenCalledWith(mockClient, AUDIT_ID, [SRC_2])
    // 去重在 assign 之前（Y-105-D4 时序）且 assign 仍执行（软删行由 WHERE deleted_at 跳过）
    const dedupeOrder = vi.mocked(mutations.dedupeSourcesForSplitTarget).mock.invocationCallOrder[0]!
    const assignOrders = vi.mocked(mutations.assignSourcesToVideo).mock.invocationCallOrder
    expect(dedupeOrder).toBeLessThan(Math.max(...assignOrders))
    expect(mutations.assignSourcesToVideo).toHaveBeenCalledWith(mockClient, [SRC_2, SRC_4], EXISTING_ID)
  })

  it('Y-105-D3（split 版）：残余冲突（target 含软删占槽位）→ 409 + ROLLBACK', async () => {
    const mockClient = makeMockClient()
    const mockPool = makeMockPool(mockClient)
    const svc = new VideoMergesService(mockPool)
    vi.mocked(mutations.fetchVideosByIds)
      .mockResolvedValueOnce([makeVideoRow(TARGET_ID)])
      .mockResolvedValueOnce([makeVideoRow(EXISTING_ID)])
    setupBaseMocks()
    vi.mocked(mutations.insertMergeAudit).mockResolvedValueOnce(AUDIT_ID)
    mockFindOrCreate.mockResolvedValueOnce({ id: CATALOG_A })
    vi.mocked(mutations.insertNewVideo).mockResolvedValueOnce(NEW_VIDEO_ID_1)
    vi.mocked(mutations.detectResidualSplitTargetConflicts).mockResolvedValueOnce(2)

    await expect(svc.split({
      videoId: TARGET_ID,
      groups: [
        { sourceIds: [SRC_1, SRC_3], newVideoMeta: { title: 'A', type: 'movie' } },
        { sourceIds: [SRC_2, SRC_4], targetVideoId: EXISTING_ID },
      ],
    }, ACTOR_ID)).rejects.toMatchObject({
      code: 'STATE_CONFLICT', httpStatus: 409,
      message: expect.stringContaining('历史软删线路'),
    })
    // 事务内 409 → ROLLBACK 整体不执行
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
    expect(mutations.assignSourcesToVideo).not.toHaveBeenCalledWith(mockClient, [SRC_2, SRC_4], EXISTING_ID)
  })
})

// ── unmerge 仅软删新建 target（D-105-4 / R-105-S4）──────────────────────

describe('VideoMergesService.unmerge — created_target_video_ids 驱动（D-105-4）', () => {
  const EXISTING_ID = '00000000-0000-0000-0000-00000000000e'

  it('snapshot 含 created_target_video_ids → 仅软删新建，已有 target 不软删（R-105-S4）', async () => {
    const mockClient = makeMockClient()
    const mockPool = makeMockPool(mockClient)
    const svc = new VideoMergesService(mockPool)

    const audit = makeAuditRow('split')
    ;(audit as { target_video_ids: string[] }).target_video_ids = [NEW_VIDEO_ID_1, EXISTING_ID]
    ;(audit.snapshot_jsonb as Record<string, unknown>)['created_target_video_ids'] = [NEW_VIDEO_ID_1]
    vi.mocked(mutations.fetchAuditById).mockResolvedValueOnce(audit)

    await svc.unmerge(AUDIT_ID, ACTOR_ID)

    expect(mutations.softDeleteVideos).toHaveBeenCalledWith(mockClient, [NEW_VIDEO_ID_1])
    expect(mutations.softDeleteVideos).not.toHaveBeenCalledWith(
      mockClient, expect.arrayContaining([EXISTING_ID]),
    )
    // 转入 sources 经 snapshot.sources 原归属归还（既有 reassign 覆盖）
    expect(mutations.reassignSourcesToOriginal).toHaveBeenCalled()
  })

  it('存量 audit 无 created 字段 → 兜底全视为新建（旧行为逐值一致）', async () => {
    const mockClient = makeMockClient()
    const mockPool = makeMockPool(mockClient)
    const svc = new VideoMergesService(mockPool)

    vi.mocked(mutations.fetchAuditById).mockResolvedValueOnce(makeAuditRow('split'))

    await svc.unmerge(AUDIT_ID, ACTOR_ID)

    expect(mutations.softDeleteVideos).toHaveBeenCalledWith(
      mockClient, [NEW_VIDEO_ID_1, NEW_VIDEO_ID_2],
    )
  })
})

// ── 操作内状态设置（ADR-105 AMENDMENT 2026-06-04 D-105-9/10/11/12 / CHG-VIR-13-D1）──

describe('VideoMergesService.merge — targetStatus（D-105-9/10/11）', () => {
  /** merge 全套 happy-path mock（target 状态可参数化）；返回句柄供断言 */
  function mockMergeHappyPath(targetState: { review?: string; visibility?: string; isPublished?: boolean } = {}) {
    const mockClient = makeMockClient()
    const mockPool = makeMockPool(mockClient)
    const svc = new VideoMergesService(mockPool)
    const auditSvcInstance = (AuditLogService as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value
    vi.mocked(mutations.fetchVideosByIds).mockResolvedValueOnce([
      makeVideoRow(SOURCE_ID_1),
      makeVideoRow(TARGET_ID, null, targetState),
    ])
    vi.mocked(mutations.fetchSourcesByVideoIds).mockResolvedValueOnce([makeSourceRow(SRC_1, SOURCE_ID_1)])
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
    return { mockClient, mockPool, svc, auditSvcInstance }
  }

  it('R-105-T1：不传 targetStatus → 不调状态机、响应无 statusTransition、snapshot 无 targetStatusBefore', async () => {
    const { svc } = mockMergeHappyPath()

    const result = await svc.merge(
      { sourceVideoIds: [SOURCE_ID_1], targetVideoId: TARGET_ID },
      ACTOR_ID,
    )

    expect(videosMutations.transitionVideoState).not.toHaveBeenCalled()
    expect('statusTransition' in result).toBe(false)
    const snapshot = vi.mocked(mutations.insertMergeAudit).mock.calls[0]![1].snapshotJsonb
    expect('targetStatusBefore' in snapshot).toBe(false)
  })

  it('applied：pending|internal target + {approved,public} → post-COMMIT approve_and_publish + snapshot 写 targetStatusBefore + afterJsonb 补记（D-105-11/12）', async () => {
    const { mockPool, svc, auditSvcInstance } = mockMergeHappyPath()  // 默认 pending|internal|0
    vi.mocked(videosMutations.transitionVideoState).mockResolvedValueOnce({
      id: TARGET_ID,
      review_status: 'approved',
      visibility_status: 'public',
      is_published: true,
      updated_at: '2026-06-04T00:00:00Z',
    })

    const result = await svc.merge(
      {
        sourceVideoIds: [SOURCE_ID_1],
        targetVideoId: TARGET_ID,
        reason: '同作品合并',
        targetStatus: { reviewStatus: 'approved', visibilityStatus: 'public' },
      },
      ACTOR_ID,
    )

    expect(result.statusTransition).toBe('applied')
    // 唯一通道 R-105-T2：post-COMMIT 经 transitionVideoState（Pool 非事务 client）
    expect(videosMutations.transitionVideoState).toHaveBeenCalledExactlyOnceWith(
      mockPool, TARGET_ID,
      { action: 'approve_and_publish', reviewedBy: ACTOR_ID, reason: '同作品合并' },
    )
    // D-105-11：snapshot 写 targetStatusBefore（unmerge 还原依据，逐值）
    const snapshot = vi.mocked(mutations.insertMergeAudit).mock.calls[0]![1].snapshotJsonb
    expect(snapshot.targetStatusBefore).toEqual({
      reviewStatus: 'pending_review',
      visibilityStatus: 'internal',
      isPublished: false,
    })
    // D-105-12：afterJsonb 纯增量补请求值 + 结果
    expect(auditSvcInstance.write).toHaveBeenCalledWith(expect.objectContaining({
      afterJsonb: expect.objectContaining({
        targetStatus: { reviewStatus: 'approved', visibilityStatus: 'public' },
        statusTransition: 'applied',
      }),
    }))
  })

  it('skipped：targetStatus == current → 不调状态机 + statusTransition=skipped + snapshot 不写 targetStatusBefore', async () => {
    const { svc } = mockMergeHappyPath({ review: 'approved', visibility: 'public', isPublished: true })

    const result = await svc.merge(
      {
        sourceVideoIds: [SOURCE_ID_1],
        targetVideoId: TARGET_ID,
        targetStatus: { reviewStatus: 'approved', visibilityStatus: 'public' },
      },
      ACTOR_ID,
    )

    expect(result.statusTransition).toBe('skipped')
    expect(videosMutations.transitionVideoState).not.toHaveBeenCalled()
    // no-op 不写还原依据（无可还原的变更）
    const snapshot = vi.mocked(mutations.insertMergeAudit).mock.calls[0]![1].snapshotJsonb
    expect('targetStatusBefore' in snapshot).toBe(false)
  })

  it('failed：transitionVideoState 抛错 → merge 不回滚（D-105-10 非原子声明）+ statusTransition=failed', async () => {
    const { mockClient, svc } = mockMergeHappyPath()
    vi.mocked(videosMutations.transitionVideoState).mockRejectedValueOnce(
      new Error('trigger rejected: concurrent state change'),
    )

    const result = await svc.merge(
      {
        sourceVideoIds: [SOURCE_ID_1],
        targetVideoId: TARGET_ID,
        targetStatus: { reviewStatus: 'approved', visibilityStatus: 'public' },
      },
      ACTOR_ID,
    )

    // merge 本身成功（COMMIT 已发生不回滚），状态失败可观测（R-105-T3）
    expect(result.auditId).toBe(AUDIT_ID)
    expect(result.statusTransition).toBe('failed')
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT')
    expect(mockClient.query).not.toHaveBeenCalledWith('ROLLBACK')
  })

  it('422：非法组合（approved|public target → rejected）→ BEGIN 前快速失败，merge 整体不执行', async () => {
    const { mockClient, svc } = mockMergeHappyPath({ review: 'approved', visibility: 'public', isPublished: true })

    await expect(
      svc.merge(
        {
          sourceVideoIds: [SOURCE_ID_1],
          targetVideoId: TARGET_ID,
          // reject 前置 from=pending_review（评审 R1 场景：approved-target 确定性 422）
          targetStatus: { reviewStatus: 'rejected' },
        },
        ACTOR_ID,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', httpStatus: 422 })

    expect(mutations.insertMergeAudit).not.toHaveBeenCalled()
    expect(mockClient.query).not.toHaveBeenCalledWith('BEGIN')
    expect(videosMutations.transitionVideoState).not.toHaveBeenCalled()
  })
})

describe('VideoMergesService.split — newVideoMeta.status（D-105-9/10）', () => {
  /** split 双组 happy-path mock（status 可注入到组定义） */
  function mockSplitHappyPath() {
    const mockClient = makeMockClient()
    const mockPool = makeMockPool(mockClient)
    const svc = new VideoMergesService(mockPool)
    const auditSvcInstance = (AuditLogService as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value
    vi.mocked(mutations.fetchVideosByIds).mockResolvedValueOnce([makeVideoRow(TARGET_ID)])
    vi.mocked(mutations.fetchSourcesByVideoId).mockResolvedValueOnce([
      makeSourceRow(SRC_1, TARGET_ID),
      makeSourceRow(SRC_2, TARGET_ID),
    ])
    vi.mocked(mutations.insertMergeAudit).mockResolvedValueOnce(AUDIT_ID)
    mockFindOrCreate
      .mockResolvedValueOnce({ id: CATALOG_A })
      .mockResolvedValueOnce({ id: CATALOG_B })
    vi.mocked(mutations.insertNewVideo)
      .mockResolvedValueOnce(NEW_VIDEO_ID_1)
      .mockResolvedValueOnce(NEW_VIDEO_ID_2)
    vi.mocked(mutations.assignSourcesToVideo).mockResolvedValue()
    vi.mocked(mutations.softDeleteVideos).mockResolvedValueOnce()
    return { mockClient, mockPool, svc, auditSvcInstance }
  }

  it('携带 status 组 → 新建后 post-COMMIT transition；数组仅含携带组（未携带组不产条目）', async () => {
    const { mockPool, svc, auditSvcInstance } = mockSplitHappyPath()
    vi.mocked(videosMutations.transitionVideoState).mockResolvedValueOnce({
      id: NEW_VIDEO_ID_1,
      review_status: 'approved',
      visibility_status: 'public',
      is_published: true,
      updated_at: '2026-06-04T00:00:00Z',
    })

    const result = await svc.split(
      {
        videoId: TARGET_ID,
        groups: [
          // 组 0 携带 status（pending|internal → approved|public = approve_and_publish）
          { sourceIds: [SRC_1], newVideoMeta: { title: 'A', type: 'movie', status: { reviewStatus: 'approved', visibilityStatus: 'public' } } },
          // 组 1 未携带（无 transition 意图，不产条目）
          { sourceIds: [SRC_2], newVideoMeta: { title: 'B', type: 'movie' } },
        ],
      },
      ACTOR_ID,
    )

    expect(result.statusTransition).toEqual([{ videoId: NEW_VIDEO_ID_1, result: 'applied' }])
    expect(videosMutations.transitionVideoState).toHaveBeenCalledExactlyOnceWith(
      mockPool, NEW_VIDEO_ID_1,
      { action: 'approve_and_publish', reviewedBy: ACTOR_ID, reason: undefined },
    )
    // D-105-12：afterJsonb 补请求值（groupIndex 锚定）+ 结果
    expect(auditSvcInstance.write).toHaveBeenCalledWith(expect.objectContaining({
      afterJsonb: expect.objectContaining({
        requestedStatuses: [{ groupIndex: 0, status: { reviewStatus: 'approved', visibilityStatus: 'public' } }],
        statusTransition: [{ videoId: NEW_VIDEO_ID_1, result: 'applied' }],
      }),
    }))
  })

  it('R-105-T1：全组不传 status → 不调状态机、响应无 statusTransition、afterJsonb 无补记字段', async () => {
    const { svc, auditSvcInstance } = mockSplitHappyPath()

    const result = await svc.split(
      {
        videoId: TARGET_ID,
        groups: [
          { sourceIds: [SRC_1], newVideoMeta: { title: 'A', type: 'movie' } },
          { sourceIds: [SRC_2], newVideoMeta: { title: 'B', type: 'movie' } },
        ],
      },
      ACTOR_ID,
    )

    expect(videosMutations.transitionVideoState).not.toHaveBeenCalled()
    expect('statusTransition' in result).toBe(false)
    const afterJsonb = auditSvcInstance.write.mock.calls[0]![0].afterJsonb
    expect('statusTransition' in afterJsonb).toBe(false)
    expect('requestedStatuses' in afterJsonb).toBe(false)
  })

  it('422：非法 status（visibilityStatus=public 单维 → pending|public 非法态）→ BEGIN 前整体不执行', async () => {
    const { mockClient, svc } = mockSplitHappyPath()

    await expect(
      svc.split(
        {
          videoId: TARGET_ID,
          groups: [
            // 归一化 (pending_review, public) = 非法三元组（023 trigger pending 不可 public）
            { sourceIds: [SRC_1], newVideoMeta: { title: 'A', type: 'movie', status: { visibilityStatus: 'public' } } },
            { sourceIds: [SRC_2], newVideoMeta: { title: 'B', type: 'movie' } },
          ],
        },
        ACTOR_ID,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', httpStatus: 422 })

    expect(mutations.insertMergeAudit).not.toHaveBeenCalled()
    expect(mockClient.query).not.toHaveBeenCalledWith('BEGIN')
    expect(mutations.insertNewVideo).not.toHaveBeenCalled()
  })

  it('skipped：status == 初始态（pending|internal）→ 产 skipped 条目且不调状态机', async () => {
    const { svc } = mockSplitHappyPath()

    const result = await svc.split(
      {
        videoId: TARGET_ID,
        groups: [
          { sourceIds: [SRC_1], newVideoMeta: { title: 'A', type: 'movie', status: { reviewStatus: 'pending_review' } } },
          { sourceIds: [SRC_2], newVideoMeta: { title: 'B', type: 'movie' } },
        ],
      },
      ACTOR_ID,
    )

    expect(result.statusTransition).toEqual([{ videoId: NEW_VIDEO_ID_1, result: 'skipped' }])
    expect(videosMutations.transitionVideoState).not.toHaveBeenCalled()
  })
})

describe('VideoMergesService.unmerge — targetStatusBefore 还原（D-105-11）', () => {
  function makeAuditWithBefore(before: { reviewStatus: string; visibilityStatus: string; isPublished: boolean }) {
    const audit = makeAuditRow('merge')
    return { ...audit, snapshot_jsonb: { ...audit.snapshot_jsonb, targetStatusBefore: before } }
  }

  function mockUnmergeTransaction() {
    const mockClient = makeMockClient()
    const mockPool = makeMockPool(mockClient)
    const svc = new VideoMergesService(mockPool)
    vi.mocked(mutations.restoreVideos).mockResolvedValueOnce()
    vi.mocked(mutations.reassignSourcesToOriginal).mockResolvedValueOnce()
    vi.mocked(mutations.markAuditReverted).mockResolvedValueOnce()
    return { mockClient, mockPool, svc }
  }

  it('存量 audit 无 targetStatusBefore → 不查 video、不调状态机、响应无 statusTransition（旧行为逐值一致）', async () => {
    const { svc } = mockUnmergeTransaction()
    vi.mocked(mutations.fetchAuditById).mockResolvedValueOnce(makeAuditRow('merge'))

    const result = await svc.unmerge(AUDIT_ID, ACTOR_ID)

    expect('statusTransition' in result).toBe(false)
    expect(videosMutations.transitionVideoState).not.toHaveBeenCalled()
    // restore 路径未触发（fetchVideosByIds 仅 restore 反查 current 时调用）
    expect(mutations.fetchVideosByIds).not.toHaveBeenCalled()
  })

  it('applied：含 targetStatusBefore（approved|internal）+ 合并后 target=approved|public → unpublish 还原', async () => {
    const { mockPool, svc } = mockUnmergeTransaction()
    vi.mocked(mutations.fetchAuditById).mockResolvedValueOnce(
      makeAuditWithBefore({ reviewStatus: 'approved', visibilityStatus: 'internal', isPublished: false }),
    )
    // restore 反查 current：合并时 publish 后形态
    vi.mocked(mutations.fetchVideosByIds).mockResolvedValueOnce([
      makeVideoRow(TARGET_ID, null, { review: 'approved', visibility: 'public', isPublished: true }),
    ])
    vi.mocked(videosMutations.transitionVideoState).mockResolvedValueOnce({
      id: TARGET_ID,
      review_status: 'approved',
      visibility_status: 'internal',
      is_published: false,
      updated_at: '2026-06-04T00:00:00Z',
    })

    const result = await svc.unmerge(AUDIT_ID, ACTOR_ID, '撤销合并')

    expect(result.statusTransition).toBe('applied')
    expect(videosMutations.transitionVideoState).toHaveBeenCalledExactlyOnceWith(
      mockPool, TARGET_ID,
      { action: 'unpublish', reviewedBy: ACTOR_ID, reason: '撤销合并' },
    )
  })

  it('skipped：current == targetStatusBefore（合并后状态被人工改回）→ 不调状态机', async () => {
    const { svc } = mockUnmergeTransaction()
    vi.mocked(mutations.fetchAuditById).mockResolvedValueOnce(
      makeAuditWithBefore({ reviewStatus: 'pending_review', visibilityStatus: 'internal', isPublished: false }),
    )
    vi.mocked(mutations.fetchVideosByIds).mockResolvedValueOnce([
      makeVideoRow(TARGET_ID),  // 默认 pending|internal|0 == before
    ])

    const result = await svc.unmerge(AUDIT_ID, ACTOR_ID)

    expect(result.statusTransition).toBe('skipped')
    expect(videosMutations.transitionVideoState).not.toHaveBeenCalled()
  })

  it('failed：还原无单步回路（approved|public → pending|internal，approve_and_publish 反向）→ unmerge 本体不受影响（已知边界）', async () => {
    const { mockClient, svc } = mockUnmergeTransaction()
    vi.mocked(mutations.fetchAuditById).mockResolvedValueOnce(
      makeAuditWithBefore({ reviewStatus: 'pending_review', visibilityStatus: 'internal', isPublished: false }),
    )
    vi.mocked(mutations.fetchVideosByIds).mockResolvedValueOnce([
      makeVideoRow(TARGET_ID, null, { review: 'approved', visibility: 'public', isPublished: true }),
    ])

    const result = await svc.unmerge(AUDIT_ID, ACTOR_ID)

    // 矩阵无 approved|public → pending|internal 单步路径（须先 unpublish 两步 / M-SN-4 D-01）
    // → 如实 failed 人工兜底（D-105-11 非原子声明；两步还原须回 ADR 另行定档）
    expect(result.statusTransition).toBe('failed')
    expect(result.restoredVideoIds).toEqual([SOURCE_ID_1, SOURCE_ID_2])
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT')
    expect(videosMutations.transitionVideoState).not.toHaveBeenCalled()
  })
})

// ── unmerge 去重行复活（ADR-105 AMENDMENT 2026-06-05 D-105-14 / CHG-MERGE-DEDUP-EP）──

describe('VideoMergesService.unmerge — dedupedSourceIds 复活（D-105-14）', () => {
  it('snapshot 含 dedupedSourceIds → reassign 后 restoreSourcesByIds 复活（先归还后复活时序）', async () => {
    const mockClient = makeMockClient()
    const mockPool = makeMockPool(mockClient)
    const svc = new VideoMergesService(mockPool)

    const audit = makeAuditRow('merge')
    const auditWithDeduped = {
      ...audit,
      snapshot_jsonb: { ...audit.snapshot_jsonb, dedupedSourceIds: [SRC_1, SRC_3] },
    }
    vi.mocked(mutations.fetchAuditById).mockResolvedValueOnce(auditWithDeduped)

    await svc.unmerge(AUDIT_ID, ACTOR_ID)

    expect(mutations.restoreSourcesByIds).toHaveBeenCalledWith(mockClient, [SRC_1, SRC_3])
    // 时序：reassignSourcesToOriginal 先于复活（避免瞬时撞 target 槽位 / 评审确认）
    const reassignOrder = vi.mocked(mutations.reassignSourcesToOriginal).mock.invocationCallOrder[0]!
    const restoreOrder = vi.mocked(mutations.restoreSourcesByIds).mock.invocationCallOrder[0]!
    expect(reassignOrder).toBeLessThan(restoreOrder)
  })

  it('存量 audit 无 dedupedSourceIds → 空数组调用（函数内早退零行为变更 / R-105-D3）', async () => {
    const mockClient = makeMockClient()
    const mockPool = makeMockPool(mockClient)
    const svc = new VideoMergesService(mockPool)
    vi.mocked(mutations.fetchAuditById).mockResolvedValueOnce(makeAuditRow('merge'))

    await svc.unmerge(AUDIT_ID, ACTOR_ID)

    expect(mutations.restoreSourcesByIds).toHaveBeenCalledWith(mockClient, [])
  })

  it('split audit 含 dedupedSourceIds（拆到已有转入去重）→ 同恢复', async () => {
    const mockClient = makeMockClient()
    const mockPool = makeMockPool(mockClient)
    const svc = new VideoMergesService(mockPool)

    const audit = makeAuditRow('split')
    const auditWithDeduped = {
      ...audit,
      snapshot_jsonb: { ...audit.snapshot_jsonb, dedupedSourceIds: [SRC_2] },
    }
    vi.mocked(mutations.fetchAuditById).mockResolvedValueOnce(auditWithDeduped)

    await svc.unmerge(AUDIT_ID, ACTOR_ID)

    expect(mutations.restoreSourcesByIds).toHaveBeenCalledWith(mockClient, [SRC_2])
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

  // ── targetStatus（ADR-105 AMENDMENT 2026-06-04 D-105-9 / CHG-VIR-13-D1）──

  it('targetStatus 合法（单维 / 双维）→ 通过', () => {
    const single = MergeSchema.parse({
      sourceVideoIds: [SOURCE_ID_1],
      targetVideoId: TARGET_ID,
      targetStatus: { visibilityStatus: 'public' },
    })
    expect(single.targetStatus).toEqual({ visibilityStatus: 'public' })

    const both = MergeSchema.parse({
      sourceVideoIds: [SOURCE_ID_1],
      targetVideoId: TARGET_ID,
      targetStatus: { reviewStatus: 'approved', visibilityStatus: 'public' },
    })
    expect(both.targetStatus).toEqual({ reviewStatus: 'approved', visibilityStatus: 'public' })
  })

  it('targetStatus 空对象（双缺省无语义）→ 报错', () => {
    expect(() => MergeSchema.parse({
      sourceVideoIds: [SOURCE_ID_1],
      targetVideoId: TARGET_ID,
      targetStatus: {},
    })).toThrow()
  })

  it('targetStatus 枚举外值 → 报错', () => {
    expect(() => MergeSchema.parse({
      sourceVideoIds: [SOURCE_ID_1],
      targetVideoId: TARGET_ID,
      targetStatus: { reviewStatus: 'published' },
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

  // ── ADR-105 AMENDMENT 2026-06-03 D-105-2（CHG-VIR-11-B）：targetVideoId xor newVideoMeta ──

  it('targetVideoId 组合法（混合新建+已有）', () => {
    const result = SplitSchema.parse({
      groups: [
        { sourceIds: [SRC_1], newVideoMeta: { title: 'A', type: 'movie' } },
        { sourceIds: [SRC_2], targetVideoId: TARGET_ID },
      ],
    })
    expect(result.groups[1]!.targetVideoId).toBe(TARGET_ID)
    expect(result.groups[1]!.newVideoMeta).toBeUndefined()
  })

  it('全组 targetVideoId（0 新建）合法（Y-A1）', () => {
    expect(() => SplitSchema.parse({
      groups: [
        { sourceIds: [SRC_1], targetVideoId: TARGET_ID },
        { sourceIds: [SRC_2], targetVideoId: SOURCE_ID_1 },
      ],
    })).not.toThrow()
  })

  it('newVideoMeta 与 targetVideoId 同时提供 → 报错（xor）', () => {
    expect(() => SplitSchema.parse({
      groups: [
        { sourceIds: [SRC_1], newVideoMeta: { title: 'A', type: 'movie' }, targetVideoId: TARGET_ID },
        { sourceIds: [SRC_2], newVideoMeta: { title: 'B', type: 'movie' } },
      ],
    })).toThrow(/恰好提供其一/)
  })

  it('二者均缺 → 报错（xor）', () => {
    expect(() => SplitSchema.parse({
      groups: [
        { sourceIds: [SRC_1] },
        { sourceIds: [SRC_2], newVideoMeta: { title: 'B', type: 'movie' } },
      ],
    })).toThrow(/恰好提供其一/)
  })

  it('组间 targetVideoId 重复 → 报错', () => {
    expect(() => SplitSchema.parse({
      groups: [
        { sourceIds: [SRC_1], targetVideoId: TARGET_ID },
        { sourceIds: [SRC_2], targetVideoId: TARGET_ID },
      ],
    })).toThrow(/不得重复/)
  })

  it('targetVideoId 非 uuid → 报错', () => {
    expect(() => SplitSchema.parse({
      groups: [
        { sourceIds: [SRC_1], targetVideoId: 'not-a-uuid' },
        { sourceIds: [SRC_2], newVideoMeta: { title: 'B', type: 'movie' } },
      ],
    })).toThrow()
  })

  // ── newVideoMeta.status（ADR-105 AMENDMENT 2026-06-04 D-105-9 / CHG-VIR-13-D1）──

  it('newVideoMeta.status 合法 → 通过；targetVideoId 组结构上不可携带（R-105-T5 互斥）', () => {
    const result = SplitSchema.parse({
      groups: [
        { sourceIds: [SRC_1], newVideoMeta: { title: 'A', type: 'movie', status: { reviewStatus: 'approved' } } },
        { sourceIds: [SRC_2], targetVideoId: TARGET_ID },
      ],
    })
    expect(result.groups[0]!.newVideoMeta!.status).toEqual({ reviewStatus: 'approved' })
    // status 仅存在于 newVideoMeta 内部 → targetVideoId 组无 newVideoMeta 即无 status 载体
    expect(result.groups[1]!.newVideoMeta).toBeUndefined()
  })

  it('newVideoMeta.status 空对象 / 枚举外值 → 报错', () => {
    expect(() => SplitSchema.parse({
      groups: [
        { sourceIds: [SRC_1], newVideoMeta: { title: 'A', type: 'movie', status: {} } },
        { sourceIds: [SRC_2], newVideoMeta: { title: 'B', type: 'movie' } },
      ],
    })).toThrow()
    expect(() => SplitSchema.parse({
      groups: [
        { sourceIds: [SRC_1], newVideoMeta: { title: 'A', type: 'movie', status: { visibilityStatus: 'visible' } } },
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

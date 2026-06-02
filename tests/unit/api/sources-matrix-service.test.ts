/**
 * sources-matrix-service.test.ts — SourcesMatrixService 单元测试
 * （ADR-117 / CHG-SN-5-11-PATCH-2）
 *
 * 覆盖：
 *   - aggregateSignal: 5 路径（empty → pending / 全 ok → ok / 全 dead → dead / 含 ok/partial → partial / 其他 → pending）
 *   - listVideoGroups: queries 返回 raw 状态数组 → Service 派生 probeStatus/renderStatus 聚合（P0-2 业务归口）
 *   - getVideoMatrix: video 不存在 → AppError NOT_FOUND 404（D-117-9）
 *   - upsertLineAlias: happy path + audit payload 内容显式断言（R-MID-1 教训：beforeJsonb / afterJsonb 字段内容必须断言）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SourcesMatrixService } from '@/api/services/SourcesMatrixService'
// CHG-VSR-3 Codex review FIX：aggregateSignal 拆至 sources-matrix.schemas.ts（Service 解 500 行硬限）
import { aggregateSignal } from '@/api/services/sources-matrix.schemas'

// ── mock DB 查询 ───────────────────────────────────────────────────

// CHG-VSR-3 / ADR-117 AMENDMENT 3（D-117-VSR3-7 方案 A）：queries 拆 4 文件，vi.mock 按符号物理位置分路径
vi.mock('@/api/db/queries/sources-matrix', () => ({
  listVideoGroups: vi.fn(),
  getVideoGroupStats: vi.fn(),
}))

vi.mock('@/api/db/queries/video-matrix', () => ({
  getVideoMatrix: vi.fn(),
}))

vi.mock('@/api/db/queries/source-line-aliases', () => ({
  listLineAliases: vi.fn(),
  upsertLineAlias: vi.fn(),
  findLineAlias: vi.fn(),
}))

vi.mock('@/api/db/queries/video-merge-mutations', () => ({
  fetchVideosByIds: vi.fn(),
}))

vi.mock('@/api/services/AuditLogService', () => ({
  AuditLogService: vi.fn().mockImplementation(() => ({
    write: vi.fn(),
  })),
}))

import * as queries from '@/api/db/queries/sources-matrix'
import * as videoMatrixQueries from '@/api/db/queries/video-matrix'
import * as aliasQueries from '@/api/db/queries/source-line-aliases'
import * as mergeMutations from '@/api/db/queries/video-merge-mutations'
import { AuditLogService } from '@/api/services/AuditLogService'

const mockPool = {} as unknown as import('pg').Pool

beforeEach(() => {
  vi.clearAllMocks()
})

// ── aggregateSignal ──────────────────────────────────────────────

describe('aggregateSignal', () => {
  it('空数组 → pending', () => {
    expect(aggregateSignal([])).toBe('pending')
  })

  it('全 ok → ok', () => {
    expect(aggregateSignal(['ok', 'ok', 'ok'])).toBe('ok')
  })

  it('全 dead → dead', () => {
    expect(aggregateSignal(['dead', 'dead'])).toBe('dead')
  })

  it('含 partial → partial', () => {
    expect(aggregateSignal(['ok', 'partial', 'dead'])).toBe('partial')
  })

  it('含 ok（不全） → partial', () => {
    expect(aggregateSignal(['ok', 'dead'])).toBe('partial')
  })

  it('全 pending → pending', () => {
    expect(aggregateSignal(['pending', 'pending'])).toBe('pending')
  })
})

// ── SourcesMatrixService.listVideoGroups ─────────────────────────

describe('SourcesMatrixService.listVideoGroups', () => {
  it('queries 返回 raw → Service map probeStatus/renderStatus 聚合（P0-2）', async () => {
    vi.mocked(queries.listVideoGroups).mockResolvedValueOnce({
      data: [{
        videoId: 'v1',
        title: 't',
        shortId: 'abc',
        type: 'movie',
        year: 2024,
        coverUrl: null,
        lineCount: 2,
        sourceCount: 4,
        probeStatuses: ['ok', 'dead'],   // mixed → partial
        renderStatuses: ['ok', 'ok'],    // all ok → ok
        updatedAt: '2026-01-01T00:00:00Z',
        // HOTFIX-PATCH-2B-FIX1（2026-05-25）：siteKeys 透传 raw → public（Service 不派生 / 直接转）
        siteKeys: ['bilibili', 'youku'],
      }],
      total: 1,
      page: 1,
      limit: 20,
    })
    const svc = new SourcesMatrixService(mockPool)
    const result = await svc.listVideoGroups({})
    expect(result.data[0]?.probeStatus).toBe('partial')
    expect(result.data[0]?.renderStatus).toBe('ok')
    expect(result.data[0]?.siteKeys).toEqual(['bilibili', 'youku'])
    expect(result.total).toBe(1)
  })

  it('queries 空数据 → Service 空结果', async () => {
    vi.mocked(queries.listVideoGroups).mockResolvedValueOnce({
      data: [], total: 0, page: 1, limit: 20,
    })
    const svc = new SourcesMatrixService(mockPool)
    const result = await svc.listVideoGroups({})
    expect(result.data).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('CHG-VSR-3：派生列双层透传（raw → Service map 显式枚举，非 spread）', async () => {
    vi.mocked(queries.listVideoGroups).mockResolvedValueOnce({
      data: [{
        videoId: 'v1', title: 't', shortId: 'abc', type: 'movie', year: 2024, coverUrl: null,
        lineCount: 2, sourceCount: 5,
        probeStatuses: ['ok'], renderStatuses: ['ok'],
        updatedAt: '2026-01-01T00:00:00Z', siteKeys: ['bilibili'],
        activeSourceCount: 3, disabledCount: 2, connectFailCount: 1, renderFailCount: 0,
        pendingProbeCount: 1, qualityHighest: '1080P', qualityCoverage: 0.8,
        latencyMedianMs: 150, needsSource: false, isPublished: true, lastCheckedAt: '2026-01-02T00:00:00Z',
      }],
      total: 1, page: 1, limit: 20,
    })
    const svc = new SourcesMatrixService(mockPool)
    const r = (await svc.listVideoGroups({})).data[0]
    expect(r?.activeSourceCount).toBe(3)
    expect(r?.disabledCount).toBe(2)
    expect(r?.connectFailCount).toBe(1)
    expect(r?.renderFailCount).toBe(0)
    expect(r?.pendingProbeCount).toBe(1)
    expect(r?.qualityHighest).toBe('1080P')
    expect(r?.qualityCoverage).toBe(0.8)
    expect(r?.latencyMedianMs).toBe(150)
    expect(r?.needsSource).toBe(false)
    expect(r?.isPublished).toBe(true)
    expect(r?.lastCheckedAt).toBe('2026-01-02T00:00:00Z')
  })
})

// ── SourcesMatrixService.getVideoMatrix ──────────────────────────

describe('SourcesMatrixService.getVideoMatrix', () => {
  it('happy path：video 存在 → 返回 lines', async () => {
    vi.mocked(mergeMutations.fetchVideosByIds).mockResolvedValueOnce([
      { id: 'v1', deleted_at: null } as never,
    ])
    vi.mocked(videoMatrixQueries.getVideoMatrix).mockResolvedValueOnce([])
    const svc = new SourcesMatrixService(mockPool)
    const lines = await svc.getVideoMatrix('v1')
    expect(lines).toEqual([])
    expect(videoMatrixQueries.getVideoMatrix).toHaveBeenCalledWith(mockPool, 'v1')
  })

  it('NOT_FOUND：video 不存在 → AppError 404（D-117-9）', async () => {
    vi.mocked(mergeMutations.fetchVideosByIds).mockResolvedValueOnce([])
    const svc = new SourcesMatrixService(mockPool)
    await expect(svc.getVideoMatrix('nonexistent')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      httpStatus: 404,
      message: expect.stringContaining('不存在'),
    })
    expect(videoMatrixQueries.getVideoMatrix).not.toHaveBeenCalled()
  })

  it('NOT_FOUND：video 已软删除 → AppError 404（D-117-9）', async () => {
    vi.mocked(mergeMutations.fetchVideosByIds).mockResolvedValueOnce([
      { id: 'v1', deleted_at: '2026-04-01T00:00:00Z' } as never,
    ])
    const svc = new SourcesMatrixService(mockPool)
    await expect(svc.getVideoMatrix('v1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      httpStatus: 404,
    })
  })
})

// ── SourcesMatrixService.upsertLineAlias（含 audit payload 内容断言 R-MID-1）─

describe('SourcesMatrixService.upsertLineAlias', () => {
  const ALIAS_AFTER = {
    sourceSiteKey: 'bilibili',
    sourceName: '线路1',
    displayName: '哔哩哔哩主线',
    updatedAt: '2026-05-13T00:00:00Z',
  }
  const ACTOR_ID = '00000000-0000-0000-0000-000000000001'

  it('INSERT 路径：beforeJsonb=null + afterJsonb 含新值（audit payload 内容显式断言 R-MID-1）', async () => {
    vi.mocked(aliasQueries.findLineAlias).mockResolvedValueOnce(null)
    vi.mocked(aliasQueries.upsertLineAlias).mockResolvedValueOnce(ALIAS_AFTER)
    const svc = new SourcesMatrixService(mockPool)
    const auditSvcInstance = (AuditLogService as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value

    const result = await svc.upsertLineAlias('bilibili', '线路1', '哔哩哔哩主线', ACTOR_ID, 'req-123')

    expect(result).toEqual(ALIAS_AFTER)

    // R-MID-1 教训：audit payload 字段内容必须显式断言
    expect(auditSvcInstance.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: ACTOR_ID,
      actionType: 'source_line_alias.upsert',
      targetKind: 'source_line_alias',
      targetId: 'bilibili/线路1',
      beforeJsonb: null,
      afterJsonb: expect.objectContaining({
        sourceSiteKey: 'bilibili',
        sourceName: '线路1',
        displayName: '哔哩哔哩主线',
      }),
      requestId: 'req-123',
    }))
  })

  it('UPDATE 路径：beforeJsonb=既有别名 + afterJsonb=新值（audit payload 内容显式断言 R-MID-1）', async () => {
    const ALIAS_BEFORE = {
      sourceSiteKey: 'bilibili',
      sourceName: '线路1',
      displayName: '旧别名',
      updatedAt: '2026-05-01T00:00:00Z',
    }
    vi.mocked(aliasQueries.findLineAlias).mockResolvedValueOnce(ALIAS_BEFORE)
    vi.mocked(aliasQueries.upsertLineAlias).mockResolvedValueOnce(ALIAS_AFTER)
    const svc = new SourcesMatrixService(mockPool)
    const auditSvcInstance = (AuditLogService as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value

    await svc.upsertLineAlias('bilibili', '线路1', '哔哩哔哩主线', ACTOR_ID)

    expect(auditSvcInstance.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: ACTOR_ID,
      actionType: 'source_line_alias.upsert',
      targetKind: 'source_line_alias',
      targetId: 'bilibili/线路1',
      beforeJsonb: expect.objectContaining({ displayName: '旧别名' }),
      afterJsonb: expect.objectContaining({ displayName: '哔哩哔哩主线' }),
      requestId: null,
    }))
  })

  it('targetId 是复合键 ${siteKey}/${sourceName}（ADR-117 §audit log 协议）', async () => {
    vi.mocked(aliasQueries.findLineAlias).mockResolvedValueOnce(null)
    vi.mocked(aliasQueries.upsertLineAlias).mockResolvedValueOnce(ALIAS_AFTER)
    const svc = new SourcesMatrixService(mockPool)
    const auditSvcInstance = (AuditLogService as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value

    await svc.upsertLineAlias('youku', '主线', 'YouKu Main', ACTOR_ID)

    expect(auditSvcInstance.write).toHaveBeenCalledWith(expect.objectContaining({
      targetId: 'youku/主线',
    }))
  })
})

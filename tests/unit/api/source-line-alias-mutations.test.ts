/**
 * source-line-alias-mutations.test.ts — CHG-368-B-A2a / ADR-164 §5.7
 *
 * 覆盖：
 *   - SourcesMatrixService.retireLineAlias: 404 / 409 已退役 / happy path
 *   - SourcesMatrixService.updateLineAliasPriority: 404 / happy path
 *   - SourcesMatrixService.getCodenamePool: occupied / cooling / available 三段分类
 *   - SourcesMatrixService.upsertLineAliasWithFields: 调 queries upsertLineAliasFull
 *
 * 不覆盖（→ -A2b）：route 端点 + audit RETRO payload 内容断言（route 层一体提交）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/db/queries/sources-matrix', () => ({
  listVideoGroups: vi.fn(),
  getVideoGroupStats: vi.fn(),
  getVideoMatrix: vi.fn(),
  listLineAliases: vi.fn(),
  upsertLineAlias: vi.fn(),
  upsertLineAliasFull: vi.fn(),
  retireLineAlias: vi.fn(),
  updateLineAliasPriority: vi.fn(),
  findCodenameAssignments: vi.fn(),
  findLineAlias: vi.fn(),
  listRoutesBySite: vi.fn(),
  selectRouteSampleSource: vi.fn(),
  countRouteSources: vi.fn(),
  softDeleteRouteBySite: vi.fn(),
}))

vi.mock('@/api/db/queries/video-merge-mutations', () => ({
  fetchVideosByIds: vi.fn(),
}))

vi.mock('@/api/services/AuditLogService', () => ({
  AuditLogService: vi.fn().mockImplementation(() => ({
    write: vi.fn(),
  })),
}))

import { SourcesMatrixService } from '@/api/services/SourcesMatrixService'
import * as queries from '@/api/db/queries/sources-matrix'
import { MOUNTAIN_CODENAMES } from '@resovo/types'
import { AppError } from '@/api/lib/errors'

const mockPool = {} as unknown as import('pg').Pool
const ACTOR_ID = '00000000-0000-0000-0000-000000000001'

const SAMPLE_ALIAS = {
  sourceSiteKey: 'bilibili',
  sourceName: '线路1',
  displayName: '哔哩哔哩主线',
  codename: '泰山',
  priority: 50,
  retiredAt: null,
  autoRetired: false,
  updatedAt: '2026-05-28T00:00:00Z',
} as const

beforeEach(() => {
  vi.clearAllMocks()
})

// ── retireLineAlias ──────────────────────────────────────────────

describe('SourcesMatrixService.retireLineAlias', () => {
  it('404：行不存在 → AppError NOT_FOUND', async () => {
    vi.mocked(queries.findLineAlias).mockResolvedValueOnce(null)
    const svc = new SourcesMatrixService(mockPool)
    await expect(svc.retireLineAlias('bilibili', '线路1', {}, ACTOR_ID)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      httpStatus: 404,
    })
    expect(queries.retireLineAlias).not.toHaveBeenCalled()
  })

  it('409：已退役行 → AppError STATE_CONFLICT', async () => {
    vi.mocked(queries.findLineAlias).mockResolvedValueOnce({
      ...SAMPLE_ALIAS,
      retiredAt: '2026-05-01T00:00:00Z',
    })
    const svc = new SourcesMatrixService(mockPool)
    await expect(svc.retireLineAlias('bilibili', '线路1', {}, ACTOR_ID)).rejects.toMatchObject({
      code: 'STATE_CONFLICT',
      httpStatus: 409,
    })
    expect(queries.retireLineAlias).not.toHaveBeenCalled()
  })

  it('happy path：成功退役 → 返回新行 retiredAt 非 NULL', async () => {
    vi.mocked(queries.findLineAlias).mockResolvedValueOnce(SAMPLE_ALIAS)
    vi.mocked(queries.retireLineAlias).mockResolvedValueOnce({
      ...SAMPLE_ALIAS,
      retiredAt: '2026-05-28T00:00:00Z',
    })
    const svc = new SourcesMatrixService(mockPool)
    const result = await svc.retireLineAlias('bilibili', '线路1', {}, ACTOR_ID)
    expect(result.retiredAt).toBe('2026-05-28T00:00:00Z')
    expect(queries.retireLineAlias).toHaveBeenCalledWith(mockPool, 'bilibili', '线路1')
  })

  it('并发竞态：before fetch 在役 + UPDATE rowCount=0 → STATE_CONFLICT', async () => {
    vi.mocked(queries.findLineAlias).mockResolvedValueOnce(SAMPLE_ALIAS)
    vi.mocked(queries.retireLineAlias).mockResolvedValueOnce(null)
    const svc = new SourcesMatrixService(mockPool)
    await expect(svc.retireLineAlias('bilibili', '线路1', {}, ACTOR_ID)).rejects.toMatchObject({
      code: 'STATE_CONFLICT',
      httpStatus: 409,
    })
  })
})

// ── updateLineAliasPriority ──────────────────────────────────────

describe('SourcesMatrixService.updateLineAliasPriority', () => {
  it('404：行不存在 → AppError NOT_FOUND', async () => {
    vi.mocked(queries.updateLineAliasPriority).mockResolvedValueOnce(null)
    const svc = new SourcesMatrixService(mockPool)
    await expect(svc.updateLineAliasPriority('bilibili', '线路1', 80, ACTOR_ID)).rejects.toBeInstanceOf(AppError)
  })

  it('happy path：返回新 priority', async () => {
    vi.mocked(queries.updateLineAliasPriority).mockResolvedValueOnce({
      ...SAMPLE_ALIAS,
      priority: 80,
    })
    const svc = new SourcesMatrixService(mockPool)
    const result = await svc.updateLineAliasPriority('bilibili', '线路1', 80, ACTOR_ID)
    expect(result.priority).toBe(80)
    expect(queries.updateLineAliasPriority).toHaveBeenCalledWith(mockPool, 'bilibili', '线路1', 80)
  })
})

// ── getCodenamePool ──────────────────────────────────────────────

describe('SourcesMatrixService.getCodenamePool', () => {
  it('空 assignments → available = MOUNTAIN_CODENAMES 全集 / occupied + cooling 空', async () => {
    vi.mocked(queries.findCodenameAssignments).mockResolvedValueOnce([])
    const svc = new SourcesMatrixService(mockPool)
    const pool = await svc.getCodenamePool()
    expect(pool.available).toEqual(MOUNTAIN_CODENAMES)
    expect(pool.occupied).toEqual([])
    expect(pool.cooling).toEqual([])
  })

  it('在役行 codename → occupied / 不出现在 available', async () => {
    vi.mocked(queries.findCodenameAssignments).mockResolvedValueOnce([
      { codename: '泰山', retiredAt: null },
      { codename: '华山', retiredAt: null },
    ])
    const svc = new SourcesMatrixService(mockPool)
    const pool = await svc.getCodenamePool()
    expect(pool.occupied).toEqual(['华山', '泰山'])  // 字典序
    expect(pool.cooling).toEqual([])
    expect(pool.available).not.toContain('泰山')
    expect(pool.available).not.toContain('华山')
  })

  it('退役 < 90 天 → cooling / 不出现在 available', async () => {
    const recentRetired = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    vi.mocked(queries.findCodenameAssignments).mockResolvedValueOnce([
      { codename: '衡山', retiredAt: recentRetired },
    ])
    const svc = new SourcesMatrixService(mockPool)
    const pool = await svc.getCodenamePool()
    expect(pool.cooling).toEqual(['衡山'])
    expect(pool.available).not.toContain('衡山')
  })

  it('退役 > 90 天 → 既不 occupied 也不 cooling → 进 available', async () => {
    const oldRetired = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString()
    vi.mocked(queries.findCodenameAssignments).mockResolvedValueOnce([
      { codename: '嵩山', retiredAt: oldRetired },
    ])
    const svc = new SourcesMatrixService(mockPool)
    const pool = await svc.getCodenamePool()
    expect(pool.cooling).toEqual([])
    expect(pool.occupied).toEqual([])
    expect(pool.available).toContain('嵩山')
  })
})

// ── upsertLineAliasWithFields ────────────────────────────────────

describe('SourcesMatrixService.upsertLineAliasWithFields', () => {
  it('委派到 queries.upsertLineAliasFull 含 codename + priority', async () => {
    vi.mocked(queries.upsertLineAliasFull).mockResolvedValueOnce({
      ...SAMPLE_ALIAS,
      codename: '峨眉',
      priority: 80,
    })
    const svc = new SourcesMatrixService(mockPool)
    const result = await svc.upsertLineAliasWithFields(
      'bilibili', '线路1',
      { displayName: '哔哩哔哩主线', codename: '峨眉', priority: 80 },
      ACTOR_ID,
    )
    expect(result.codename).toBe('峨眉')
    expect(result.priority).toBe(80)
    expect(queries.upsertLineAliasFull).toHaveBeenCalledWith(
      mockPool, 'bilibili', '线路1',
      { displayName: '哔哩哔哩主线', codename: '峨眉', priority: 80 },
      ACTOR_ID,
    )
  })
})

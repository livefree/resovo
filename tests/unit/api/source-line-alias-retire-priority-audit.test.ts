/**
 * source-line-alias-retire-priority-audit.test.ts — CHG-368-B-A2b audit RETRO
 *
 * ADR-164 D-164-7 / R-MID-1 系统化第 29-30 次：验证
 *   - `source_line_alias.retire`     audit payload 内容断言（before/after + reason）
 *   - `source_line_alias.priority_update` audit payload 内容断言（before/after priority 字段）
 *
 * 覆盖：
 *   - retire：404 / 409 不写 audit / happy path 写 retire 且 afterJsonb 含 reason
 *   - priority_update：404 不写 / happy path 写 priority_update 且 before/after priority 不同
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// CHG-VSR-3 / ADR-117 AMENDMENT 3（D-117-VSR3-7 方案 A）：别名 CRUD 符号迁至 source-line-aliases.ts，mock 路径同步
vi.mock('@/api/db/queries/source-line-aliases', () => ({
  listLineAliases: vi.fn(),
  listAllSourceLines: vi.fn(),
  upsertLineAlias: vi.fn(),
  upsertLineAliasFull: vi.fn(),
  retireLineAlias: vi.fn(),
  updateLineAliasPriority: vi.fn(),
  findCodenameAssignments: vi.fn(),
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

import { SourcesMatrixService } from '@/api/services/SourcesMatrixService'
import * as queries from '@/api/db/queries/source-line-aliases'
import { AuditLogService } from '@/api/services/AuditLogService'

const mockPool = {} as unknown as import('pg').Pool
const ACTOR_ID = '00000000-0000-0000-0000-000000000001'

const BEFORE_ALIAS = {
  sourceSiteKey: 'bilibili',
  sourceName: '线路1',
  displayName: '哔哩哔哩主线',
  codename: '泰山',
  priority: 50,
  retiredAt: null,
  autoRetired: false,
  updatedAt: '2026-05-28T00:00:00Z',
} as const

const AFTER_RETIRED = {
  ...BEFORE_ALIAS,
  retiredAt: '2026-05-28T01:00:00Z',
} as const

beforeEach(() => {
  vi.clearAllMocks()
})

function getAuditWriteSpy() {
  const instance = (AuditLogService as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value
  return instance.write as ReturnType<typeof vi.fn>
}

// ── source_line_alias.retire ─────────────────────────────────────

describe('SourcesMatrixService.retireLineAlias audit (R-MID-1 第 29 次系统化)', () => {
  it('404 行不存在 → 不写 audit', async () => {
    vi.mocked(queries.findLineAlias).mockResolvedValueOnce(null)
    const svc = new SourcesMatrixService(mockPool)
    const writeSpy = getAuditWriteSpy()
    await expect(svc.retireLineAlias('bilibili', '线路1', {}, ACTOR_ID)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    expect(writeSpy).not.toHaveBeenCalled()
  })

  it('409 已退役 → 不写 audit', async () => {
    vi.mocked(queries.findLineAlias).mockResolvedValueOnce({
      ...BEFORE_ALIAS,
      retiredAt: '2026-04-01T00:00:00Z',
    })
    const svc = new SourcesMatrixService(mockPool)
    const writeSpy = getAuditWriteSpy()
    await expect(svc.retireLineAlias('bilibili', '线路1', {}, ACTOR_ID)).rejects.toMatchObject({
      code: 'STATE_CONFLICT',
    })
    expect(writeSpy).not.toHaveBeenCalled()
  })

  it('happy path → audit payload 含 actionType="source_line_alias.retire" + targetId + before/after + reason', async () => {
    vi.mocked(queries.findLineAlias).mockResolvedValueOnce(BEFORE_ALIAS)
    vi.mocked(queries.retireLineAlias).mockResolvedValueOnce(AFTER_RETIRED)
    const svc = new SourcesMatrixService(mockPool)
    const writeSpy = getAuditWriteSpy()
    await svc.retireLineAlias('bilibili', '线路1', { reason: '站点关停' }, ACTOR_ID, 'req-99')
    expect(writeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ACTOR_ID,
        actionType: 'source_line_alias.retire',
        targetKind: 'source_line_alias',
        targetId: 'bilibili/线路1',
        beforeJsonb: expect.objectContaining({
          sourceSiteKey: 'bilibili',
          codename: '泰山',
          retiredAt: null,
        }),
        afterJsonb: expect.objectContaining({
          sourceSiteKey: 'bilibili',
          retiredAt: '2026-05-28T01:00:00Z',
          reason: '站点关停',
        }),
        requestId: 'req-99',
      }),
    )
  })

  it('reason 未提供 → afterJsonb.reason = null', async () => {
    vi.mocked(queries.findLineAlias).mockResolvedValueOnce(BEFORE_ALIAS)
    vi.mocked(queries.retireLineAlias).mockResolvedValueOnce(AFTER_RETIRED)
    const svc = new SourcesMatrixService(mockPool)
    const writeSpy = getAuditWriteSpy()
    await svc.retireLineAlias('bilibili', '线路1', {}, ACTOR_ID)
    expect(writeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'source_line_alias.retire',
        afterJsonb: expect.objectContaining({ reason: null }),
      }),
    )
  })
})

// ── source_line_alias.priority_update ───────────────────────────

describe('SourcesMatrixService.updateLineAliasPriority audit (R-MID-1 第 30 次系统化)', () => {
  it('404 行不存在（before fetch null）→ 不写 audit', async () => {
    vi.mocked(queries.findLineAlias).mockResolvedValueOnce(null)
    const svc = new SourcesMatrixService(mockPool)
    const writeSpy = getAuditWriteSpy()
    await expect(svc.updateLineAliasPriority('bilibili', '线路1', 80, ACTOR_ID)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    expect(writeSpy).not.toHaveBeenCalled()
  })

  it('happy path → audit payload 含 actionType="source_line_alias.priority_update" + before/after priority 字段不同', async () => {
    vi.mocked(queries.findLineAlias).mockResolvedValueOnce(BEFORE_ALIAS)
    vi.mocked(queries.updateLineAliasPriority).mockResolvedValueOnce({
      ...BEFORE_ALIAS,
      priority: 80,
    })
    const svc = new SourcesMatrixService(mockPool)
    const writeSpy = getAuditWriteSpy()
    await svc.updateLineAliasPriority('bilibili', '线路1', 80, ACTOR_ID, 'req-123')
    expect(writeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ACTOR_ID,
        actionType: 'source_line_alias.priority_update',
        targetKind: 'source_line_alias',
        targetId: 'bilibili/线路1',
        beforeJsonb: expect.objectContaining({ priority: 50 }),
        afterJsonb: expect.objectContaining({ priority: 80 }),
        requestId: 'req-123',
      }),
    )
  })
})

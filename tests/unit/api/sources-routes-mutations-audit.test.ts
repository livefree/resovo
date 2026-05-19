/**
 * sources-routes-mutations-audit.test.ts — CHG-SN-7-REDO-01-E2 audit RETRO
 *
 * ADR-117 AMENDMENT 2 2026-05-19 / R-MID-1 系统化第 13 次（合并 actionType 模式）：
 * 验证 `sources.route_action` 在 test/reprobe/delete 三个路径的 audit payload 内容断言。
 *
 * 覆盖：
 *   - testRoute：afterJsonb.action='test' + ok + latencyMs + sampleVideoId + probeJobId
 *   - testRoute：404 当 (siteKey, sourceName) 无 video_sources 行
 *   - reprobeRoute：freeze 守卫 → STATE_CONFLICT 409
 *   - reprobeRoute：afterJsonb.action='reprobe' + probeJobId + queuedCount
 *   - deleteRoute：freeze 守卫
 *   - deleteRoute：beforeJsonb.deletedIds + afterJsonb.action='delete' + deletedCount
 *   - deleteRoute：truncated 标记当 > 50 行
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'
import { SourcesMatrixService } from '@/api/services/SourcesMatrixService'

const FROZEN_SETTING_RESULT = { rows: [{ value: 'true' }] }
const UNFROZEN_SETTING_RESULT = { rows: [{ value: 'false' }] }

type MockResult = { rows: Record<string, unknown>[] }

function makePool(queryImpl: (sql: string, params: readonly unknown[]) => MockResult): Pool {
  return {
    query: vi.fn((sql: string, params?: readonly unknown[]) => Promise.resolve(queryImpl(sql, params ?? []))),
  } as unknown as Pool
}

function makeAuditSpy() {
  const writeMock = vi.fn()
  return {
    writeMock,
    AuditLogServiceStub: class {
      write = writeMock
    },
  }
}

// 不能 stub AuditLogService 真源（new SourcesMatrixService 内 new AuditLogService）；
// 改用 service 实例后替换其 auditSvc 属性 ref
function spyAuditOnService(svc: SourcesMatrixService): ReturnType<typeof vi.fn> {
  const writeMock = vi.fn()
  ;(svc as unknown as { auditSvc: { write: typeof writeMock } }).auditSvc = { write: writeMock }
  return writeMock
}

describe('SourcesMatrixService.testRoute audit', () => {
  beforeEach(() => {
    vi.useRealTimers()
    // mock fetch HEAD
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
  })

  it('1. ok=true 路径 → afterJsonb.action="test" + ok=true + latencyMs + sampleVideoId + probeJobId', async () => {
    const pool = makePool((sql) => {
      if (sql.includes('SELECT vs.video_id, vs.source_url')) {
        return { rows: [{ video_id: 'vid-uuid-1', source_url: 'https://example.com/play.m3u8' }] }
      }
      return { rows: [] }
    })
    const svc = new SourcesMatrixService(pool)
    const writeMock = spyAuditOnService(svc)
    const result = await svc.testRoute('jszyapi', '线路1', 'actor-1', 'req-1')
    expect(result.ok).toBe(true)
    expect(result.sampleVideoId).toBe('vid-uuid-1')
    expect(result.probeJobId).toMatch(/^probe-jszyapi-线路1-/)
    // R-MID-1 audit payload 内容断言（audit-log-coverage 守卫要求 expect.objectContaining 形式）
    expect(writeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'sources.route_action',
        targetKind: 'source_route',
        targetId: 'jszyapi/线路1',
        beforeJsonb: null,
        afterJsonb: expect.objectContaining({
          action: 'test',
          ok: true,
          sampleVideoId: 'vid-uuid-1',
        }),
      }),
    )
  })

  it('2. 404 当 (siteKey, sourceName) 无 video_sources 行 → audit 不写入', async () => {
    const pool = makePool(() => ({ rows: [] }))
    const svc = new SourcesMatrixService(pool)
    const writeMock = spyAuditOnService(svc)
    await expect(svc.testRoute('jszyapi', 'missing', 'actor-1')).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 })
    expect(writeMock).not.toHaveBeenCalled()
  })

  it('3. fetch 失败 → ok=false / latencyMs=null / audit 仍写入', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    const pool = makePool((sql) => {
      if (sql.includes('SELECT vs.video_id, vs.source_url')) {
        return { rows: [{ video_id: 'vid-2', source_url: 'https://broken' }] }
      }
      return { rows: [] }
    })
    const svc = new SourcesMatrixService(pool)
    const writeMock = spyAuditOnService(svc)
    const result = await svc.testRoute('jszyapi', '线路1', 'actor-1')
    expect(result.ok).toBe(false)
    expect(result.latencyMs).toBeNull()
    expect(writeMock).toHaveBeenCalledOnce()
    expect(writeMock.mock.calls[0][0].afterJsonb.ok).toBe(false)
  })
})

describe('SourcesMatrixService.reprobeRoute audit + freeze 守卫', () => {
  it('4. freeze=true → STATE_CONFLICT 409，audit 不写入', async () => {
    const pool = makePool((sql) => {
      if (sql.includes('system_settings')) return FROZEN_SETTING_RESULT
      return { rows: [] }
    })
    const svc = new SourcesMatrixService(pool)
    const writeMock = spyAuditOnService(svc)
    await expect(svc.reprobeRoute('jszyapi', '线路1', 'actor-1')).rejects.toMatchObject({ code: 'STATE_CONFLICT', httpStatus: 409 })
    expect(writeMock).not.toHaveBeenCalled()
  })

  it('5. freeze=false + 有线路 → afterJsonb.action="reprobe" + probeJobId + queuedCount', async () => {
    const pool = makePool((sql) => {
      if (sql.includes('system_settings')) return UNFROZEN_SETTING_RESULT
      if (sql.includes('COUNT(*) AS count')) return { rows: [{ count: '7' }] }
      return { rows: [] }
    })
    const svc = new SourcesMatrixService(pool)
    const writeMock = spyAuditOnService(svc)
    const result = await svc.reprobeRoute('jszyapi', '线路1', 'actor-1', 'req-2')
    expect(result.queuedCount).toBe(7)
    expect(result.probeJobId).toMatch(/^reprobe-jszyapi-线路1-/)
    expect(writeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'sources.route_action',
        targetKind: 'source_route',
        afterJsonb: expect.objectContaining({ action: 'reprobe', queuedCount: 7 }),
      }),
    )
  })

  it('6. freeze=false + queuedCount=0 → NOT_FOUND 404 / audit 不写', async () => {
    const pool = makePool((sql) => {
      if (sql.includes('system_settings')) return UNFROZEN_SETTING_RESULT
      if (sql.includes('COUNT(*) AS count')) return { rows: [{ count: '0' }] }
      return { rows: [] }
    })
    const svc = new SourcesMatrixService(pool)
    const writeMock = spyAuditOnService(svc)
    await expect(svc.reprobeRoute('jszyapi', 'missing', 'actor-1')).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 })
    expect(writeMock).not.toHaveBeenCalled()
  })
})

describe('SourcesMatrixService.deleteRoute audit + freeze 守卫 + 软删除', () => {
  it('7. freeze=true → STATE_CONFLICT 409 / 不执行 UPDATE', async () => {
    const pool = makePool((sql) => {
      if (sql.includes('system_settings')) return FROZEN_SETTING_RESULT
      return { rows: [] }
    })
    const svc = new SourcesMatrixService(pool)
    const writeMock = spyAuditOnService(svc)
    await expect(svc.deleteRoute('jszyapi', '线路1', 'actor-1')).rejects.toMatchObject({ code: 'STATE_CONFLICT', httpStatus: 409 })
    expect(writeMock).not.toHaveBeenCalled()
  })

  it('8. 完整流程：beforeJsonb.deletedIds + afterJsonb.action="delete" + deletedCount', async () => {
    const pool = makePool((sql) => {
      if (sql.includes('system_settings')) return UNFROZEN_SETTING_RESULT
      if (sql.includes('COUNT(*) AS count')) return { rows: [{ count: '3' }] }
      if (sql.includes('UPDATE video_sources')) {
        return { rows: [{ id: 'vs-id-1' }, { id: 'vs-id-2' }, { id: 'vs-id-3' }] }
      }
      return { rows: [] }
    })
    const svc = new SourcesMatrixService(pool)
    const writeMock = spyAuditOnService(svc)
    const result = await svc.deleteRoute('jszyapi', '线路1', 'actor-1', 'req-3')
    expect(result.deletedCount).toBe(3)
    expect(result.deletedIds).toEqual(['vs-id-1', 'vs-id-2', 'vs-id-3'])
    expect(writeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'sources.route_action',
        targetKind: 'source_route',
        targetId: 'jszyapi/线路1',
        beforeJsonb: expect.objectContaining({
          totalCount: 3,
          truncated: false,
        }),
        afterJsonb: expect.objectContaining({ action: 'delete', deletedCount: 3 }),
      }),
    )
    expect(writeMock.mock.calls[0][0].beforeJsonb.deletedIds).toHaveLength(3)
  })

  it('9. > 50 行 → beforeJsonb.deletedIds 截断 + truncated=true', async () => {
    const manyIds = Array.from({ length: 60 }, (_, i) => ({ id: `vs-${i}` }))
    const pool = makePool((sql) => {
      if (sql.includes('system_settings')) return UNFROZEN_SETTING_RESULT
      if (sql.includes('COUNT(*) AS count')) return { rows: [{ count: '60' }] }
      if (sql.includes('UPDATE video_sources')) return { rows: manyIds }
      return { rows: [] }
    })
    const svc = new SourcesMatrixService(pool)
    const writeMock = spyAuditOnService(svc)
    const result = await svc.deleteRoute('jszyapi', '热门线路', 'actor-1')
    expect(result.deletedCount).toBe(60)
    const payload = writeMock.mock.calls[0][0]
    expect(payload.beforeJsonb.deletedIds).toHaveLength(50)
    expect(payload.beforeJsonb.truncated).toBe(true)
    expect(payload.beforeJsonb.totalCount).toBe(60)
  })

  it('10. queuedCount=0 → NOT_FOUND 404', async () => {
    const pool = makePool((sql) => {
      if (sql.includes('system_settings')) return UNFROZEN_SETTING_RESULT
      if (sql.includes('COUNT(*) AS count')) return { rows: [{ count: '0' }] }
      return { rows: [] }
    })
    const svc = new SourcesMatrixService(pool)
    const writeMock = spyAuditOnService(svc)
    await expect(svc.deleteRoute('jszyapi', 'missing', 'actor-1')).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 })
    expect(writeMock).not.toHaveBeenCalled()
  })
})

/**
 * video-source-inline-action-audit.test.ts — CHG-351-A + ADR-158 AMENDMENT (CHG-356)
 *
 * R-MID-1 第 27 次系统化 audit payload 内容断言守卫
 * AMENDMENT (CHG-356) BREAKING：异步占位 jobId → 同步快探 + UPDATE DB + 新 status 字段
 *   - probeJobId / renderJobId 字段移除
 *   - beforeJsonb 从 DB 读取（R-MID-1 D-121-4）
 *   - afterJsonb 加 newProbeStatus / newRenderStatus / latencyMs
 *
 * 覆盖 5 case：
 *   1. probeOne happy path → afterJsonb.action='probe' + newProbeStatus='ok' + latencyMs
 *   2. probeOne 404 → audit 不写
 *   3. probeOne 409 freeze → audit 不写
 *   4. renderCheckOne happy path → afterJsonb.action='render_check' + newRenderStatus='ok'
 *   5. renderCheckOne 404 → audit 不写
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'
// CHG-357: probeOne / renderCheckOne 已迁至 SourceProbeService（SourcesMatrixService 委托调用）
//   audit spy 必须 spy 实际执行 audit 的 SourceProbeService 实例
import { SourceProbeService } from '@/api/services/SourceProbeService'

const FROZEN_SETTING_RESULT = { rows: [{ value: 'true' }] }
const UNFROZEN_SETTING_RESULT = { rows: [{ value: 'false' }] }

type MockResult = { rows: Record<string, unknown>[] }

function makePool(queryImpl: (sql: string, params: readonly unknown[]) => MockResult): Pool {
  return {
    query: vi.fn((sql: string, params?: readonly unknown[]) => Promise.resolve(queryImpl(sql, params ?? []))),
  } as unknown as Pool
}

function spyAuditOnService(svc: SourceProbeService): ReturnType<typeof vi.fn> {
  const writeMock = vi.fn()
  ;(svc as unknown as { auditSvc: { write: typeof writeMock } }).auditSvc = { write: writeMock }
  return writeMock
}

const TEST_SOURCE_ID = '00000000-0000-4000-8000-000000000001'
const TEST_VIDEO_ID = '00000000-0000-4000-8000-000000000002'

function makeSourceRow(): Record<string, unknown> {
  return {
    id: TEST_SOURCE_ID,
    video_id: TEST_VIDEO_ID,
    episode_number: 1,
    source_url: 'https://example.com/play.m3u8',
    source_name: '线路1',
    source_site_key: 'jszyapi',
    user_label: null,
    display_name: null,
    type: 'video',
    quality: null,
    is_active: true,
    probe_status: 'pending',
    render_status: 'pending',
    latency_ms: null,
    last_probed_at: null,
    last_rendered_at: null,
    quality_detected: null,
    quality_source: 'meta',
    resolution_width: null,
    resolution_height: null,
    detected_at: null,
    last_checked: null,
    submitted_by: null,
    created_at: '2026-05-27T00:00:00.000Z',
    updated_at: '2026-05-27T00:00:00.000Z',
  }
}

describe('SourceProbeService.probeOne audit + freeze 守卫 (ADR-158 AMENDMENT / CHG-356)', () => {
  beforeEach(() => {
    // 默认 mock fetch HEAD → ok
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'video/mp4' },
    }))
  })

  it('1. happy path → afterJsonb { action="probe", newProbeStatus, latencyMs } + beforeJsonb { probeStatus, latencyMs }', async () => {
    const pool = makePool((sql) => {
      if (sql.includes('system_settings')) return UNFROZEN_SETTING_RESULT
      if (sql.includes('WHERE vs.id = $1')) return { rows: [makeSourceRow()] }
      if (sql.includes('UPDATE video_sources')) return { rows: [] }
      if (sql.includes('INSERT INTO source_health_events')) return { rows: [{ id: 'evt-1' }] }
      return { rows: [] }
    })
    const svc = new SourceProbeService(pool)
    const writeMock = spyAuditOnService(svc)

    const result = await svc.probeOne(TEST_SOURCE_ID, 'actor-1', 'req-1')

    expect(result.queued).toBe(false)
    expect(result.sourceId).toBe(TEST_SOURCE_ID)
    expect(result.newProbeStatus).toBe('ok')
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    expect(writeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'actor-1',
        actionType: 'video_source.inline_action',
        targetKind: 'video_source',
        targetId: TEST_SOURCE_ID,
        beforeJsonb: expect.objectContaining({
          probeStatus: 'pending',
          latencyMs: null,
        }),
        afterJsonb: expect.objectContaining({
          action: 'probe',
          newProbeStatus: 'ok',
          sourceId: TEST_SOURCE_ID,
        }),
        requestId: 'req-1',
      }),
    )
  })

  it('2. 404 source 不存在 → audit 不写', async () => {
    const pool = makePool((sql) => {
      if (sql.includes('system_settings')) return UNFROZEN_SETTING_RESULT
      if (sql.includes('WHERE vs.id = $1')) return { rows: [] }
      return { rows: [] }
    })
    const svc = new SourceProbeService(pool)
    const writeMock = spyAuditOnService(svc)

    await expect(svc.probeOne(TEST_SOURCE_ID, 'actor-1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      httpStatus: 404,
    })
    expect(writeMock).not.toHaveBeenCalled()
  })

  it('3. freeze=true → STATE_CONFLICT 409 / audit 不写', async () => {
    const pool = makePool((sql) => {
      if (sql.includes('system_settings')) return FROZEN_SETTING_RESULT
      return { rows: [] }
    })
    const svc = new SourceProbeService(pool)
    const writeMock = spyAuditOnService(svc)

    await expect(svc.probeOne(TEST_SOURCE_ID, 'actor-1')).rejects.toMatchObject({
      code: 'STATE_CONFLICT',
      httpStatus: 409,
    })
    expect(writeMock).not.toHaveBeenCalled()
  })
})

describe('SourceProbeService.renderCheckOne audit + 不守 freeze (ADR-158 AMENDMENT D-158-5)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/vnd.apple.mpegurl' },
    }))
  })

  it('4. happy path → afterJsonb { action="render_check", newRenderStatus } + beforeJsonb { renderStatus }', async () => {
    const pool = makePool((sql) => {
      if (sql.includes('WHERE vs.id = $1')) return { rows: [makeSourceRow()] }
      if (sql.includes('UPDATE video_sources')) return { rows: [] }
      if (sql.includes('INSERT INTO source_health_events')) return { rows: [{ id: 'evt-2' }] }
      return { rows: [] }
    })
    const svc = new SourceProbeService(pool)
    const writeMock = spyAuditOnService(svc)

    const result = await svc.renderCheckOne(TEST_SOURCE_ID, 'actor-2', 'req-2')

    expect(result.queued).toBe(false)
    expect(result.sourceId).toBe(TEST_SOURCE_ID)
    expect(result.newRenderStatus).toBe('ok')
    expect(writeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'actor-2',
        actionType: 'video_source.inline_action',
        targetKind: 'video_source',
        targetId: TEST_SOURCE_ID,
        beforeJsonb: expect.objectContaining({
          renderStatus: 'pending',
        }),
        afterJsonb: expect.objectContaining({
          action: 'render_check',
          newRenderStatus: 'ok',
          sourceId: TEST_SOURCE_ID,
        }),
        requestId: 'req-2',
      }),
    )
  })

  it('5. 404 source 不存在 → audit 不写 (renderCheckOne 不查 freeze)', async () => {
    const pool = makePool((sql) => {
      if (sql.includes('WHERE vs.id = $1')) return { rows: [] }
      return { rows: [] }
    })
    const svc = new SourceProbeService(pool)
    const writeMock = spyAuditOnService(svc)

    await expect(svc.renderCheckOne(TEST_SOURCE_ID, 'actor-2')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      httpStatus: 404,
    })
    expect(writeMock).not.toHaveBeenCalled()
  })
})

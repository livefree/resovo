/**
 * video-source-inline-action-audit.test.ts — CHG-351-A audit RETRO（R-MID-1 第 27 次系统化）
 *
 * ADR-158 audit payload 内容断言守卫：验证 `video_source.inline_action` 在
 * probe / render-check 两个路径的 audit 写入语义（合并 actionType + afterJsonb.action 范式）。
 *
 * 覆盖（D-158-5 + D-158-7 + Y2 测试展开）：
 *   1. probeOne happy path → afterJsonb.action='probe' + probeJobId + sourceId
 *   2. probeOne 404 (source 不存在 / 软删除) → audit 不写
 *   3. probeOne 409 (freeze) → audit 不写
 *   4. renderCheckOne happy path → afterJsonb.action='render_check' + renderJobId + sourceId
 *   5. renderCheckOne 404 (source 不存在) → audit 不写
 *
 * 注：renderCheckOne 不守 freeze（D-158-5 / Y1 diagnostic 可用性优先），故无 freeze case。
 */

import { describe, it, expect, vi } from 'vitest'
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

function spyAuditOnService(svc: SourcesMatrixService): ReturnType<typeof vi.fn> {
  const writeMock = vi.fn()
  ;(svc as unknown as { auditSvc: { write: typeof writeMock } }).auditSvc = { write: writeMock }
  return writeMock
}

const TEST_SOURCE_ID = '00000000-0000-4000-8000-000000000001'

function makeSourceRow(): Record<string, unknown> {
  return {
    id: TEST_SOURCE_ID,
    video_id: '00000000-0000-4000-8000-000000000002',
    episode_number: 1,
    source_url: 'https://example.com/play.m3u8',
    source_name: '线路1',
    source_site_key: 'jszyapi',
    user_label: null,
    display_name: null,
    type: 'video',
    quality: null,
    is_active: true,
    probe_status: 'ok',
    render_status: 'ok',
    latency_ms: 120,
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

describe('SourcesMatrixService.probeOne audit + freeze 守卫（ADR-158 / CHG-351-A）', () => {
  it('1. happy path → afterJsonb.action="probe" + probeJobId 含 probe-vs- 前缀 + sourceId', async () => {
    const pool = makePool((sql) => {
      if (sql.includes('system_settings')) return UNFROZEN_SETTING_RESULT
      if (sql.includes('WHERE vs.id = $1')) return { rows: [makeSourceRow()] }
      return { rows: [] }
    })
    const svc = new SourcesMatrixService(pool)
    const writeMock = spyAuditOnService(svc)

    const result = await svc.probeOne(TEST_SOURCE_ID, 'actor-1', 'req-1')

    expect(result.queued).toBe(true)
    expect(result.sourceId).toBe(TEST_SOURCE_ID)
    expect(result.probeJobId).toMatch(/^probe-vs-00000000-0000-4000-8000-000000000001-/)
    // R-MID-1 audit payload 内容断言（audit-log-coverage 守卫要求 expect.objectContaining 形式）
    expect(writeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'actor-1',
        actionType: 'video_source.inline_action',
        targetKind: 'video_source',
        targetId: TEST_SOURCE_ID,
        beforeJsonb: null,
        afterJsonb: expect.objectContaining({
          action: 'probe',
          probeJobId: expect.stringMatching(/^probe-vs-/),
          sourceId: TEST_SOURCE_ID,
        }),
        requestId: 'req-1',
      }),
    )
  })

  it('2. 404 source 不存在 / 已软删除 → audit 不写', async () => {
    const pool = makePool((sql) => {
      if (sql.includes('system_settings')) return UNFROZEN_SETTING_RESULT
      if (sql.includes('WHERE vs.id = $1')) return { rows: [] }
      return { rows: [] }
    })
    const svc = new SourcesMatrixService(pool)
    const writeMock = spyAuditOnService(svc)

    await expect(svc.probeOne(TEST_SOURCE_ID, 'actor-1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      httpStatus: 404,
    })
    expect(writeMock).not.toHaveBeenCalled()
  })

  it('3. freeze=true → STATE_CONFLICT 409 / audit 不写（D-158-5 / Y1 probe 守 freeze）', async () => {
    const pool = makePool((sql) => {
      if (sql.includes('system_settings')) return FROZEN_SETTING_RESULT
      return { rows: [] }
    })
    const svc = new SourcesMatrixService(pool)
    const writeMock = spyAuditOnService(svc)

    await expect(svc.probeOne(TEST_SOURCE_ID, 'actor-1')).rejects.toMatchObject({
      code: 'STATE_CONFLICT',
      httpStatus: 409,
    })
    expect(writeMock).not.toHaveBeenCalled()
  })
})

describe('SourcesMatrixService.renderCheckOne audit + 不守 freeze（ADR-158 / D-158-5 Y1）', () => {
  it('4. happy path → afterJsonb.action="render_check" + renderJobId 含 render-vs- 前缀 + sourceId', async () => {
    const pool = makePool((sql) => {
      if (sql.includes('WHERE vs.id = $1')) return { rows: [makeSourceRow()] }
      return { rows: [] }
    })
    const svc = new SourcesMatrixService(pool)
    const writeMock = spyAuditOnService(svc)

    const result = await svc.renderCheckOne(TEST_SOURCE_ID, 'actor-2', 'req-2')

    expect(result.queued).toBe(true)
    expect(result.sourceId).toBe(TEST_SOURCE_ID)
    expect(result.renderJobId).toMatch(/^render-vs-00000000-0000-4000-8000-000000000001-/)
    expect(writeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'actor-2',
        actionType: 'video_source.inline_action',
        targetKind: 'video_source',
        targetId: TEST_SOURCE_ID,
        beforeJsonb: null,
        afterJsonb: expect.objectContaining({
          action: 'render_check',
          renderJobId: expect.stringMatching(/^render-vs-/),
          sourceId: TEST_SOURCE_ID,
        }),
        requestId: 'req-2',
      }),
    )
  })

  it('5. 404 source 不存在 → audit 不写（renderCheckOne 不查 freeze / D-158-5 Y1）', async () => {
    const pool = makePool((sql) => {
      // 不返回 system_settings（renderCheckOne 不调 assertNotFrozen）
      if (sql.includes('WHERE vs.id = $1')) return { rows: [] }
      return { rows: [] }
    })
    const svc = new SourcesMatrixService(pool)
    const writeMock = spyAuditOnService(svc)

    await expect(svc.renderCheckOne(TEST_SOURCE_ID, 'actor-2')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      httpStatus: 404,
    })
    expect(writeMock).not.toHaveBeenCalled()
  })
})

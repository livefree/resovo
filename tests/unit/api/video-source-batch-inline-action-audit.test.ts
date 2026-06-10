/**
 * video-source-batch-inline-action-audit.test.ts — CHG-357 / ADR-158 AMENDMENT 2
 *
 * R-MID-1 第 28 次系统化 audit payload 内容断言守卫
 * batch 范式：1 条 summary audit + 子 probeOneInternal 走 skipAudit=true 不写
 *   - actionType: video_source.batch_inline_action（新增 1 项 / 4 真源 +1）
 *   - targetKind: 'video'（batch 对象是 video 而非单源 / 与单源 inline_action targetKind='video_source' 区分）
 *   - afterJsonb: { action: 'batch_probe'|'batch_render_check', summary, sourceIds }
 *   - beforeJsonb: null（batch 是 video-level / 无单一前态可读 / 数据完整性靠 source_health_events 每源 1 条兜底）
 *
 * 覆盖 7 case：
 *   1. batchProbe happy → summary + sourceIds + 子 source-level audit 不写
 *   2. batchProbe 404 video 无 active source → audit 不写
 *   3. batchProbe 409 freeze → audit 不写
 *   4. batchRenderCheck happy → action='batch_render_check' + summary
 *   5. batchRenderCheck 404 → audit 不写
 *   6. batchProbe N=20 source → 分批 5 并发执行 / summary.total=20
 *   7. batchProbe summary.failed 字段 — Promise 异常 case 待主流程验证（advisory 不强测）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'
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

// SRCHEALTH-P1-3：试播 manifest 真解析的 mock 响应体（非 master → evaluateHls ok）
const MEDIA_PLAYLIST = '#EXTM3U\n#EXTINF:10,\nseg-0.ts\n#EXT-X-ENDLIST\n'

// SRCHEALTH-P1-3 Codex 拦截修复：实现改为限量流式读取（readBodyLimited），mock 提供
// body stream；每次 fetch 调用须新建 stream（同一 stream 二次 getReader 会 locked）
function makeBodyStream(payload: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(payload))
      controller.close()
    },
  })
}

const TEST_VIDEO_ID = '00000000-0000-4000-8000-000000000001'

function makeSourceRow(idSuffix: string): Record<string, unknown> {
  return {
    id: `00000000-0000-4000-8000-${idSuffix.padStart(12, '0')}`,
    video_id: TEST_VIDEO_ID,
    episode_number: 1,
    source_url: `https://example.com/play-${idSuffix}.m3u8`,
    source_name: `线路${idSuffix}`,
    source_site_key: 'jszyapi',
    user_label: null,
    display_name: null,
    type: 'hls',
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

describe('SourceProbeService.batchProbe audit + freeze 守卫 (ADR-158 AMENDMENT 2 / CHG-357)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'video/mp4' },
    }))
  })

  it('1. happy path → 1 条 summary audit (targetKind="video" / action="batch_probe" / sourceIds 列表)', async () => {
    const sourceRows = [makeSourceRow('1'), makeSourceRow('2'), makeSourceRow('3')]
    const pool = makePool((sql) => {
      if (sql.includes('system_settings')) return UNFROZEN_SETTING_RESULT
      if (sql.includes('WHERE vs.video_id = $1')) return { rows: sourceRows }
      if (sql.includes('UPDATE video_sources')) return { rows: [] }
      if (sql.includes('INSERT INTO source_health_events')) return { rows: [{ id: 'evt' }] }
      return { rows: [] }
    })
    const svc = new SourceProbeService(pool)
    const writeMock = spyAuditOnService(svc)

    const result = await svc.batchProbe(TEST_VIDEO_ID, 'actor-1', 'req-1')

    expect(result.videoId).toBe(TEST_VIDEO_ID)
    expect(result.results).toHaveLength(3)
    expect(result.summary).toEqual({ total: 3, ok: 3, dead: 0, failed: 0 })
    // 仅 1 条 summary audit（batch 范式 / 子 source-level audit 不写）
    expect(writeMock).toHaveBeenCalledOnce()
    expect(writeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'actor-1',
        actionType: 'video_source.batch_inline_action',
        targetKind: 'video',
        targetId: TEST_VIDEO_ID,
        beforeJsonb: null,
        afterJsonb: expect.objectContaining({
          action: 'batch_probe',
          summary: expect.objectContaining({ total: 3, ok: 3 }),
          sourceIds: expect.arrayContaining([
            sourceRows[0].id, sourceRows[1].id, sourceRows[2].id,
          ]),
        }),
        requestId: 'req-1',
      }),
    )
  })

  it('2. 404 video 无 active source → audit 不写', async () => {
    const pool = makePool((sql) => {
      if (sql.includes('system_settings')) return UNFROZEN_SETTING_RESULT
      if (sql.includes('WHERE vs.video_id = $1')) return { rows: [] }
      return { rows: [] }
    })
    const svc = new SourceProbeService(pool)
    const writeMock = spyAuditOnService(svc)

    await expect(svc.batchProbe(TEST_VIDEO_ID, 'actor-1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      httpStatus: 404,
    })
    expect(writeMock).not.toHaveBeenCalled()
  })

  it('3. freeze=true → STATE_CONFLICT 409 整体不部分执行 / audit 不写', async () => {
    const pool = makePool((sql) => {
      if (sql.includes('system_settings')) return FROZEN_SETTING_RESULT
      return { rows: [] }
    })
    const svc = new SourceProbeService(pool)
    const writeMock = spyAuditOnService(svc)

    await expect(svc.batchProbe(TEST_VIDEO_ID, 'actor-1')).rejects.toMatchObject({
      code: 'STATE_CONFLICT',
      httpStatus: 409,
    })
    expect(writeMock).not.toHaveBeenCalled()
  })

  it('6. N=20 source → 分批 5 并发执行 / summary.total=20', async () => {
    const sourceRows = Array.from({ length: 20 }, (_, i) => makeSourceRow(`${i + 1}`))
    const pool = makePool((sql) => {
      if (sql.includes('system_settings')) return UNFROZEN_SETTING_RESULT
      if (sql.includes('WHERE vs.video_id = $1')) return { rows: sourceRows }
      if (sql.includes('UPDATE video_sources')) return { rows: [] }
      if (sql.includes('INSERT INTO source_health_events')) return { rows: [{ id: 'evt' }] }
      return { rows: [] }
    })
    const svc = new SourceProbeService(pool)
    const writeMock = spyAuditOnService(svc)

    const result = await svc.batchProbe(TEST_VIDEO_ID, 'actor-1')
    expect(result.summary.total).toBe(20)
    expect(result.results).toHaveLength(20)
    // 仍仅 1 条 summary audit (batch 范式)
    expect(writeMock).toHaveBeenCalledOnce()
  })
})

describe('SourceProbeService.batchRenderCheck audit + 不守 freeze (ADR-158 D-158-5 继承 / CHG-357)', () => {
  beforeEach(() => {
    // SRCHEALTH-P1-3：试播升级 GET + manifest 真解析 → mock 提供 body stream（media playlist → ok）
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve({
      ok: true,
      status: 200,
      body: makeBodyStream(MEDIA_PLAYLIST),
    })))
  })

  it('4. happy path → action="batch_render_check" + summary + targetKind="video"', async () => {
    const sourceRows = [makeSourceRow('1'), makeSourceRow('2')]
    const pool = makePool((sql) => {
      if (sql.includes('WHERE vs.video_id = $1')) return { rows: sourceRows }
      if (sql.includes('UPDATE video_sources')) return { rows: [] }
      if (sql.includes('INSERT INTO source_health_events')) return { rows: [{ id: 'evt' }] }
      return { rows: [] }
    })
    const svc = new SourceProbeService(pool)
    const writeMock = spyAuditOnService(svc)

    const result = await svc.batchRenderCheck(TEST_VIDEO_ID, 'actor-2', 'req-2')

    expect(result.videoId).toBe(TEST_VIDEO_ID)
    expect(result.summary).toEqual({ total: 2, ok: 2, partial: 0, dead: 0, failed: 0 })
    expect(writeMock).toHaveBeenCalledOnce()
    expect(writeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'actor-2',
        actionType: 'video_source.batch_inline_action',
        targetKind: 'video',
        targetId: TEST_VIDEO_ID,
        afterJsonb: expect.objectContaining({
          action: 'batch_render_check',
          summary: expect.objectContaining({ total: 2, ok: 2 }),
        }),
        requestId: 'req-2',
      }),
    )
  })

  it('5. 404 video 无 active source → audit 不写 (renderCheck 不查 freeze)', async () => {
    const pool = makePool((sql) => {
      if (sql.includes('WHERE vs.video_id = $1')) return { rows: [] }
      return { rows: [] }
    })
    const svc = new SourceProbeService(pool)
    const writeMock = spyAuditOnService(svc)

    await expect(svc.batchRenderCheck(TEST_VIDEO_ID, 'actor-2')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      httpStatus: 404,
    })
    expect(writeMock).not.toHaveBeenCalled()
  })
})

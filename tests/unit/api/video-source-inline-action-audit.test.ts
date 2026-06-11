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
    // SRCHEALTH-P1-3：试播升级 GET + manifest 真解析 → mock 提供 body stream（media playlist → ok）
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve({
      ok: true,
      status: 200,
      body: makeBodyStream(MEDIA_PLAYLIST),
    })))
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

  // SRCHEALTH-P1-3（D-1）：manifest 真解析 → 质量字段随 render_status 一并写入
  it('6. master manifest 解析 → UPDATE 写 resolution/quality（与 worker level2 同款语义）', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve({
      ok: true,
      status: 200,
      body: makeBodyStream('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1920x1080\nhigh.m3u8\n'),
    })))
    let updateParams: readonly unknown[] = []
    const pool = makePool((sql, params) => {
      if (sql.includes('WHERE vs.id = $1')) return { rows: [makeSourceRow()] }
      if (sql.includes('UPDATE video_sources')) {
        updateParams = params
        return { rows: [] }
      }
      if (sql.includes('INSERT INTO source_health_events')) return { rows: [{ id: 'evt-3' }] }
      return { rows: [] }
    })
    const svc = new SourceProbeService(pool)
    spyAuditOnService(svc)

    const result = await svc.renderCheckOne(TEST_SOURCE_ID, 'actor-2', 'req-3')

    expect(result.newRenderStatus).toBe('ok')
    // updateSourceHealthAfterRenderCheck 参数序：[sourceId, renderStatus, width, height, quality]
    expect(updateParams).toEqual([TEST_SOURCE_ID, 'ok', 1920, 1080, '1080P'])
  })

  // SRCHEALTH-P1-3 Codex 拦截守卫：服务器忽略 Range 返回 200 无限流（mp4 大文件场景）
  // → readBodyLimited 读满上限即 cancel；若实现退回全量 arrayBuffer()/text() 会在此挂死
  it('7. mp4 服务器忽略 Range 返回 200 无限流 → 限量读取后正常完成（不全量缓冲）', async () => {
    const CHUNK = new Uint8Array(16 * 1024)
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve({
      ok: true,
      status: 200,
      body: new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.enqueue(CHUNK) // 永不 close：全量读取实现会无限缓冲直到测试超时
        },
      }),
    })))
    const pool = makePool((sql) => {
      if (sql.includes('WHERE vs.id = $1')) return { rows: [{ ...makeSourceRow(), type: 'mp4' }] }
      if (sql.includes('UPDATE video_sources')) return { rows: [] }
      if (sql.includes('INSERT INTO source_health_events')) return { rows: [{ id: 'evt-4' }] }
      return { rows: [] }
    })
    const svc = new SourceProbeService(pool)
    spyAuditOnService(svc)

    const result = await svc.renderCheckOne(TEST_SOURCE_ID, 'actor-2', 'req-4')

    // 限量读取在 64KB 截断（全量实现会挂死至超时）；全 0 字节非 ISO BMFF 容器
    // → isValidMp4 false → dead（无效内容不得判 ok，Codex 二轮拦截语义）
    expect(result.newRenderStatus).toBe('dead')
  })
})

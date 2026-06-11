/**
 * source-probe-playback-verify.test.ts — SourceProbeService.recordPlaybackVerify（ADR-198）
 *
 * 验证 admin 真实播放反馈成功/失败不对称分支（query 层 mock，断言委托 + 分支逻辑）：
 *   - source 不存在 / 不属该 video → NOT_FOUND（不直更）
 *   - 成功 → recordAdminPlaybackVerifySuccess（quality 由 heightToQuality 映射）+ 溯源事件
 *     (origin=admin_playback, processed_at 非空) + 重算聚合
 *   - 成功无分辨率 → qualityDetected=null（不驱动 quality）
 *   - 失败 → 不调直更 + 定向 recheck 信号(origin=admin_playback, new_status=dead, processed_at=NULL)
 *     + 不重算聚合 + 返回当前(未变)状态
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const findVideoSourceById = vi.fn()
const recordAdminPlaybackVerifySuccess = vi.fn()
const listActiveProbeStatuses = vi.fn()
const insertHealthEvent = vi.fn()
const updateVideoSourceCheckStatus = vi.fn()
const auditWrite = vi.fn()

vi.mock('@/api/db/queries/video_sources', () => ({
  findVideoSourceById: (...a: unknown[]) => findVideoSourceById(...a),
  recordAdminPlaybackVerifySuccess: (...a: unknown[]) => recordAdminPlaybackVerifySuccess(...a),
  listVideoSources: vi.fn(),
  listActiveProbeStatuses: (...a: unknown[]) => listActiveProbeStatuses(...a),
  updateSourceHealthAfterProbe: vi.fn(),
  updateSourceHealthAfterRenderCheck: vi.fn(),
}))
vi.mock('@/api/db/queries/sourceHealthEvents', () => ({
  insertHealthEvent: (...a: unknown[]) => insertHealthEvent(...a),
}))
vi.mock('@/api/db/queries/videos.status', () => ({
  updateVideoSourceCheckStatus: (...a: unknown[]) => updateVideoSourceCheckStatus(...a),
}))
vi.mock('@/api/db/queries/systemSettings', () => ({ getSetting: vi.fn() }))
vi.mock('@/api/services/AuditLogService', () => ({
  AuditLogService: vi.fn(() => ({ write: auditWrite })),
}))

import { SourceProbeService } from '@/api/services/SourceProbeService'

const db = {} as never
function svc() {
  return new SourceProbeService(db)
}
function makeSource(over: Record<string, unknown> = {}) {
  return {
    id: 's1', videoId: 'v1', sourceUrl: 'http://x', probeStatus: 'dead', renderStatus: 'dead', latencyMs: null,
    ...over,
  } as never
}

beforeEach(() => {
  vi.clearAllMocks()
  listActiveProbeStatuses.mockResolvedValue(['ok'])
})

describe('SourceProbeService.recordPlaybackVerify（ADR-198）', () => {
  it('source 不存在 → NOT_FOUND（不直更）', async () => {
    findVideoSourceById.mockResolvedValue(null)
    await expect(svc().recordPlaybackVerify('v1', 's1', 'u1', { success: true })).rejects.toThrow(/不存在/)
    expect(recordAdminPlaybackVerifySuccess).not.toHaveBeenCalled()
    expect(insertHealthEvent).not.toHaveBeenCalled()
  })

  it('source 不属于该 video → NOT_FOUND（不直更）', async () => {
    findVideoSourceById.mockResolvedValue(makeSource({ videoId: 'OTHER' }))
    await expect(svc().recordPlaybackVerify('v1', 's1', 'u1', { success: true })).rejects.toThrow()
    expect(recordAdminPlaybackVerifySuccess).not.toHaveBeenCalled()
  })

  it('成功（1080 高）→ 直更 quality=1080P + 溯源事件(processed_at 非空, origin=admin_playback) + 重算聚合', async () => {
    findVideoSourceById.mockResolvedValue(makeSource())
    recordAdminPlaybackVerifySuccess.mockResolvedValue({ newProbeStatus: 'ok', newRenderStatus: 'ok' })
    const res = await svc().recordPlaybackVerify('v1', 's1', 'u1', {
      success: true, resolutionWidth: 1920, resolutionHeight: 1080,
    })
    expect(recordAdminPlaybackVerifySuccess).toHaveBeenCalledWith(db, 's1', {
      resolutionWidth: 1920, resolutionHeight: 1080, qualityDetected: '1080P',
    })
    const ev = insertHealthEvent.mock.calls[0]![1] as Record<string, unknown>
    expect(ev.origin).toBe('admin_playback')
    expect(ev.processedAt).not.toBeNull()
    expect(updateVideoSourceCheckStatus).toHaveBeenCalled() // 成功翻转 → 重算
    expect(res).toEqual({ sourceId: 's1', newProbeStatus: 'ok', newRenderStatus: 'ok', verified: true })
  })

  it('成功无分辨率 → qualityDetected=null（不驱动 quality）', async () => {
    findVideoSourceById.mockResolvedValue(makeSource())
    recordAdminPlaybackVerifySuccess.mockResolvedValue({ newProbeStatus: 'ok', newRenderStatus: 'ok' })
    await svc().recordPlaybackVerify('v1', 's1', 'u1', { success: true })
    expect(recordAdminPlaybackVerifySuccess).toHaveBeenCalledWith(db, 's1', {
      resolutionWidth: null, resolutionHeight: null, qualityDetected: null,
    })
  })

  it('失败 → 不直更 + 定向 recheck 信号(processed_at=NULL, origin=admin_playback, new_status=dead) + 不重算', async () => {
    findVideoSourceById.mockResolvedValue(makeSource({ probeStatus: 'ok', renderStatus: 'ok' }))
    const res = await svc().recordPlaybackVerify('v1', 's1', 'u1', {
      success: false, errorCode: 'MEDIA_ERR_DECODE',
    })
    expect(recordAdminPlaybackVerifySuccess).not.toHaveBeenCalled()
    const ev = insertHealthEvent.mock.calls[0]![1] as Record<string, unknown>
    expect(ev.origin).toBe('admin_playback')
    expect(ev.newStatus).toBe('dead')
    expect(ev.processedAt).toBeNull() // 定向 recheck 队列待 worker 消费
    expect(ev.errorDetail).toBe('MEDIA_ERR_DECODE')
    expect(updateVideoSourceCheckStatus).not.toHaveBeenCalled() // 状态未变 → 不重算
    // 返回当前(未变)状态
    expect(res).toEqual({ sourceId: 's1', newProbeStatus: 'ok', newRenderStatus: 'ok', verified: true })
  })
})

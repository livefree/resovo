import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'
import type pino from 'pino'

/**
 * SRCHEALTH-P3-3-B1：runLevel1Probe 熔断编排测试。
 * extractSiteId 已删除（P3-3-A 登记的双副本，本卡切 @resovo/media-probe extractHostname，
 * hostname 提取语义由 tests/unit/packages/media-probe/url.test.ts 守卫）。
 */

const mockShouldSkipSite = vi.fn()
const mockRecordFailure = vi.fn()
const mockRecordSuccess = vi.fn()
const mockPersist = vi.fn()

vi.mock('../../../../../apps/worker/src/lib/circuit-breaker', () => ({
  shouldSkipSite: (...args: unknown[]) => mockShouldSkipSite(...args),
  recordFailure: (...args: unknown[]) => mockRecordFailure(...args),
  recordSuccess: (...args: unknown[]) => mockRecordSuccess(...args),
}))
vi.mock('../../../../../apps/worker/src/jobs/source-health/host-health', () => ({
  persistCircuitTransition: (...args: unknown[]) => mockPersist(...args),
}))

import { runLevel1Probe } from '../../../../../apps/worker/src/jobs/source-health/level1-probe'

const mockQuery = vi.fn()
const pool = { query: mockQuery } as unknown as Pool
const log = {
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
} as unknown as pino.Logger

function makeSource(url: string) {
  return {
    id: 'src-1',
    video_id: 'vid-1',
    source_url: url,
    type: 'mp4',
    is_active: true,
    probe_status: 'pending',
    render_status: 'pending',
    quality_detected: null,
    last_probed_at: null,
    last_rendered_at: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('runLevel1Probe — 熔断编排（P3-3-B1）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 })
    mockShouldSkipSite.mockReturnValue(false)
    mockRecordFailure.mockReturnValue(null)
    mockRecordSuccess.mockReturnValue(null)
    mockPersist.mockResolvedValue(undefined)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
  })

  it('null hostname（无效 URL）跳过熔断统计但仍探测，且不落库 host_health', async () => {
    await runLevel1Probe(pool, log, { sources: [makeSource('not-a-url')] })

    expect(mockShouldSkipSite).not.toHaveBeenCalled()
    expect(mockRecordSuccess).not.toHaveBeenCalled()
    expect(mockRecordFailure).not.toHaveBeenCalled()
    expect(mockPersist).not.toHaveBeenCalled()
    // 仍然探测：probe UPDATE 被执行
    const updateCall = mockQuery.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('SET probe_status'),
    )
    expect(updateCall).toBeTruthy()
  })

  it('hostname 传入熔断器为 extractHostname 规范化值（小写去端口），探测 ok 时 transition 交 persistCircuitTransition', async () => {
    mockRecordSuccess.mockReturnValue('recovered')

    await runLevel1Probe(pool, log, { sources: [makeSource('HTTPS://CDN.Example.COM:8443/v.mp4')] })

    expect(mockShouldSkipSite).toHaveBeenCalledWith('cdn.example.com')
    expect(mockRecordSuccess).toHaveBeenCalledWith('cdn.example.com')
    expect(mockPersist).toHaveBeenCalledWith(pool, log, 'cdn.example.com', 'recovered')
  })

  it('探测失败 recordFailure 返回 tripped 时落库', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
    mockRecordFailure.mockReturnValue('tripped')

    await runLevel1Probe(pool, log, { sources: [makeSource('https://bad.example.com/v.mp4')] })

    expect(mockRecordFailure).toHaveBeenCalledWith('bad.example.com')
    expect(mockPersist).toHaveBeenCalledWith(pool, log, 'bad.example.com', 'tripped')
  })

  it('熔断 active 时 skip：写 circuit_breaker event、不探测', async () => {
    mockShouldSkipSite.mockReturnValue(true)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await runLevel1Probe(pool, log, { sources: [makeSource('https://down.example.com/v.mp4')] })

    expect(fetchMock).not.toHaveBeenCalled()
    const eventCall = mockQuery.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('source_health_events'),
    )
    expect(eventCall).toBeTruthy()
    expect((eventCall![1] as unknown[])[2]).toBe('circuit_breaker')
  })
})

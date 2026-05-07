// @vitest-environment jsdom

/**
 * use-sources.test.ts — useVideoSources hook 单元测试（CHG-SN-4-08）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../../../../../apps/server-next/src/lib/videos/api', () => ({
  listVideoSources: vi.fn(),
  toggleVideoSource: vi.fn(),
  disableDeadSources: vi.fn(),
  refetchSources: vi.fn(),
  getLineHealthEvents: vi.fn(),
}))

import * as api from '../../../../../apps/server-next/src/lib/videos/api'
import { useVideoSources, toDisplayState } from '../../../../../apps/server-next/src/lib/videos/use-sources'
import type { VideoSource } from '../../../../../apps/server-next/src/lib/videos/use-sources'

function makeSource(overrides: Partial<VideoSource> = {}): VideoSource {
  return {
    id: 's1',
    video_id: 'v1',
    source_url: 'https://example.com/ep1.m3u8',
    source_name: 'Test Source',
    is_active: true,
    last_checked: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    episode_number: 1,
    season_number: 1,
    source_site_key: 'testsite',
    site_key: 'testsite',
    type: 'hls',
    probe_status: 'ok',
    render_status: 'ok',
    latency_ms: 120,
    last_probed_at: null,
    last_rendered_at: null,
    quality_detected: '1080P',
    quality_source: 'crawler',
    resolution_width: 1920,
    resolution_height: 1080,
    detected_at: null,
    video_title: 'Test Video',
    ...overrides,
  }
}

describe('toDisplayState', () => {
  it('ok → ok', () => expect(toDisplayState('ok')).toBe('ok'))
  it('partial → partial', () => expect(toDisplayState('partial')).toBe('partial'))
  it('dead → dead', () => expect(toDisplayState('dead')).toBe('dead'))
  it('pending → pending', () => expect(toDisplayState('pending')).toBe('pending'))
})

describe('useVideoSources', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('加载时 loading=true，成功后 sources 就位', async () => {
    const sources = [makeSource()]
    vi.mocked(api.listVideoSources).mockResolvedValue(sources)

    const { result } = renderHook(() => useVideoSources('v1'))
    expect(result.current[0].loading).toBe(true)

    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    expect(result.current[0].loading).toBe(false)
    expect(result.current[0].sources).toHaveLength(1)
    expect(result.current[0].sources[0]!.id).toBe('s1')
  })

  it('加载失败时 error 就位', async () => {
    vi.mocked(api.listVideoSources).mockRejectedValue(new Error('网络错误'))

    const { result } = renderHook(() => useVideoSources('v1'))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    expect(result.current[0].error).toBeInstanceOf(Error)
    expect(result.current[0].error?.message).toBe('网络错误')
  })

  it('toggle：乐观更新 + 成功（CHG-SN-5-PRE-01-C：透传 updated_at + 用 server 返回新版本号）', async () => {
    const src = makeSource({ is_active: true, updated_at: '2024-01-01T00:00:00Z' })
    const fresh = { ...src, is_active: false, updated_at: '2024-01-01T00:00:01Z' }
    vi.mocked(api.listVideoSources).mockResolvedValue([src])
    vi.mocked(api.toggleVideoSource).mockResolvedValue({ data: fresh as VideoSource })

    const { result } = renderHook(() => useVideoSources('v1'))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    await act(async () => {
      await result.current[1].toggle('s1', false)
    })

    expect(result.current[0].sources[0]!.is_active).toBe(false)
    expect(result.current[0].sources[0]!.updated_at).toBe('2024-01-01T00:00:01Z')
    // CHG-SN-5-PRE-01-C：第 4 个参数是当前 updated_at，启用乐观锁
    expect(api.toggleVideoSource).toHaveBeenCalledWith('v1', 's1', false, '2024-01-01T00:00:00Z')
  })

  it('toggle：API 失败时回滚', async () => {
    const src = makeSource({ is_active: true })
    vi.mocked(api.listVideoSources).mockResolvedValue([src])
    vi.mocked(api.toggleVideoSource).mockRejectedValue(new Error('API error'))

    const { result } = renderHook(() => useVideoSources('v1'))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    await expect(act(async () => {
      await result.current[1].toggle('s1', false)
    })).rejects.toThrow()

    expect(result.current[0].sources[0]!.is_active).toBe(true)
  })

  // CHG-SN-5-PRE-01-C：UI 路径乐观锁失败 → 拉新数据 + 抛出异常供消费方提示
  it('toggle：409 REVIEW_RACE 时调用 listVideoSources 拉新列表 + 异常向上抛', async () => {
    const stale = makeSource({ is_active: true, updated_at: '2024-01-01T00:00:00Z' })
    vi.mocked(api.listVideoSources).mockResolvedValue([stale])
    const raceErr = Object.assign(new Error('race'), { code: 'REVIEW_RACE', status: 409 })
    vi.mocked(api.toggleVideoSource).mockRejectedValue(raceErr)

    const { result } = renderHook(() => useVideoSources('v1'))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    // 初始加载时已调用 1 次
    const initialCalls = vi.mocked(api.listVideoSources).mock.calls.length

    await expect(act(async () => {
      await result.current[1].toggle('s1', false)
    })).rejects.toMatchObject({ code: 'REVIEW_RACE', status: 409 })

    // race 触发重载 → listVideoSources 又被调用至少 1 次
    expect(vi.mocked(api.listVideoSources).mock.calls.length).toBeGreaterThan(initialCalls)
    expect(api.toggleVideoSource).toHaveBeenCalledWith('v1', 's1', false, '2024-01-01T00:00:00Z')
  })

  // 非 race 错误 → 回滚乐观更新到 snapshot
  it('toggle：非 race 错误回滚到调用前 snapshot', async () => {
    const src = makeSource({ is_active: true, updated_at: '2024-01-01T00:00:00Z' })
    vi.mocked(api.listVideoSources).mockResolvedValue([src])
    vi.mocked(api.toggleVideoSource).mockRejectedValue(new Error('network'))

    const { result } = renderHook(() => useVideoSources('v1'))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    await expect(act(async () => {
      await result.current[1].toggle('s1', false)
    })).rejects.toThrow('network')

    expect(result.current[0].sources[0]!.is_active).toBe(true)  // 回滚成功
  })

  it('disableDead：调用 API 并刷新列表', async () => {
    vi.mocked(api.listVideoSources).mockResolvedValue([makeSource()])
    vi.mocked(api.disableDeadSources).mockResolvedValue({ data: { disabled: 2 } })

    const { result } = renderHook(() => useVideoSources('v1'))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    await act(async () => { await result.current[1].disableDead() })

    expect(api.disableDeadSources).toHaveBeenCalledWith('v1')
    expect(result.current[0].bulkPending).toBe(false)
  })
})

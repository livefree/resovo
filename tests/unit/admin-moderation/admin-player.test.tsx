/**
 * admin-player.test.tsx — AdminPlayer + useSelectedLine 单测（FIX-D / ≥ 5 case）
 */
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanup, render, fireEvent } from '@testing-library/react'
import { renderHook, act } from '@testing-library/react'
import React from 'react'

// ── Mock @resovo/player-core ──────────────────────────────────────────────────
// Player 组件用 <video> 需要完整 DOM；测试层替换为 stub

// 暴露 Player mock 调用计数让 -EP "key bump remount" 测试可断言（vi.hoisted 保证 vi.mock 工厂前初始化）
const { playerMountSpy } = vi.hoisted(() => ({ playerMountSpy: vi.fn() }))

vi.mock('@resovo/player-core', () => ({
  // CHG-SN-9-PLAYER-ERROR-CONSUMER-A：扩 onError 透传，让 fail 按钮触发 PlayerErrorEvent
  // Wave 4 #4-EP / Y-166-6：每次 React mount 调一次 playerMountSpy，让 key bump remount 测试断言
  Player: vi.fn(
    ({
      src,
      onPlay,
      onError,
    }: {
      src?: string
      onPlay?: () => void
      onError?: (event: { code: string; src: string | null; fatal: boolean }) => void
    }) => {
      playerMountSpy()
      return (
        <div data-mock-player data-src={src ?? ''}>
          <button type="button" data-mock-play onClick={onPlay}>play</button>
          <button
            type="button"
            data-mock-fail-native
            onClick={() => onError?.({ code: 'native_media_failed', src: src ?? null, fatal: true })}
          >
            fail-native
          </button>
          <button
            type="button"
            data-mock-fail-hls
            onClick={() => onError?.({ code: 'hls_fatal', src: src ?? null, fatal: true })}
          >
            fail-hls
          </button>
        </div>
      )
    },
  ),
}))

// ── Mock api-client ───────────────────────────────────────────────────────────

const postMock = vi.fn().mockResolvedValue({})

vi.mock('../../../apps/server-next/src/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: (...args: unknown[]) => postMock(...args),
  },
}))

// ── 被测模块（mock 声明之后 import）─────────────────────────────────────────────

import { AdminPlayer } from '../../../apps/server-next/src/app/admin/moderation/_client/AdminPlayer'
import { useSelectedLine } from '../../../apps/server-next/src/lib/moderation/use-selected-line'
import type { LineAggregate } from '../../../packages/admin-ui/src/components/composite/lines-panel/lines-panel.types'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ── Case 1：null 源 → idle 占位 ───────────────────────────────────────────────

describe('AdminPlayer — Case 1: null 源展示占位', () => {
  it('sourceUrl=null → data-state=idle + 占位文案', () => {
    const { container } = render(
      <AdminPlayer videoId="vid-1" sourceUrl={null} sourceId={null} />
    )
    const el = container.querySelector('[data-admin-player]') as HTMLElement
    expect(el.getAttribute('data-state')).toBe('idle')
    expect(el.textContent).toContain('选择线路以播放')
    expect(container.querySelector('[data-mock-player]')).toBeNull()
  })
})

// ── Case 2：sourceUrl 非空 → 渲染 Player ──────────────────────────────────────

describe('AdminPlayer — Case 2: 有效 sourceUrl 渲染 Player', () => {
  it('sourceUrl 非 null → data-state=ready + Player 渲染 + src 透传', () => {
    const src = 'https://cdn.example.com/v.m3u8'
    const { container } = render(
      <AdminPlayer videoId="vid-1" sourceUrl={src} sourceId="src-1" />
    )
    const el = container.querySelector('[data-admin-player]') as HTMLElement
    expect(el.getAttribute('data-state')).toBe('ready')
    const player = container.querySelector('[data-mock-player]') as HTMLElement
    expect(player).toBeTruthy()
    expect(player.getAttribute('data-src')).toBe(src)
  })
})

// ── Case 3：首次 onPlay → playback-verify POST（ADR-198 admin 专用端点）──────────

describe('AdminPlayer — Case 3: 首次播放上报 playback-verify', () => {
  it('onPlay 首次调用 → apiClient.post 命中 admin 端点（路径化 videoId/sourceId）+ body{success:true}', () => {
    const { container } = render(
      <AdminPlayer videoId="vid-abc" sourceUrl="https://cdn.example.com/v.m3u8" sourceId="src-xyz" />
    )
    fireEvent.click(container.querySelector('[data-mock-play]')!)
    expect(postMock).toHaveBeenCalledTimes(1)
    expect(postMock).toHaveBeenCalledWith('/admin/videos/vid-abc/sources/src-xyz/playback-verify', {
      success: true,
    })
  })

  it('onVerified prop 提供 → 成功上报 resolve 后携 verify 结果调用（刷新链 + 线路外科同步）', async () => {
    // playback-verify 200 响应 { data: {...} }；AdminPlayer 取 res.data 透传 onVerified
    postMock.mockResolvedValueOnce({
      data: { sourceId: 'src-1', newProbeStatus: 'ok', newRenderStatus: 'ok', verified: true },
    })
    const onVerified = vi.fn()
    const { container } = render(
      <AdminPlayer videoId="vid-1" sourceUrl="https://cdn.example.com/v.m3u8" sourceId="src-1" onVerified={onVerified} />
    )
    fireEvent.click(container.querySelector('[data-mock-play]')!)
    // postMock resolve 后微任务触发 onVerified
    await Promise.resolve()
    await Promise.resolve()
    expect(onVerified).toHaveBeenCalledTimes(1)
    expect(onVerified).toHaveBeenCalledWith({ sourceId: 'src-1', newProbeStatus: 'ok', newRenderStatus: 'ok', verified: true })
  })

  it('onError（失败）不触发 onVerified（失败为异步 recheck，UI 同步无变化）', async () => {
    const onVerified = vi.fn()
    const { container } = render(
      <AdminPlayer videoId="vid-1" sourceUrl="https://cdn.example.com/v.m3u8" sourceId="src-1" onVerified={onVerified} />
    )
    fireEvent.click(container.querySelector('[data-mock-fail-native]')!)
    await Promise.resolve()
    await Promise.resolve()
    expect(onVerified).not.toHaveBeenCalled()
  })
})

// ── Case 4：同 sourceId 多次 onPlay → 只上报一次（去抖）────────────────────────

describe('AdminPlayer — Case 4: 同 sourceId 去抖', () => {
  it('相同 sourceId 的第二次 onPlay 不再调用 apiClient.post', () => {
    const { container } = render(
      <AdminPlayer videoId="vid-1" sourceUrl="https://cdn.example.com/v.m3u8" sourceId="src-1" />
    )
    const playBtn = container.querySelector('[data-mock-play]')!
    fireEvent.click(playBtn)
    fireEvent.click(playBtn)
    fireEvent.click(playBtn)
    expect(postMock).toHaveBeenCalledTimes(1)
  })
})

// ── Case 5：sourceId 变更 → 重置并再次上报 ────────────────────────────────────

describe('AdminPlayer — Case 5: sourceId 变更重置 feedback ref', () => {
  it('新 sourceId 重新渲染后 onPlay 再次触发 POST', () => {
    const { container, rerender } = render(
      <AdminPlayer videoId="vid-1" sourceUrl="https://cdn.example.com/v1.m3u8" sourceId="src-1" />
    )
    fireEvent.click(container.querySelector('[data-mock-play]')!)
    expect(postMock).toHaveBeenCalledTimes(1)

    // 切换到新 source（sourceId 不同）
    rerender(
      <AdminPlayer videoId="vid-1" sourceUrl="https://cdn.example.com/v2.m3u8" sourceId="src-2" />
    )
    fireEvent.click(container.querySelector('[data-mock-play]')!)
    expect(postMock).toHaveBeenCalledTimes(2)
    expect(postMock).toHaveBeenLastCalledWith('/admin/videos/vid-1/sources/src-2/playback-verify', {
      success: true,
    })
  })
})

// ── CHG-SN-9-PLAYER-ERROR-CONSUMER-A / Wave 4 #2 ────────────────────────────

describe('AdminPlayer — Case 5b: onError → POST feedback {success:false, errorCode}', () => {
  it('Player 触发 onError → apiClient.post 携带 success:false + errorCode=event.code', () => {
    const { container } = render(
      <AdminPlayer videoId="vid-abc" sourceUrl="https://cdn.example.com/v.m3u8" sourceId="src-xyz" />,
    )
    fireEvent.click(container.querySelector('[data-mock-fail-native]')!)
    expect(postMock).toHaveBeenCalledTimes(1)
    expect(postMock).toHaveBeenCalledWith('/admin/videos/vid-abc/sources/src-xyz/playback-verify', {
      success: false,
      errorCode: 'native_media_failed',
    })
  })

  it('hls_fatal 也透传 → errorCode=hls_fatal', () => {
    const { container } = render(
      <AdminPlayer videoId="vid-1" sourceUrl="https://cdn.example.com/v.m3u8" sourceId="src-1" />,
    )
    fireEvent.click(container.querySelector('[data-mock-fail-hls]')!)
    expect(postMock).toHaveBeenLastCalledWith('/admin/videos/vid-1/sources/src-1/playback-verify', {
      success: false,
      errorCode: 'hls_fatal',
    })
  })
})

describe('AdminPlayer — Case 5c: 同 sourceId 失败上报去抖', () => {
  it('同 sourceId 第二次 onError 不再 POST（防 fatal 循环刷流量）', () => {
    const { container } = render(
      <AdminPlayer videoId="vid-1" sourceUrl="https://cdn.example.com/v.m3u8" sourceId="src-1" />,
    )
    const failBtn = container.querySelector('[data-mock-fail-native]')!
    fireEvent.click(failBtn)
    fireEvent.click(failBtn)
    fireEvent.click(failBtn)
    expect(postMock).toHaveBeenCalledTimes(1)
  })

  it('sourceId 变更 → 失败上报 ref 复位，新 source 失败再次上报', () => {
    const { container, rerender } = render(
      <AdminPlayer videoId="vid-1" sourceUrl="https://cdn.example.com/v1.m3u8" sourceId="src-1" />,
    )
    fireEvent.click(container.querySelector('[data-mock-fail-native]')!)
    expect(postMock).toHaveBeenCalledTimes(1)

    rerender(
      <AdminPlayer videoId="vid-1" sourceUrl="https://cdn.example.com/v2.m3u8" sourceId="src-2" />,
    )
    fireEvent.click(container.querySelector('[data-mock-fail-native]')!)
    expect(postMock).toHaveBeenCalledTimes(2)
    expect(postMock).toHaveBeenLastCalledWith('/admin/videos/vid-1/sources/src-2/playback-verify', {
      success: false,
      errorCode: 'native_media_failed',
    })
  })

  it('成功上报后再 onError → 失败上报独立 ref / 仍允许上报（成功→失败语义切换是有用信号）', () => {
    const { container } = render(
      <AdminPlayer videoId="vid-1" sourceUrl="https://cdn.example.com/v.m3u8" sourceId="src-1" />,
    )
    // 1. 先播放成功
    fireEvent.click(container.querySelector('[data-mock-play]')!)
    expect(postMock).toHaveBeenCalledTimes(1)
    expect(postMock).toHaveBeenLastCalledWith('/admin/videos/vid-1/sources/src-1/playback-verify', expect.objectContaining({ success: true }))
    // 2. 同 sourceId 再 onError → 仍上报失败（reportedRef 不阻塞 errorReportedRef）
    fireEvent.click(container.querySelector('[data-mock-fail-native]')!)
    expect(postMock).toHaveBeenCalledTimes(2)
    expect(postMock).toHaveBeenLastCalledWith('/admin/videos/vid-1/sources/src-1/playback-verify', expect.objectContaining({ success: false, errorCode: 'native_media_failed' }))
  })
})

// ── CHG-SN-9-PLAYER-ERROR-RETRY-CONTROL-EP / Wave 4 #4-EP / Y-166-6 ─────────

describe('AdminPlayer — Case 5d: 手动重试此线路（Y-166-6 key bump remount）', () => {
  it('点击重试按钮 → Player 重 mount（sourceLoadVersion bump 触发 key 变化）', () => {
    playerMountSpy.mockClear()
    const { container, getByTestId } = render(
      <AdminPlayer videoId="vid-1" sourceUrl="https://cdn.example.com/v.m3u8" sourceId="src-1" />,
    )
    const initialMountCount = playerMountSpy.mock.calls.length
    expect(initialMountCount).toBeGreaterThan(0)

    const retryBtn = getByTestId('admin-player-retry-btn')
    fireEvent.click(retryBtn)

    // key 变化 → Player remount → playerMountSpy 调用次数增加
    expect(playerMountSpy.mock.calls.length).toBeGreaterThan(initialMountCount)
    expect(container.querySelector('[data-mock-player]')).toBeTruthy()
  })

  it('点击重试后 errorReportedRef 清空 → 同 sourceId 再 onError 允许重新上报', () => {
    const { container, getByTestId } = render(
      <AdminPlayer videoId="vid-1" sourceUrl="https://cdn.example.com/v.m3u8" sourceId="src-1" />,
    )
    fireEvent.click(container.querySelector('[data-mock-fail-native]')!)
    expect(postMock).toHaveBeenCalledTimes(1)

    // 同 sourceId 第二次 fatal 被 errorReportedRef 去抖（CHG-SN-9-PLAYER-ERROR-CONSUMER-A 既有行为）
    fireEvent.click(container.querySelector('[data-mock-fail-native]')!)
    expect(postMock).toHaveBeenCalledTimes(1)

    // 用户点击重试 → errorReportedRef 清空 / 同 sourceId 再次 fatal 允许上报
    fireEvent.click(getByTestId('admin-player-retry-btn'))
    // remount 后 mock player 重新挂载 / 重新拿到 fail 按钮
    fireEvent.click(container.querySelector('[data-mock-fail-native]')!)
    expect(postMock).toHaveBeenCalledTimes(2)
    expect(postMock).toHaveBeenLastCalledWith('/admin/videos/vid-1/sources/src-1/playback-verify', expect.objectContaining({
      success: false,
      errorCode: 'native_media_failed',
    }))
  })
})

// ── Case 6：useSelectedLine — 活跃线路选中 ───────────────────────────────────

describe('useSelectedLine — Case 6: 正常选中', () => {
  it('onLineSelect 含活跃集 → selected 字段正确', () => {
    const { result } = renderHook(() => useSelectedLine())

    const mockLine: LineAggregate = {
      key: 'site_a|线A',
      siteKey: 'site_a',
      lineName: '线A',
      hostname: 'cdn.example.com',
      totalEpisodes: 2,
      activeCount: 1,
      probeAggregate: 'ok',
      renderAggregate: 'ok',
      latencyMedianMs: 120,
      qualityHighest: '1080P',
      episodes: [
        { id: 'ep-1', episodeNumber: 1, probe: 'ok', render: 'ok', latencyMs: 120, isActive: false, sourceUrl: '', updatedAt: '' },
        { id: 'ep-2', episodeNumber: 2, probe: 'ok', render: 'ok', latencyMs: 120, isActive: true, sourceUrl: 'https://cdn.example.com/ep2.m3u8', updatedAt: '2026-01-01T00:00:00Z' },
      ],
    }

    act(() => {
      result.current.onLineSelect({
        lineKey: 'site_a|线A',
        line: mockLine,
        firstActiveUrl: 'https://cdn.example.com/ep2.m3u8',
      })
    })

    expect(result.current.selected).toEqual({
      lineKey: 'site_a|线A',
      sourceUrl: 'https://cdn.example.com/ep2.m3u8',
      sourceId: 'ep-2',
    })
  })
})

// ── Case 7：useSelectedLine — 无活跃集 → null ────────────────────────────────

describe('useSelectedLine — Case 7: 无活跃集', () => {
  it('所有集 isActive=false → selected 保持 null', () => {
    const { result } = renderHook(() => useSelectedLine())

    const mockLine: LineAggregate = {
      key: 'site_a|线B',
      siteKey: 'site_a',
      lineName: '线B',
      hostname: null,
      totalEpisodes: 1,
      activeCount: 0,
      probeAggregate: 'dead',
      renderAggregate: 'dead',
      latencyMedianMs: null,
      qualityHighest: null,
      episodes: [
        { id: 'ep-x', episodeNumber: 1, probe: 'dead', render: 'dead', latencyMs: null, isActive: false, sourceUrl: '', updatedAt: '' },
      ],
    }

    act(() => {
      result.current.onLineSelect({
        lineKey: 'site_a|线B',
        line: mockLine,
        firstActiveUrl: null,
      })
    })

    expect(result.current.selected).toBeNull()
  })
})

// ── Case 8：useSelectedLine — clearSelection ─────────────────────────────────

describe('useSelectedLine — Case 8: clearSelection', () => {
  it('clearSelection() → selected 变为 null', () => {
    const { result } = renderHook(() => useSelectedLine())

    const mockLine: LineAggregate = {
      key: 'site_a|线C',
      siteKey: 'site_a',
      lineName: '线C',
      hostname: null,
      totalEpisodes: 1,
      activeCount: 1,
      probeAggregate: 'ok',
      renderAggregate: 'ok',
      latencyMedianMs: null,
      qualityHighest: null,
      episodes: [
        { id: 'ep-z', episodeNumber: 1, probe: 'ok', render: 'ok', latencyMs: null, isActive: true, sourceUrl: 'https://cdn.example.com/ep.m3u8', updatedAt: '' },
      ],
    }

    act(() => {
      result.current.onLineSelect({ lineKey: 'site_a|线C', line: mockLine, firstActiveUrl: 'https://cdn.example.com/ep.m3u8' })
    })
    expect(result.current.selected).not.toBeNull()

    act(() => {
      result.current.clearSelection()
    })
    expect(result.current.selected).toBeNull()
  })
})

/**
 * admin-player.test.tsx — AdminPlayer + useSelectedLine 单测（FIX-D / ≥ 5 case）
 */
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanup, render, fireEvent } from '@testing-library/react'
import { renderHook, act } from '@testing-library/react'
import React from 'react'

// ── Mock @resovo/player-core ──────────────────────────────────────────────────
// Player 组件用 <video> 需要完整 DOM；测试层替换为 stub

vi.mock('@resovo/player-core', () => ({
  Player: vi.fn(({ src, onPlay }: { src?: string; onPlay?: () => void }) => (
    <div data-mock-player data-src={src ?? ''}>
      <button type="button" data-mock-play onClick={onPlay}>play</button>
    </div>
  )),
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

// ── Case 3：首次 onPlay → feedback POST ───────────────────────────────────────

describe('AdminPlayer — Case 3: 首次播放上报 feedback', () => {
  it('onPlay 首次调用 → apiClient.post 携带 videoId/sourceId/success:true', () => {
    const { container } = render(
      <AdminPlayer videoId="vid-abc" sourceUrl="https://cdn.example.com/v.m3u8" sourceId="src-xyz" />
    )
    fireEvent.click(container.querySelector('[data-mock-play]')!)
    expect(postMock).toHaveBeenCalledTimes(1)
    expect(postMock).toHaveBeenCalledWith('/feedback/playback', {
      videoId: 'vid-abc',
      sourceId: 'src-xyz',
      success: true,
    })
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
    expect(postMock).toHaveBeenLastCalledWith('/feedback/playback', {
      videoId: 'vid-1',
      sourceId: 'src-2',
      success: true,
    })
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

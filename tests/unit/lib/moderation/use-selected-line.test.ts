/**
 * @vitest-environment jsdom
 *
 * use-selected-line.test.ts — CHG-345 / Wave 1 #2
 *
 * 覆盖 EpisodeSelector ↔ LinesPanel ↔ AdminPlayer 联动 hook：
 *   #1 初始无选中 → selected = null
 *   #2 onLineSelect 选中 line（含 ep=1 active） → selected.sourceUrl = ep1 URL
 *   #3 currentEp 切换 1 → 3 → selected.sourceUrl 跟随更新到 ep3
 *   #4 currentEp 切到该 line 不存在的 ep → fallback 到第一活跃 ep
 *   #5 line 全部 dead（isActive=false）→ selected = null
 *   #6 clearSelection → selected = null
 *   #7 切换不同 line 后,currentEp 与新 line 重新联动
 */
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSelectedLine } from '../../../../apps/server-next/src/lib/moderation/use-selected-line'
import type { LineAggregate, EpisodeMini } from '@resovo/admin-ui'

function makeEp(overrides: Partial<EpisodeMini> = {}): EpisodeMini {
  return {
    id: `ep-${overrides.episodeNumber ?? 'x'}`,
    episodeNumber: 1,
    probe: 'ok',
    render: 'ok',
    latencyMs: 200,
    isActive: true,
    sourceUrl: `https://cdn.test/ep${overrides.episodeNumber ?? 1}.m3u8`,
    updatedAt: '2026-05-27T00:00:00.000Z',
    ...overrides,
  }
}

function makeLine(key: string, episodes: EpisodeMini[]): LineAggregate {
  return {
    key,
    siteKey: 'site-a',
    lineName: 'line-a',
    hostname: 'cdn.test',
    totalEpisodes: episodes.length,
    activeCount: episodes.filter(e => e.isActive).length,
    probeAggregate: 'ok',
    renderAggregate: 'ok',
    latencyMedianMs: 200,
    qualityHighest: '1080P',
    episodes,
  }
}

describe('useSelectedLine — CHG-345 EpisodeSelector ↔ LinesPanel ↔ AdminPlayer 联动', () => {
  it('#1 初始无选中 → selected = null', () => {
    const { result } = renderHook(() => useSelectedLine(1))
    expect(result.current.selected).toBeNull()
  })

  it('#2 onLineSelect 选中 line（含 ep=1 active）→ selected.sourceUrl = ep1 URL', () => {
    const { result } = renderHook(() => useSelectedLine(1))
    const line = makeLine('site-a|line-a', [
      makeEp({ episodeNumber: 1, id: 'ep-1', sourceUrl: 'https://cdn.test/ep1.m3u8' }),
      makeEp({ episodeNumber: 2, id: 'ep-2', sourceUrl: 'https://cdn.test/ep2.m3u8' }),
    ])

    act(() => {
      result.current.onLineSelect({ lineKey: line.key, line, firstActiveUrl: 'https://cdn.test/ep1.m3u8' })
    })

    expect(result.current.selected).toEqual({
      lineKey: 'site-a|line-a',
      sourceUrl: 'https://cdn.test/ep1.m3u8',
      sourceId: 'ep-1',
    })
  })

  it('#3 currentEp 切换 1 → 3 → selected.sourceUrl 跟随更新到 ep3（核心 bug 修复验证）', () => {
    let currentEp = 1
    const line = makeLine('site-a|line-a', [
      makeEp({ episodeNumber: 1, id: 'ep-1', sourceUrl: 'https://cdn.test/ep1.m3u8' }),
      makeEp({ episodeNumber: 2, id: 'ep-2', sourceUrl: 'https://cdn.test/ep2.m3u8' }),
      makeEp({ episodeNumber: 3, id: 'ep-3', sourceUrl: 'https://cdn.test/ep3.m3u8' }),
    ])

    const { result, rerender } = renderHook(() => useSelectedLine(currentEp))

    act(() => {
      result.current.onLineSelect({ lineKey: line.key, line, firstActiveUrl: 'https://cdn.test/ep1.m3u8' })
    })

    expect(result.current.selected?.sourceUrl).toBe('https://cdn.test/ep1.m3u8')
    expect(result.current.selected?.sourceId).toBe('ep-1')

    currentEp = 3
    rerender()

    expect(result.current.selected?.sourceUrl).toBe('https://cdn.test/ep3.m3u8')
    expect(result.current.selected?.sourceId).toBe('ep-3')
  })

  it('#4 currentEp 切到该 line 不存在的 ep（line A 仅 1-6 集，切 ep=10）→ fallback 到第一活跃 ep', () => {
    let currentEp = 1
    const line = makeLine('site-b|line-b', [
      makeEp({ episodeNumber: 1, id: 'b-1', sourceUrl: 'https://cdn.test/b/ep1.m3u8' }),
      makeEp({ episodeNumber: 2, id: 'b-2', sourceUrl: 'https://cdn.test/b/ep2.m3u8' }),
      makeEp({ episodeNumber: 3, id: 'b-3', sourceUrl: 'https://cdn.test/b/ep3.m3u8' }),
    ])

    const { result, rerender } = renderHook(() => useSelectedLine(currentEp))

    act(() => {
      result.current.onLineSelect({ lineKey: line.key, line, firstActiveUrl: 'https://cdn.test/b/ep1.m3u8' })
    })

    currentEp = 10
    rerender()

    expect(result.current.selected?.sourceUrl).toBe('https://cdn.test/b/ep1.m3u8')
    expect(result.current.selected?.sourceId).toBe('b-1')
  })

  it('#5 line 全部 dead（isActive=false）→ selected = null', () => {
    const { result } = renderHook(() => useSelectedLine(1))
    const line = makeLine('site-c|line-c', [
      makeEp({ episodeNumber: 1, id: 'c-1', isActive: false }),
      makeEp({ episodeNumber: 2, id: 'c-2', isActive: false }),
    ])

    act(() => {
      result.current.onLineSelect({ lineKey: line.key, line, firstActiveUrl: null })
    })

    expect(result.current.selected).toBeNull()
  })

  it('#6 clearSelection → selected = null', () => {
    const { result } = renderHook(() => useSelectedLine(1))
    const line = makeLine('site-a|line-a', [makeEp({ episodeNumber: 1, id: 'ep-1' })])

    act(() => {
      result.current.onLineSelect({ lineKey: line.key, line, firstActiveUrl: 'https://cdn.test/ep1.m3u8' })
    })
    expect(result.current.selected).not.toBeNull()

    act(() => {
      result.current.clearSelection()
    })
    expect(result.current.selected).toBeNull()
  })

  it('#7 切换不同 line 后,currentEp 与新 line 重新联动', () => {
    let currentEp = 2
    const lineA = makeLine('site-a|line-a', [
      makeEp({ episodeNumber: 1, id: 'a-1', sourceUrl: 'https://cdn.test/a/ep1.m3u8' }),
      makeEp({ episodeNumber: 2, id: 'a-2', sourceUrl: 'https://cdn.test/a/ep2.m3u8' }),
    ])
    const lineB = makeLine('site-b|line-b', [
      makeEp({ episodeNumber: 1, id: 'b-1', sourceUrl: 'https://cdn.test/b/ep1.m3u8' }),
      makeEp({ episodeNumber: 2, id: 'b-2', sourceUrl: 'https://cdn.test/b/ep2.m3u8' }),
      makeEp({ episodeNumber: 3, id: 'b-3', sourceUrl: 'https://cdn.test/b/ep3.m3u8' }),
    ])

    const { result, rerender } = renderHook(() => useSelectedLine(currentEp))

    act(() => {
      result.current.onLineSelect({ lineKey: lineA.key, line: lineA, firstActiveUrl: 'https://cdn.test/a/ep1.m3u8' })
    })
    expect(result.current.selected?.sourceUrl).toBe('https://cdn.test/a/ep2.m3u8')

    act(() => {
      result.current.onLineSelect({ lineKey: lineB.key, line: lineB, firstActiveUrl: 'https://cdn.test/b/ep1.m3u8' })
    })
    expect(result.current.selected?.sourceUrl).toBe('https://cdn.test/b/ep2.m3u8')
    expect(result.current.selected?.lineKey).toBe('site-b|line-b')

    currentEp = 3
    rerender()
    expect(result.current.selected?.sourceUrl).toBe('https://cdn.test/b/ep3.m3u8')
  })
})

/**
 * line-matrix.test.ts — PLAYER-LINE-BOUND-EP
 *
 * 覆盖 buildLineKey（红线 2 分组键口径）+ buildLineMatrix（线路优先矩阵派生）：
 * 分组 / 集号升序去重 / 同集保最高分 / 线路首次出现序 / representative=最高分集源。
 */

import { describe, it, expect } from 'vitest'
import type { VideoSource } from '@resovo/types'
import { buildLineKey } from '../../../apps/web-next/src/lib/line-display-name'
import { buildLineMatrix, buildThemedLines } from '../../../apps/web-next/src/lib/line-matrix'
import { THEME_NUMBERS } from '../../../apps/web-next/src/lib/line-display-name'

function src(partial: Partial<VideoSource>): VideoSource {
  return {
    id: Math.random().toString(36).slice(2),
    videoId: 'v1',
    sourceUrl: 'https://e.com/x.m3u8',
    sourceName: '线路1',
    siteDisplayName: null,
    quality: '1080P',
    type: 'hls',
    episodeNumber: 1,
    isActive: true,
    effectiveScore: 0.5,
    ...partial,
  } as unknown as VideoSource
}

describe('buildLineKey（红线 2 分组键）', () => {
  it('siteDisplayName 非空 → 复合 (site, name)', () => {
    expect(buildLineKey({ siteDisplayName: '腾讯云', sourceName: '线路1' })).toContain('腾讯云')
    expect(buildLineKey({ siteDisplayName: '腾讯云', sourceName: '线路1' })).toContain('线路1')
  })

  it('siteDisplayName 为 null/空白 → 降级 sourceName 单键', () => {
    expect(buildLineKey({ siteDisplayName: null, sourceName: 'L1' })).toBe('L1')
    expect(buildLineKey({ siteDisplayName: '   ', sourceName: 'L1' })).toBe('L1')
  })

  it('同站点不同 sourceName → 不同 key（保线路粒度）', () => {
    const a = buildLineKey({ siteDisplayName: '腾讯', sourceName: '线路1' })
    const b = buildLineKey({ siteDisplayName: '腾讯', sourceName: '线路2' })
    expect(a).not.toBe(b)
  })

  it('分隔符防串台：site+name 拼接不与无分隔字符串碰撞', () => {
    const a = buildLineKey({ siteDisplayName: 'AB', sourceName: 'C' })
    const b = buildLineKey({ siteDisplayName: 'A', sourceName: 'BC' })
    expect(a).not.toBe(b)
  })
})

describe('buildLineMatrix', () => {
  it('按线路分组 + 集号升序去重 + episodes 映射', () => {
    const sources = [
      src({ siteDisplayName: '线路A', sourceName: 'a', episodeNumber: 1 }),
      src({ siteDisplayName: '线路A', sourceName: 'a', episodeNumber: 3 }),
      src({ siteDisplayName: '线路A', sourceName: 'a', episodeNumber: 2 }),
      src({ siteDisplayName: '线路B', sourceName: 'b', episodeNumber: 1 }),
      src({ siteDisplayName: '线路B', sourceName: 'b', episodeNumber: 2 }),
    ]
    const matrix = buildLineMatrix(sources)
    expect(matrix).toHaveLength(2)
    const lineA = matrix[0]!
    expect(lineA.episodeNumbers).toEqual([1, 2, 3])
    expect(lineA.episodes.get(3)).toBeDefined()
    const lineB = matrix[1]!
    expect(lineB.episodeNumbers).toEqual([1, 2])
  })

  it('线路顺序 = 输入首次出现序（复用后端排序）', () => {
    const sources = [
      src({ siteDisplayName: 'Z', sourceName: 'z', episodeNumber: 1, effectiveScore: 0.9 }),
      src({ siteDisplayName: 'A', sourceName: 'a', episodeNumber: 1, effectiveScore: 0.1 }),
    ]
    const matrix = buildLineMatrix(sources)
    expect(matrix[0]!.siteDisplayName).toBe('Z') // 先出现者在前，与分数无关
    expect(matrix[1]!.siteDisplayName).toBe('A')
  })

  it('同线路同集去重保 effectiveScore 最高', () => {
    const sources = [
      src({ siteDisplayName: 'A', sourceName: 'a', episodeNumber: 1, sourceUrl: 'low', effectiveScore: 0.2 }),
      src({ siteDisplayName: 'A', sourceName: 'a', episodeNumber: 1, sourceUrl: 'high', effectiveScore: 0.8 }),
    ]
    const matrix = buildLineMatrix(sources)
    expect(matrix).toHaveLength(1)
    expect(matrix[0]!.episodes.get(1)!.sourceUrl).toBe('high')
  })

  it('representative = 该线路 effectiveScore 最高的集源（黄线 3 / 非首集）', () => {
    const sources = [
      src({ siteDisplayName: 'A', sourceName: 'a', episodeNumber: 1, sourceUrl: 'ep1', effectiveScore: 0.1 }),
      src({ siteDisplayName: 'A', sourceName: 'a', episodeNumber: 2, sourceUrl: 'ep2', effectiveScore: 0.9 }),
    ]
    const matrix = buildLineMatrix(sources)
    expect(matrix[0]!.representative.sourceUrl).toBe('ep2')
  })

  it('episodeNumber null（电影）归一为第 1 集', () => {
    const matrix = buildLineMatrix([src({ siteDisplayName: 'A', sourceName: 'a', episodeNumber: null })])
    expect(matrix[0]!.episodeNumbers).toEqual([1])
  })

  it('空输入 → 空矩阵', () => {
    expect(buildLineMatrix([])).toEqual([])
  })
})

describe('buildThemedLines', () => {
  it('与 lines[] 同序同长，含主题标签', () => {
    const matrix = buildLineMatrix([
      src({ siteDisplayName: 'A', sourceName: 'a', episodeNumber: 1, effectiveScore: 0.8 }),
      src({ siteDisplayName: 'B', sourceName: 'b', episodeNumber: 1, effectiveScore: 0.7 }),
    ])
    const themed = buildThemedLines(matrix, THEME_NUMBERS)
    expect(themed).toHaveLength(2)
    expect(themed[0]!.label).toBeTruthy()
  })
})

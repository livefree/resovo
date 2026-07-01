/**
 * line-matrix.test.ts — PLAYER-12-A / SEQ-20260630-01
 *
 * 覆盖 @resovo/types 跨端唯一真源：
 * - buildLineKey（分组键口径：site+name 复合 / null 降级 / U+0000 防串台）
 * - groupSourcesIntoLineMatrix（服务端聚合）：线路首现序 / representative=最高分投影 /
 *   focusEpisodeSource 当前集完整源（BLOCKER-1）/ 缺集→null / 越界骨架全 null / 空矩阵 /
 *   episodeNumbers 并集升序去重 / 同集去重保最高分。
 */

import { describe, it, expect } from 'vitest'
import type { VideoSource } from '@resovo/types'
import { buildLineKey, groupSourcesIntoLineMatrix } from '@resovo/types'

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
    lastChecked: null,
    effectiveScore: 0.5,
    ...partial,
  } as unknown as VideoSource
}

describe('buildLineKey（跨端分组键真源）', () => {
  it('siteDisplayName 非空 → 复合 (site, name)', () => {
    const key = buildLineKey({ siteDisplayName: '腾讯云', sourceName: '线路1' })
    expect(key).toContain('腾讯云')
    expect(key).toContain('线路1')
  })

  it('siteDisplayName 为 null/空白 → 降级 sourceName 单键', () => {
    expect(buildLineKey({ siteDisplayName: null, sourceName: 'L1' })).toBe('L1')
    expect(buildLineKey({ siteDisplayName: '   ', sourceName: 'L1' })).toBe('L1')
  })

  it('U+0000 分隔符防串台：site+name 不与无分隔字符串碰撞', () => {
    expect(buildLineKey({ siteDisplayName: 'AB', sourceName: 'C' })).not.toBe(
      buildLineKey({ siteDisplayName: 'A', sourceName: 'BC' }),
    )
    // 分隔符确为 U+0000（业务文案不会出现）
    expect(buildLineKey({ siteDisplayName: 'A', sourceName: 'B' })).toBe('A\u0000B')
  })
})

describe('groupSourcesIntoLineMatrix（服务端聚合）', () => {
  it('线路顺序 = 输入首次出现序（复用后端权威排序，与分数无关）', () => {
    const matrix = groupSourcesIntoLineMatrix(
      [
        src({ siteDisplayName: 'Z', sourceName: 'z', episodeNumber: 1, effectiveScore: 0.9 }),
        src({ siteDisplayName: 'A', sourceName: 'a', episodeNumber: 1, effectiveScore: 0.1 }),
      ],
      1,
    )
    expect(matrix.lines).toHaveLength(2)
    expect(matrix.lines[0]!.siteDisplayName).toBe('Z')
    expect(matrix.lines[1]!.siteDisplayName).toBe('A')
  })

  it('representative = 该线路 effectiveScore 最高集源（非首集），且为纯 label/health 投影（结构不可播放）', () => {
    const matrix = groupSourcesIntoLineMatrix(
      [
        src({ siteDisplayName: 'A', sourceName: 'a', episodeNumber: 1, sourceUrl: 'ep1', effectiveScore: 0.1 }),
        src({ siteDisplayName: 'A', sourceName: 'a', episodeNumber: 2, sourceUrl: 'ep2', effectiveScore: 0.9 }),
      ],
      1,
    )
    const rep = matrix.lines[0]!.representative
    expect(rep.episodeNumber).toBe(2) // ep2 是最高分集源（0.9 > 0.1）
    expect(rep.effectiveScore).toBe(0.9)
    // Codex MEDIUM / arch-reviewer REVISE：representative 结构上不可播放——刻意剔除可播放定位字段
    expect(rep).not.toHaveProperty('sourceUrl')
    expect(rep).not.toHaveProperty('type')
    expect(rep).not.toHaveProperty('id')
    expect(rep).not.toHaveProperty('videoId')
    expect(rep).not.toHaveProperty('isActive')
  })

  it('focusEpisodeSource = focusEpisode 该线路完整源（BLOCKER-1，含 id 可播放）', () => {
    const matrix = groupSourcesIntoLineMatrix(
      [
        src({ id: 'x1', siteDisplayName: 'A', sourceName: 'a', episodeNumber: 1, sourceUrl: 'ep1' }),
        src({ id: 'x2', siteDisplayName: 'A', sourceName: 'a', episodeNumber: 2, sourceUrl: 'ep2' }),
      ],
      2,
    )
    const fes = matrix.lines[0]!.focusEpisodeSource
    expect(fes).not.toBeNull()
    expect(fes!.id).toBe('x2')
    expect(fes!.sourceUrl).toBe('ep2')
  })

  it('线路缺 focusEpisode 集 → focusEpisodeSource = null（骨架仍在）', () => {
    const matrix = groupSourcesIntoLineMatrix(
      [
        src({ siteDisplayName: 'A', sourceName: 'a', episodeNumber: 1 }),
        src({ siteDisplayName: 'B', sourceName: 'b', episodeNumber: 1 }),
        src({ siteDisplayName: 'B', sourceName: 'b', episodeNumber: 5 }),
      ],
      5,
    )
    expect(matrix.lines).toHaveLength(2)
    expect(matrix.lines[0]!.focusEpisodeSource).toBeNull() // A 无第 5 集
    expect(matrix.lines[1]!.focusEpisodeSource).not.toBeNull() // B 有第 5 集
  })

  it('越界 focusEpisode（无任何线路提供）→ 全线路 focusEpisodeSource=null，episodeNumbers 仍非空（D3 非 404）', () => {
    const matrix = groupSourcesIntoLineMatrix(
      [
        src({ siteDisplayName: 'A', sourceName: 'a', episodeNumber: 1 }),
        src({ siteDisplayName: 'A', sourceName: 'a', episodeNumber: 2 }),
      ],
      99,
    )
    expect(matrix.focusEpisode).toBe(99)
    expect(matrix.episodeNumbers).toEqual([1, 2]) // 全并集仍返回，供剧集选择器
    expect(matrix.lines.every((l) => l.focusEpisodeSource === null)).toBe(true)
  })

  it('同线路同 focusEpisode 多源 → focusEpisodeSource 保 effectiveScore 最高', () => {
    const matrix = groupSourcesIntoLineMatrix(
      [
        src({ siteDisplayName: 'A', sourceName: 'a', episodeNumber: 1, sourceUrl: 'low', effectiveScore: 0.2 }),
        src({ siteDisplayName: 'A', sourceName: 'a', episodeNumber: 1, sourceUrl: 'high', effectiveScore: 0.8 }),
      ],
      1,
    )
    expect(matrix.lines[0]!.focusEpisodeSource!.sourceUrl).toBe('high')
  })

  it('episodeNumbers：per-line 升序去重 + 顶层全线路并集', () => {
    const matrix = groupSourcesIntoLineMatrix(
      [
        src({ siteDisplayName: 'A', sourceName: 'a', episodeNumber: 3 }),
        src({ siteDisplayName: 'A', sourceName: 'a', episodeNumber: 1 }),
        src({ siteDisplayName: 'A', sourceName: 'a', episodeNumber: 1 }),
        src({ siteDisplayName: 'B', sourceName: 'b', episodeNumber: 2 }),
      ],
      1,
    )
    expect(matrix.lines[0]!.episodeNumbers).toEqual([1, 3])
    expect(matrix.episodeNumbers).toEqual([1, 2, 3])
  })

  it('episodeNumber null（电影）归一为第 1 集', () => {
    const matrix = groupSourcesIntoLineMatrix([src({ siteDisplayName: 'A', sourceName: 'a', episodeNumber: null })], 1)
    expect(matrix.episodeNumbers).toEqual([1])
    expect(matrix.lines[0]!.focusEpisodeSource).not.toBeNull()
  })

  it('空输入 → 空矩阵（消费方须防御）', () => {
    expect(groupSourcesIntoLineMatrix([], 1)).toEqual({ focusEpisode: 1, episodeNumbers: [], lines: [] })
  })
})

/**
 * typeFromProvider.test.ts — ADR-203 / META-44-B provider 形式类型信号纯函数
 * 覆盖：tmdbTypeSignal（media_type+genre 映射 / movie+16 不推 anime / documentary 跨 media_type）
 *       doubanTypeSignal（形式类别提取 / 顺序优先 / 纯题材→null）
 *       resolveTypeSignal（fill-if-default 闸门：other→写 / 具体→conflict / 幂等→无）
 */
import { describe, it, expect } from 'vitest'
import { tmdbTypeSignal, doubanTypeSignal, resolveTypeSignal } from '@/api/lib/typeFromProvider'

describe('tmdbTypeSignal', () => {
  it('tv + genre16(动画) → anime', () => {
    expect(tmdbTypeSignal('tv', [16, 10765])).toBe('anime')
  })
  it('movie + genre16 → 不推 anime，走 movie 兜底（D-203-1 注①）', () => {
    expect(tmdbTypeSignal('movie', [16, 18])).toBe('movie')
  })
  it('genre99(纪录) 跨 media_type 一致 → documentary', () => {
    expect(tmdbTypeSignal('movie', [99])).toBe('documentary')
    expect(tmdbTypeSignal('tv', [99, 16])).toBe('documentary') // documentary 优先于 tv+16
  })
  it('tv + 10762(Kids) → kids / tv + 10763(News) → news', () => {
    expect(tmdbTypeSignal('tv', [10762])).toBe('kids')
    expect(tmdbTypeSignal('tv', [10763])).toBe('news')
  })
  it('media_type 兜底：movie→movie / tv→series（无形式 genre）', () => {
    expect(tmdbTypeSignal('movie', [28, 12])).toBe('movie')
    expect(tmdbTypeSignal('tv', [18, 9648])).toBe('series')
  })
  it('低置信信号不映射：10751(Family)/10764(Reality) 不触发 kids/variety', () => {
    expect(tmdbTypeSignal('tv', [10751])).toBe('series') // family 不推 kids
    expect(tmdbTypeSignal('tv', [10764])).toBe('series') // reality 不推 variety
  })
})

describe('doubanTypeSignal', () => {
  it('形式类别提取：动画→anime / 纪录片→documentary / 短片→short / 儿童→kids', () => {
    expect(doubanTypeSignal(['动画', '冒险'])).toBe('anime')
    expect(doubanTypeSignal(['纪录片'])).toBe('documentary')
    expect(doubanTypeSignal(['短片', '剧情'])).toBe('short')
    expect(doubanTypeSignal(['儿童', '家庭'])).toBe('kids')
  })
  it('多形式类别按顺序优先（动画 > 纪录片 > 短片 > 儿童）', () => {
    expect(doubanTypeSignal(['纪录片', '动画'])).toBe('anime')
  })
  it('纯题材（剧情/喜剧）→ null', () => {
    expect(doubanTypeSignal(['剧情', '喜剧', '爱情'])).toBeNull()
  })
  it('空数组 → null', () => {
    expect(doubanTypeSignal([])).toBeNull()
  })
})

describe('resolveTypeSignal（fill-if-default 闸门）', () => {
  it("current==='other' → 写候选", () => {
    expect(resolveTypeSignal('other', 'anime')).toEqual({ typeToWrite: 'anime', conflict: null })
  })
  it('current 为具体值 ≠ 候选 → 不写 + conflict（绝不覆盖具体 type）', () => {
    expect(resolveTypeSignal('series', 'anime')).toEqual({ typeToWrite: null, conflict: { current: 'series', candidate: 'anime' } })
  })
  it('候选 === 现值 → 幂等无操作（含 other===other / 具体===具体）', () => {
    expect(resolveTypeSignal('other', null)).toEqual({ typeToWrite: null, conflict: null })
    expect(resolveTypeSignal('anime', 'anime')).toEqual({ typeToWrite: null, conflict: null })
  })
  it('候选 null → 无操作（无 conflict）', () => {
    expect(resolveTypeSignal('movie', null)).toEqual({ typeToWrite: null, conflict: null })
  })
})

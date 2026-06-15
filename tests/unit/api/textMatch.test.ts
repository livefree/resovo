/**
 * tests/unit/api/textMatch.test.ts — 通用文本/年份相似度工具（META-47 从 DoubanService.utils 下沉）
 *
 * 覆盖下沉后行为不变：similarity（bigram Jaccard）/ normalizeForMatch（去括号+仅 alnum）/ parseYear。
 * DoubanService.utils 经 re-export 复用同款实现，douban 既有打分测试为间接回归面。
 */
import { describe, it, expect } from 'vitest'
import { similarity, normalizeForMatch, parseYear } from '@/api/lib/textMatch'

describe('similarity', () => {
  it('完全相同 → 1', () => {
    expect(similarity('abcdef', 'abcdef')).toBe(1)
  })
  it('忽略大小写 + 空白', () => {
    expect(similarity('Ab Cd', 'abcd')).toBe(1)
  })
  it('空串任一 → 0', () => {
    expect(similarity('', 'abc')).toBe(0)
    expect(similarity('abc', '')).toBe(0)
  })
  it('部分重叠 bigram Jaccard（abcdef~abcdeg=0.8）', () => {
    expect(similarity('abcdef', 'abcdeg')).toBeCloseTo(0.8)
  })
  it('完全不相交 → 0', () => {
    expect(similarity('abcdef', 'zzzzzz')).toBe(0)
  })
})

describe('normalizeForMatch', () => {
  it('小写 + 去括号内容 + 仅保留字母数字', () => {
    expect(normalizeForMatch('Frieren（葬送）: Beyond!')).toBe('frierenbeyond')
  })
  it('全角括号同样剔除', () => {
    expect(normalizeForMatch('标题（副标题）')).toBe('标题')
  })
  it('保留 CJK 字母与数字', () => {
    expect(normalizeForMatch('进击的巨人 2 期')).toBe('进击的巨人2期')
  })
})

describe('parseYear', () => {
  it('从字符串抽首个 4 位年份', () => {
    expect(parseYear('2023-09-29')).toBe(2023)
  })
  it('数值年份', () => {
    expect(parseYear(2024)).toBe(2024)
  })
  it('无年份 / null / undefined → null', () => {
    expect(parseYear('暂无')).toBeNull()
    expect(parseYear(null)).toBeNull()
    expect(parseYear(undefined)).toBeNull()
  })
})

/**
 * format-play-count.test.ts — STATS-05-A 播放次数格式化（3 处展示共用 util 真源）
 */
import { describe, it, expect } from 'vitest'
import { formatPlayCount } from '@/lib/format-play-count'

describe('formatPlayCount (STATS-05-A)', () => {
  it('0 → "0"（无统计行显示 0，不隐藏）', () => {
    expect(formatPlayCount(0)).toBe('0')
  })

  it('小于 1 万 → 原数字字符串', () => {
    expect(formatPlayCount(1)).toBe('1')
    expect(formatPlayCount(9999)).toBe('9999')
  })

  it('恰好 1 万 → "1.0万"', () => {
    expect(formatPlayCount(10000)).toBe('1.0万')
  })

  it('万级 → "x.x万"（一位小数）', () => {
    expect(formatPlayCount(12345)).toBe('1.2万')
    expect(formatPlayCount(1234567)).toBe('123.5万')
  })
})

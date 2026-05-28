/**
 * format-country-name.test.ts — formatCountryName helper（CHG-366 / plan §10.4.3）
 */
import { describe, it, expect } from 'vitest'
import { formatCountryName } from '@resovo/types'

describe('formatCountryName()', () => {
  it('US 默认 zh-CN → "美国"', () => {
    expect(formatCountryName('US')).toBe('美国')
  })

  it('CN locale=en → "China"', () => {
    expect(formatCountryName('CN', 'en')).toBe('China')
  })

  it('JP 默认 zh-CN → "日本"', () => {
    expect(formatCountryName('JP')).toBe('日本')
  })

  it('小写 us 被规范化为 US → "美国"', () => {
    expect(formatCountryName('us')).toBe('美国')
  })

  it('null / undefined / 空串 → fallback', () => {
    expect(formatCountryName(null)).toBe('')
    expect(formatCountryName(undefined)).toBe('')
    expect(formatCountryName('')).toBe('')
    expect(formatCountryName(null, 'zh-CN', '—')).toBe('—')
  })

  it('非法格式（长度 / 含数字）→ 原 code', () => {
    expect(formatCountryName('USA')).toBe('USA')        // 3 letters
    expect(formatCountryName('U1')).toBe('U1')          // contains digit
    expect(formatCountryName('U')).toBe('U')            // 1 letter
  })

  it('合法格式但无效 region 代码（如 XX）→ 原 code 降级', () => {
    // Intl.DisplayNames 对未知 region 行为：返回 input 本身 → helper 降级原 code
    expect(formatCountryName('XX')).toBe('XX')
  })
})

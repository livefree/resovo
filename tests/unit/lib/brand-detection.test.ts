import { describe, it, expect } from 'vitest'
import {
  parseBrandSlug,
  parseTheme,
  DEFAULT_BRAND_SLUG,
  DEFAULT_THEME,
} from '../../../apps/web-next/src/lib/brand-detection'

describe('parseBrandSlug', () => {
  it('undefined → 返回默认值', () => {
    expect(parseBrandSlug(undefined)).toBe(DEFAULT_BRAND_SLUG)
  })

  it('空字符串 → 返回默认值', () => {
    expect(parseBrandSlug('')).toBe(DEFAULT_BRAND_SLUG)
  })

  it('纯空白 → 返回默认值（trim 后为空，正则不匹配）', () => {
    expect(parseBrandSlug('   ')).toBe(DEFAULT_BRAND_SLUG)
  })

  it('合法 slug resovo → 原样返回', () => {
    expect(parseBrandSlug('resovo')).toBe('resovo')
  })

  it('合法 slug 带连字符 flux-pro → 原样返回', () => {
    expect(parseBrandSlug('flux-pro')).toBe('flux-pro')
  })

  it('合法 slug 含数字 brand2026 → 原样返回', () => {
    expect(parseBrandSlug('brand2026')).toBe('brand2026')
  })

  it('大写输入 RESOVO → 归一化为小写 resovo', () => {
    expect(parseBrandSlug('RESOVO')).toBe('resovo')
  })

  it('首尾空白 "  flux  " → 去除空白后返回 flux', () => {
    expect(parseBrandSlug('  flux  ')).toBe('flux')
  })

  it('含下划线 flux_pro → 返回默认值', () => {
    expect(parseBrandSlug('flux_pro')).toBe(DEFAULT_BRAND_SLUG)
  })

  it('含点号 flux.pro → 返回默认值', () => {
    expect(parseBrandSlug('flux.pro')).toBe(DEFAULT_BRAND_SLUG)
  })

  it('含空格 "flux pro" → 返回默认值', () => {
    expect(parseBrandSlug('flux pro')).toBe(DEFAULT_BRAND_SLUG)
  })

  it('XSS 注入尝试 <script> → 返回默认值', () => {
    expect(parseBrandSlug('<script>')).toBe(DEFAULT_BRAND_SLUG)
  })

  it('超长输入（65 字符）→ 返回默认值（正则上限 64）', () => {
    expect(parseBrandSlug('a'.repeat(65))).toBe(DEFAULT_BRAND_SLUG)
  })

  it('正好 64 字符合法 slug → 原样返回（边界值）', () => {
    const slug = 'a'.repeat(64)
    expect(parseBrandSlug(slug)).toBe(slug)
  })

  it('Unicode 中文字符 品牌 → 返回默认值', () => {
    expect(parseBrandSlug('品牌')).toBe(DEFAULT_BRAND_SLUG)
  })
})

describe('parseTheme', () => {
  it('undefined → 返回默认值 system', () => {
    expect(parseTheme(undefined)).toBe(DEFAULT_THEME)
  })

  it('空字符串 → 返回默认值', () => {
    expect(parseTheme('')).toBe(DEFAULT_THEME)
  })

  it('light → light', () => {
    expect(parseTheme('light')).toBe('light')
  })

  it('dark → dark', () => {
    expect(parseTheme('dark')).toBe('dark')
  })

  it('system → system', () => {
    expect(parseTheme('system')).toBe('system')
  })

  it('大写 DARK → 返回默认值（严格不归一化）', () => {
    expect(parseTheme('DARK')).toBe(DEFAULT_THEME)
  })

  it('多余空白 " light " → 返回默认值（不 trim，写入端保证干净值）', () => {
    expect(parseTheme(' light ')).toBe(DEFAULT_THEME)
  })

  it('非法值 auto → 返回默认值', () => {
    expect(parseTheme('auto')).toBe(DEFAULT_THEME)
  })

  it('任意字符串 hacker-value → 返回默认值', () => {
    expect(parseTheme('hacker-value')).toBe(DEFAULT_THEME)
  })

  it('数字字符串 1 → 返回默认值', () => {
    expect(parseTheme('1')).toBe(DEFAULT_THEME)
  })
})

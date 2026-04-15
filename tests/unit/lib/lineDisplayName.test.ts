/**
 * tests/unit/lib/lineDisplayName.test.ts
 * CHG-409: 测试 CHG-405 新增的 PROVIDER_PATTERNS 和 resolveSourceDisplayName
 */

import { describe, it, expect } from 'vitest'
import { normalizeProviderName, resolveSourceDisplayName } from '@/lib/line-display-name'

describe('normalizeProviderName — CHG-405 爬虫 key 映射', () => {
  it.each([
    ['bfzy',       '暴风资源'],
    ['bfzym3u8',   '暴风资源'],
    ['暴风资源',    '暴风资源'],
    ['1080zyk',    '1080P资源'],
    ['1080zy',     '1080P资源'],
    ['lzzy',       '量子资源'],
    ['量子',        '量子资源'],
    ['jyzy',       '金鹰资源'],
    ['wolongzy',   '卧龙资源'],
    ['subo',       '速播资源'],
    ['modu',       '魔都资源'],
    ['youzzy',     '优质资源'],
  ])('normalizeProviderName("%s") → "%s"', (input, expected) => {
    expect(normalizeProviderName(input)).toBe(expected)
  })

  it('原有映射仍然生效', () => {
    expect(normalizeProviderName('subyun')).toBe('SUB云')
    expect(normalizeProviderName('aliyun')).toBe('阿里云')
    expect(normalizeProviderName('quark')).toBe('夸克云')
  })

  it('未知来源原样返回（非通用 line 格式）', () => {
    expect(normalizeProviderName('mysite')).toBe('mysite')
  })

  it('null/undefined/空字符串返回 null', () => {
    expect(normalizeProviderName(null)).toBeNull()
    expect(normalizeProviderName(undefined)).toBeNull()
    expect(normalizeProviderName('')).toBeNull()
  })
})

describe('resolveSourceDisplayName', () => {
  it('优先使用 siteDisplayName', () => {
    expect(resolveSourceDisplayName('暴风资源', 'bfzym3u8')).toBe('暴风资源')
  })

  it('siteDisplayName 为空时 fallback 到 normalizeProviderName', () => {
    expect(resolveSourceDisplayName(null, 'bfzym3u8')).toBe('暴风资源')
    expect(resolveSourceDisplayName('', '1080zyk')).toBe('1080P资源')
  })

  it('两者均无法匹配时返回 "未知线路"', () => {
    expect(resolveSourceDisplayName(null, null)).toBe('未知线路')
    expect(resolveSourceDisplayName('', '')).toBe('未知线路')
  })

  it('siteDisplayName 空白字符串视为无效，fallback 到 sourceName', () => {
    expect(resolveSourceDisplayName('   ', 'lzzy')).toBe('量子资源')
  })
})

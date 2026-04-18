/**
 * tests/unit/lib/lineDisplayName.test.ts
 * CHG-409: 测试 CHG-405 新增的 PROVIDER_PATTERNS 和 resolveSourceDisplayName
 */

import { describe, it, expect } from 'vitest'
import { normalizeProviderName, resolveSourceDisplayName, deduplicateLabels } from '@/lib/line-display-name'

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

describe('deduplicateLabels — CHG-413 同源多线路编号', () => {
  it('无重复时原样返回', () => {
    const items = [{ label: '暴风资源', url: 'a' }, { label: '量子资源', url: 'b' }]
    expect(deduplicateLabels(items)).toEqual(items)
  })

  it('重复 label 追加 -1/-2 序号', () => {
    const items = [
      { label: '暴风资源', url: 'a' },
      { label: '暴风资源', url: 'b' },
      { label: '暴风资源', url: 'c' },
    ]
    const result = deduplicateLabels(items)
    expect(result[0].label).toBe('暴风资源-1')
    expect(result[1].label).toBe('暴风资源-2')
    expect(result[2].label).toBe('暴风资源-3')
  })

  it('只有一个重复项时，两者都编号', () => {
    const items = [{ label: 'A', id: 1 }, { label: 'B', id: 2 }, { label: 'A', id: 3 }]
    const result = deduplicateLabels(items)
    expect(result[0].label).toBe('A-1')
    expect(result[1].label).toBe('B')
    expect(result[2].label).toBe('A-2')
  })

  it('不修改非 label 字段', () => {
    const items = [{ label: '速播资源', extra: 42 }, { label: '速播资源', extra: 99 }]
    const result = deduplicateLabels(items)
    expect(result[0].extra).toBe(42)
    expect(result[1].extra).toBe(99)
  })

  it('空数组返回空数组', () => {
    expect(deduplicateLabels([])).toEqual([])
  })
})

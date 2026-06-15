/**
 * country-to-iso.test.ts — countryToIso 正向归一真源（META-40）
 *
 * 覆盖：双形态（已 ISO 直通 / 中文名映射）、「中国X」前缀分别归一、media_catalog 实测
 * 扩充覆盖、线路别名、不可归一 → null。与 format-country-name（出）构成双向真源。
 */
import { describe, it, expect } from 'vitest'
import { countryToIso, COUNTRY_NAME_TO_ISO } from '@resovo/types'

describe('countryToIso()', () => {
  it('已是 ISO alpha-2 → 直接大写归一', () => {
    expect(countryToIso('CN')).toBe('CN')
    expect(countryToIso('jp')).toBe('JP')
    expect(countryToIso('us')).toBe('US')
    expect(countryToIso(' gb ')).toBe('GB') // trim
  })

  it('中文规范名经表映射', () => {
    expect(countryToIso('中国大陆')).toBe('CN')
    expect(countryToIso('美国')).toBe('US')
    expect(countryToIso('日本')).toBe('JP')
    expect(countryToIso('韩国')).toBe('KR')
  })

  it('「中国X」豆瓣前缀分别归一（非全归 CN）', () => {
    expect(countryToIso('中国大陆')).toBe('CN')
    expect(countryToIso('中国香港')).toBe('HK')
    expect(countryToIso('中国台湾')).toBe('TW')
    expect(countryToIso('中国澳门')).toBe('MO')
  })

  it('media_catalog 实测污染中文名全部可归一（原 COUNTRY_MAP 8 国缺口补齐）', () => {
    // 原 COUNTRY_MAP 无法覆盖的实测中文名 → 本卡扩充后归一
    expect(countryToIso('印度')).toBe('IN')
    expect(countryToIso('法国')).toBe('FR')
    expect(countryToIso('澳大利亚')).toBe('AU')
    expect(countryToIso('爱尔兰')).toBe('IE')
    expect(countryToIso('德国')).toBe('DE')
    expect(countryToIso('加拿大')).toBe('CA')
  })

  it('线路名地区别名保留（SourceParserService.parseCountry 复用，不可丢）', () => {
    expect(countryToIso('港剧')).toBe('HK')
    expect(countryToIso('日剧')).toBe('JP')
    expect(countryToIso('美剧')).toBe('US')
    expect(countryToIso('国产')).toBe('CN')
    expect(countryToIso('华语')).toBe('CN')
  })

  it('不可归一 → null（调用方跳过，不污染 ISO 列）', () => {
    expect(countryToIso('火星')).toBeNull()
    expect(countryToIso('未知地区')).toBeNull()
    expect(countryToIso('USA')).toBeNull() // 3 字母非 alpha-2、非中文表
    expect(countryToIso('')).toBeNull()
    expect(countryToIso('   ')).toBeNull()
    expect(countryToIso(null)).toBeNull()
    expect(countryToIso(undefined)).toBeNull()
  })

  it('COUNTRY_NAME_TO_ISO 全部映射值为合法 ISO alpha-2（大写两字母）', () => {
    for (const iso of Object.values(COUNTRY_NAME_TO_ISO)) {
      expect(iso).toMatch(/^[A-Z]{2}$/)
    }
  })
})

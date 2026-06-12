/**
 * tests/unit/api/source-language-resolver.test.ts — LANG-DIM-B（ADR-199 D-199-2/3）
 *
 * 验收红线：
 *  1. 五级优先级链：source_name_token > vod_lang > title_token > region_inferred > unknown。
 *  2. 字幕维度无地区推断；DB 三态（null/[]/具体语言）映射正确。
 *  3. country 双形态规整复用 COUNTRY_MAP（ISO 直通 / 中文名映射 / 未知 → null）。
 *  4. vod_lang 组合词别名（汉语普通话 / 国粤双语）exact 命中。
 */

import { describe, it, expect } from 'vitest'
import {
  normalizeAudioLanguage,
  matchSubtitleToken,
  normalizeCountryCode,
  resolveSourceLanguages,
  AUDIO_LANGUAGE_CANONICALS,
} from '@/api/services/SourceLanguageResolver'

describe('normalizeAudioLanguage — 自由文本 → 语音规范词', () => {
  it('规范词直通 + 别名归一', () => {
    expect(normalizeAudioLanguage('国语')).toBe('国语')
    expect(normalizeAudioLanguage('粤语')).toBe('粤语')
    expect(normalizeAudioLanguage('汉语普通话')).toBe('国语')
    expect(normalizeAudioLanguage('普通话')).toBe('国语')
    expect(normalizeAudioLanguage('国粤双语')).toBe('国语')
    expect(normalizeAudioLanguage('日语')).toBe('日语')
    expect(normalizeAudioLanguage('韩文')).toBe('韩语')
  })

  it('token 扫描：线路名 / 带噪文本中命中', () => {
    expect(normalizeAudioLanguage('粤语线路')).toBe('粤语')
    expect(normalizeAudioLanguage('线路A 国语版')).toBe('国语')
  })

  it('映射不到 → null（原文留观测层，不入封闭枚举）', () => {
    expect(normalizeAudioLanguage('泰语')).toBeNull()
    expect(normalizeAudioLanguage('')).toBeNull()
    expect(normalizeAudioLanguage(null)).toBeNull()
    expect(normalizeAudioLanguage(undefined)).toBeNull()
  })

  it('确定性：连续两次调用同输入恒等（/g 规则无 lastIndex 状态泄漏）', () => {
    expect(normalizeAudioLanguage('粤语线路')).toBe('粤语')
    expect(normalizeAudioLanguage('粤语线路')).toBe('粤语')
  })

  it('产出值均在封闭枚举内', () => {
    for (const v of ['国语', '汉语普通话', '粤语线路', '日语版', '韩语', '英语']) {
      const r = normalizeAudioLanguage(v)
      if (r !== null) expect(AUDIO_LANGUAGE_CANONICALS).toContain(r)
    }
  })
})

describe('matchSubtitleToken — 字幕 token 命中', () => {
  it('中英字幕 → 具体语言；中字 → [中文]；无字幕 / 双语字幕 / 裸字幕', () => {
    expect(matchSubtitleToken('中英字幕')).toEqual({ marker: '中英字幕', languages: ['中文', '英文'] })
    expect(matchSubtitleToken('某剧 中字')).toEqual({ marker: '中字', languages: ['中文'] })
    expect(matchSubtitleToken('无字幕')).toEqual({ marker: '无字幕', languages: [] })
    expect(matchSubtitleToken('双语字幕')).toEqual({ marker: '双语字幕', languages: [] })
    expect(matchSubtitleToken('线路B')).toBeNull()
  })
})

describe('normalizeCountryCode — country 双形态规整（复用 COUNTRY_MAP）', () => {
  it('ISO code 直通（含小写规整）', () => {
    expect(normalizeCountryCode('CN')).toBe('CN')
    expect(normalizeCountryCode('jp')).toBe('JP')
  })

  it('中文名经 COUNTRY_MAP 映射', () => {
    expect(normalizeCountryCode('中国大陆')).toBe('CN')
    expect(normalizeCountryCode('香港')).toBe('HK')
  })

  it('未知 / 空 → null', () => {
    expect(normalizeCountryCode('未知地区')).toBeNull()
    expect(normalizeCountryCode(null)).toBeNull()
  })
})

describe('resolveSourceLanguages — 五级推断链（D-199-3）', () => {
  const titleFacets = { audioLanguage: '国语', subtitleMarker: '中字', subtitleLanguages: ['中文'] }

  it('步骤 0：sourceName 行级 token 盖过一切', () => {
    const r = resolveSourceLanguages({
      sourceName: '粤语线路', vodLang: '国语', titleFacets, country: 'JP',
    })
    expect(r.audioLanguage).toBe('粤语')
    expect(r.audioLanguageSource).toBe('source_name_token')
  })

  it('步骤 1：vod_lang 盖过 title_token 与地区', () => {
    const r = resolveSourceLanguages({ sourceName: 'line-a', vodLang: '日语', titleFacets, country: 'CN' })
    expect(r.audioLanguage).toBe('日语')
    expect(r.audioLanguageSource).toBe('vod_lang')
  })

  it('步骤 2：标题 facets；步骤 3：地区推断（CN/TW→国语 HK→粤语 JP→日语 KR→韩语）', () => {
    const fromTitle = resolveSourceLanguages({ sourceName: 'line-a', vodLang: null, titleFacets, country: 'JP' })
    expect(fromTitle.audioLanguage).toBe('国语')
    expect(fromTitle.audioLanguageSource).toBe('title_token')

    for (const [country, expected] of [['CN', '国语'], ['TW', '国语'], ['HK', '粤语'], ['JP', '日语'], ['KR', '韩语']] as const) {
      const r = resolveSourceLanguages({ sourceName: 'line-a', vodLang: null, titleFacets: null, country })
      expect(r.audioLanguage).toBe(expected)
      expect(r.audioLanguageSource).toBe('region_inferred')
    }
  })

  it('中文名地区（存量 media_catalog.country 双形态）同样可推断', () => {
    const r = resolveSourceLanguages({ country: '中国大陆' })
    expect(r.audioLanguage).toBe('国语')
    expect(r.audioLanguageSource).toBe('region_inferred')
  })

  it('步骤 4：全不命中 → unknown（US 等无先验地区不推断）', () => {
    const r = resolveSourceLanguages({ sourceName: 'line-a', country: 'US' })
    expect(r.audioLanguage).toBeNull()
    expect(r.audioLanguageSource).toBe('unknown')
  })

  it('字幕维度：title facets → DB 数组；无地区推断', () => {
    const r = resolveSourceLanguages({ sourceName: 'line-a', titleFacets, country: 'CN' })
    expect(r.subtitleLanguages).toEqual(['中文'])
    expect(r.subtitleLanguageSource).toBe('title_token')

    const none = resolveSourceLanguages({ sourceName: 'line-a', country: 'CN' })
    expect(none.subtitleLanguages).toBeNull()
    expect(none.subtitleLanguageSource).toBe('unknown')
  })

  it('字幕三态：无字幕 → [] / 双语未知具体 → null（provenance 仍如实标）', () => {
    const noSub = resolveSourceLanguages({
      titleFacets: { audioLanguage: null, subtitleMarker: '无字幕', subtitleLanguages: [] },
    })
    expect(noSub.subtitleLanguages).toEqual([])
    expect(noSub.subtitleLanguageSource).toBe('title_token')

    const dual = resolveSourceLanguages({
      titleFacets: { audioLanguage: null, subtitleMarker: '双语字幕', subtitleLanguages: [] },
    })
    expect(dual.subtitleLanguages).toBeNull()
    expect(dual.subtitleLanguageSource).toBe('title_token')
  })

  it('两维度独立短路：audio=region_inferred 与 subtitle=vod_lang 可同行并存', () => {
    const r = resolveSourceLanguages({ vodLang: '中字', country: 'CN' })
    expect(r.subtitleLanguages).toEqual(['中文'])
    expect(r.subtitleLanguageSource).toBe('vod_lang')
    expect(r.audioLanguage).toBe('国语')
    expect(r.audioLanguageSource).toBe('region_inferred')
  })
})

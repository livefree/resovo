/**
 * tests/unit/api/sourceParserTypeMap.test.ts — CRAWLER-07
 *
 * 验证 SourceParserService.parseType 的新行为：
 * - 向后兼容字符串参数
 * - 支持 { typeName, vodClass, typeId } 对象参数
 * - vodClass 首项优先匹配（细分类精度高于 type_name）
 * - TYPE_MAP 扩充至覆盖苹果 CMS 常见细分类（国产动漫/日韩综艺/剧情片/网络电影等）
 */

import { describe, it, expect } from 'vitest'
import { parseType, parseVodItem } from '@/api/services/SourceParserService'

describe('parseType — CRAWLER-07 扩充后的 TYPE_MAP', () => {
  // ── 向后兼容：字符串调用 ──
  it('string 调用形式仍然工作（向后兼容）', () => {
    expect(parseType('电影')).toBe('movie')
    expect(parseType('电视剧')).toBe('series')
    expect(parseType(undefined)).toBe('other')
  })

  // ── 电影类细分类 ──
  it.each([
    ['剧情片', 'movie'],
    ['动作片', 'movie'],
    ['喜剧片', 'movie'],
    ['爱情片', 'movie'],
    ['科幻片', 'movie'],
    ['恐怖片', 'movie'],
    ['战争片', 'movie'],
    ['悬疑片', 'movie'],
    ['冒险片', 'movie'],
    ['惊悚片', 'movie'],
    ['灾难片', 'movie'],
    ['犯罪片', 'movie'],
    ['网络电影', 'movie'],
    ['微电影', 'movie'],
  ])('电影类细分 "%s" → %s', (input, expected) => {
    expect(parseType(input)).toBe(expected)
  })

  // ── 动漫细分类 ──
  it.each([
    ['国产动漫', 'anime'],
    ['日本动漫', 'anime'],
    ['日韩动漫', 'anime'],
    ['欧美动漫', 'anime'],
    ['港台动漫', 'anime'],
  ])('动漫细分 "%s" → %s', (input, expected) => {
    expect(parseType(input)).toBe(expected)
  })

  // ── 综艺细分类 ──
  it.each([
    ['大陆综艺', 'variety'],
    ['国产综艺', 'variety'],
    ['港台综艺', 'variety'],
    ['日韩综艺', 'variety'],
    ['欧美综艺', 'variety'],
  ])('综艺细分 "%s" → %s', (input, expected) => {
    expect(parseType(input)).toBe(expected)
  })

  // ── 电视剧细分类 ──
  it.each([
    ['网络剧', 'series'],
    ['港剧', 'series'],
    ['台剧', 'series'],
    ['日韩剧', 'series'],
    ['欧美剧', 'series'],
  ])('电视剧细分 "%s" → %s', (input, expected) => {
    expect(parseType(input)).toBe(expected)
  })

  // ── 未知项降级 ──
  it('未知细分类降级 other', () => {
    expect(parseType('三级片')).toBe('other')
    expect(parseType('MMA')).toBe('other')
  })

  // ── 对象调用：vodClass 优先于 typeName ──
  it('vodClass 首项优先于 typeName（细分类精度高）', () => {
    expect(
      parseType({ typeName: '电影', vodClass: '国产动漫' }),
    ).toBe('anime')
    expect(
      parseType({ typeName: '综艺', vodClass: '剧情片' }),
    ).toBe('movie')
  })

  it('vodClass 多值（逗号/斜杠/竖线）取首项', () => {
    expect(parseType({ vodClass: '剧情片,动作片' })).toBe('movie')
    expect(parseType({ vodClass: '国产动漫/日本动漫' })).toBe('anime')
    expect(parseType({ vodClass: '港剧｜日剧' })).toBe('series')
    expect(parseType({ vodClass: '大陆综艺、港台综艺' })).toBe('variety')
  })

  it('vodClass 首项不命中 → 回落 typeName', () => {
    expect(parseType({ typeName: '电影', vodClass: '未知分类' })).toBe('movie')
  })

  it('vodClass 首项命中 → 即使 typeName 命中不同类型也以 vodClass 为准', () => {
    // 场景：站点把"综艺"底下的"港台综艺"再标到剧集 type_name，细分更可靠
    expect(parseType({ typeName: '电视剧', vodClass: '大陆综艺' })).toBe('variety')
  })

  it('vodClass + typeName 都不命中 → other', () => {
    expect(parseType({ typeName: '未知', vodClass: '也未知' })).toBe('other')
  })

  it('空对象 → other', () => {
    expect(parseType({})).toBe('other')
  })
})

describe('parseVodItem — CRAWLER-07 接入 vod_class + 新字段', () => {
  it('parseVodItem 优先按 vod_class 识别类型', () => {
    const { video } = parseVodItem({
      vod_id: 'x',
      vod_name: 'Test',
      type_name: '电影',        // 主分类"电影"
      vod_class: '国产动漫',    // 细分类"国产动漫"
    })
    // 期望以 vod_class 为准 → anime
    expect(video.type).toBe('anime')
  })

  it('RawVodItem 新字段（vod_total / vod_serial 等）不会破坏解析', () => {
    const { video } = parseVodItem({
      vod_id: 'x',
      vod_name: 'Test',
      type_name: '电视剧',
      vod_class: '网络剧',
      vod_lang: '普通话',
      vod_total: 24,
      vod_serial: 12,
      vod_version: 'HD',
      vod_state: '正片',
      vod_note: '更新中',
      type_id: 13,
    })
    expect(video.type).toBe('series')
    expect(video.title).toBe('Test')
  })
})

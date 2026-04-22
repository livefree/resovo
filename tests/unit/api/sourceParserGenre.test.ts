/**
 * tests/unit/api/sourceParserGenre.test.ts — CRAWLER-08
 *
 * 验证 source_category 与 genre 识别的新行为：
 * - parseVodItem 的 source_category 优先取 vod_class 首项
 * - parseGenre 切到 genreMapper.mapSourceCategory 兜底（覆盖豆瓣对齐题材）
 * - 本地 GENRE_MAP 特有项（爽文短剧等）仍优先命中
 */

import { describe, it, expect } from 'vitest'
import { parseGenre, parseVodItem } from '@/api/services/SourceParserService'

describe('parseGenre — CRAWLER-08 切 mapSourceCategory 兜底', () => {
  it('本地 GENRE_MAP 特有项优先（爽文短剧 → romance）', () => {
    expect(parseGenre('爽文短剧')).toBe('romance')
    expect(parseGenre('女频恋爱')).toBe('romance')
    expect(parseGenre('脑洞悬疑')).toBe('mystery')
  })

  it('兜底命中 genreMapper.SOURCE_CATEGORY_MAP（豆瓣对齐的新增题材）', () => {
    // META-10 新增对齐豆瓣的题材值
    expect(parseGenre('冒险')).toBe('adventure')
    expect(parseGenre('灾难')).toBe('disaster')
    expect(parseGenre('歌舞')).toBe('musical')
    expect(parseGenre('音乐')).toBe('musical')
    expect(parseGenre('西部')).toBe('western')
    expect(parseGenre('运动')).toBe('sport')
    expect(parseGenre('体育')).toBe('sport')
    expect(parseGenre('传记')).toBe('biography')
  })

  it('兜底覆盖原有题材（都市、言情、仙侠、谍战 等）', () => {
    expect(parseGenre('都市')).toBe('romance')
    expect(parseGenre('言情')).toBe('romance')
    expect(parseGenre('仙侠')).toBe('fantasy')
    expect(parseGenre('谍战')).toBe('thriller')
    expect(parseGenre('悬疑')).toBe('mystery')
    expect(parseGenre('灵异')).toBe('horror')
  })

  it('未映射项 → null（不强推 other）', () => {
    expect(parseGenre('未知类目XYZ')).toBeNull()
    expect(parseGenre(null)).toBeNull()
    expect(parseGenre(undefined)).toBeNull()
    expect(parseGenre('')).toBeNull()
  })

  it('本地 GENRE_MAP 与 genreMapper 冲突时本地优先', () => {
    // 本地 GENRE_MAP["功夫片"] = 'action'（业务侧细分）
    // genreMapper SOURCE_CATEGORY_MAP 不含"功夫片"，只有"功夫/武侠"
    // 本地优先保证规则
    expect(parseGenre('功夫片')).toBe('action')
    expect(parseGenre('武侠片')).toBe('martial_arts')
  })
})

describe('parseVodItem — CRAWLER-08 source_category 优先取 vod_class', () => {
  it('vod_class 存在 → source_category 取其首项', () => {
    const { video } = parseVodItem({
      vod_id: 'x1',
      vod_name: 'Test',
      type_name: '电影',
      vod_class: '冒险,灾难',
    })
    expect(video.category).toBe('冒险')
    // 由 mapSourceCategory 推断题材
    expect(video.genre).toBe('adventure')
  })

  it('vod_class 多种分隔符（逗号/中文逗号/斜杠/竖线/顿号）都支持', () => {
    const cases = [
      { vod_class: '冒险/灾难', expected: '冒险' },
      { vod_class: '冒险｜灾难', expected: '冒险' },
      { vod_class: '冒险、灾难', expected: '冒险' },
      { vod_class: '冒险，灾难', expected: '冒险' },
    ]
    for (const c of cases) {
      const { video } = parseVodItem({
        vod_id: 'x',
        vod_name: 'T',
        type_name: '电影',
        vod_class: c.vod_class,
      })
      expect(video.category).toBe(c.expected)
    }
  })

  it('vod_class 缺失 → 回落 type_name', () => {
    const { video } = parseVodItem({
      vod_id: 'x2',
      vod_name: 'Test',
      type_name: '电影',
    })
    expect(video.category).toBe('电影')
  })

  it('vod_class 与 type_name 都缺失 → source_category null', () => {
    const { video } = parseVodItem({
      vod_id: 'x3',
      vod_name: 'Test',
    })
    expect(video.category).toBeNull()
  })

  it('vod_class 首项可同时决定 type 与 source_category', () => {
    const { video } = parseVodItem({
      vod_id: 'x4',
      vod_name: '运动纪录',
      type_name: '电影',
      vod_class: '运动',
    })
    // type=movie（vod_class='运动' 不命中 TYPE_MAP → 回落 type_name='电影'=movie）
    expect(video.type).toBe('movie')
    // source_category 取"运动"
    expect(video.category).toBe('运动')
    // genre 由 mapSourceCategory 推断 → sport
    expect(video.genre).toBe('sport')
  })
})

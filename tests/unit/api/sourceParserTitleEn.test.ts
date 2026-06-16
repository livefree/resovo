/**
 * tests/unit/api/sourceParserTitleEn.test.ts — CHG-VIR-11-D
 *
 * 验证入库侧 title_en 拼音门禁（parseVodItem）：
 * 苹果CMS `vod_en`（英文名）约定填中文标题全拼（slug），拼音冒充英文官方名会污染
 * knownNames（被标 official/en/conf=1.0）→ 误导 TMDB 搜索/打分。入库即过滤：
 * 拼音形态不写 title_en，真英文保留。
 */

import { describe, it, expect } from 'vitest'
import { parseVodItem, type RawVodItem } from '@/api/services/SourceParserService'

/** 最小可解析条目（仅置必填 vod_name + 待测 vod_en）。 */
function makeItem(vodEn: string | undefined): RawVodItem {
  return { vod_id: '1', vod_name: '他比前男友炙热', vod_en: vodEn }
}

describe('parseVodItem — title_en 入库拼音门禁（CHG-VIR-11-D）', () => {
  it('无空格连写拼音 slug → title_en 置 null（实证样本 tabiqiannanyouzhire）', () => {
    expect(parseVodItem(makeItem('tabiqiannanyouzhire')).video.titleEn).toBeNull()
  })

  it('空格分隔多词拼音 → title_en 置 null', () => {
    expect(parseVodItem(makeItem('Wo Bei Quan Wang Da Bao')).video.titleEn).toBeNull()
  })

  it('真英文标题 → 原样保留写入 title_en', () => {
    expect(parseVodItem(makeItem('The Avengers')).video.titleEn).toBe('The Avengers')
  })

  it('含数字的混合噪声（非拼音判定）→ 保留（门禁只拦纯拼音）', () => {
    // isPinyinTitle 对含数字串返 false（年份/集数线索 = 混合元数据，非罗马音）
    expect(parseVodItem(makeItem('maoxuewang2026')).video.titleEn).toBe('maoxuewang2026')
  })

  it('vod_en 缺失 / 空白 → title_en 置 null（既有行为不变）', () => {
    expect(parseVodItem(makeItem(undefined)).video.titleEn).toBeNull()
    expect(parseVodItem(makeItem('   ')).video.titleEn).toBeNull()
  })
})

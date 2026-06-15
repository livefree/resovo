/**
 * tests/unit/api/genreMapper.test.ts
 *
 * META-41-A：mapBangumiTags —— Bangumi 开放词表标签 → VideoGenre 保守归一。
 * 重点验证两层保守去噪（白名单 + count 下限）、政策敏感标签不映射、genres 去重、
 * raw（命中原始标签子集，喂 genres_raw）溯源语义。
 */

import { describe, it, expect } from 'vitest'
import { mapBangumiTags } from '@/api/lib/genreMapper'

const t = (name: string, count = 100) => ({ name, count })

describe('mapBangumiTags（META-41-A：开放词表保守归一）', () => {
  it('白名单命中映射到规范 VideoGenre', () => {
    const r = mapBangumiTags([t('科幻'), t('恋爱'), t('悬疑')])
    expect(r.genres).toEqual(['sci_fi', 'romance', 'mystery'])
    expect(r.raw).toEqual(['科幻', '恋爱', '悬疑'])
  })

  it('多个原始标签映射同一 genre → genres 去重，raw 保留全部命中原始名', () => {
    // 热血 + 战斗 + 格斗 都 → action
    const r = mapBangumiTags([t('热血'), t('战斗'), t('格斗')])
    expect(r.genres).toEqual(['action'])
    expect(r.raw).toEqual(['热血', '战斗', '格斗'])
  })

  it('机甲 / 机战 / 机器人 → sci_fi（mecha 归科幻）', () => {
    expect(mapBangumiTags([t('机甲')]).genres).toEqual(['sci_fi'])
    expect(mapBangumiTags([t('机战')]).genres).toEqual(['sci_fi'])
    expect(mapBangumiTags([t('机器人')]).genres).toEqual(['sci_fi'])
  })

  it('异世界 / 魔法 / 魔法少女 → fantasy', () => {
    const r = mapBangumiTags([t('异世界'), t('魔法少女')])
    expect(r.genres).toEqual(['fantasy'])
    expect(r.raw).toEqual(['异世界', '魔法少女'])
  })

  it('计数下限：count < 3 的偶发标签跳过（开放词表单/双用户标签不可靠）', () => {
    const r = mapBangumiTags([t('科幻', 2), t('恋爱', 1), t('悬疑', 3)])
    // 仅 count>=3 的 悬疑 入选
    expect(r.genres).toEqual(['mystery'])
    expect(r.raw).toEqual(['悬疑'])
  })

  it('未知标签静默跳过（情绪/设定/制作公司/年份非题材标签）', () => {
    const r = mapBangumiTags([t('治愈'), t('日常'), t('校园'), t('京都动画'), t('2024'), t('TV')])
    expect(r.genres).toEqual([])
    expect(r.raw).toEqual([])
  })

  it('政策敏感取向标签不入表（对齐 douban「同性/情色→不映射」，原始标签留 catalog.tags）', () => {
    const r = mapBangumiTags([t('百合'), t('耽美'), t('后宫')])
    expect(r.genres).toEqual([])
    expect(r.raw).toEqual([])
  })

  it('混杂输入：仅白名单 + 过下限的题材标签产出，噪声与敏感标签滤除', () => {
    const r = mapBangumiTags([
      t('热血', 500),     // action ✓
      t('校园', 480),     // 设定，跳过
      t('治愈', 460),     // 情绪，跳过
      t('恋爱', 300),     // romance ✓
      t('百合', 200),     // 政策敏感，跳过
      t('音乐', 5),       // musical ✓
      t('运动', 2),       // 过滤（count<3）
      t('京都动画', 1),   // 制作公司 + count<3，跳过
    ])
    expect(r.genres).toEqual(['action', 'romance', 'musical'])
    expect(r.raw).toEqual(['热血', '恋爱', '音乐'])
  })

  it('空数组 / 空白名 → 空结果（不抛）', () => {
    expect(mapBangumiTags([])).toEqual({ genres: [], raw: [] })
    expect(mapBangumiTags([t('  ', 100), t('', 100)])).toEqual({ genres: [], raw: [] })
  })

  it('标签名两侧空白被 trim 后匹配', () => {
    const r = mapBangumiTags([t('  科幻  ')])
    expect(r.genres).toEqual(['sci_fi'])
    expect(r.raw).toEqual(['科幻'])
  })

  it('军事 → war（对齐 source_category 军事归战争）', () => {
    expect(mapBangumiTags([t('军事'), t('战争')]).genres).toEqual(['war'])
  })

  it('所有映射目标均为合法 VideoGenre（无 other / 无非法值）', () => {
    const samples = ['热血', '搞笑', '恋爱', '科幻', '奇幻', '悬疑', '恐怖', '惊悚',
      '历史', '战争', '运动', '音乐', '冒险', '犯罪', '家庭', '武侠', '灾难']
    const { genres } = mapBangumiTags(samples.map((s) => t(s)))
    expect(genres).not.toContain('other')
    // 抽样断言关键映射方向
    expect(genres).toContain('action')
    expect(genres).toContain('martial_arts')
    expect(genres).toContain('disaster')
  })
})

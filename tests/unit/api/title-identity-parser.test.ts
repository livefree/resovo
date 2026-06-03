/**
 * tests/unit/api/title-identity-parser.test.ts — SEQ-20260602-03 / CHG-VIR-5（Phase 1a）
 *
 * 验收红线：
 *  1. fixture 全绿（书名号/全半角/标点 · 国语/粤语/字幕 · 加长/导剪/SP/OVA/剧场版 ·
 *     第N季/S2/Part2/序号 · 源站噪声）。
 *  2. `normalizeTitle`/`normalizeMergeKey` 输出**完全不变**（regression 守卫：本卡未触碰
 *     TitleNormalizer，断言其既有行为逐字符不变）。
 *  3. facets 仅观测：Y4 护栏区分「序号即身份（复仇者联盟4）」与「序号即季/卷（第4季）」。
 */

import { describe, it, expect } from 'vitest'
import {
  parseTitle,
  classifyTitleKind,
  computeConfidence,
  TITLE_PARSER_VERSION,
} from '@/api/services/TitleIdentityParser'
import {
  normalizeTitle,
  normalizeMergeKey,
} from '@/api/services/TitleNormalizer'

describe('TitleIdentityParser.parseTitle — coreTitleKey 基础归一', () => {
  it('裸标题：coreTitleKey 等于小写归一串、facets 全空、parserVersion 透传', () => {
    const r = parseTitle('复仇者联盟')
    expect(r.coreTitleKey).toBe('复仇者联盟')
    expect(r.facets.seasonNumber).toBeNull()
    expect(r.facets.qualityNoise).toEqual([])
    expect(r.parserVersion).toBe(TITLE_PARSER_VERSION)
    expect(r.titleKind).toBe('original')
    expect(r.confidence).toBe(1)
  })

  it('英文标题统一小写', () => {
    expect(parseTitle('The Avengers').coreTitleKey).toBe('the avengers')
  })

  it('空 / 全空白输入：coreTitleKey 为空、confidence 0.1', () => {
    expect(parseTitle('').coreTitleKey).toBe('')
    expect(parseTitle('   ').coreTitleKey).toBe('')
    expect(parseTitle('').confidence).toBe(0.1)
  })

  it('确定性：同输入恒等产出', () => {
    const a = parseTitle('斗罗大陆 第4季 国语 1080p 更新至30集')
    const b = parseTitle('斗罗大陆 第4季 国语 1080p 更新至30集')
    expect(a).toEqual(b)
  })
})

describe('TitleIdentityParser — 书名号 / 全半角 / 标点', () => {
  it('书名号《》作为标点剥离，核心标题保留', () => {
    expect(parseTitle('《复仇者联盟》').coreTitleKey).toBe('复仇者联盟')
  })

  it('全角标点折叠后剥离', () => {
    expect(parseTitle('复仇者联盟！').coreTitleKey).toBe('复仇者联盟')
  })

  it('全角数字折叠为半角', () => {
    expect(parseTitle('机动战士高达００７９').coreTitleKey).toBe('机动战士高达0079')
  })

  it('标点差异归一到同 key（与 normalizeMergeKey 同口径）', () => {
    expect(parseTitle('当前、正被打扰中！').coreTitleKey).toBe('当前正被打扰中')
    expect(parseTitle('当前正被打扰中').coreTitleKey).toBe('当前正被打扰中')
  })
})

describe('TitleIdentityParser — 语言 / 字幕变体 → facets.languageVariant', () => {
  it('国语 → languageVariant=国语，titleKind=localized', () => {
    const r = parseTitle('叶问 国语')
    expect(r.coreTitleKey).toBe('叶问')
    expect(r.facets.languageVariant).toBe('国语')
    expect(r.titleKind).toBe('localized')
  })

  it('粤语版 → languageVariant=粤语', () => {
    const r = parseTitle('无间道 粤语版')
    expect(r.coreTitleKey).toBe('无间道')
    expect(r.facets.languageVariant).toBe('粤语')
  })

  it('中英字幕 → languageVariant=字幕', () => {
    const r = parseTitle('神探夏洛克 中英字幕')
    expect(r.coreTitleKey).toBe('神探夏洛克')
    expect(r.facets.languageVariant).toBe('字幕')
  })
})

describe('TitleIdentityParser — 版本 / 发布形态 → facets.edition / releaseMarker', () => {
  it('加长版 → edition=加长版，titleKind=edition', () => {
    const r = parseTitle('指环王 加长版')
    expect(r.coreTitleKey).toBe('指环王')
    expect(r.facets.edition).toBe('加长版')
    expect(r.titleKind).toBe('edition')
  })

  it('导演剪辑版 → edition=导演剪辑版', () => {
    const r = parseTitle('银翼杀手 导演剪辑版')
    expect(r.coreTitleKey).toBe('银翼杀手')
    expect(r.facets.edition).toBe('导演剪辑版')
  })

  it('剧场版 → releaseMarker=剧场版（不并入 core）', () => {
    const r = parseTitle('你的名字 剧场版')
    expect(r.coreTitleKey).toBe('你的名字')
    expect(r.facets.releaseMarker).toBe('剧场版')
  })

  it('OVA → releaseMarker=OVA', () => {
    const r = parseTitle('某番 OVA')
    expect(r.coreTitleKey).toBe('某番')
    expect(r.facets.releaseMarker).toBe('OVA')
  })

  it('SP / 特别篇 → releaseMarker=SP', () => {
    expect(parseTitle('某番 SP').facets.releaseMarker).toBe('SP')
    expect(parseTitle('某番 特别篇').facets.releaseMarker).toBe('SP')
  })

  it('英文 Spider/Se7en 不被 SP/season 模式误剥', () => {
    expect(parseTitle('Spider Man').coreTitleKey).toBe('spider man')
    expect(parseTitle('Se7en').coreTitleKey).toBe('se7en')
  })
})

describe('TitleIdentityParser — 季 / 部 / 卷序号 → facets.seasonNumber（Y4 护栏）', () => {
  it('Y4 序号即季/卷：第N季 剥到 seasonNumber，同剧不同季 core 相同', () => {
    const s4 = parseTitle('斗罗大陆 第4季')
    const s3 = parseTitle('斗罗大陆 第3季')
    expect(s4.coreTitleKey).toBe('斗罗大陆')
    expect(s3.coreTitleKey).toBe('斗罗大陆')
    expect(s4.coreTitleKey).toBe(s3.coreTitleKey) // 同 core → blocking 同集合
    expect(s4.facets.seasonNumber).toBe(4)
    expect(s3.facets.seasonNumber).toBe(3) // 季不同 → season_mismatch（后续 phase）
  })

  it('Y4 序号即身份：裸序号保留进 core，不同序号 → 不同 core', () => {
    const a4 = parseTitle('复仇者联盟4')
    const a3 = parseTitle('复仇者联盟3')
    expect(a4.coreTitleKey).toBe('复仇者联盟4')
    expect(a3.coreTitleKey).toBe('复仇者联盟3')
    expect(a4.coreTitleKey).not.toBe(a3.coreTitleKey)
    expect(a4.facets.seasonNumber).toBeNull() // 无显式季标记 → 不剥
  })

  it('中文数字季：第三季 → seasonNumber=3', () => {
    expect(parseTitle('某剧 第三季').facets.seasonNumber).toBe(3)
    expect(parseTitle('某剧 第十一季').facets.seasonNumber).toBe(11)
  })

  it('英文 S2 / Season 2 → seasonNumber=2', () => {
    expect(parseTitle('Stranger Things S2').facets.seasonNumber).toBe(2)
    expect(parseTitle('Stranger Things S2').coreTitleKey).toBe('stranger things')
    expect(parseTitle('Dark Season 2').facets.seasonNumber).toBe(2)
  })

  it('S01E05 → seasonNumber=1（集号丢弃）', () => {
    const r = parseTitle('Westworld S01E05')
    expect(r.facets.seasonNumber).toBe(1)
    expect(r.coreTitleKey).toBe('westworld')
  })

  it('Part 2 / 第二部 / 第二卷 → seasonNumber=2', () => {
    expect(parseTitle('间谍过家家 Part 2').facets.seasonNumber).toBe(2)
    expect(parseTitle('某作 第二部').facets.seasonNumber).toBe(2)
    expect(parseTitle('某漫 第二卷').facets.seasonNumber).toBe(2)
  })
})

describe('TitleIdentityParser — 画质 / 编码噪声 → facets.qualityNoise[]', () => {
  it('1080p / bluray / hevc 剥到 qualityNoise', () => {
    const r = parseTitle('盗梦空间 1080p BluRay HEVC')
    expect(r.coreTitleKey).toBe('盗梦空间')
    expect(r.facets.qualityNoise).toContain('1080p')
    expect(r.facets.qualityNoise).toContain('bluray')
    expect(r.facets.qualityNoise).toContain('hevc')
  })

  it('4K / 2160p 剥离', () => {
    const r = parseTitle('阿凡达 4K 2160p')
    expect(r.coreTitleKey).toBe('阿凡达')
    expect(r.facets.qualityNoise).toContain('4k')
  })
})

describe('TitleIdentityParser — 源站噪声 → facets.sourceNoise[]，titleKind=crawler', () => {
  it('更新至N集 → sourceNoise，titleKind=crawler', () => {
    const r = parseTitle('庆余年 更新至20集')
    expect(r.coreTitleKey).toBe('庆余年')
    expect(r.facets.sourceNoise).toContain('更新至20集')
    expect(r.titleKind).toBe('crawler')
    expect(r.confidence).toBe(0.85)
  })

  it('全集 / 完结 → sourceNoise', () => {
    expect(parseTitle('斗破苍穹 全集').facets.sourceNoise).toContain('全集')
    expect(parseTitle('某剧 大结局').facets.sourceNoise.length).toBeGreaterThan(0)
  })

  it('单集页 第5集 / 第五话 → sourceNoise（非 season）', () => {
    const r = parseTitle('海贼王 第5集')
    expect(r.coreTitleKey).toBe('海贼王')
    expect(r.facets.seasonNumber).toBeNull()
    expect(r.facets.sourceNoise).toContain('第5集')
  })

  it('域名水印剥离', () => {
    const r = parseTitle('复仇者联盟 www.dyttw.com')
    expect(r.coreTitleKey).toBe('复仇者联盟')
    expect(r.facets.sourceNoise.length).toBeGreaterThan(0)
    expect(r.titleKind).toBe('crawler')
  })

  it('括号水印 → bracketTokens（不入 core）', () => {
    const r = parseTitle('【高清影院】庆余年')
    expect(r.coreTitleKey).toBe('庆余年')
    expect(r.facets.bracketTokens).toContain('高清影院')
  })
})

describe('TitleIdentityParser — 多噪声组合', () => {
  it('季 + 语言 + 画质 + 源站噪声同时存在，core 仅留作品名', () => {
    const r = parseTitle('斗破苍穹 第5季 国语 1080p 更新至30集')
    expect(r.coreTitleKey).toBe('斗破苍穹')
    expect(r.facets.seasonNumber).toBe(5)
    expect(r.facets.languageVariant).toBe('国语')
    expect(r.facets.qualityNoise).toContain('1080p')
    expect(r.facets.sourceNoise).toContain('更新至30集')
    expect(r.titleKind).toBe('crawler') // 源站噪声优先
  })

  it('括号年份 → bracketTokens，年份不污染 core', () => {
    const r = parseTitle('盗梦空间（2010）')
    expect(r.coreTitleKey).toBe('盗梦空间')
    expect(r.facets.bracketTokens).toContain('2010')
  })
})

describe('TitleIdentityParser — titleKind 罗马音 / 分类辅助', () => {
  it('拼音核心 → titleKind=romanized', () => {
    expect(parseTitle('Wo Bei Quan Wang Da Bao').titleKind).toBe('romanized')
  })

  it('真英文 → 不误判为 romanized', () => {
    expect(parseTitle('The Avengers').titleKind).toBe('original')
  })

  it('classifyTitleKind 优先级 crawler > edition > localized', () => {
    const facets = {
      seasonNumber: null,
      edition: '加长版',
      languageVariant: '国语',
      releaseMarker: null,
      qualityNoise: [],
      sourceNoise: ['更新至10集'],
      bracketTokens: [],
    }
    // 源站噪声在场 → crawler（即便 edition/lang 也命中）
    expect(classifyTitleKind('某剧', facets)).toBe('crawler')
    // 去掉源站噪声 → edition
    expect(classifyTitleKind('某剧', { ...facets, sourceNoise: [] })).toBe('edition')
    // 再去 edition → localized
    expect(classifyTitleKind('某剧', { ...facets, sourceNoise: [], edition: null })).toBe('localized')
  })

  it('computeConfidence：空 core=0.1，源站噪声 -0.15', () => {
    const empty = { seasonNumber: null, edition: null, languageVariant: null, releaseMarker: null, qualityNoise: [], sourceNoise: [], bracketTokens: [] }
    expect(computeConfidence('', empty)).toBe(0.1)
    expect(computeConfidence('某剧', empty)).toBe(1)
    expect(computeConfidence('某剧', { ...empty, sourceNoise: ['更新至1集'] })).toBe(0.85)
  })
})

describe('TitleNormalizer 回归守卫 — 既有语义逐字符不变（CHG-VIR-5 不触碰）', () => {
  it('normalizeTitle 剥括号年份 + 画质标签', () => {
    expect(normalizeTitle('复仇者联盟 (2019) 1080p')).toBe('复仇者联盟')
  })

  it('normalizeTitle 剥季数词', () => {
    expect(normalizeTitle('斗罗大陆 第3季')).toBe('斗罗大陆')
  })

  it('normalizeMergeKey 剥标点（当前、正被打扰中！）', () => {
    expect(normalizeMergeKey('当前、正被打扰中！')).toBe('当前正被打扰中')
  })

  it('normalizeMergeKey 与 parser coreTitleKey 在「剥季」基线一致、parser 额外保存 season', () => {
    // 二者基线核心一致（都得 斗罗大陆）
    expect(normalizeMergeKey('斗罗大陆 第3季')).toBe('斗罗大陆')
    const parsed = parseTitle('斗罗大陆 第3季')
    expect(parsed.coreTitleKey).toBe('斗罗大陆')
    // 但 parser 额外把季号解析保存（normalizeMergeKey 直接丢弃）
    expect(parsed.facets.seasonNumber).toBe(3)
  })
})

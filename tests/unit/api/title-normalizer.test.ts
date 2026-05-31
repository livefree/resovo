/**
 * tests/unit/api/title-normalizer.test.ts
 * CHG-38: TitleNormalizer 标准化 + buildMatchKey 测试
 * 规则 B: 去 HTML / 装饰括号 / 年份 / 季数词 / 画质标签，Unicode 小写
 */

import { describe, it, expect } from 'vitest'
import {
  normalizeTitle,
  buildMatchKey,
  normalizeForExternalMatch,
  stripExternalMatchPunct,
} from '@/api/services/TitleNormalizer'

describe('normalizeTitle', () => {
  // ── 基础小写 ─────────────────────────────────────────────────────

  it('英文标题转小写', () => {
    expect(normalizeTitle('The Dark Knight')).toBe('the dark knight')
  })

  it('纯中文标题保持不变（已是最小形式）', () => {
    expect(normalizeTitle('流浪地球')).toBe('流浪地球')
  })

  it('首尾空格被去除', () => {
    expect(normalizeTitle('  流浪地球  ')).toBe('流浪地球')
  })

  it('多余内部空格合并为单个空格', () => {
    expect(normalizeTitle('流浪  地球')).toBe('流浪 地球')
  })

  // ── HTML 标签 ────────────────────────────────────────────────────

  it('剥离 HTML 标签 <br>', () => {
    expect(normalizeTitle('流浪地球<br>2')).toBe('流浪地球 2')
  })

  it('剥离 <b> 标签', () => {
    expect(normalizeTitle('<b>流浪地球</b>')).toBe('流浪地球')
  })

  it('剥离 HTML 实体 &nbsp;', () => {
    expect(normalizeTitle('流浪&nbsp;地球')).toBe('流浪 地球')
  })

  // ── 括号包裹年份 ─────────────────────────────────────────────────

  it('去除半角括号包裹的四位年份 (2024)', () => {
    expect(normalizeTitle('流浪地球(2023)')).toBe('流浪地球')
  })

  it('去除全角括号包裹的年份 （2023）', () => {
    expect(normalizeTitle('流浪地球（2023）')).toBe('流浪地球')
  })

  it('去除方括号包裹的年份 [2023]', () => {
    expect(normalizeTitle('流浪地球[2023]')).toBe('流浪地球')
  })

  it('去除全角方括号包裹的年份 【2023】', () => {
    expect(normalizeTitle('流浪地球【2023】')).toBe('流浪地球')
  })

  // ── 季数词 ───────────────────────────────────────────────────────

  it('去除中文"第二季"', () => {
    expect(normalizeTitle('绝命毒师第二季')).toBe('绝命毒师')
  })

  it('去除"第三季"', () => {
    expect(normalizeTitle('权力的游戏第三季')).toBe('权力的游戏')
  })

  it('去除英文 Season 2（大写）', () => {
    expect(normalizeTitle('Breaking Bad Season 2')).toBe('breaking bad')
  })

  it('去除英文 season 3（小写）', () => {
    expect(normalizeTitle('stranger things season 3')).toBe('stranger things')
  })

  it('去除 S01 格式季数', () => {
    expect(normalizeTitle('Arrow S01')).toBe('arrow')
  })

  it('去除 S02E05 集数格式', () => {
    expect(normalizeTitle('Game of Thrones S02E05')).toBe('game of thrones')
  })

  it('去除 Part 2', () => {
    expect(normalizeTitle('Dune Part 2')).toBe('dune')
  })

  it('去除 Vol. 1', () => {
    expect(normalizeTitle('Stranger Things Vol. 1')).toBe('stranger things')
  })

  // ── 画质标签 ─────────────────────────────────────────────────────

  it('去除括号内 HD 标签', () => {
    expect(normalizeTitle('流浪地球[HD]')).toBe('流浪地球')
  })

  it('去除括号内 4K 标签', () => {
    expect(normalizeTitle('流浪地球(4K)')).toBe('流浪地球')
  })

  it('去除括号内 1080P 标签', () => {
    expect(normalizeTitle('哪吒之魔童降世(1080P)')).toBe('哪吒之魔童降世')
  })

  it('去除括号内 HDR 标签', () => {
    expect(normalizeTitle('流浪地球[HDR]')).toBe('流浪地球')
  })

  it('去除独立 BluRay 标签', () => {
    expect(normalizeTitle('The Matrix BluRay')).toBe('the matrix')
  })

  it('去除独立 WEBRip 标签', () => {
    expect(normalizeTitle('Inception WEBRip')).toBe('inception')
  })

  // ── 装饰括号内容 ─────────────────────────────────────────────────

  it('去除全角【】内的装饰内容', () => {
    expect(normalizeTitle('【独家首播】流浪地球')).toBe('流浪地球')
  })

  it('去除【抢先版】装饰', () => {
    expect(normalizeTitle('流浪地球【抢先版】')).toBe('流浪地球')
  })

  it('去除（正片）装饰', () => {
    expect(normalizeTitle('流浪地球（正片）')).toBe('流浪地球')
  })

  // ── CJK 标点保留（META-22 归并键不变式 / 防回归）─────────────────
  // normalizeTitle 输出即持久化归并键 title_normalized；刻意保留 CJK 标点以维持存量行键稳定。
  // 标点不敏感的富集匹配归一化由 normalizeForExternalMatch 负责（见下方 describe）。

  it('保留顿号「、」与全角感叹号「！」（归并键稳定）', () => {
    expect(normalizeTitle('当前、正被打扰中！')).toBe('当前、正被打扰中！')
  })

  it('保留书名号「《》」（不剥离）', () => {
    expect(normalizeTitle('《灌篮高手》')).toBe('《灌篮高手》')
  })

  // ── 复合场景 ─────────────────────────────────────────────────────

  it('中英文混合标题：去年份 + 小写', () => {
    expect(normalizeTitle('Batman(2022)')).toBe('batman')
  })

  it('多重装饰：年份 + 季数 + 画质', () => {
    expect(normalizeTitle('Game of Thrones Season 3 (2013) [1080P]')).toBe('game of thrones')
  })

  it('同标题不同装饰应归并到相同结果', () => {
    const a = normalizeTitle('哪吒之魔童降世(2019)')
    const b = normalizeTitle('哪吒之魔童降世[HD]')
    const c = normalizeTitle('哪吒之魔童降世（正片）')
    expect(a).toBe(b)
    expect(b).toBe(c)
  })

  it('不同标题不应归并', () => {
    const a = normalizeTitle('流浪地球')
    const b = normalizeTitle('流浪地球2')
    expect(a).not.toBe(b)
  })

  it('空字符串返回空字符串', () => {
    expect(normalizeTitle('')).toBe('')
  })
})

// ── buildMatchKey ────────────────────────────────────────────────

describe('buildMatchKey', () => {
  it('相同标题 + 相同 year + 相同 type → 相同 key', () => {
    const a = buildMatchKey('哪吒之魔童降世(2019)', 2019, 'movie')
    const b = buildMatchKey('哪吒之魔童降世[HD]', 2019, 'movie')
    expect(a).toBe(b)
  })

  it('相同标题但 type 不同 → 不同 key（规则 A: type 不同不合并）', () => {
    const a = buildMatchKey('动漫标题', 2020, 'anime')
    const b = buildMatchKey('动漫标题', 2020, 'movie')
    expect(a).not.toBe(b)
  })

  it('相同标题但 year 不同 → 不同 key', () => {
    const a = buildMatchKey('翻拍电影', 2010, 'movie')
    const b = buildMatchKey('翻拍电影', 2023, 'movie')
    expect(a).not.toBe(b)
  })

  it('year 为 null 时也能正确生成 key', () => {
    const key = buildMatchKey('未知年份', null, 'movie')
    expect(key).toContain('|')
    expect(key).toContain('movie')
  })

  it('相同标题 year=null → 相同 key', () => {
    const a = buildMatchKey('无年份剧集', null, 'series')
    const b = buildMatchKey('无年份剧集', null, 'series')
    expect(a).toBe(b)
  })
})

// ── normalizeForExternalMatch（META-22 / 外部源富集匹配）──────────────

describe('normalizeForExternalMatch', () => {
  it('剥离顿号「、」与全角感叹号「！」（dump 侧召回对齐）', () => {
    expect(normalizeForExternalMatch('当前、正被打扰中！')).toBe('当前正被打扰中')
  })

  it('剥离全角问号「？」', () => {
    expect(normalizeForExternalMatch('你的名字？')).toBe('你的名字')
  })

  it('剥离全角逗号/句号「，。」', () => {
    expect(normalizeForExternalMatch('夏目友人帐，第。集')).toBe('夏目友人帐第集')
  })

  it('剥离书名号「《》」与引号「「」」', () => {
    expect(normalizeForExternalMatch('《灌篮高手》「全国大赛」')).toBe('灌篮高手全国大赛')
  })

  it('剥离片假名中点「・」与全角冒号「：」', () => {
    expect(normalizeForExternalMatch('钢之炼金术师：FA・剧场版')).toBe('钢之炼金术师fa剧场版')
  })

  it('带标点与无标点标题归一化后相同（漏配修复核心）', () => {
    expect(normalizeForExternalMatch('当前、正被打扰中！')).toBe(normalizeForExternalMatch('当前正被打扰中'))
  })

  it('全角字母数字保留（\\p{L}/\\p{N}）', () => {
    expect(normalizeForExternalMatch('Ｑ１０')).toBe('ｑ１０')
  })

  // ── 防回归：合法 CJK 字符不被误剥（Codex stop-time review）──────────
  // 々(U+3005 Lm) / 〇(U+3007 Nl) / 苏杭数字属字母数字，dump 侧 [^\p{L}\p{N}] 保留，必须一致保留

  it('保留叠字符「々」（人々 / 佐々木 类，与 dump 一致）', () => {
    expect(normalizeForExternalMatch('佐々木')).toBe('佐々木')
    expect(normalizeForExternalMatch('人々')).toBe('人々')
  })

  it('保留表零汉字「〇」', () => {
    expect(normalizeForExternalMatch('二〇二三')).toBe('二〇二三')
  })

  it('剥 ASCII 标点但保留词间空格（降低有损塌缩面）', () => {
    // 仅剥 \p{P}/\p{S}（'-'/':'）→ 空格保留（不像 dump [^\p{L}\p{N}] 连空格全剥）
    expect(normalizeForExternalMatch('Spider-Man: No Way Home')).toBe('spiderman no way home')
  })

  it('剥音符符号「♪」（\\p{S}）', () => {
    expect(normalizeForExternalMatch('おねがい♪マイメロディ')).toBe('おねがいマイメロディ')
  })

  it('仍复用 normalizeTitle 全流程（去年份/季数/画质）', () => {
    expect(normalizeForExternalMatch('海贼王！第二季(2023)[1080P]')).toBe('海贼王')
  })
})

// ── stripExternalMatchPunct（META-22 / 已归一字符串剥标点符号）──────────

describe('stripExternalMatchPunct', () => {
  it('对已归一字符串剥标点（持久化 title_normalized 入匹配边界）', () => {
    // 模拟持久化归并键（normalizeTitle 输出，保留标点）→ 匹配边界剥成 dump 对齐形态（CJK 无空格）
    expect(stripExternalMatchPunct(normalizeTitle('当前、正被打扰中！'))).toBe('当前正被打扰中')
  })

  it('幂等：已剥字符串再剥不变', () => {
    const once = stripExternalMatchPunct('当前正被打扰中')
    expect(stripExternalMatchPunct(once)).toBe('当前正被打扰中')
  })

  it('剥标点后折叠残留空白（保留词间单空格）', () => {
    expect(stripExternalMatchPunct('a ！ b')).toBe('a b')
  })

  it('保留 々〇 等字母数字字符', () => {
    expect(stripExternalMatchPunct('佐々木・2〇')).toBe('佐々木2〇')
  })

  it('空字符串返回空字符串', () => {
    expect(stripExternalMatchPunct('')).toBe('')
  })
})

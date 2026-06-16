/**
 * PinyinDetector.test.ts — CHG-365-A1
 *
 * 覆盖 isPinyin 的判定语义：
 *  1. 典型拼音（多词）→ true
 *  2. 真英文标题 → false（含非拼音音节词）
 *  3. 边界：空 / null / undefined / 纯空白 → false
 *  4. 单字符 / 短词 → false（MIN_WORD_LEN=2 防误判）
 *  5. 含非 ASCII（中文 / 重音字符）→ false
 *  6. 含数字 → false
 *  7. 首尾标点宽容（如 "Wo,Bei" 视为 2 词，仍判拼音）
 *  8. 大小写不敏感
 */

import { describe, it, expect } from 'vitest'
import { isPinyin, isConcatenatedPinyin, isPinyinTitle, isLikelyPinyinSlug } from '../../../../apps/api/src/services/PinyinDetector'

describe('PinyinDetector.isPinyin', () => {
  describe('典型拼音（plan §10.4.1 示例）', () => {
    it('"Wo Bei Quan Wang Da Bao" → true', () => {
      expect(isPinyin('Wo Bei Quan Wang Da Bao')).toBe(true)
    })

    it('"Da Hua Xi You" → true', () => {
      expect(isPinyin('Da Hua Xi You')).toBe(true)
    })

    it('"Hong Lou Meng" → true', () => {
      expect(isPinyin('Hong Lou Meng')).toBe(true)
    })

    it('"Zhuang Yuan Mei" (复音节 zhuang) → true', () => {
      expect(isPinyin('Zhuang Yuan Mei')).toBe(true)
    })
  })

  describe('真英文标题', () => {
    it('"The Avengers" → false ("the" / "avengers" 都非拼音音节)', () => {
      expect(isPinyin('The Avengers')).toBe(false)
    })

    it('"Inception" → false', () => {
      expect(isPinyin('Inception')).toBe(false)
    })

    it('"Star Wars" → false', () => {
      expect(isPinyin('Star Wars')).toBe(false)
    })

    it('"Forrest Gump" → false', () => {
      expect(isPinyin('Forrest Gump')).toBe(false)
    })
  })

  describe('边界', () => {
    it('空字符串 → false', () => {
      expect(isPinyin('')).toBe(false)
    })

    it('null → false', () => {
      expect(isPinyin(null)).toBe(false)
    })

    it('undefined → false', () => {
      expect(isPinyin(undefined)).toBe(false)
    })

    it('纯空白 → false', () => {
      expect(isPinyin('   ')).toBe(false)
    })

    it('单字符 → false（MIN_WORD_LEN=2 防误判）', () => {
      expect(isPinyin('a')).toBe(false)
    })
  })

  describe('非法字符', () => {
    it('含中文 → false', () => {
      expect(isPinyin('中文 Title')).toBe(false)
    })

    it('含重音字符 → false（café）', () => {
      expect(isPinyin('Café Bao')).toBe(false)
    })

    it('含数字 → false', () => {
      expect(isPinyin('Bao 2024')).toBe(false)
    })
  })

  describe('标点 / 大小写宽容', () => {
    it('首尾标点剥离 + 含 distinctive feature（"Da, Xi You." → true）', () => {
      expect(isPinyin('Da, Xi You.')).toBe(true)
    })

    it('全小写 / 全大写 等价（"DA HUA XI YOU" → true / 含 x distinctive）', () => {
      expect(isPinyin('DA HUA XI YOU')).toBe(true)
      expect(isPinyin('da hua xi you')).toBe(true)
    })
  })

  describe('严格 false-positive 防御', () => {
    // 多词且全是基础拼音音节（无 zh/ch/sh/q/x/j 声母或复韵母）
    // distinctive feature 门槛（Codex stop-time review #6）
    it('"Ma Ma" → false（英文重叠词 / 仅基础音节）', () => {
      expect(isPinyin('Ma Ma')).toBe(false)
    })

    it('"Naomi" → false（英文名 / 仅基础音节 na+o+mi 无 distinctive）', () => {
      expect(isPinyin('Naomi')).toBe(false)
    })

    it('"Wo Bei" → false（仅基础音节 / 无 distinctive / 保守判定）', () => {
      expect(isPinyin('Wo Bei')).toBe(false)
    })

    // 单词输入 ≥ 2 词门槛（Codex stop-time review #7）
    // 单词 + distinctive feature 是英文姓名 false-positive 主要来源
    it('"Long" → false（英文常见词 + ong distinctive / 单词不可靠）', () => {
      expect(isPinyin('Long')).toBe(false)
    })

    it('"Chang" → false（英文姓 + ch+ang / 单词不可靠）', () => {
      expect(isPinyin('Chang')).toBe(false)
    })

    it('"Sheng" → false（英文姓 + sh+eng / 单词不可靠）', () => {
      expect(isPinyin('Sheng')).toBe(false)
    })

    it('"Sushi" → false（单词 / 即使含 sh distinctive 也保守判 false）', () => {
      expect(isPinyin('Sushi')).toBe(false)
    })

    it('"Bao" → false（单词 + 仅基础音节 / 双重防御）', () => {
      expect(isPinyin('Bao')).toBe(false)
    })

    // 已知 limit case：多词英文姓名 "Long Wang" 仍可能 false-positive
    // 业务接受：title_en 实际典型形态是 ≥ 3 词的完整标题（"Wo Bei Quan Wang Da Bao"）
    it('"Long Wang" 已知 limit case → true（多词英文姓名 / heuristic 接受 / 配合人工校对）', () => {
      // 这是个文档化的 limit case：2 词姓名场景 helper 无法判断 / 人工校对兜底
      expect(isPinyin('Long Wang')).toBe(true)
    })
  })
})

// ── isConcatenatedPinyin（CHG-VIR-11-C：无空格连写拼音 / catalog title_en 污染形态）──

describe('isConcatenatedPinyin', () => {
  it('真实污染样例 → true（wuyanshashou = wu-yan-sha-shou / 含 sh）', () => {
    expect(isConcatenatedPinyin('wuyanshashou')).toBe(true)
  })

  it('长连写 → true（keaideniwugexiaohaidexiaochang）', () => {
    expect(isConcatenatedPinyin('keaideniwugexiaohaidexiaochang')).toBe(true)
  })

  it('DP 回溯形态 → true（heitaiyangdierji：dierji 须回溯 di-er-ji，贪心 die+rji 会误判）', () => {
    expect(isConcatenatedPinyin('heitaiyangdierji')).toBe(true)
  })

  it('混合大小写 slug → false（moxuMAO 元数据噪声不迁）', () => {
    expect(isConcatenatedPinyin('moxuMAO')).toBe(false)
  })

  it('含数字 slug → false（maoxuewang2026）', () => {
    expect(isConcatenatedPinyin('maoxuewang2026')).toBe(false)
  })

  it('长度 < 8 → false（banana 英文词防御）', () => {
    expect(isConcatenatedPinyin('banana')).toBe(false)
  })

  it('音节数 < 4 → false（maoxuewang = mao-xue-wang 3 音节保守不迁）', () => {
    expect(isConcatenatedPinyin('maoxuewang')).toBe(false)
  })

  it('无 distinctive feature → false（保守防英文）', () => {
    // wo-bei-da-ma：可分解 4 音节但全基础音节无 distinctive → false
    expect(isConcatenatedPinyin('wobeidama')).toBe(false)
  })

  it('含空格 → false（多词形态交给 isPinyin）', () => {
    expect(isConcatenatedPinyin('wu yan sha shou')).toBe(false)
  })

  it('不可分解英文 → false（avengersendgame）', () => {
    expect(isConcatenatedPinyin('avengersendgame')).toBe(false)
  })

  it('null / 空串 → false', () => {
    expect(isConcatenatedPinyin(null)).toBe(false)
    expect(isConcatenatedPinyin('')).toBe(false)
  })
})

// ── DP 分解修复回归（CHG-VIR-11-C：isPinyin 词内贪心歧义形态）──────────

describe('isPinyin — DP 回溯（贪心歧义词）', () => {
  it('"Dierji Zhanshi" → true（dierji 词内须回溯 di-er-ji；修复前贪心 die+rji 误判 false）', () => {
    expect(isPinyin('Dierji Zhanshi')).toBe(true)
  })
})

// ── isPinyinTitle 组合谓词（CHG-VIR-11-D：入库 title_en 拼音门禁正典口径）──────

describe('isPinyinTitle — isPinyin ∪ isConcatenatedPinyin', () => {
  it('无空格连写 slug（vod_en 实际污染形态）→ true', () => {
    // 「他比前男友炙热」全拼，TMDB 误匹配调查的实证样本
    expect(isPinyinTitle('tabiqiannanyouzhire')).toBe(true)
    expect(isPinyinTitle('wuyanshashou')).toBe(true)
    expect(isPinyinTitle('tunshixingkongdisanji')).toBe(true)
  })

  it('空格分隔多词拼音 → true', () => {
    expect(isPinyinTitle('Wo Bei Quan Wang Da Bao')).toBe(true)
    expect(isPinyinTitle('Da Hua Xi You')).toBe(true)
  })

  it('真英文标题 → false（保留写入 title_en）', () => {
    expect(isPinyinTitle('The Avengers')).toBe(false)
    expect(isPinyinTitle('Inception')).toBe(false)
    expect(isPinyinTitle('Forrest Gump')).toBe(false)
  })

  it('短串 / 非 ASCII / 空 → false', () => {
    expect(isPinyinTitle('maoxuewang2026')).toBe(false) // 剥数字→maoxuewang 仅 3 音节 < 4 阈值，放过
    expect(isPinyinTitle('他比前男友炙热')).toBe(false) // 中文本体非罗马音
    expect(isPinyinTitle(null)).toBe(false)
    expect(isPinyinTitle('')).toBe(false)
    expect(isPinyinTitle('   ')).toBe(false)
  })

  // CHG-VIR-11-E：含数字（季数/年份嵌入）的连写拼音——剥数字后再测，长串命中、短串放过
  it('数字嵌入的长连写拼音（季数/年份）→ true', () => {
    expect(isPinyinTitle('geleisidi6ji')).toBe(true) // 格雷斯第6季：剥6→geleisidiji 5 音节
    expect(isPinyinTitle('guanyuwozhuanshengbianchengshilaimuzhedangshidi4ji')).toBe(true) // 第4季
    expect(isPinyinTitle('jimaofeishangtiankuangbiao1978')).toBe(true) // 鸡毛飞上天:狂飙1978
  })

  // Codex stop-time review：空格分词拼音含数字（isPinyin 遇数字直接 false）剥数字后经 isPinyin 命中
  it('数字嵌入的空格分词拼音 → true', () => {
    expect(isPinyinTitle('Wei Xian Guan Xi 2023')).toBe(true) // 危险关系2023
    expect(isPinyinTitle('Ge Lei Si Di 2 Ji')).toBe(true)     // 格雷斯第2季
  })

  it('剥数字后短串 / 非拼音 → 仍 false（保守不误伤）', () => {
    expect(isPinyinTitle('miqing2025')).toBe(false) // 迷情：剥→miqing 2 音节，短
    expect(isPinyinTitle('se7en')).toBe(false)       // 真英文含数字：剥→seen 非拼音
    expect(isPinyinTitle('2012')).toBe(false)        // 纯数字
  })
})

// CHG-VIR-11-F：入库门禁激进谓词——保守谓词漏判的真拼音（短/无 distinctive/嵌大写）全命中
describe('isLikelyPinyinSlug — 激进拼音判定（门禁专用）', () => {
  it('① <4 音节短拼音 → true（保守 isConcatenatedPinyin 漏）', () => {
    expect(isLikelyPinyinSlug('jianan')).toBe(true)   // 迦南 jia-nan 2 音节
    expect(isLikelyPinyinSlug('chixia')).toBe(true)   // 炽夏 chi-xia
    expect(isLikelyPinyinSlug('chaociyuan')).toBe(true) // 超次元 chao-ci-yuan 3 音节
  })

  it('② 无 distinctive 特征拼音 → true（保守漏）', () => {
    expect(isLikelyPinyinSlug('womenyukuaidehaorizi')).toBe(true) // 我们愉快的好日子 8 音节
    expect(isLikelyPinyinSlug('laopainanyou')).toBe(true)         // 老派男友
    expect(isLikelyPinyinSlug('sihuonianhua')).toBe(true)         // 似火年华
    expect(isLikelyPinyinSlug('wocaibuhuixindongne')).toBe(true)  // 我才不会心动呢（含 'ne'，补音节表后命中）
  })

  it('③ 嵌入大写字母（版本/VS token）→ true（剥大写当分词符）', () => {
    expect(isLikelyPinyinSlug('jiamianqishiV3')).toBe(true)  // 假面骑士V3
    expect(isLikelyPinyinSlug('jiaNcifang')).toBe(true)      // 家N次方
    expect(isLikelyPinyinSlug('shijiebeixiaozusaibilishiVSaiji20260616')).toBe(true) // 世界杯…比利时VS埃及
  })

  it('④ title-case 拼音（首字母大写是拼音一部分）→ true（Codex stop-time review）', () => {
    expect(isLikelyPinyinSlug('Chixia')).toBe(true)                 // 炽夏 title-case 连写（剥大写会断成 hixia）
    expect(isLikelyPinyinSlug('Womenyukuaidehaorizi')).toBe(true)   // title-case 连写
    expect(isLikelyPinyinSlug('Wo Cai Bu Hui Xin Dong Ne')).toBe(true) // title-case 空格分词
    expect(isLikelyPinyinSlug('Reconglingkaishideyishijieshenghuo')).toBe(true) // Re从零开始…（re 是合法音节）
  })

  it('真英文 → false（不误伤）', () => {
    expect(isLikelyPinyinSlug('Inception')).toBe(false)   // 不可分解
    expect(isLikelyPinyinSlug('The Avengers')).toBe(false) // 分词 avengers 不可分解
    expect(isLikelyPinyinSlug('Joy of Life')).toBe(false)  // oy/ife 不可分解
    expect(isLikelyPinyinSlug('time')).toBe(false)         // 4 字符 < 6 阈值
    expect(isLikelyPinyinSlug('BORDERLESS')).toBe(false)   // 全大写真英文不可分解
    expect(isLikelyPinyinSlug(null)).toBe(false)
    expect(isLikelyPinyinSlug('')).toBe(false)
  })

  it('能分解为拼音的真英文 → true（用户裁定可接受的误拦）', () => {
    expect(isLikelyPinyinSlug('banana')).toBe(true) // ba-na-na 可分解（罕见误拦，title_en→null 可恢复）
  })
})

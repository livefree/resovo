/**
 * TitleIdentityParser.ts — 视频身份解析器（Phase 1a / SEQ-20260602-03 / CHG-VIR-5）
 *
 * 产出 ADR-105a D-105a-1 定义的**新增并行 `core_title_key`** + 结构化 facets，供后续
 * 多证据 blocking / Scoring 使用。**零生产行为变更**：纯函数、不落库、不参与任何归并决策。
 *
 * ── 与 `TitleNormalizer` 的边界（红线 R1 / ADR-105a D-105a-1）─────────────────────
 * `core_title_key` 与 `normalizeTitle` / `normalizeMergeKey` **语义解耦、互不覆盖**：
 *   - `normalizeMergeKey`（写 `media_catalog.title_normalized`）= 保守归并键基线，**不动**。
 *   - `core_title_key` = blocking 召回键，把 season / edition / 语言变体 / 序号等 token
 *     **解析保存到 facets 而非丢弃**（normalizeTitle 是直接删除）。
 * 因此本文件**刻意不复用** `TitleNormalizer` 内部常量 —— 二者是并行 key，各自演进
 * （ADR-105a D-105a-1「与 normalizeTitle/normalizeMergeKey 语义解耦」）。本文件不 import
 * 也不修改 `TitleNormalizer`，保证其输出逐字符不变（CHG-VIR-5 验收红线）。
 *
 * ── 确定性 ──────────────────────────────────────────────────────────────────
 * 全流程确定性：同一 raw 输入恒产出同一结果（无随机 / 无时间 / 无外部依赖），是
 * `evidence_hash`（ADR-105a D-105a-8）幂等的前提。
 *
 * ── 不做的事 ────────────────────────────────────────────────────────────────
 * - 不做繁简归一 / 字形折叠（简繁走 ADR-175 并列 localized alias / 红线 R1）。
 * - 不引入 pg_trgm / OpenCC / 任何技术栈外依赖（红线 R2）；纯字符串确定性归一。
 */

import { isPinyin } from './PinyinDetector'

// ── 解析器版本（ADR-105a D-105a-8 / Y-105a-5）──────────────────────────────────
/**
 * 解析器版本号。语义升级（归一规则 / facet 抽取规则变化）必须 bump，驱动
 * `evidence_hash` 变化 → 受控触发 `superseded` + 新 pending（Phase 2b）。
 * 非内容变化（注释 / 重构）不 bump。
 * 1.1.0（ADR-199 D-199-4）：languageVariant 单值 facet 拆分为 audioLanguage +
 * subtitleMarker/subtitleLanguages 双维度；规则表拆 AUDIO/SUBTITLE 两张。
 */
export const TITLE_PARSER_VERSION = '1.1.0'

// ── 类型契约（ADR-105a D-105a-1 / 设计 §4.1）─────────────────────────────────

/**
 * 标题解析产物 facets：解析保存而非删除的结构化 token。
 * 全部字段仅供观测 / 后续 Scoring，Phase 1a 不参与任何决策。
 */
export interface TitleFacets {
  /** 季号：第N季 / Season N / SN / Part N / Vol N 剥出的数字（「序号即季/卷」）。null=无显式季标记 */
  seasonNumber: number | null
  /** 版本标记：加长版 / 导演剪辑版 / 完整版 / 精编版 / 正片 等（取首个命中的规范词）。null=无 */
  edition: string | null
  /**
   * 语音（配音）变体（ADR-199 D-199-4，1.1.0 起替代旧单值 languageVariant）：
   * 国语 / 粤语 / 日语 / 韩语 / 英语 等规范词，取首个命中。null=无语音 token。
   * 旧 parsed_facets_jsonb 快照仍含 languageVariant 键（读侧兜底，无生产消费方）。
   */
  audioLanguage: string | null
  /**
   * 字幕 token 规范词（中字 / 中英字幕 / 双语字幕 / 内嵌字幕 / 无字幕 / 字幕），
   * 取首个命中。null=标题无字幕 token。与 subtitleLanguages 配合表达 DB 三态
   * （D-199-1）：marker=无字幕 → `{}`；subtitleLanguages 非空 → 数组；
   * marker 非 null 但 languages 空（双语/内嵌/裸字幕）→ NULL（已知有字幕但具体未知）。
   */
  subtitleMarker: string | null
  /** 字幕已知具体语言：中字→['中文']，中英字幕→['中文','英文']；未知具体或无 token→[] */
  subtitleLanguages: string[]
  /** 发布形态：SP / OVA / 剧场版 / 番外 等（取首个命中规范词）。null=无 */
  releaseMarker: string | null
  /** 画质 / 编码噪声 token（4k / 1080p / bluray / hevc …），去重有序 */
  qualityNoise: string[]
  /** 源站操作噪声 token（更新至 / 全集 / 完结 / 抢先版 …），去重有序 */
  sourceNoise: string[]
  /** 括号内提取的原始 token（年份 / 装饰信息），去重有序 */
  bracketTokens: string[]
}

/**
 * 标题类型启发式分类（ADR-175 枚举）。单一 raw 字符串无外部上下文时为 best-effort，
 * Phase 1a 仅作观测。各值触发信号见 {@link classifyTitleKind}。
 * - `crawler`：含源站操作噪声（更新至 / 全集 …）的采集原始标题
 * - `edition`：以版本标记（加长版 / 导剪）为主要特征
 * - `localized`：含配音 / 字幕等本地化变体（国语 / 粤语 / 中字）
 * - `romanized`：核心标题为拼音 / 罗马音
 * - `aka`：别名（Phase 1a 无单标题可靠信号，预留 forward-compat，当前不主动产出）
 * - `original`：缺省（干净的原始 / 标准标题）
 */
export type TitleKind = 'original' | 'localized' | 'romanized' | 'aka' | 'crawler' | 'edition'

/** `parseTitle` 输出（ADR-105a D-105a-1）。 */
export interface ParsedTitle {
  /** 确定性归一后的作品核心标题等值 key（B-tree 可承载；非字符相似键 / D-105a-1） */
  coreTitleKey: string
  /** 结构化解析产物（解析保存而非删除） */
  facets: TitleFacets
  /** 标题类型启发式分类 */
  titleKind: TitleKind
  /** 解析器版本（= {@link TITLE_PARSER_VERSION}） */
  parserVersion: string
  /** 解析置信度 [0,1]（确定性启发式；噪声越多越低） */
  confidence: number
}

/**
 * 面向入库/展示的标准标题包。
 *
 * 存储分工：
 * - `displayTitle`：写 `videos.title` / `media_catalog.title` 的标准显示标题。
 * - `identityTitle`：参与 `title_normalized` 的标题基底；保留发布形态，排除季号。
 * - `seasonNumber`：写 `media_catalog.season_number`，由唯一键显式承载。
 */
export interface StandardVideoTitle {
  displayTitle: string
  identityTitle: string
  seasonNumber: number | null
  releaseMarker: string | null
  /** 语音变体（ADR-199 双维度，1.1.0 起替代旧 languageVariant）。供 source 层语言推断链 title_token 级消费 */
  audioLanguage: string | null
  /** 字幕 token 规范词（语义见 TitleFacets.subtitleMarker） */
  subtitleMarker: string | null
  /** 字幕已知具体语言（语义见 TitleFacets.subtitleLanguages） */
  subtitleLanguages: string[]
  edition: string | null
  coreTitleKey: string
}

// ── 抽取规则常量（解析器自有真源，与 TitleNormalizer 解耦）─────────────────────

/** 季 / 部 / 卷 序号模式 → facets.seasonNumber（「序号即季/卷」，从 core 剥离）。 */
const SEASON_PATTERNS: ReadonlyArray<RegExp> = [
  // 中文：第X季 / 第X部 / 第X卷（X = CJK 数字或阿拉伯数字）
  /第\s*([一二三四五六七八九十百零〇\d]+)\s*[季部卷]/g,
  // 英文：Season 1 / Seasons 2
  /\bseasons?\s*(\d{1,3})\b/gi,
  // 英文：S1 / S01 / S1E01（仅取季号，E 集号不进 season）
  /\bs(\d{1,2})(?:e\d{1,2})?\b/gi,
  // Part 2 / Part.2
  /\bpart\.?\s*(\d{1,3})\b/gi,
  // Vol 3 / Vol.3
  /\bvol\.?\s*(\d{1,3})\b/gi,
]

/** 版本标记 → facets.edition（规范词 + 匹配别名）。顺序即优先级（先命中先取）。 */
const EDITION_RULES: ReadonlyArray<{ canonical: string; pattern: RegExp }> = [
  { canonical: '导演剪辑版', pattern: /导演剪辑版|导演剪辑|导剪|director'?s?\s*cut/gi },
  { canonical: '加长版', pattern: /加长版|加长|extended(?:\s*edition)?/gi },
  { canonical: '完整版', pattern: /完整版|未删减版|uncut/gi },
  { canonical: '精编版', pattern: /精编版|精编/gi },
  { canonical: '正片', pattern: /正片/gi },
]

/** 发布形态 → facets.releaseMarker（规范词 + 匹配别名）。顺序即优先级。 */
const RELEASE_MARKER_RULES: ReadonlyArray<{ canonical: string; pattern: RegExp }> = [
  { canonical: '剧场版', pattern: /剧场版|劇場版|theatrical|the\s*movie/gi },
  { canonical: 'OVA', pattern: /\bov[a]\b|\boad\b/gi },
  { canonical: 'SP', pattern: /特别篇|特別篇|\bsp\b|\bspecial\b/gi },
  { canonical: '番外', pattern: /番外篇|番外/gi },
]

/**
 * 语音（配音）变体 → facets.audioLanguage（ADR-199 D-199-2 规则表拆分）。
 * 顺序即优先级。规范词 = 封闭枚举（AUDIO_LANGUAGE_CANONICALS 真源在
 * SourceLanguageResolver）。「国配」并入「国语」规范词——语义同为中文配音，
 * 分立会让前台「≥2 语音才显示」误判多语音。供 SourceLanguageResolver 复用
 * （D-199-3 步骤 0 线路名 token / vod_lang token）。
 */
export const AUDIO_VARIANT_RULES: ReadonlyArray<{ canonical: string; pattern: RegExp }> = [
  { canonical: '国语', pattern: /国语版|國語版|普通话版|国配版|国语|國語|普通话|国配/gi },
  { canonical: '粤语', pattern: /粤语版|粵語版|粤语|粵語/gi },
  { canonical: '日语', pattern: /日语版|日語版|日语|日語/gi },
  { canonical: '韩语', pattern: /韩语版|韓語版|韩语|韓語/gi },
  { canonical: '英语', pattern: /英语版|英語版|英语|英語/gi },
]

/**
 * 字幕变体 → facets.subtitleMarker + facets.subtitleLanguages（ADR-199 D-199-2）。
 * 顺序即优先级（复合 token 先于裸「字幕」）。languages = 可解析的具体语言
 * （空数组=有字幕但具体语言未知，与「无字幕」marker 区分，见 TitleFacets 注释）。
 */
export const SUBTITLE_VARIANT_RULES: ReadonlyArray<{
  canonical: string
  pattern: RegExp
  languages: ReadonlyArray<string>
}> = [
  { canonical: '中英字幕', pattern: /中英字幕|中英双字/gi, languages: ['中文', '英文'] },
  { canonical: '双语字幕', pattern: /双语字幕|雙語字幕/gi, languages: [] },
  { canonical: '内嵌字幕', pattern: /內嵌字幕|内嵌字幕/gi, languages: [] },
  { canonical: '无字幕', pattern: /无字幕|無字幕/gi, languages: [] },
  { canonical: '中字', pattern: /中字/gi, languages: ['中文'] },
  { canonical: '字幕', pattern: /字幕/gi, languages: [] },
]

/** 画质 / 编码噪声 → facets.qualityNoise[]（不影响身份）。 */
const QUALITY_NOISE_PATTERNS: ReadonlyArray<RegExp> = [
  /\b4k\b|\buhd\b|\b2160p\b/gi,
  /\b1080[pi]\b|\b720[pi]\b|\b480p\b|\b360p\b/gi,
  /\bhdr10\+?\b|\bhdr\b|\bdolby\s*vision\b|\bdv\b/gi,
  /\bblu-?ray\b|\bbdrip\b|\bwebrip\b|\bweb-?dl\b|\bwebdl\b|\bremux\b|\bdvdrip\b|\bdvd\b|\bhdtv\b/gi,
  /\bx?26[45]\b|\bh\.?26[45]\b|\bhevc\b|\bavc\b/gi,
  /\bfhd\b|\bhd\b|\bsd\b/gi,
  /\baac\b|\bdd5\.1\b|\batmos\b|\bflac\b/gi,
]

/** 源站操作噪声 → facets.sourceNoise[]（采集运营态，强 crawler 信号）。 */
const SOURCE_NOISE_PATTERNS: ReadonlyArray<RegExp> = [
  /更新至\s*(?:第\s*)?[\d一二三四五六七八九十百零〇]*\s*[集话話期]?/g,
  /已?完结|已?完結|大结局|大結局/g,
  /全\s*[\d一二三四五六七八九十百零〇]*\s*[集话話期]/g,
  /共\s*[\d一二三四五六七八九十百零〇]+\s*[集话話期]/g,
  // 单集 / 单话页噪声：第5集 / 第五话（注意：第N季/部/卷 已在 SEASON_PATTERNS 剥出，不在此）
  /第\s*[\d一二三四五六七八九十百零〇]+\s*[集话話期]/g,
  /抢先版|搶先版|抢先看|抢鲜版/g,
  /高清在线|在线观看|在線觀看|免费观看|免費觀看|高清完整/g,
  // 域名水印（www.xxx.com / xxx.tv 等源站签名）
  /\b(?:www\.)?[a-z0-9][a-z0-9-]*\.(?:com|net|cc|tv|me|cn|org|io|vip)\b/gi,
  /\bhd中字\b/gi,
]

/** 装饰括号（含内容）— 内容提取到 bracketTokens 后整体剥离。 */
const BRACKET_WITH_CONTENT = /[（(【\[][^）)\]】]{0,40}[）)\]】]/g

/**
 * Unicode 标点（`\p{P}`）+ 符号（`\p{S}`）。core_title_key 末步剥离，使
 * 「当前、正被打扰中！」与「当前正被打扰中」归一到同 key（与 normalizeMergeKey 同口径，
 * 但本文件独立实现以保持解耦）。
 */
const PUNCT_SYMBOLS = /[\p{P}\p{S}]/gu

// ── CJK 数字解析（季号用）──────────────────────────────────────────────────────

const CJK_DIGIT: Readonly<Record<string, number>> = {
  零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5,
  六: 6, 七: 7, 八: 8, 九: 9,
}

/**
 * 解析季号字符串为整数：支持阿拉伯数字与 CJK 数字（零~九十百，覆盖 0~999，季号场景足够）。
 * 无法解析返回 null。确定性、无副作用。
 */
function parseSeasonNumeral(raw: string): number | null {
  const s = raw.trim()
  if (s === '') return null
  if (/^\d+$/.test(s)) return Number.parseInt(s, 10)

  // CJK：处理 十/百 量级与个位组合（一十一=11、二十=20、二十三=23、一百零五=105）
  let total = 0
  let section = 0
  let consumed = false
  for (const ch of s) {
    if (ch === '十') {
      section = (section === 0 ? 1 : section) * 10
      consumed = true
    } else if (ch === '百') {
      section = (section === 0 ? 1 : section) * 100
      consumed = true
    } else if (ch in CJK_DIGIT) {
      const d = CJK_DIGIT[ch]!
      if (d === 0) {
        // 「零」仅作占位（一百零五），不直接累加
        consumed = true
      } else {
        total += section
        section = d
        consumed = true
      }
    } else {
      return null
    }
  }
  if (!consumed) return null
  return total + section
}

// ── 抽取辅助 ──────────────────────────────────────────────────────────────────

/** 把全角字符折叠为半角（数字 / 字母 / 空格），便于 ASCII 模式匹配。确定性。 */
function foldFullwidth(input: string): string {
  return input.replace(/[！-～]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  ).replace(/　/g, ' ')
}

/**
 * 显示标题专用折叠：仅折叠全角数字/字母与全角空格（ASCII 噪声模式可命中），
 * **保留全角标点**——中文显示标题惯例用全角标点（「这！就是街舞」「：起源」），
 * 与 normalizeDisplayTitle 的全角标点收空格规则配套。识别/归一路径仍走
 * foldFullwidth 全折叠，不受影响。
 */
function foldDisplayWidth(input: string): string {
  return input.replace(/[０-９ａ-ｚＡ-Ｚ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  ).replace(/　/g, ' ')
}

/** 去重保序追加。 */
function pushUnique(list: string[], value: string): void {
  const v = value.trim()
  if (v !== '' && !list.includes(v)) list.push(v)
}

/**
 * 单值 marker 抽取（release / edition / languageVariant 共用）：
 * 按规则顺序剥离全部命中文本，首个命中规则的 canonical 经 assign 写入 facet。返回剥离后的串。
 */
function extractSingleMarker(
  input: string,
  rules: ReadonlyArray<{ canonical: string; pattern: RegExp }>,
  assign: (canonical: string) => void,
): string {
  let s = input
  let assigned = false
  for (const { canonical, pattern } of rules) {
    let hit = false
    s = s.replace(pattern, () => {
      hit = true
      return ' '
    })
    if (hit && !assigned) {
      assign(canonical)
      assigned = true
    }
  }
  return s
}

/**
 * 字幕变体抽取（D-199-2）：与 extractSingleMarker 同构，但首个命中同时携带
 * languages 数组（SUBTITLE_VARIANT_RULES 形状不同，无法直接共用）。
 * 所有规则命中文本均剥离，仅首个命中触发 assign。
 */
function extractSubtitleMarker(
  input: string,
  assign: (canonical: string, languages: ReadonlyArray<string>) => void,
): string {
  let s = input
  let assigned = false
  for (const { canonical, pattern, languages } of SUBTITLE_VARIANT_RULES) {
    let hit = false
    s = s.replace(pattern, () => {
      hit = true
      return ' '
    })
    if (hit && !assigned) {
      assign(canonical, languages)
      assigned = true
    }
  }
  return s
}

/**
 * 噪声 token 抽取（qualityNoise / sourceNoise 共用）：所有命中文本经 normalizeMatch
 * 去重收集到 list，并从串剥离。返回剥离后的串。
 */
function extractNoiseTokens(
  input: string,
  patterns: ReadonlyArray<RegExp>,
  list: string[],
  normalizeMatch: (match: string) => string,
): string {
  let s = input
  for (const pattern of patterns) {
    s = s.replace(pattern, (match) => {
      pushUnique(list, normalizeMatch(match))
      return ' '
    })
  }
  return s
}

// ── 主入口 ────────────────────────────────────────────────────────────────────

/**
 * 解析原始标题为 {@link ParsedTitle}。确定性、纯函数、无副作用。
 *
 * 流水线（每步把命中的 token 抽到 facets 后从工作串剥离）：
 *   1. 剥 HTML 标签 / 实体
 *   2. 全角折叠（数字 / 字母 / 空格）
 *   3. 提取括号 token → bracketTokens，剥离括号
 *   4. 季 / 部 / 卷序号 → seasonNumber（**仅显式季标记**；裸序号如「复仇者联盟4」保留）
 *   5. 发布形态 → releaseMarker
 *   6. 版本标记 → edition
 *   7. 语言 / 字幕变体 → languageVariant
 *   8. 画质噪声 → qualityNoise[]
 *   9. 源站噪声 → sourceNoise[]
 *  10. 折叠空白 → lower → 剥标点/符号 ⇒ coreTitleKey
 *
 * Y4 护栏（D-105a-13）：第 4 步只剥「有显式季/部/卷关键词」的序号；裸尾随数字
 * （序号即作品身份，如《复仇者联盟 4》）保留进 coreTitleKey，使不同序号 → 不同 key。
 */
export function parseTitle(raw: string): ParsedTitle {
  const facets: TitleFacets = {
    seasonNumber: null,
    edition: null,
    audioLanguage: null,
    subtitleMarker: null,
    subtitleLanguages: [],
    releaseMarker: null,
    qualityNoise: [],
    sourceNoise: [],
    bracketTokens: [],
  }

  if (typeof raw !== 'string' || raw.trim() === '') {
    return {
      coreTitleKey: '',
      facets,
      titleKind: 'original',
      parserVersion: TITLE_PARSER_VERSION,
      confidence: 0.1,
    }
  }

  let s = raw

  // 1. 剥 HTML 标签与实体
  s = s.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ')

  // 2. 全角折叠
  s = foldFullwidth(s)

  // 3. 括号 token 提取 + 剥离
  s = s.replace(BRACKET_WITH_CONTENT, (match) => {
    const inner = match.slice(1, -1).trim()
    if (inner !== '') pushUnique(facets.bracketTokens, inner)
    return ' '
  })

  // 4. 季 / 部 / 卷序号（仅显式标记；首个命中定 seasonNumber）
  for (const pattern of SEASON_PATTERNS) {
    s = s.replace(pattern, (_match, num: string) => {
      if (facets.seasonNumber === null) {
        const parsed = parseSeasonNumeral(num)
        if (parsed !== null) facets.seasonNumber = parsed
      }
      return ' '
    })
  }

  // 5. 发布形态 / 6. 版本标记 / 7a. 语音变体 / 7b. 字幕变体（单值，首个命中规则胜出）
  s = extractSingleMarker(s, RELEASE_MARKER_RULES, (c) => { facets.releaseMarker = c })
  s = extractSingleMarker(s, EDITION_RULES, (c) => { facets.edition = c })
  s = extractSingleMarker(s, AUDIO_VARIANT_RULES, (c) => { facets.audioLanguage = c })
  s = extractSubtitleMarker(s, (canonical, languages) => {
    facets.subtitleMarker = canonical
    facets.subtitleLanguages = [...languages]
  })

  // 8. 画质噪声 / 9. 源站噪声（多值，去重收集）
  s = extractNoiseTokens(s, QUALITY_NOISE_PATTERNS, facets.qualityNoise, (m) => m.toLowerCase())
  s = extractNoiseTokens(s, SOURCE_NOISE_PATTERNS, facets.sourceNoise, (m) => m.replace(/\s+/g, ''))

  // 10. 折叠空白 → lower → 剥标点/符号
  const coreTitleKey = s
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(PUNCT_SYMBOLS, '')
    .replace(/\s+/g, ' ')
    .trim()

  return {
    coreTitleKey,
    facets,
    titleKind: classifyTitleKind(coreTitleKey, facets),
    parserVersion: TITLE_PARSER_VERSION,
    confidence: computeConfidence(coreTitleKey, facets),
  }
}

function stripRules(
  input: string,
  rules: ReadonlyArray<{ canonical: string; pattern: RegExp }>,
): string {
  let s = input
  for (const { pattern } of rules) {
    s = s.replace(pattern, ' ')
  }
  return s
}

function stripPatterns(input: string, patterns: ReadonlyArray<RegExp>): string {
  let s = input
  for (const pattern of patterns) {
    s = s.replace(pattern, ' ')
  }
  return s
}

function normalizeDisplayTitle(input: string): string {
  return input
    .replace(/\s+/g, ' ')
    .replace(/\s+([，。！？、：；）》】])/g, '$1')
    .replace(/([（《【])\s+/g, '$1')
    .trim()
}

function appendDisplaySuffix(base: string, suffix: string | null): string {
  return suffix ? `${base} ${suffix}` : base
}

/**
 * 从采集原始标题派生标准存储/显示标题。
 *
 * 规则：
 * - `第x季` / `Sx` / `Part x` 是结构化身份：从显示基底剥离，写 `seasonNumber`，
 *   展示统一追加 `第N季`。
 * - `剧场版` / `OVA` / `SP` 是发布形态身份：保留进 `identityTitle` 和展示标题。
 * - `国语` / `粤语` / 字幕、画质、更新态是 source 层或噪声：不进入 catalog/video 标题。
 */
export function buildStandardVideoTitle(raw: string): StandardVideoTitle {
  const parsed = parseTitle(raw)

  let base = raw
  base = base.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ')
  base = foldDisplayWidth(base)
  base = base.replace(BRACKET_WITH_CONTENT, ' ')
  base = stripPatterns(base, SEASON_PATTERNS)
  base = stripRules(base, RELEASE_MARKER_RULES)
  base = stripRules(base, EDITION_RULES)
  base = stripRules(base, AUDIO_VARIANT_RULES)
  base = stripRules(base, SUBTITLE_VARIANT_RULES)
  base = stripPatterns(base, QUALITY_NOISE_PATTERNS)
  base = stripPatterns(base, SOURCE_NOISE_PATTERNS)

  const fallbackTitle = normalizeDisplayTitle(parsed.coreTitleKey || raw)
  const baseTitle = normalizeDisplayTitle(base) || fallbackTitle
  const identityTitle = appendDisplaySuffix(baseTitle, parsed.facets.releaseMarker)
  const displayTitle = parsed.facets.seasonNumber === null
    ? identityTitle
    : `${identityTitle} 第${parsed.facets.seasonNumber}季`

  return {
    displayTitle,
    identityTitle,
    seasonNumber: parsed.facets.seasonNumber,
    releaseMarker: parsed.facets.releaseMarker,
    audioLanguage: parsed.facets.audioLanguage,
    subtitleMarker: parsed.facets.subtitleMarker,
    subtitleLanguages: parsed.facets.subtitleLanguages,
    edition: parsed.facets.edition,
    coreTitleKey: parsed.coreTitleKey,
  }
}

/**
 * 标题类型启发式分类。确定性优先级：
 *   crawler（含源站噪声）> edition（含版本标记）> localized（含语言变体）
 *   > romanized（核心为拼音）> original（缺省）
 * 单标题无外部上下文 → best-effort，Phase 1a 仅观测。`aka` 无可靠单标题信号，不主动产出。
 */
export function classifyTitleKind(coreTitleKey: string, facets: TitleFacets): TitleKind {
  if (facets.sourceNoise.length > 0) return 'crawler'
  if (facets.edition !== null) return 'edition'
  // D-199-4：双维度任一非空即 localized（subtitleMarker 覆盖「双语/内嵌/裸字幕」等
  // languages 不可解析的 token，比仅看 subtitleLanguages.length 召回完整）
  if (facets.audioLanguage !== null || facets.subtitleMarker !== null) return 'localized'
  if (isPinyin(coreTitleKey)) return 'romanized'
  return 'original'
}

/**
 * 解析置信度 [0,1]：确定性启发式，噪声 / 残缺越多越低。仅观测，不参与决策。
 */
export function computeConfidence(coreTitleKey: string, facets: TitleFacets): number {
  if (coreTitleKey === '') return 0.1
  let score = 1.0
  if (facets.sourceNoise.length > 0) score -= 0.15
  if (facets.qualityNoise.length > 2) score -= 0.05
  if (facets.bracketTokens.length > 2) score -= 0.05
  if (coreTitleKey.length <= 1) score -= 0.2
  return Math.max(0, Math.min(1, Math.round(score * 100) / 100))
}

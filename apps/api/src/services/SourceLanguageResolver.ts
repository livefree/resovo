/**
 * SourceLanguageResolver.ts — 播放源语言双维度推断（ADR-199 D-199-2 / D-199-3）
 *
 * 把分散的语言信号（线路名 token / 上游 vod_lang / 标题 facets / 地区先验）按
 * 五级优先级链归一为 `video_sources` 的 4 个语言列取值。纯函数、确定性、无副作用。
 *
 * 优先级（D-199-3，数据优先于推断）：
 *   0. sourceName 行级 token（最精确，评审 BLOCKER 方案 B 新增）
 *   1. vod_lang（上游结构化字段，vod 级）
 *   2. 标题 token（TitleIdentityParser 双维度 facets，vod 级）
 *   3. 地区推断（仅 audio：CN·TW→国语 / HK→粤语 / JP→日语 / KR→韩语）
 *   4. unknown
 *
 * 字幕维度无地区推断（无可靠先验，provenance CHECK 同步少 region_inferred）。
 * country 规整委托 packages/types `countryToIso` 单一真源（META-40 收敛，原 COUNTRY_MAP
 * 已上提）；双形态：已是 ISO code 直接用，否则过中文/别名表。
 */

import type { AudioLanguageSource, SubtitleLanguageSource } from '@/types'
import { countryToIso } from '@/types'
import { AUDIO_VARIANT_RULES, SUBTITLE_VARIANT_RULES } from './TitleIdentityParser'

// ── 封闭枚举规范词（D-199-2 真源；扩词改这里 + AUDIO_VARIANT_RULES）──────────────

/** 语音规范词封闭枚举。「国配」并入「国语」（同为中文配音，分立误判多语音）。 */
export const AUDIO_LANGUAGE_CANONICALS = ['国语', '粤语', '日语', '韩语', '英语'] as const
export type AudioLanguageCanonical = typeof AUDIO_LANGUAGE_CANONICALS[number]

/** 字幕已知具体语言规范词封闭枚举（subtitle_languages 数组元素值域）。 */
export const SUBTITLE_LANGUAGE_CANONICALS = ['中文', '英文'] as const

/**
 * vod_lang 自由文本 → 语音规范词别名映射（exact-trim 命中优先于 token 扫描；
 * 「国粤双语」等组合词 token 扫描扫不到相邻子串，必须显式列出取首个规范词）。
 */
const VOD_LANG_AUDIO_ALIASES: Readonly<Record<string, AudioLanguageCanonical>> = {
  汉语普通话: '国语',
  普通话: '国语',
  国粤双语: '国语',
  中文: '国语',
  华语: '国语',
  汉语: '国语',
  韩文: '韩语',
  日文: '日语',
  英文: '英语',
}

/** 地区 → 语音先验（仅 audio，D-199-3 第 3 级；HK→粤语 / TW→国语 经评审采纳）。 */
const REGION_AUDIO_MAP: Readonly<Record<string, AudioLanguageCanonical>> = {
  CN: '国语',
  TW: '国语',
  HK: '粤语',
  JP: '日语',
  KR: '韩语',
}

// ── 归一函数（D-199-2）────────────────────────────────────────────────────────

/**
 * 自由文本（vod_lang / 线路名 / 任意 token 串）→ 语音规范词。
 * exact-trim 别名命中 > AUDIO_VARIANT_RULES 首个 token 命中 > null（原文留观测层）。
 */
export function normalizeAudioLanguage(raw: string | null | undefined): AudioLanguageCanonical | null {
  const s = raw?.trim()
  if (!s) return null
  const alias = VOD_LANG_AUDIO_ALIASES[s]
  if (alias) return alias
  for (const { canonical, pattern } of AUDIO_VARIANT_RULES) {
    // String.match(/g) 无 lastIndex 状态问题（test/exec 对 /g 规则有状态，勿换）
    if (s.match(pattern)) return canonical as AudioLanguageCanonical
  }
  return null
}

/** 字幕维度 token 命中结果：marker 规范词 + 可解析具体语言（语义同 TitleFacets）。 */
export interface SubtitleTokenHit {
  marker: string
  languages: ReadonlyArray<string>
}

/** 自由文本 → 字幕 token（首个命中规则）。null=无字幕 token。 */
export function matchSubtitleToken(raw: string | null | undefined): SubtitleTokenHit | null {
  const s = raw?.trim()
  if (!s) return null
  for (const { canonical, pattern, languages } of SUBTITLE_VARIANT_RULES) {
    if (s.match(pattern)) return { marker: canonical, languages }
  }
  return null
}

/**
 * country 双形态规整：委托 packages/types `countryToIso` 单一真源（META-40 收敛）。
 * 保留本符号供 region 推断（:160）与既有消费者；语义不变（已 ISO 直接用，否则查表）。
 */
export function normalizeCountryCode(raw: string | null | undefined): string | null {
  return countryToIso(raw)
}

// ── 五级推断链主入口（D-199-3）────────────────────────────────────────────────

/** 标题侧已解析 facets（调用方持有 parseTitle/buildStandardVideoTitle 产物，避免重复解析）。 */
export interface TitleLanguageFacets {
  audioLanguage: string | null
  subtitleMarker: string | null
  subtitleLanguages: ReadonlyArray<string>
}

export interface ResolveSourceLanguagesInput {
  /** 线路名（行级，步骤 0） */
  sourceName?: string | null
  /** 上游 vod_lang（vod 级，步骤 1）。回填场景不可得传 null */
  vodLang?: string | null
  /** 标题双维度 facets（vod 级，步骤 2）。无标题信号传 null */
  titleFacets?: TitleLanguageFacets | null
  /** 地区（catalog.country，步骤 3 仅 audio）。ISO code 或中文名均可 */
  country?: string | null
}

/** 推断结果（直接对应 video_sources 4 列写入值）。 */
export interface ResolvedSourceLanguages {
  audioLanguage: string | null
  audioLanguageSource: AudioLanguageSource
  /** DB 三态（D-199-1）：null=未知（含有字幕但具体未知）/ []=明确无字幕 / [...]=已知 */
  subtitleLanguages: string[] | null
  subtitleLanguageSource: SubtitleLanguageSource
}

/** 字幕 token 命中 → DB 三态值（语义见 TitleFacets.subtitleMarker 注释）。 */
function subtitleHitToDbValue(hit: SubtitleTokenHit): string[] | null {
  if (hit.marker === '无字幕') return []
  if (hit.languages.length > 0) return [...hit.languages]
  return null
}

/**
 * 五级推断链逐维度求值。两维度独立短路：audio 与 subtitle 可来自不同级
 * （provenance 双列即为此设计，评审 REVISE）。
 */
export function resolveSourceLanguages(input: ResolveSourceLanguagesInput): ResolvedSourceLanguages {
  // ── audio ──
  let audioLanguage: string | null = null
  let audioLanguageSource: AudioLanguageSource = 'unknown'

  const fromSourceName = normalizeAudioLanguage(input.sourceName)
  if (fromSourceName !== null) {
    audioLanguage = fromSourceName
    audioLanguageSource = 'source_name_token'
  } else {
    const fromVodLang = normalizeAudioLanguage(input.vodLang)
    if (fromVodLang !== null) {
      audioLanguage = fromVodLang
      audioLanguageSource = 'vod_lang'
    } else if (input.titleFacets?.audioLanguage) {
      audioLanguage = input.titleFacets.audioLanguage
      audioLanguageSource = 'title_token'
    } else {
      const region = normalizeCountryCode(input.country)
      const fromRegion = region !== null ? REGION_AUDIO_MAP[region] ?? null : null
      if (fromRegion !== null) {
        audioLanguage = fromRegion
        audioLanguageSource = 'region_inferred'
      }
    }
  }

  // ── subtitle（无地区推断）──
  let subtitleLanguages: string[] | null = null
  let subtitleLanguageSource: SubtitleLanguageSource = 'unknown'

  const subFromSourceName = matchSubtitleToken(input.sourceName)
  if (subFromSourceName !== null) {
    subtitleLanguages = subtitleHitToDbValue(subFromSourceName)
    subtitleLanguageSource = 'source_name_token'
  } else {
    const subFromVodLang = matchSubtitleToken(input.vodLang)
    if (subFromVodLang !== null) {
      subtitleLanguages = subtitleHitToDbValue(subFromVodLang)
      subtitleLanguageSource = 'vod_lang'
    } else if (input.titleFacets?.subtitleMarker) {
      subtitleLanguages = subtitleHitToDbValue({
        marker: input.titleFacets.subtitleMarker,
        languages: input.titleFacets.subtitleLanguages,
      })
      subtitleLanguageSource = 'title_token'
    }
  }

  return { audioLanguage, audioLanguageSource, subtitleLanguages, subtitleLanguageSource }
}

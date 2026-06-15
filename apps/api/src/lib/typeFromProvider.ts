/**
 * typeFromProvider.ts — provider 形式类型信号 → VideoType（ADR-203 / META-44-B）
 *
 * 纯函数，无 IO，便于单测。三个出口：
 * - tmdbTypeSignal：TMDB media_type + genre id → 高置信形式 type（D-203-1）
 * - doubanTypeSignal：豆瓣 genres 字符串 → 高置信形式 type（D-203-1）
 * - resolveTypeSignal：fill-if-default 闸门（D-203-2）——仅 current==='other' 才写候选，
 *   绝不覆盖已有具体 type；候选与现值不同但 current 非 other → 返回 conflict 供 caller 记 D-203-5 日志。
 *
 * 边界（D-203-1 红线）：仅采纳「形式判别」高置信信号；不映射 family/reality/talk/music 等低置信
 * （避免误开 variety / 误伤合家欢电影）；movie+genre16 不推 anime（剧场版口径未定 + anime 与 bangumi 门控耦合）。
 */

import type { VideoType } from '@/types'

/** 低置信默认集——仅当现 type ∈ 此集才允许 provider 写回（D-203-2 fill-if-default）。 */
const TYPE_LOW_CONFIDENCE_DEFAULTS = new Set<string>(['other'])

/** TMDB 形式 genre id（已在 mapTmdbGenres 标 null 丢弃的形式类目，复用同 id 真源，D-203-1）。 */
const TMDB_GENRE_ANIMATION = 16
const TMDB_GENRE_DOCUMENTARY = 99
const TMDB_GENRE_KIDS = 10762
const TMDB_GENRE_NEWS = 10763

/**
 * TMDB media_type + genre id → 候选 VideoType（D-203-1）。
 * 形式判别优先：documentary（任意 media_type）> tv 形式 genre（anime/kids/news）> media_type 兜底。
 * 不映射的低置信信号（family/reality/talk）静默返回 media_type 兜底或现状。
 */
export function tmdbTypeSignal(mediaType: 'movie' | 'tv', genreIds: readonly number[]): VideoType | null {
  const ids = new Set(genreIds)
  // documentary 形式判别跨 media_type 一致（纪录电影 / 纪录剧集均归 documentary）
  if (ids.has(TMDB_GENRE_DOCUMENTARY)) return 'documentary'
  if (mediaType === 'tv') {
    if (ids.has(TMDB_GENRE_ANIMATION)) return 'anime' // movie+16 不推 anime（D-203-1 注①）
    if (ids.has(TMDB_GENRE_KIDS)) return 'kids'
    if (ids.has(TMDB_GENRE_NEWS)) return 'news'
    return 'series'
  }
  return 'movie'
}

/** 豆瓣形式类别中文关键词 → 候选 VideoType（D-203-1；从 detail.genres 字符串数组提取）。 */
const DOUBAN_TYPE_KEYWORDS: ReadonlyArray<readonly [string, VideoType]> = [
  ['动画', 'anime'],
  ['纪录片', 'documentary'],
  ['短片', 'short'],
  ['儿童', 'kids'],
]

/**
 * 豆瓣 genres 字符串 → 候选 VideoType（D-203-1）。
 * 仅匹配高置信形式类别；命中多个时按 DOUBAN_TYPE_KEYWORDS 顺序取首（动画 > 纪录片 > 短片 > 儿童）。
 * 无形式类别（纯题材如剧情/喜剧）→ null（不推断 type）。
 */
export function doubanTypeSignal(genres: readonly string[]): VideoType | null {
  if (genres.length === 0) return null
  const set = new Set(genres.map((g) => g.trim()))
  for (const [keyword, type] of DOUBAN_TYPE_KEYWORDS) {
    if (set.has(keyword)) return type
  }
  return null
}

/** type 信号裁定结果（D-203-2/5）。 */
export interface TypeSignalOutcome {
  /** 非 null → caller 应把 type 并入 updateFields（同 safeUpdate 单事务，红线①）。 */
  typeToWrite: VideoType | null
  /** 非 null → 信号与现具体值冲突未改，caller 应记 D-203-5 观测日志（不写库）。 */
  conflict: { current: string; candidate: VideoType } | null
}

/**
 * fill-if-default 闸门（D-203-2 + D-203-5）。
 * - 候选 null / 候选 === 现值（幂等）→ 无操作。
 * - 现 type ∈ 低置信默认集（'other'）→ 写候选。
 * - 现 type 为具体值 ≠ 候选 → 不写（绝不覆盖具体 type），返回 conflict 供观测。
 */
export function resolveTypeSignal(currentType: string, candidate: VideoType | null): TypeSignalOutcome {
  if (!candidate || candidate === currentType) return { typeToWrite: null, conflict: null }
  if (TYPE_LOW_CONFIDENCE_DEFAULTS.has(currentType)) return { typeToWrite: candidate, conflict: null }
  return { typeToWrite: null, conflict: { current: currentType, candidate } }
}

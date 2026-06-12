/**
 * sources.types.ts — video_sources 共享类型
 * 从 sources.ts 拆出（CHG-SN-7-MISC-API-QUERIES-SIZE）
 */

import type { SourceType, AudioLanguageSource, SubtitleLanguageSource } from '@/types'

export interface UpsertSourceInput {
  videoId: string
  episodeNumber: number  // ADR-016: 统一坐标系，单集/电影为 1
  seasonNumber?: number  // 默认 1
  sourceUrl: string      // ADR-001: 第三方直链，不做代理
  sourceName: string
  type: SourceType
  sourceSiteKey?: string | null  // CHG-414: 行级源站 key，优先于 videos.site_key
  /** ADR-199 D-199-1：语音规范词。缺省 null（写库 NULL + source 'unknown'） */
  audioLanguage?: string | null
  audioLanguageSource?: AudioLanguageSource
  /** ADR-199 D-199-1 三态：null=未知 / []=明确无字幕 / [...]=已知具体语言 */
  subtitleLanguages?: string[] | null
  subtitleLanguageSource?: SubtitleLanguageSource
}

/**
 * provenance 等级 SQL 片段（ADR-199 D-199-1 升级规则的机器可执行表达）：
 * source_name_token(4) > vod_lang(3) > title_token(2) > region_inferred(1) > unknown(0)。
 * `expr` 为列名 / EXCLUDED.列名 / 带显式 cast 的参数（裸参数须 `$N::text`，
 * 防 PG「could not determine data type」——BUGFIX-RENDERCHECK-PLAYBACK-SQL-CAST 教训）。
 */
export function languageSourceRankSql(expr: string): string {
  return `CASE ${expr} WHEN 'source_name_token' THEN 4 WHEN 'vod_lang' THEN 3 WHEN 'title_token' THEN 2 WHEN 'region_inferred' THEN 1 ELSE 0 END`
}

/**
 * ON CONFLICT DO UPDATE 用语言四列守卫式 SET 片段（upsertSource / replaceSourcesForSite 共用）：
 * 新 provenance 等级 ≥ 旧等级才覆盖（同级重爬最新观测胜），反向保持旧值。
 */
export function languageUpgradeSetSql(): string {
  const newAudioRank = languageSourceRankSql('EXCLUDED.audio_language_source')
  const oldAudioRank = languageSourceRankSql('video_sources.audio_language_source')
  const newSubRank = languageSourceRankSql('EXCLUDED.subtitle_language_source')
  const oldSubRank = languageSourceRankSql('video_sources.subtitle_language_source')
  return `
    audio_language = CASE WHEN ${newAudioRank} >= ${oldAudioRank} THEN EXCLUDED.audio_language ELSE video_sources.audio_language END,
    audio_language_source = CASE WHEN ${newAudioRank} >= ${oldAudioRank} THEN EXCLUDED.audio_language_source ELSE video_sources.audio_language_source END,
    subtitle_languages = CASE WHEN ${newSubRank} >= ${oldSubRank} THEN EXCLUDED.subtitle_languages ELSE video_sources.subtitle_languages END,
    subtitle_language_source = CASE WHEN ${newSubRank} >= ${oldSubRank} THEN EXCLUDED.subtitle_language_source ELSE video_sources.subtitle_language_source END`
}

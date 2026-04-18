/**
 * externalCandidateMappers.ts — 外部元数据到统一候选模型的映射函数
 * META-04
 *
 * 提供两个 mapper：
 * - mapDoubanDumpEntryToCandidate: 本地 dump 行 → ExternalSubjectCandidate
 * - mapDoubanAdapterDetailsToCandidate: adapter 在线详情 → ExternalSubjectCandidate
 *
 * confidence / confidenceBreakdown 由调用方（MetadataEnrichService）传入，
 * mapper 本身不做匹配判断。
 */

import type { DoubanEntryMatch } from '@/api/db/queries/externalData'
import type { DoubanSubjectDetails } from '@/api/lib/doubanAdapter'
import type { ExternalSubjectCandidate, ExternalPerson, ExternalRecommendation } from '@/types'

// ── mapper 1: 本地 dump ───────────────────────────────────────────

/**
 * 将 external_data.douban_entries 的一行映射为统一候选模型。
 * sourceFreshness = 'offline'（来自本地 CSV 导入，非实时）
 */
export function mapDoubanDumpEntryToCandidate(
  entry: DoubanEntryMatch,
  opts: { confidence?: number; confidenceBreakdown?: Record<string, number> } = {},
): ExternalSubjectCandidate {
  const directors: ExternalPerson[] = entry.directors.map((name, i) => ({
    id: entry.directorIds[i] ?? undefined,
    name,
    role: '导演',
  }))

  const writers: ExternalPerson[] = entry.writers.map((name) => ({
    name,
    role: '编剧',
  }))

  const cast: ExternalPerson[] = entry.cast.map((name, i) => ({
    id: entry.actorIds[i] ?? undefined,
    name,
    role: '演员',
  }))

  return {
    provider: 'douban',
    externalId: entry.doubanId,
    title: entry.title,
    aliases: entry.aliases.length > 0 ? entry.aliases : undefined,
    year: entry.year ?? undefined,
    releaseDate: entry.releaseDate ?? undefined,
    coverUrl: entry.coverUrl ?? undefined,
    rating: entry.rating ?? undefined,
    ratingVotes: entry.doubanVotes ?? undefined,
    genres: entry.genres.length > 0 ? entry.genres : undefined,
    countries: entry.regions.length > 0 ? entry.regions : undefined,
    languages: entry.languages.length > 0 ? entry.languages : undefined,
    durationMinutes: entry.durationMinutes ?? undefined,
    directors: directors.length > 0 ? directors : undefined,
    writers: writers.length > 0 ? writers : undefined,
    cast: cast.length > 0 ? cast : undefined,
    tags: entry.tags.length > 0 ? entry.tags : undefined,
    imdbId: entry.imdbId ?? undefined,
    summary: entry.description ?? undefined,
    confidence: opts.confidence ?? 0,
    confidenceBreakdown: opts.confidenceBreakdown ?? {},
    sourceFreshness: 'offline',
  }
}

// ── mapper 2: adapter 在线详情 ────────────────────────────────────

/**
 * 将 douban-adapter 的 DoubanSubjectDetails 映射为统一候选模型。
 * sourceFreshness = 'online'（实时抓取，字段更完整但速度慢）
 */
export function mapDoubanAdapterDetailsToCandidate(
  details: DoubanSubjectDetails,
  opts: { confidence?: number; confidenceBreakdown?: Record<string, number> } = {},
): ExternalSubjectCandidate {
  const rateNum = details.rate ? Number(details.rate) : undefined
  const yearNum = details.year ? Number(details.year) : undefined

  const directors: ExternalPerson[] = details.directors.map((name) => ({
    name,
    role: '导演',
  }))

  const writers: ExternalPerson[] = details.screenwriters.map((name) => ({
    name,
    role: '编剧',
  }))

  // actors 是含头像信息的详细对象；cast 是名字数组。优先用 actors（有 id）
  const cast: ExternalPerson[] = details.actors.length > 0
    ? details.actors.map((a) => ({ id: a.id, name: a.name, role: a.role || '演员' }))
    : details.cast.map((name) => ({ name, role: '演员' }))

  const recommendations: ExternalRecommendation[] = details.recommendations.map((r) => ({
    externalId: r.id,
    title: r.title,
    coverUrl: r.poster || undefined,
    rating: r.rate ? Number(r.rate) : undefined,
  }))

  return {
    provider: 'douban',
    externalId: details.id,
    title: details.title,
    year: Number.isFinite(yearNum) ? yearNum : undefined,
    coverUrl: details.poster || undefined,
    backdropUrl: details.backdrop || undefined,
    rating: Number.isFinite(rateNum) ? rateNum : undefined,
    genres: details.genres.length > 0 ? details.genres : undefined,
    countries: details.countries.length > 0 ? details.countries : undefined,
    languages: details.languages.length > 0 ? details.languages : undefined,
    durationMinutes: details.movieDuration ?? undefined,
    episodeCount: details.episodes ?? undefined,
    episodeLength: details.episodeLength ?? undefined,
    releaseDate: details.firstAired ?? undefined,
    directors: directors.length > 0 ? directors : undefined,
    writers: writers.length > 0 ? writers : undefined,
    cast: cast.length > 0 ? cast : undefined,
    summary: details.plotSummary || undefined,
    trailerUrl: details.trailerUrl || undefined,
    recommendations: recommendations.length > 0 ? recommendations : undefined,
    confidence: opts.confidence ?? 0,
    confidenceBreakdown: opts.confidenceBreakdown ?? {},
    sourceFreshness: 'online',
  }
}

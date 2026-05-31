/**
 * BangumiService.utils.ts — Bangumi 纯函数工具（ADR-161）
 * 对标 DoubanService.utils.ts：置信度评分 / infobox 解析 / 字段映射
 */

import type { CatalogUpdateData } from '@/api/db/queries/mediaCatalog'
import type { BangumiEntryMatch } from '@/api/db/queries/externalData'
import type { BangumiSubject, BangumiEpisode, BangumiInfoboxItem, BangumiSearchItem } from '@/api/lib/bangumi'
import type { CatalogEpisodeInput } from '@/api/db/queries/catalogEpisodes'
import { normalizeTitle } from './TitleNormalizer'

// ── 置信度（复用豆瓣 dump 阈值范式，本地匹配仅 title_norm，base 0.70）────

/**
 * 本地 dump 条目置信度：base 0.70（title_norm 精确）+ 年份加分。
 * 与 MetadataEnrichService.computeLocalDoubanConfidence 同款阈值语义
 * （≥0.85 auto / [0.60,0.85) candidate / <0.60 丢弃）。
 */
export function computeLocalBangumiConfidence(
  entry: BangumiEntryMatch,
  year: number | null,
): { confidence: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = { title: 0.7 }
  let confidence = 0.7
  if (year !== null && entry.year !== null) {
    const diff = Math.abs(entry.year - year)
    if (diff === 0) {
      breakdown.year_exact = 0.22
      confidence += 0.22
    } else if (diff === 1) {
      breakdown.year_close = 0.17
      confidence += 0.17
    }
  }
  return { confidence: Math.min(1, confidence), breakdown }
}

/**
 * REST 搜索候选置信度（ADR-161 / META-17 方案 A：精确兜底，安全零误配）。
 *
 * REST `searchSubjects` 是模糊搜索（「海贼王」会返回「海贼王子」等子串命中），故**仅当候选
 * `name_cn` 或 `name` 规范化后精确等于 titleNorm** 才给分（base 0.70，与本地 dump 精确同档）+ 年份加分；
 * 非精确返回 0（< CANDIDATE 阈值 → 拒绝），避免假阳性。别名差异（海贼王↔航海王）会安全漏配，留人工确认。
 */
export function computeRestBangumiConfidence(
  item: BangumiSearchItem,
  titleNorm: string,
  year: number | null,
): { confidence: number; breakdown: Record<string, number> } {
  const nameCnNorm = item.name_cn ? normalizeTitle(item.name_cn) : ''
  const nameJpNorm = item.name ? normalizeTitle(item.name) : ''
  const exact = (nameCnNorm !== '' && nameCnNorm === titleNorm) || (nameJpNorm !== '' && nameJpNorm === titleNorm)
  if (!exact) return { confidence: 0, breakdown: { rest_no_exact: 0 } }

  const breakdown: Record<string, number> = { rest_title_exact: 0.7 }
  let confidence = 0.7
  const itemYear = extractYear(item.date)
  if (year !== null && itemYear !== null) {
    const diff = Math.abs(itemYear - year)
    if (diff === 0) {
      breakdown.year_exact = 0.22
      confidence += 0.22
    } else if (diff === 1) {
      breakdown.year_close = 0.17
      confidence += 0.17
    }
  }
  return { confidence: Math.min(1, confidence), breakdown }
}

// ── infobox 解析 ───────────────────────────────────────────────────

/** 把 infobox value（string | {k?,v}[]）摊平为字符串数组 */
function infoboxValues(value: BangumiInfoboxItem['value']): string[] {
  if (typeof value === 'string') return value.trim() ? [value.trim()] : []
  if (Array.isArray(value)) {
    return value.map((x) => x?.v).filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
  }
  return []
}

export interface ParsedInfobox {
  directors: string[]
  writers: string[]
  studios: string[]
}

/**
 * 解析 anime infobox 的制作信息。
 * 仅取可靠存在的键：导演 / 脚本·系列构成 / 动画制作。
 * 声优（CV）不在 infobox 中（属 /characters），故不解析 cast，避免写错。
 * 解析失败的键降级为空（不抛、不写空串，ADR-161 A2）。
 */
export function parseInfobox(infobox: BangumiInfoboxItem[] | undefined | null): ParsedInfobox {
  const result: ParsedInfobox = { directors: [], writers: [], studios: [] }
  if (!Array.isArray(infobox)) return result
  for (const item of infobox) {
    if (!item || typeof item.key !== 'string') continue
    const key = item.key.trim()
    const values = infoboxValues(item.value)
    if (key === '导演' || key === '監督') result.directors.push(...values)
    else if (key === '脚本' || key === '系列构成' || key === '剧本') result.writers.push(...values)
    else if (key === '动画制作' || key === '動畫製作' || key === '动画制作公司') result.studios.push(...values)
  }
  return result
}

// ── 字段映射 ───────────────────────────────────────────────────────

function extractYear(date: string | null | undefined): number | null {
  if (!date) return null
  const m = date.match(/^(\d{4})/)
  if (!m) return null
  const y = Number.parseInt(m[1], 10)
  return Number.isFinite(y) ? y : null
}

const MAX_TAGS = 15

/**
 * BangumiSubject → CatalogUpdateData（仅含 Bangumi 可靠提供的字段；
 * 缺省字段不写，交由 safeUpdate 保留既有值）。
 */
export function mapSubjectToCatalogFields(subject: BangumiSubject): CatalogUpdateData {
  const fields: CatalogUpdateData = {
    bangumiSubjectId: subject.id,
  }

  const titleCn = subject.name_cn?.trim() || null
  const titleJp = subject.name?.trim() || null
  if (titleCn) fields.title = titleCn
  if (titleJp) fields.titleOriginal = titleJp

  if (subject.summary?.trim()) fields.description = subject.summary.trim()

  const cover = subject.images?.large || subject.images?.common || subject.images?.medium
  if (cover) fields.coverUrl = cover

  if (subject.rating && subject.rating.score > 0) {
    fields.rating = subject.rating.score
    if (subject.rating.total > 0) fields.ratingVotes = subject.rating.total
  }

  if (subject.date) {
    fields.releaseDate = subject.date
    const y = extractYear(subject.date)
    if (y !== null) fields.year = y
  }

  const info = parseInfobox(subject.infobox)
  if (info.directors.length > 0) fields.director = info.directors
  if (info.writers.length > 0) fields.writers = info.writers

  // tags：作品标签 top N + 动画制作公司（前缀 制作:，ADR-161 A1，不入 aliases）
  const tagNames = Array.isArray(subject.tags)
    ? subject.tags.filter((t) => t?.name).slice(0, MAX_TAGS).map((t) => t.name)
    : []
  const studioTags = info.studios.map((s) => `制作:${s}`)
  const tags = [...tagNames, ...studioTags]
  if (tags.length > 0) fields.tags = tags

  return fields
}

/** 解析 'HH:MM:SS' / 'MM:SS' / ISO8601 PT..M.. 时长为秒；失败返回 null */
function parseDurationSeconds(raw: string | null | undefined): number | null {
  if (!raw) return null
  const clock = raw.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/)
  if (clock) {
    const h = clock[1] ? Number(clock[1]) : 0
    return h * 3600 + Number(clock[2]) * 60 + Number(clock[3])
  }
  return null
}

/** BangumiEpisode[] → CatalogEpisodeInput[]（source='bangumi'） */
export function mapEpisodes(episodes: BangumiEpisode[]): CatalogEpisodeInput[] {
  return episodes.map((e) => ({
    source: 'bangumi',
    externalEpisodeId: String(e.id),
    epType: typeof e.type === 'number' ? e.type : 0,
    sort: typeof e.sort === 'number' ? e.sort : null,
    ep: typeof e.ep === 'number' ? e.ep : null,
    name: e.name?.trim() || null,
    nameCn: e.name_cn?.trim() || null,
    airdate: e.airdate?.trim() || null,
    durationSeconds: e.duration_seconds ?? parseDurationSeconds(e.duration),
    description: e.desc?.trim() || null,
  }))
}

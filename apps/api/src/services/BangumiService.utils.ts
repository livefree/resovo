/**
 * BangumiService.utils.ts — Bangumi 纯函数工具（ADR-161）
 * 对标 DoubanService.utils.ts：置信度评分 / infobox 解析 / 字段映射
 */

import type { CatalogUpdateData } from '@/api/db/queries/mediaCatalog'
import type { BangumiEntryMatch } from '@/api/db/queries/externalData'
import type { BangumiSubject, BangumiEpisode, BangumiInfoboxItem, BangumiSearchItem, BangumiCharacter, BangumiImages } from '@/api/lib/bangumi'
import type { CatalogEpisodeInput } from '@/api/db/queries/catalogEpisodes'
import type { CatalogCharacterInput } from '@/api/db/queries/catalogCharacters'
import { normalizeForExternalMatch } from './TitleNormalizer'
import { mapBangumiTags } from '@/api/lib/genreMapper'

// ── 有损键歧义守卫（META-22 三次修订 / Codex stop-time review）──────────

/**
 * 判定本地 dump 标题命中是否「歧义」——外部源 `title_normalized` 经 `[^\p{L}\p{N}]`
 * 有损存储，标点不敏感匹配可能命中**多条不同记录**；若 top-2 的年份判别档相同
 *（或视频无年份可判别），则标题键不足以唯一定位 → 禁止 auto 绑定，降级 candidate 人工确认。
 *
 * 年份档与 `findDoubanByTitleNorm`/`findBangumiByTitleNorm` 的 SQL ORDER BY 一致：
 * 视频无年份→全 0；exact→0；±1→1；其余（含条目无年份）→2。
 */
export function isAmbiguousLocalMatch(
  matches: ReadonlyArray<{ year: number | null }>,
  videoYear: number | null,
): boolean {
  if (matches.length < 2) return false
  const tier = (entryYear: number | null): number => {
    if (videoYear === null) return 0
    if (entryYear === null) return 2
    const diff = Math.abs(entryYear - videoYear)
    return diff === 0 ? 0 : diff === 1 ? 1 : 2
  }
  return tier(matches[0].year) === tier(matches[1].year)
}

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
  const nameCnNorm = item.name_cn ? normalizeForExternalMatch(item.name_cn) : ''
  const nameJpNorm = item.name ? normalizeForExternalMatch(item.name) : ''
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

/**
 * REST 别名感知置信度（META-20 别名感知 B）：name 未精确命中时查 subject infobox 别名。
 *
 * 仅当 titleNorm 规范化后**精确**等于某别名（或 name_cn/name 兜底）才给分（base 0.70 + 年份加分，
 * 同 REST exact 档）。保守：仅精确别名匹配（curated infobox 「别名」键），避免假阳性；
 * 别名无年份 → 0.70 候选（人工确认），别名 + 年份 → ≥0.85 自动（召回海贼王↔航海王）。
 */
export function computeAliasBangumiConfidence(
  subject: BangumiSubject,
  titleNorm: string,
  year: number | null,
): { confidence: number; breakdown: Record<string, number> } {
  const candidates = [
    subject.name_cn,
    subject.name,
    ...parseInfoboxAliases(subject.infobox),
  ]
  const exact = candidates.some((c) => {
    const n = c ? normalizeForExternalMatch(c) : ''
    return n !== '' && n === titleNorm
  })
  if (!exact) return { confidence: 0, breakdown: { rest_alias_no_exact: 0 } }

  const breakdown: Record<string, number> = { rest_alias_exact: 0.7 }
  let confidence = 0.7
  const itemYear = extractYear(subject.date)
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

/** 从 infobox 提取别名（键「别名」；中文名/英文名通常已在 name_cn/name，不重复取）。 */
export function parseInfoboxAliases(infobox: BangumiInfoboxItem[] | undefined | null): string[] {
  if (!Array.isArray(infobox)) return []
  const out: string[] = []
  for (const item of infobox) {
    if (!item || typeof item.key !== 'string') continue
    if (item.key.trim() === '别名' || item.key.trim() === '別名') out.push(...infoboxValues(item.value))
  }
  return out
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
  const allTags = Array.isArray(subject.tags) ? subject.tags : []
  const tagNames = allTags.filter((t) => t?.name).slice(0, MAX_TAGS).map((t) => t.name)
  const studioTags = info.studios.map((s) => `制作:${s}`)
  const tags = [...tagNames, ...studioTags]
  if (tags.length > 0) fields.tags = tags

  // genres（META-41-A）：开放词表标签经白名单 + 计数下限保守归一；命中的原始标签喂 genres_raw 供审核溯源。
  // 用全量 allTags（非 top-N slice）—— mapBangumiTags 内含 count 下限 + 白名单双重去噪，覆盖更全。
  const { genres, raw: genresRaw } = mapBangumiTags(allTags)
  if (genres.length > 0) {
    fields.genres = genres
    fields.genresRaw = genresRaw
  }

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

/**
 * 清洗 Bangumi airdate → 仅接受完整合法 `YYYY-MM-DD`，否则 null（META-15-C backfill 暴露）。
 * Bangumi 部分剧集 airdate 为「仅年份(2099) / 残缺(2024-00-00) / 空」→ 直插 DATE 列会
 * `invalid input syntax for type date` 失败并回滚整个 enrich 事务（catalog+角色+ref 全丢）。
 */
function sanitizeAirdate(raw: string | null | undefined): string | null {
  if (!raw) return null
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return `${m[1]}-${m[2]}-${m[3]}`
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
    airdate: sanitizeAirdate(e.airdate),
    durationSeconds: e.duration_seconds ?? parseDurationSeconds(e.duration),
    description: e.desc?.trim() || null,
  }))
}

// ── 角色 + CV 映射（ADR-161 AMENDMENT / META-19）──────────────────────

/** relation 展示排序权重（越小越靠前）；未知 relation 排末（9）。 */
const RELATION_SORT_WEIGHT: Record<string, number> = {
  主角: 0, 配角: 1, 客串: 2, 闲角: 3,
}

/** 取最佳可用图（large→medium→common→grid→small），无则 null。 */
function pickImage(images: BangumiImages | null): string | null {
  return images?.large || images?.medium || images?.common || images?.grid || images?.small || null
}

/**
 * BangumiCharacter[] → CatalogCharacterInput[]（source='bangumi'）。
 * sort = relation 权重 × 1000 + 原序（relation 分组内保留源序）；actor 按源数组序。
 */
export function mapCharacters(characters: BangumiCharacter[]): CatalogCharacterInput[] {
  return characters.map((c, i) => {
    const weight = RELATION_SORT_WEIGHT[c.relation?.trim() ?? ''] ?? 9
    return {
      source: 'bangumi',
      externalCharacterId: String(c.id),
      name: c.name?.trim() || String(c.id),
      relation: c.relation?.trim() || null,
      charType: typeof c.type === 'number' ? c.type : null,
      sort: weight * 1000 + i,
      imageUrl: pickImage(c.images),
      summary: c.summary?.trim() || null,
      actors: (c.actors ?? []).map((a, j) => ({
        externalActorId: String(a.id),
        name: a.name?.trim() || String(a.id),
        imageUrl: pickImage(a.images),
        sort: j,
      })),
    }
  })
}

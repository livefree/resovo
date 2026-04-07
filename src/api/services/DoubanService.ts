/**
 * DoubanService.ts — 豆瓣元数据同步业务逻辑
 * CHG-23: 管理员手动触发，每次只处理单个视频
 *
 * 流程：
 * 1. 从 DB 获取视频（title + year）
 * 2. 跳过已有 douban_id 的视频（不覆盖）
 * 3. 搜索豆瓣，选取标题相似度 >80% 的第一个结果
 * 4. 抓取详情，更新 DB
 */

import type { Pool } from 'pg'
import { searchDouban } from '@/api/lib/douban'
import { getDoubanDetailRich } from '@/api/lib/doubanAdapter'
import { mapDoubanGenres } from '@/api/lib/genreMapper'
import * as videoQueries from '@/api/db/queries/videos'
import * as catalogQueries from '@/api/db/queries/mediaCatalog'
import { MediaCatalogService } from './MediaCatalogService'
import type { DoubanPreviewFound, DoubanPreviewMiss, DoubanPreview } from '@/types/contracts/v1/admin'

// ── 类型 ──────────────────────────────────────────────────────────

export type SyncReason = 'already_synced' | 'no_match' | 'fetch_failed'

export interface SyncResult {
  updated: true
  fields: string[]
  doubanId: string
}

export interface SyncSkipped {
  updated: false
  reason: SyncReason
}

export type { DoubanPreviewFound, DoubanPreviewMiss, DoubanPreview }

// ── 字符串相似度（简易 Jaccard 字符二元组） ──────────────────────

function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '')
  const na = normalize(a)
  const nb = normalize(b)
  if (na === nb) return 1

  const bigrams = (s: string) => {
    const set = new Set<string>()
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2))
    return set
  }
  const sa = bigrams(na)
  const sb = bigrams(nb)
  let intersection = 0
  for (const g of sa) if (sb.has(g)) intersection++
  return (2 * intersection) / (sa.size + sb.size)
}

function normalizeForMatch(input: string): string {
  return input
    .toLowerCase()
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
}

function parseYear(value: string | number | null | undefined): number | null {
  if (value == null) return null
  const match = String(value).match(/\d{4}/)
  if (!match) return null
  const year = Number.parseInt(match[0], 10)
  return Number.isFinite(year) ? year : null
}

type Candidate = Awaited<ReturnType<typeof searchDouban>>[number]

function candidateScore(videoTitle: string, videoYear: number | null | undefined, item: Candidate): number {
  const titleScore = similarity(normalizeForMatch(videoTitle), normalizeForMatch(item.title))
  const subtitleScore = similarity(normalizeForMatch(videoTitle), normalizeForMatch(item.sub_title ?? ''))
  const baseScore = Math.max(titleScore, subtitleScore)

  const targetYear = videoYear ?? null
  const candidateYear = parseYear(item.year)
  if (targetYear == null || candidateYear == null) return baseScore
  if (targetYear === candidateYear) return Math.min(1, baseScore + 0.2)
  if (Math.abs(targetYear - candidateYear) === 1) return Math.min(1, baseScore + 0.1)
  return baseScore
}

function pickBestCandidate(videoTitle: string, videoYear: number | null | undefined, candidates: Candidate[]): Candidate | null {
  let best: Candidate | null = null
  let bestScore = 0
  for (const item of candidates) {
    const score = candidateScore(videoTitle, videoYear, item)
    if (score > bestScore) {
      bestScore = score
      best = item
    }
  }
  // 旧阈值 0.8 过严，实际会漏掉大量有效候选；放宽到 0.45 由详情抓取再次兜底
  return best && bestScore >= 0.45 ? best : null
}

// ── Service ──────────────────────────────────────────────────────

export class DoubanService {
  constructor(private db: Pool) {}

  async syncVideo(videoId: string): Promise<SyncResult | SyncSkipped> {
    // 1. 获取视频基本信息（含 catalog JOIN 字段）
    const video = await videoQueries.findAdminVideoById(this.db, videoId)
    if (!video) return { updated: false, reason: 'no_match' }

    // 2. 获取关联的 catalog 条目
    const catalog = await catalogQueries.findCatalogById(this.db, video.catalog_id)
    if (!catalog) return { updated: false, reason: 'no_match' }

    // 2b. 已有 douban_id（在 catalog 层），跳过
    if (catalog.doubanId) return { updated: false, reason: 'already_synced' }

    // 3. 搜索豆瓣（使用 catalog 标题和年份）
    let candidates: Awaited<ReturnType<typeof searchDouban>>
    try {
      candidates = await searchDouban(catalog.title, catalog.year ?? undefined)
    } catch {
      return { updated: false, reason: 'fetch_failed' }
    }

    if (candidates.length === 0) return { updated: false, reason: 'no_match' }

    // 4. 选取最优候选
    const best = pickBestCandidate(catalog.title, catalog.year ?? null, candidates)
    if (!best) return { updated: false, reason: 'no_match' }

    // 5. 获取详情（使用 douban-adapter，支持 23+ 字段）
    const detail = await getDoubanDetailRich(best.id)
    if (!detail) return { updated: false, reason: 'fetch_failed' }

    // 6. 通过 MediaCatalogService.safeUpdate 写入 catalog（source='douban', priority=3）
    const catalogService = new MediaCatalogService(this.db)
    const ratingNum = detail.rate ? parseFloat(detail.rate) : NaN
    const updateFields: import('@/api/db/queries/mediaCatalog').CatalogUpdateData = {
      doubanId: detail.id,
    }
    if (!isNaN(ratingNum)) updateFields.rating = ratingNum
    if (detail.plotSummary) updateFields.description = detail.plotSummary
    if (detail.poster) updateFields.coverUrl = detail.poster
    if (detail.directors.length > 0) updateFields.director = detail.directors
    if (detail.cast.length > 0) updateFields.cast = detail.cast
    if (detail.screenwriters.length > 0) updateFields.writers = detail.screenwriters
    if (detail.genres.length > 0) {
      updateFields.genresRaw = detail.genres
      const mapped = mapDoubanGenres(detail.genres)
      if (mapped.length > 0) updateFields.genres = mapped
    }
    if (detail.countries.length > 0) updateFields.country = detail.countries[0]

    const updated = await catalogService.safeUpdate(catalog.id, updateFields, 'douban')
    if (!updated) return { updated: false, reason: 'fetch_failed' }

    const fields: string[] = ['doubanId']
    if (!isNaN(ratingNum)) fields.push('rating')
    if (detail.plotSummary) fields.push('description')
    if (detail.poster) fields.push('coverUrl')
    if (detail.directors.length > 0) fields.push('director')
    if (detail.cast.length > 0) fields.push('cast')
    if (detail.screenwriters.length > 0) fields.push('writers')
    if (detail.genres.length > 0) {
      fields.push('genresRaw')
      if (mapDoubanGenres(detail.genres).length > 0) fields.push('genres')
    }

    return { updated: true, fields, doubanId: detail.id }
  }

  async previewVideo(videoId: string): Promise<DoubanPreviewFound | DoubanPreviewMiss> {
    const video = await videoQueries.findAdminVideoById(this.db, videoId)
    if (!video) return { found: false, reason: 'no_match' }

    let candidates: Awaited<ReturnType<typeof searchDouban>>
    try {
      candidates = await searchDouban(video.title, video.year ?? undefined)
    } catch {
      return { found: false, reason: 'fetch_failed' }
    }
    if (candidates.length === 0) return { found: false, reason: 'no_match' }

    const best = pickBestCandidate(video.title, video.year ?? null, candidates)
    if (!best) return { found: false, reason: 'no_match' }

    const detail = await getDoubanDetailRich(best.id)
    if (!detail) {
      return {
        found: true,
        partial: true,
        doubanId: best.id,
        title: best.title,
        year: parseYear(best.year),
        rating: null,
        description: null,
        coverUrl: null,
        directors: [],
        casts: [],
      }
    }

    const ratingNum = detail.rate ? parseFloat(detail.rate) : NaN
    return {
      found: true,
      doubanId: detail.id,
      title: detail.title,
      year: parseYear(detail.year),
      rating: !isNaN(ratingNum) ? ratingNum : null,
      description: detail.plotSummary ?? null,
      coverUrl: detail.poster,
      directors: detail.directors,
      casts: detail.cast,
      screenwriters: detail.screenwriters,
      genres: detail.genres,
      countries: detail.countries,
      languages: detail.languages,
    }
  }
}

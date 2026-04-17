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
import * as externalDataQueries from '@/api/db/queries/externalData'
import { MediaCatalogService } from './MediaCatalogService'
import { enrichmentQueue } from '@/api/lib/queue'
import type { DoubanPreviewFound, DoubanPreviewMiss, DoubanPreview } from '@/types/contracts/v1/admin'
import type { EnrichJobData } from './MetadataEnrichService'

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

// META-07: 候选字段对比数据（内部使用，不导出）
interface CandidateProposed {
  title: string | null
  year: number | null
  rating: number | null
  description: string | null
  coverUrl: string | null
  directors: string[]
  cast: string[]
  genres: string[]
  country: string | null
}

export interface FieldDiff {
  field: string
  label: string
  current: string | null
  proposed: string | null
  changed: boolean
}

export interface DoubanCandidateComparison {
  externalRefId: string
  externalId: string
  confidence: number | null
  matchMethod: string | null
  breakdown: Record<string, number> | null
  diffs: FieldDiff[]
}

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

    const updated = await catalogService.safeUpdate(catalog.id, updateFields, 'douban', { sourceRef: detail.id })
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

  // ── CHG-386：暂存队列豆瓣操作 ─────────────────────────────────────

  /** 批量为指定视频入队元数据丰富 Job（jobId 去重，delay=0 立即执行） */
  async batchEnqueueEnrich(videoIds: string[]): Promise<{ queued: number; skipped: number }> {
    let queued = 0
    let skipped = 0
    for (const videoId of videoIds) {
      const video = await videoQueries.findAdminVideoById(this.db, videoId)
      if (!video) { skipped++; continue }
      const jobData: EnrichJobData = {
        videoId,
        catalogId: video.catalog_id,
        title: video.title,
        year: video.year ?? null,
        type: video.type,
      }
      await enrichmentQueue.add(jobData, {
        delay: 0,
        jobId: `enrich-${videoId}`,
      })
      queued++
    }
    return { queued, skipped }
  }

  /** 关键词搜索豆瓣，返回候选列表（不写 DB） */
  async searchByKeyword(keyword: string): Promise<Awaited<ReturnType<typeof searchDouban>>> {
    return searchDouban(keyword)
  }

  /** 确认应用指定豆瓣条目，写入 catalog + 更新 videos.douban_status + 标记 manual_confirmed */
  async confirmSubject(videoId: string, subjectId: string): Promise<{ updated: boolean; reason?: string }> {
    const video = await videoQueries.findAdminVideoById(this.db, videoId)
    if (!video) return { updated: false, reason: 'video_not_found' }

    const detail = await getDoubanDetailRich(subjectId)
    if (!detail) return { updated: false, reason: 'fetch_failed' }

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

    const updated = await catalogService.safeUpdate(video.catalog_id, updateFields, 'douban', { sourceRef: subjectId })
    if (!updated) return { updated: false, reason: 'catalog_update_rejected' }

    // 标记 video_external_refs 为 manual_confirmed
    await externalDataQueries.upsertVideoExternalRef(this.db, {
      videoId,
      provider: 'douban',
      externalId: subjectId,
      matchStatus: 'manual_confirmed',
      matchMethod: 'manual',
      isPrimary: true,
      linkedBy: 'moderator',
    })

    // 读取最新 catalog 计算 meta_score
    const catalog = await catalogQueries.findCatalogById(this.db, video.catalog_id)
    const metaScore = calcMetaScore(catalog)

    await videoQueries.updateVideoEnrichStatus(this.db, videoId, { doubanStatus: 'matched', metaScore })
    return { updated: true }
  }

  /**
   * META-07: 获取候选对比数据（当前 catalog 字段 vs 候选条目字段）
   * 返回 null 表示无候选条目或视频不存在
   */
  async getCandidateData(videoId: string): Promise<DoubanCandidateComparison | null> {
    const video = await videoQueries.findAdminVideoById(this.db, videoId)
    if (!video) return null

    const refs = await externalDataQueries.listVideoExternalRefs(this.db, videoId, 'douban')
    const candidateRef = refs.find((r) => r.matchStatus === 'candidate')
    if (!candidateRef) return null

    // 先查本地 dump，再网络 fallback
    let proposed: CandidateProposed | null = null
    const localEntry = await externalDataQueries.findDoubanEntryById(this.db, candidateRef.externalId)
    if (localEntry) {
      proposed = {
        title: localEntry.title,
        year: localEntry.year,
        rating: localEntry.rating,
        description: localEntry.description,
        coverUrl: localEntry.coverUrl,
        directors: localEntry.directors,
        cast: localEntry.cast,
        genres: localEntry.genres,
        country: localEntry.country,
      }
    } else {
      // 网络 fallback
      const detail = await getDoubanDetailRich(candidateRef.externalId)
      if (detail) {
        const ratingNum = detail.rate ? parseFloat(detail.rate) : NaN
        proposed = {
          title: detail.title,
          year: parseYear(detail.year),
          rating: isNaN(ratingNum) ? null : ratingNum,
          description: detail.plotSummary ?? null,
          coverUrl: detail.poster ?? null,
          directors: detail.directors,
          cast: detail.cast,
          genres: detail.genres,
          country: detail.countries[0] ?? null,
        }
      }
    }
    if (!proposed) return null

    const catalog = await catalogQueries.findCatalogById(this.db, video.catalog_id)
    const current: CandidateProposed = {
      title: catalog?.title ?? null,
      year: catalog?.year ?? null,
      rating: catalog?.rating ?? null,
      description: catalog?.description ?? null,
      coverUrl: catalog?.coverUrl ?? null,
      directors: catalog?.director ?? [],
      cast: catalog?.cast ?? [],
      genres: catalog?.genresRaw ?? [],
      country: catalog?.country ?? null,
    }

    const FIELD_LABELS: Record<string, string> = {
      title: '标题', year: '年份', rating: '评分',
      description: '简介', coverUrl: '封面', directors: '导演',
      cast: '主演', genres: '题材', country: '国家/地区',
    }

    const diffs: FieldDiff[] = (Object.keys(FIELD_LABELS) as (keyof CandidateProposed)[]).map((field) => {
      const curr = formatFieldValue(current[field])
      const prop = formatFieldValue(proposed![field])
      return { field, label: FIELD_LABELS[field]!, current: curr, proposed: prop, changed: curr !== prop }
    })

    let breakdown: Record<string, number> | null = null
    if (candidateRef.notes) {
      try { breakdown = JSON.parse(candidateRef.notes) as Record<string, number> } catch { /* invalid JSON, ignore */ }
    }

    return { externalRefId: candidateRef.id, externalId: candidateRef.externalId, confidence: candidateRef.confidence, matchMethod: candidateRef.matchMethod, breakdown, diffs }
  }

  /**
   * META-07: 仅应用选中字段，并将 video_external_refs 标记为 manual_confirmed
   */
  async confirmFields(
    videoId: string,
    subjectId: string,
    fields: string[],
  ): Promise<{ updated: boolean; reason?: string }> {
    const video = await videoQueries.findAdminVideoById(this.db, videoId)
    if (!video) return { updated: false, reason: 'video_not_found' }
    if (fields.length === 0) return { updated: false, reason: 'no_fields' }

    // 获取候选数据（优先本地 dump）
    const localEntry = await externalDataQueries.findDoubanEntryById(this.db, subjectId)
    let proposed: CandidateProposed | null = null
    if (localEntry) {
      proposed = {
        title: localEntry.title, year: localEntry.year, rating: localEntry.rating,
        description: localEntry.description, coverUrl: localEntry.coverUrl,
        directors: localEntry.directors, cast: localEntry.cast,
        genres: localEntry.genres, country: localEntry.country,
      }
    } else {
      const detail = await getDoubanDetailRich(subjectId)
      if (!detail) return { updated: false, reason: 'fetch_failed' }
      const ratingNum = detail.rate ? parseFloat(detail.rate) : NaN
      proposed = {
        title: detail.title, year: parseYear(detail.year),
        rating: isNaN(ratingNum) ? null : ratingNum,
        description: detail.plotSummary ?? null, coverUrl: detail.poster ?? null,
        directors: detail.directors, cast: detail.cast,
        genres: detail.genres, country: detail.countries[0] ?? null,
      }
    }

    const FIELD_TO_CATALOG: Record<string, keyof import('@/api/db/queries/mediaCatalog').CatalogUpdateData> = {
      title: 'title', year: 'year', rating: 'rating',
      description: 'description', coverUrl: 'coverUrl', directors: 'director',
      cast: 'cast', genres: 'genresRaw', country: 'country',
    }

    const updateFields: import('@/api/db/queries/mediaCatalog').CatalogUpdateData = { doubanId: subjectId }
    for (const f of fields) {
      const catalogKey = FIELD_TO_CATALOG[f]
      if (!catalogKey) continue
      const val = proposed[f as keyof CandidateProposed]
      if (f === 'genres' && Array.isArray(val)) {
        updateFields.genresRaw = val as string[]
        const mapped = mapDoubanGenres(val as string[])
        if (mapped.length > 0) updateFields.genres = mapped
      } else {
        (updateFields as Record<string, unknown>)[catalogKey] = val
      }
    }

    const catalogService = new MediaCatalogService(this.db)
    const updated = await catalogService.safeUpdate(video.catalog_id, updateFields, 'douban', { sourceRef: subjectId })
    if (!updated) return { updated: false, reason: 'catalog_update_rejected' }

    // 标记 manual_confirmed
    await externalDataQueries.upsertVideoExternalRef(this.db, {
      videoId,
      provider: 'douban',
      externalId: subjectId,
      matchStatus: 'manual_confirmed',
      matchMethod: 'manual_fields',
      isPrimary: true,
      linkedBy: 'moderator',
    })

    const catalog = await catalogQueries.findCatalogById(this.db, video.catalog_id)
    const metaScore = calcMetaScore(catalog)
    await videoQueries.updateVideoEnrichStatus(this.db, videoId, { doubanStatus: 'matched', metaScore })
    return { updated: true }
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

// ── 工具函数 ─────────────────────────────────────────────────────

/** META-07: 将字段值序列化为可比较的字符串（null/undefined → null） */
function formatFieldValue(val: unknown): string | null {
  if (val == null) return null
  if (Array.isArray(val)) return val.length === 0 ? null : val.join(' / ')
  return String(val)
}

function calcMetaScore(catalog: import('@/api/db/queries/mediaCatalog').MediaCatalogRow | null): number {
  if (!catalog) return 0
  let score = 0
  if (catalog.title) score += 20
  if (catalog.coverUrl) score += 20
  if (catalog.description) score += 20
  if (catalog.genres && catalog.genres.length > 0) score += 20
  if (catalog.year) score += 10
  if (catalog.type && catalog.type !== 'other') score += 10
  return Math.min(100, score)
}

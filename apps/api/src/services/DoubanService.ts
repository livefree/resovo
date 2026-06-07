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
import { buildManualMetaQuality } from './MetadataEnrichService'
import { updateVideoEpisodes } from '@/api/db/queries/videos'

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

import {
  type CandidateProposed,
  parseYear,
  pickBestCandidate,
  formatFieldValue,
  calcMetaScore,
} from './DoubanService.utils'

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

    const { updated } = await catalogService.safeUpdate(catalog.id, updateFields, 'douban', { sourceRef: detail.id })
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

    const { updated, skippedFields } = await catalogService.safeUpdate(video.catalog_id, updateFields, 'douban', { sourceRef: subjectId })
    if (!updated) return { updated: false, reason: 'catalog_update_rejected' }
    // ADR-186 INV-1：doubanId 未落地（exact 冲突——该豆瓣条目已绑定其他作品）→ 不虚标 matched
    //（updated 在"无字段可写"时返回原 catalog 非 null，须再查 skippedFields，arch-reviewer Q4）
    if (skippedFields.includes('doubanId')) return { updated: false, reason: 'douban_id_conflict' }

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

    // Codex stop-time review #8: 同步 meta_quality 防 stale（method='manual', confidence=1.0）
    const metaQuality = buildManualMetaQuality(video.meta_quality, {
      status: 'manual_confirmed',
      method: 'manual',
      confidence: 1.0,
    })

    await videoQueries.updateVideoEnrichStatus(this.db, videoId, {
      doubanStatus: 'matched', metaScore, metaQuality,
    })

    // CHG-367-B-B / ADR-163 D-163-6 manual 写入合约：
    //   人工 confirm 优先级最高 / 同时写 total_episodes + current_episodes / 覆盖既有值
    //   detail.episodes 来自豆瓣 subject 详情（豆瓣不区分 total/current，单一数字）
    if (detail.episodes && detail.episodes > 0) {
      await updateVideoEpisodes(
        this.db,
        videoId,
        { totalEpisodes: detail.episodes, currentEpisodes: detail.episodes },
        'manual',
      )
    }
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
    // CHG-367-B-B / ADR-163 §11 A3 + Y2：本地 dump 无 episodes 字段（DoubanEntryMatch 不含）；
    //   仅网络 fallback 的 detail.episodes 可作为 episodes 真源。
    let proposedEpisodes: number | null = null
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
      proposedEpisodes = detail.episodes ?? null
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
    const { updated, skippedFields } = await catalogService.safeUpdate(video.catalog_id, updateFields, 'douban', { sourceRef: subjectId })
    if (!updated) return { updated: false, reason: 'catalog_update_rejected' }
    // ADR-186 INV-1：doubanId 未落地（exact 冲突——该豆瓣条目已绑定其他作品）→ 不虚标 matched
    if (skippedFields.includes('doubanId')) return { updated: false, reason: 'douban_id_conflict' }

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

    // Codex stop-time review #8: 同步 meta_quality 防 stale（method='manual_fields', confidence=1.0）
    const metaQuality = buildManualMetaQuality(video.meta_quality, {
      status: 'manual_confirmed',
      method: 'manual_fields',
      confidence: 1.0,
    })

    await videoQueries.updateVideoEnrichStatus(this.db, videoId, {
      doubanStatus: 'matched', metaScore, metaQuality,
    })

    // CHG-367-B-B / ADR-163 D-163-6 + Y2 黄线：fields 含 'episodes' 时走 manual 写入合约（覆盖）。
    //   episodes 不在 FIELD_TO_CATALOG 映射（catalog 无此字段）；走 videos 表独立路径。
    //   本地 dump 路径无 episodes 真源（A3 advisory）→ proposedEpisodes 为 null 时跳过。
    if (fields.includes('episodes') && proposedEpisodes && proposedEpisodes > 0) {
      await updateVideoEpisodes(
        this.db,
        videoId,
        { totalEpisodes: proposedEpisodes, currentEpisodes: proposedEpisodes },
        'manual',
      )
    }
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


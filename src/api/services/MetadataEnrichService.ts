/**
 * MetadataEnrichService.ts — 自动元数据丰富服务
 * CHG-385 Phase 3：入库后自动豆瓣匹配 + Bangumi 补充 + 源检验 + meta_score
 *
 * 五步流程：
 *   Step1: 本地 external_data.douban_entries 精确匹配
 *   Step2: fallback → douban 网络搜索（置信度分级）
 *   Step3: type=anime 时查 external_data.bangumi_entries
 *   Step4: 源 HEAD 检验，写 source_check_status
 *   Step5: 计算 meta_score（title/cover/description/genres/year/type 各有权重）
 */

import type { Pool } from 'pg'
import type { DoubanStatus, SourceCheckStatus } from '@/types'
import { searchDouban } from '@/api/lib/douban'
import { getDoubanDetailRich } from '@/api/lib/doubanAdapter'
import { mapDoubanGenres } from '@/api/lib/genreMapper'
import { MediaCatalogService } from './MediaCatalogService'
import { normalizeTitle } from './TitleNormalizer'
import * as externalDataQueries from '@/api/db/queries/externalData'
import * as sourcesQueries from '@/api/db/queries/sources'
import * as videosQueries from '@/api/db/queries/videos'
import * as catalogQueries from '@/api/db/queries/mediaCatalog'

// ── 公开接口 ──────────────────────────────────────────────────────

export interface EnrichJobData {
  videoId: string
  catalogId: string
  title: string
  year: number | null
  type: string
}

// ── 内部常量 ──────────────────────────────────────────────────────

/** 豆瓣 Step2 网络搜索置信度阈值 */
const MATCH_THRESHOLD = 0.75
const CANDIDATE_THRESHOLD = 0.45

/** 源检验最大并发 HEAD 请求数 */
const SOURCE_CHECK_CONCURRENCY = 5
/** 源检验单次超时 ms */
const SOURCE_CHECK_TIMEOUT_MS = 8_000
/** 每视频最多检验源数 */
const SOURCE_CHECK_LIMIT = 20

// ── Service ───────────────────────────────────────────────────────

export class MetadataEnrichService {
  private catalogService: MediaCatalogService

  constructor(private db: Pool) {
    this.catalogService = new MediaCatalogService(db)
  }

  async enrich(data: EnrichJobData): Promise<void> {
    const { videoId, catalogId, title, year, type } = data
    const titleNorm = normalizeTitle(title)

    let doubanStatus: DoubanStatus = 'unmatched'

    // Step 1: 本地豆瓣匹配
    const step1 = await this.step1LocalDouban(catalogId, titleNorm, year)
    if (step1 !== null) {
      // 本地有条目（matched 或 candidate），不再走网络搜索
      doubanStatus = step1
    } else {
      // Step 2: 本地无任何匹配，fallback 至网络搜索
      const step2 = await this.step2NetworkSearch(catalogId, title, year)
      if (step2 !== null) doubanStatus = step2
    }

    // Step 3: 动画类型补充 Bangumi 数据
    if (type === 'anime') {
      await this.step3Bangumi(catalogId, titleNorm, year)
    }

    // Step 4: 源 HEAD 检验
    const sourceStatus = await this.step4SourceCheck(videoId)

    // Step 5: 计算 meta_score
    const metaScore = await this.step5MetaScore(catalogId)

    // 写入最终状态
    await videosQueries.updateVideoEnrichStatus(this.db, videoId, { doubanStatus, metaScore })
    await videosQueries.updateVideoSourceCheckStatus(this.db, videoId, sourceStatus)
  }

  // ── Step 1 ───────────────────────────────────────────────────────

  private async step1LocalDouban(
    catalogId: string,
    titleNorm: string,
    year: number | null
  ): Promise<DoubanStatus | null> {
    const matches = await externalDataQueries.findDoubanByTitleNorm(this.db, titleNorm, year)
    if (matches.length === 0) return null

    const best = matches[0]
    const yearMatch = !year || !best.year || Math.abs(best.year - year) <= 1

    await this.catalogService.safeUpdate(catalogId, {
      doubanId: best.doubanId,
      rating: best.rating ?? undefined,
      description: best.description ?? undefined,
      coverUrl: best.coverUrl ?? undefined,
      director: best.directors,
      cast: best.cast,
      writers: best.writers,
      genres: best.genres.length > 0 ? mapDoubanGenres(best.genres) : undefined,
      genresRaw: best.genres.length > 0 ? best.genres : undefined,
      country: best.country ?? undefined,
    }, 'douban')

    return yearMatch ? 'matched' : 'candidate'
  }

  // ── Step 2 ───────────────────────────────────────────────────────

  private async step2NetworkSearch(
    catalogId: string,
    title: string,
    year: number | null
  ): Promise<DoubanStatus | null> {
    let candidates: Awaited<ReturnType<typeof searchDouban>>
    try {
      candidates = await searchDouban(title, year ?? undefined)
    } catch {
      return null
    }
    if (candidates.length === 0) return 'unmatched'

    const best = pickBestCandidate(title, year, candidates)
    if (!best) return 'unmatched'

    if (best.score >= MATCH_THRESHOLD) {
      const detail = await getDoubanDetailRich(best.id)
      if (detail) {
        const ratingNum = detail.rate ? parseFloat(detail.rate) : NaN
        await this.catalogService.safeUpdate(catalogId, {
          doubanId: detail.id,
          rating: !isNaN(ratingNum) ? ratingNum : undefined,
          description: detail.plotSummary ?? undefined,
          coverUrl: detail.poster ?? undefined,
          director: detail.directors.length > 0 ? detail.directors : undefined,
          cast: detail.cast.length > 0 ? detail.cast : undefined,
          writers: detail.screenwriters.length > 0 ? detail.screenwriters : undefined,
          genres: detail.genres.length > 0 ? mapDoubanGenres(detail.genres) : undefined,
          genresRaw: detail.genres.length > 0 ? detail.genres : undefined,
          country: detail.countries[0] ?? undefined,
        }, 'douban')
        return 'matched'
      }
    }

    return best.score >= CANDIDATE_THRESHOLD ? 'candidate' : 'unmatched'
  }

  // ── Step 3 ───────────────────────────────────────────────────────

  private async step3Bangumi(
    catalogId: string,
    titleNorm: string,
    year: number | null
  ): Promise<void> {
    const matches = await externalDataQueries.findBangumiByTitleNorm(this.db, titleNorm, year)
    if (matches.length === 0) return

    const best = matches[0]
    // Bangumi 补充：优先回填 description（若 catalog 尚无内容）
    await this.catalogService.safeUpdate(catalogId, {
      bangumiSubjectId: best.bangumiId,
      description: best.summary ?? undefined,
      rating: best.rating ?? undefined,
    }, 'bangumi')
  }

  // ── Step 4 ───────────────────────────────────────────────────────

  private async step4SourceCheck(videoId: string): Promise<SourceCheckStatus> {
    const sources = await sourcesQueries.listSourcesForBatchVerify(this.db, {
      scope: 'video',
      videoId,
      activeOnly: false,
      limit: SOURCE_CHECK_LIMIT,
    })
    if (sources.length === 0) return 'pending'

    // 并发 HEAD 检验（分批避免超出并发上限）
    let activeCount = 0
    for (let i = 0; i < sources.length; i += SOURCE_CHECK_CONCURRENCY) {
      const chunk = sources.slice(i, i + SOURCE_CHECK_CONCURRENCY)
      const results = await Promise.all(chunk.map((s) => headCheck(s.source_url)))
      for (let j = 0; j < chunk.length; j++) {
        const isActive = results[j]
        await sourcesQueries.updateSourceActiveStatus(this.db, chunk[j].id, isActive)
        if (isActive) activeCount++
      }
    }

    if (activeCount === 0) return 'all_dead'
    if (activeCount === sources.length) return 'ok'
    return 'partial'
  }

  // ── Step 5 ───────────────────────────────────────────────────────

  private async step5MetaScore(catalogId: string): Promise<number> {
    const catalog = await catalogQueries.findCatalogById(this.db, catalogId)
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
}

// ── 工具函数 ──────────────────────────────────────────────────────

type Candidate = Awaited<ReturnType<typeof searchDouban>>[number]

interface ScoredCandidate { id: string; score: number }

function pickBestCandidate(
  title: string,
  year: number | null,
  candidates: Candidate[]
): ScoredCandidate | null {
  function similarity(a: string, b: string): number {
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '')
    const na = normalize(a); const nb = normalize(b)
    if (na === nb) return 1
    if (!na || !nb) return 0
    const bigrams = (s: string) => {
      const set = new Set<string>()
      for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2))
      return set
    }
    const sa = bigrams(na); const sb = bigrams(nb)
    let intersection = 0
    for (const g of sa) if (sb.has(g)) intersection++
    return (2 * intersection) / (sa.size + sb.size)
  }
  const normalize = (s: string) => s.toLowerCase().replace(/[（(][^）)]*[）)]/g, '').replace(/[^\p{L}\p{N}]/gu, '')

  let best: ScoredCandidate | null = null
  for (const item of candidates) {
    const titleSim = Math.max(
      similarity(normalize(title), normalize(item.title)),
      similarity(normalize(title), normalize(item.sub_title ?? ''))
    )
    const yearMatch = year && item.year ? (() => {
      const cy = parseInt(item.year); return Math.abs(cy - year)
    })() : 0
    const score = yearMatch === 0 ? Math.min(1, titleSim + 0.2) :
      yearMatch === 1 ? Math.min(1, titleSim + 0.1) : titleSim
    if (!best || score > best.score) best = { id: item.id, score }
  }
  return best
}

async function headCheck(url: string): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SOURCE_CHECK_TIMEOUT_MS)
  try {
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/**
 * trending.ts — 站内信号候选生成（ADR-183 D-183-4.3）
 *
 * featured / top10 自动补位 + banner suggest_only 候选池：复用 listTrendingVideos /
 * listVideosByRatingDesc 链路，**不引豆瓣/Bangumi**。源查询已预过滤
 * published/public（站内信号源本就只取可见行），过滤链仍统一跑——
 * 可播源/封面缺失仍可产生 filtered 解释条目。
 * banner 候选源 = trending 为实施级推演（ADR-183 未裁 banner 源，suggest_only
 * 池走站内信号与 D-183-4.3 同向；apply 至 Hero 须经编辑器人工确认 D-182-4.5）。
 * 消费方 = homeAutofillWorker（CHG-HOME-AUTOFILL-REFRESH）。
 */

import { randomUUID } from 'node:crypto'
import type { Pool } from 'pg'
import type { AutofillCandidate, VideoCard } from '@resovo/types'
import { listTrendingVideos } from '@/api/db/queries/videos'
import { listVideosByRatingDesc } from '@/api/db/queries/videos.status'
import { CANDIDATE_POOL_LIMIT } from './policy'
import { evaluateCandidateFilters } from './filters'

export type TrendingSection = 'featured' | 'top10' | 'banner'

/**
 * VideoCard 列表 → 候选（纯函数，导出供单测）。
 * 排序权威 = 源查询序（trending 热度 / rating DESC）；score 为解释展示值
 * （站内 rating/10，无独立加权公式——D-183-4.3 站内信号不套豆瓣权重）。
 */
export function buildTrendingCandidates(cards: readonly VideoCard[], origin: string): AutofillCandidate[] {
  let rank = 0
  return cards.map((card) => {
    const filter = evaluateCandidateFilters({
      // 源查询已过滤 published/public/软删（listTrendingVideos / listVideosByRatingDesc）
      isPublished: true,
      visibleOnFrontend: true,
      isAdult: false,
      playableSourceCount: card.sourceCount,
      hasImage: card.coverUrl != null && card.coverUrl !== '',
      hasImageFallback: false,
      brandLocaleVisible: true,
    })
    if (!filter.filtered) rank += 1
    return {
      id: randomUUID(),
      videoId: card.id,
      videoSummary: {
        title: card.title,
        slug: card.slug,
        coverUrl: card.coverUrl,
        type: card.type,
        year: card.year,
        rating: card.rating,
        sourceCount: card.sourceCount,
      },
      score: card.rating != null && card.rating > 0 ? Math.min(card.rating, 10) / 10 : 0,
      rank: filter.filtered ? 0 : rank,
      origin,
      filtered: filter.filtered,
      ...(filter.filterReason ? { filterReason: filter.filterReason } : {}),
    }
  })
}

/**
 * 站内信号 section 候选生成编排：
 * featured / banner → trending 周榜（origin 'trending'）；top10 → rating DESC
 * （origin 'rating'，与 preview fetchAutoFill 同口径）。站内源无缺口概念 → gaps 恒空。
 */
export async function generateTrendingSectionCandidates(
  db: Pool,
  section: TrendingSection,
): Promise<{ candidates: AutofillCandidate[]; gaps: [] }> {
  let cards: VideoCard[]
  let origin: string
  if (section === 'top10') {
    cards = await listVideosByRatingDesc(db, CANDIDATE_POOL_LIMIT, [])
    origin = 'rating'
  } else {
    cards = await listTrendingVideos(db, { period: 'week', limit: CANDIDATE_POOL_LIMIT })
    origin = 'trending'
  }
  return { candidates: buildTrendingCandidates(cards, origin), gaps: [] }
}

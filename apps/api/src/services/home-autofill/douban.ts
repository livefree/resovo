/**
 * douban.ts — 豆瓣候选生成集成（ADR-183 D-183-1 / D-183-4.1 / D-183-7.2）
 *
 * hot_movies / hot_series 候选：源行（queries/home-autofill-douban）→ doubanScore
 * 加权 + 过滤链 → AutofillCandidate[]（filtered 条目保留入快照供解释展示）。
 * 缺口：未映射扫描窗 → 同公式评分（站内信号自然缺失按 0）→ top-N ContentGap[]。
 * 消费方 = homeAutofillWorker（CHG-HOME-AUTOFILL-REFRESH 卡接线）。
 */

import { randomUUID } from 'node:crypto'
import type { Pool } from 'pg'
import type { AutofillCandidate, ContentGap } from '@resovo/types'
import {
  listDoubanCandidateSourceRows,
  listDoubanGapSourceRows,
  type DoubanCandidateSourceRow,
  type DoubanGapSourceRow,
} from '@/api/db/queries/home-autofill-douban'
import { CANDIDATE_POOL_LIMIT, GAP_TOP_N, GAP_SCAN_WINDOW } from './policy'
import { doubanScore } from './score'
import { evaluateCandidateFilters } from './filters'

/** hot section → 分池 videos.type（D-183-1；hot_anime 归 bangumi 候选源） */
const DOUBAN_SECTION_TYPE = {
  hot_movies: 'movie',
  hot_series: 'series',
} as const

export type DoubanSection = keyof typeof DOUBAN_SECTION_TYPE

/** 源不稳定惩罚信号：批量检验存在死源（ADR-157 双形态 partial / all_dead） */
function isUnstableSource(sourceCheckStatus: string): boolean {
  return sourceCheckStatus === 'partial' || sourceCheckStatus === 'all_dead'
}

/** 距今天数（更新时间缺失/非法按 null → recency 按最旧 0） */
function ageInDays(updatedAt: string, now: Date): number | null {
  const t = new Date(updatedAt).getTime()
  if (!Number.isFinite(t)) return null
  return Math.max(0, (now.getTime() - t) / 86_400_000)
}

/**
 * 源行 → 候选（纯函数，导出供单测）。
 * score DESC 排序；rank 仅未过滤条目占名次（1 起），filtered 条目 rank=0 哨兵。
 * brandLocaleVisible 恒 true（D-182-3 settings 首版全局无 brand 维度）；
 * hasImageFallback 恒 false（FallbackCover 为渲染级兜底，非数据级明确 fallback 信号）。
 */
export function buildDoubanCandidates(
  rows: readonly DoubanCandidateSourceRow[],
  now: Date,
): AutofillCandidate[] {
  const maxVotes = rows.reduce((max, r) => Math.max(max, r.doubanVotes ?? 0), 0)

  const scored = rows.map((row) => {
    const filter = evaluateCandidateFilters({
      isPublished: row.isPublished,
      visibleOnFrontend: row.visibilityStatus === 'public',
      isAdult: row.contentRating === 'adult' || row.siteIsAdult,
      playableSourceCount: row.activeSourceCount,
      hasImage: row.coverUrl != null && row.coverUrl !== '',
      hasImageFallback: false,
      brandLocaleVisible: true,
    })
    const score = doubanScore({
      votes: row.doubanVotes,
      rating: row.doubanRating,
      ageDays: ageInDays(row.updatedAt, now),
      activeSourceCount: row.activeSourceCount,
      missingImage: !row.coverUrl,
      unstableSource: isUnstableSource(row.sourceCheckStatus),
    }, maxVotes)
    return { row, filter, score }
  })

  scored.sort((a, b) => b.score - a.score)

  let rank = 0
  return scored.map(({ row, filter, score }) => {
    if (!filter.filtered) rank += 1
    return {
      id: randomUUID(),
      videoId: row.videoId,
      videoSummary: {
        title: row.title,
        slug: row.slug,
        coverUrl: row.coverUrl,
        type: row.type,
        year: row.year,
        rating: row.catalogRating,
        sourceCount: row.activeSourceCount,
      },
      score,
      rank: filter.filtered ? 0 : rank,
      origin: 'douban',
      filtered: filter.filtered,
      ...(filter.filterReason ? { filterReason: filter.filterReason } : {}),
    }
  })
}

/**
 * 缺口源行 → top-N ContentGap（纯函数，导出供单测）。
 * 同 doubanScore 公式（站内 recency/source_health 信号自然缺失按 0，封面缺失计惩罚），
 * 与候选评分单一实现；扫描窗 votes 序预截后此处精确评分截 top-N。
 */
export function buildDoubanGaps(rows: readonly DoubanGapSourceRow[], topN: number): ContentGap[] {
  const maxVotes = rows.reduce((max, r) => Math.max(max, r.doubanVotes ?? 0), 0)

  const scored = rows.map((row) => {
    const rating = row.doubanRating == null ? null : Number(row.doubanRating)
    const score = doubanScore({
      votes: row.doubanVotes,
      rating: Number.isFinite(rating ?? NaN) ? rating : null,
      ageDays: null,
      activeSourceCount: 0,
      missingImage: !row.coverUrl,
      unstableSource: false,
    }, maxVotes)
    return { row, score }
  })

  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, topN).map(({ row, score }) => ({
    provider: 'douban',
    externalId: row.doubanId,
    title: row.title,
    coverUrl: row.coverUrl,
    score,
    rank: null,
    mediaTypeHint: row.mediaTypeHint,
  }))
}

/**
 * 豆瓣 section 候选生成编排（worker 消费，CHG-HOME-AUTOFILL-REFRESH 接线）。
 * 候选与缺口同时序产出（同一次重算入同一快照，D-183-7.3）。
 */
export async function generateDoubanSectionCandidates(
  db: Pool,
  section: DoubanSection,
  now: Date = new Date(),
): Promise<{ candidates: AutofillCandidate[]; gaps: ContentGap[] }> {
  const [sourceRows, gapRows] = await Promise.all([
    listDoubanCandidateSourceRows(db, DOUBAN_SECTION_TYPE[section], CANDIDATE_POOL_LIMIT),
    listDoubanGapSourceRows(db, GAP_SCAN_WINDOW),
  ])
  return {
    candidates: buildDoubanCandidates(sourceRows, now),
    gaps: buildDoubanGaps(gapRows, GAP_TOP_N),
  }
}

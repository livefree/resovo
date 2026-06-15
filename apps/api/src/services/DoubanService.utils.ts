/**
 * DoubanService.utils.ts — 豆瓣相似度算法 + 内部工具函数
 * 从 DoubanService.ts 拆出的私有辅助模块
 */

import { searchDouban } from '@/api/lib/douban'
import type { MediaCatalogRow } from '@/api/db/queries/mediaCatalog'
import { similarity, normalizeForMatch, parseYear } from '@/api/lib/textMatch'

// 通用文本/年份相似度工具已下沉至 lib/textMatch（META-47）；此处 re-export 保留既有
// import 路径（DoubanService.ts 等消费方零改动），candidateScore 内部继续引用。
export { similarity, normalizeForMatch, parseYear }

// ── 内部私有类型 ──────────────────────────────────────────────────

/** META-07: 候选字段对比数据（内部使用，不导出） */
export interface CandidateProposed {
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

type Candidate = Awaited<ReturnType<typeof searchDouban>>[number]

export function candidateScore(videoTitle: string, videoYear: number | null | undefined, item: Candidate): number {
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

export function pickBestCandidate(videoTitle: string, videoYear: number | null | undefined, candidates: Candidate[]): Candidate | null {
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

// ── 字段工具 ─────────────────────────────────────────────────────

/** META-07: 将字段值序列化为可比较的字符串（null/undefined → null） */
export function formatFieldValue(val: unknown): string | null {
  if (val == null) return null
  if (Array.isArray(val)) return val.length === 0 ? null : val.join(' / ')
  return String(val)
}

export function calcMetaScore(catalog: MediaCatalogRow | null): number {
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

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
import { searchDouban, getDoubanDetail } from '@/api/lib/douban'
import * as videoQueries from '@/api/db/queries/videos'

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

// ── Service ──────────────────────────────────────────────────────

export class DoubanService {
  constructor(private db: Pool) {}

  async syncVideo(videoId: string): Promise<SyncResult | SyncSkipped> {
    // 1. 获取视频基本信息
    const video = await videoQueries.findAdminVideoById(this.db, videoId)
    if (!video) return { updated: false, reason: 'no_match' }

    // 2. 已有 douban_id，跳过
    if (video.douban_id) return { updated: false, reason: 'already_synced' }

    // 3. 搜索豆瓣
    let candidates: Awaited<ReturnType<typeof searchDouban>>
    try {
      candidates = await searchDouban(video.title, video.year ?? undefined)
    } catch {
      return { updated: false, reason: 'fetch_failed' }
    }

    if (candidates.length === 0) return { updated: false, reason: 'no_match' }

    // 4. 选取相似度最高的候选，必须 >80%
    let bestId: string | null = null
    let bestScore = 0
    for (const item of candidates) {
      const score = similarity(video.title, item.title)
      if (score > bestScore) {
        bestScore = score
        bestId = item.id
      }
    }
    if (!bestId || bestScore < 0.8) return { updated: false, reason: 'no_match' }

    // 5. 获取详情
    let detail: Awaited<ReturnType<typeof getDoubanDetail>>
    try {
      detail = await getDoubanDetail(bestId)
    } catch {
      return { updated: false, reason: 'fetch_failed' }
    }
    if (!detail) return { updated: false, reason: 'fetch_failed' }

    // 6. 更新 DB
    const input: videoQueries.UpdateDoubanInput = {
      doubanId: detail.id,
      rating: detail.rating,
      description: detail.summary,
      coverUrl: detail.posterUrl,
      director: detail.directors.length > 0 ? detail.directors : undefined,
      cast: detail.casts.length > 0 ? detail.casts : undefined,
    }

    const updated = await videoQueries.updateDoubanData(this.db, videoId, input)
    if (!updated) return { updated: false, reason: 'fetch_failed' }

    const fields: string[] = ['douban_id']
    if (detail.rating !== null) fields.push('rating')
    if (detail.summary) fields.push('description')
    if (detail.posterUrl) fields.push('cover_url')
    if (detail.directors.length > 0) fields.push('director')
    if (detail.casts.length > 0) fields.push('cast')

    return { updated: true, fields, doubanId: detail.id }
  }
}

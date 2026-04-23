/**
 * home.types.ts — 首页 API 响应类型（HANDOFF-04，ADR-052/053）
 */

import type { VideoCard, VideoType } from './video.types'

// ── Top10 ────────────────────────────────────────────────────────

/**
 * top10 排序策略。
 * 'manual_plus_rating'：人工置顶 + rating DESC 冷启动 fallback（当前 v1）
 * 'composite'：views/completion/rating 综合算分（SEQ-202604XX-STATS-V1 跟进实装）
 */
export type SortStrategy = 'manual_plus_rating' | 'composite'

export interface Top10Item {
  video: VideoCard
  /** 1-based 展示排名，由 HomeService 计算 */
  rank: number
  /** 是否来自人工置顶（home_modules.slot='top10'）*/
  isPinned: boolean
}

export interface Top10Response {
  items: Top10Item[]
  /** 前端根据此字段从 i18n 字典取副标题文案（不在 API 层硬编码）*/
  sortStrategy: SortStrategy
}

// ── Count By Type ────────────────────────────────────────────────

export interface CountByTypeItem {
  type: VideoType
  count: number
}

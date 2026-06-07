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

// ── Hot Shelf（ADR-184 D-184-2）──────────────────────────────────

export interface HomeShelfItem {
  video: VideoCard
  /** 1-based 最终展示序（投影后重排连续） */
  rank: number
  /** pinned 头部 vs 自动/兜底补位（auto/fallback 不细分，D-184-7.5 公开面最小化） */
  isPinned: boolean
}

/** GET /home/shelf 响应（ADR-184；section 窄集常量 HOME_SHELF_SECTIONS 见 home-section.types.ts） */
export interface HomeShelfResponse {
  items: HomeShelfItem[]
  /**
   * 本次合成消费的候选快照时间；null = 未消费快照（纯 pinned + 趋势兜底）。
   * 来源 = HomePreviewSection.consumedSnapshotAt（D-184-3.5 结构保证，禁止二次查快照）
   */
  snapshotAt: string | null
  /** 合成时间（缓存命中时为缓存体生成时间，方案 §12 显式标记缓存时间口径） */
  generatedAt: string
}

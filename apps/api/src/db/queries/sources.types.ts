/**
 * sources.types.ts — video_sources 共享类型
 * 从 sources.ts 拆出（CHG-SN-7-MISC-API-QUERIES-SIZE）
 */

import type { SourceType } from '@/types'

export interface UpsertSourceInput {
  videoId: string
  episodeNumber: number  // ADR-016: 统一坐标系，单集/电影为 1
  seasonNumber?: number  // 默认 1
  sourceUrl: string      // ADR-001: 第三方直链，不做代理
  sourceName: string
  type: SourceType
  sourceSiteKey?: string | null  // CHG-414: 行级源站 key，优先于 videos.site_key
}

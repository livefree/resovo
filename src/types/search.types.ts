/**
 * search.types.ts — 搜索类型
 */

import type { VideoType, VideoCategory, VideoCard } from './video.types'

// ── 搜索请求参数 ─────────────────────────────────────────────────

export interface SearchParams {
  q?: string               // 关键词（与 director/actor/writer 至少一个）
  type?: VideoType
  category?: VideoCategory
  year?: number
  ratingMin?: number
  lang?: string            // 字幕语言，BCP 47
  director?: string        // 精确匹配（ES .keyword）
  actor?: string           // 精确匹配
  writer?: string          // 精确匹配
  sort?: 'relevance' | 'rating' | 'latest'
  page?: number
  limit?: number
}

// ── 搜索结果 ─────────────────────────────────────────────────────

export interface SearchResult extends VideoCard {
  // 搜索结果在 VideoCard 基础上额外包含：
  highlight?: {
    title?: string         // 含 <em> 高亮标记的标题
    titleEn?: string
    description?: string
  }
}

// ── 搜索联想词 ───────────────────────────────────────────────────

export type SuggestionType = 'video' | 'director' | 'actor' | 'writer'

export interface SearchSuggestion {
  type: SuggestionType
  text: string             // 显示文字
  role?: string            // 人名联想时的角色说明，如"导演"、"声优"
}

export interface SuggestParams {
  q: string                // 输入前缀，最少 1 字符
  limit?: number           // 默认 6
}

// ── 激活的筛选条件（前端 UI 状态）───────────────────────────────

export interface ActiveFilter {
  key: keyof Pick<SearchParams, 'type' | 'category' | 'year' | 'ratingMin' | 'lang' | 'director' | 'actor' | 'writer'>
  value: string
  label: string            // 显示标签，如"导演：荒木哲郎"
}

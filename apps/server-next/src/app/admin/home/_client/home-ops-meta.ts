/**
 * home-ops-meta.ts — HomeOpsClient 声明性常量（CHG-HOME-AUTOFILL-UI 文件拆分）
 *
 * 自 HomeOpsClient 拆出（582>500 硬限）：slot 枚举序 / 中文 label / 页面布局样式，
 * 纯声明零逻辑（section-meta.ts 同范式）。
 */

import type { CSSProperties } from 'react'
import type { HomeModuleSlot } from '@/lib/home-modules/types'

// ADR-181 D-181-4（migration 094）：+3 hot slot（热门 shelf pinned 头部专用）
export const SLOTS: readonly HomeModuleSlot[] = ['banner', 'featured', 'top10', 'type_shortcuts', 'hot_movies', 'hot_series', 'hot_anime']

export const SLOT_LABEL: Record<HomeModuleSlot, string> = {
  banner: '轮播广告',
  featured: '精选推荐',
  top10: 'TOP 10',
  type_shortcuts: '类型快捷',
  hot_movies: '热门电影',
  hot_series: '热播剧集',
  hot_anime: '热门动漫',
}

export const PAGE_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
  gap: 'var(--section-gap)',
  padding: 'var(--page-padding-y) var(--page-padding-x) 0',
}

export const BODY_SPLIT_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 360px',
  gap: '12px',
  flex: '1 1 auto',
  minHeight: 0,
  alignItems: 'start',
}

export const SLOT_SECTION_STYLE: CSSProperties = {
  overflowY: 'auto',
  minHeight: 0,
}

// CHG-HOME-UX-08：来源回链栏（仿 merge-entry-source-bar）
export const ENTRY_SOURCE_BAR_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 12px',
  background: 'var(--state-info-bg)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-default)',
}

/**
 * section-meta.ts — 画布区块展示元数据（CHG-HOME-CARD-DND-B）
 *
 * SECTION_TITLE 第 3 消费方（CanvasSection / SectionInspector /
 * CrossSectionConfirmModal）触发共享提取（CLAUDE.md「同一 UI 模式 3 处以上必须提取」）。
 * key 与 HomeSectionKey 枚举（ADR-182 D-182-2）一一对应。
 */

import type { HomeSectionKey } from '@/lib/home-curation/types'

export const SECTION_TITLE: Record<HomeSectionKey, string> = {
  banner: 'Hero Banner',
  type_shortcuts: '分类快捷入口',
  featured: '精选推荐',
  top10: 'TOP 10',
  hot_movies: '热门电影',
  hot_series: '热播剧集',
  hot_anime: '热门动漫',
}

/** 视频型区块（方案 §5.3：视频卡仅可在这些区块间跨区块拖动） */
export const VIDEO_SECTIONS: ReadonlySet<HomeSectionKey> = new Set<HomeSectionKey>([
  'featured',
  'top10',
  'hot_movies',
  'hot_series',
  'hot_anime',
])

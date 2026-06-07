/**
 * registry.ts — 豆瓣合集采集注册表 + 抓取常量（ADR-187 D-187-2）
 *
 * collection key = 豆瓣端点物理拓扑（key 失效=上游变更，非运营可配项）→ 代码常量注册表
 * （类比 ADR-183 D-183-4.4 算法常量，不入 DB 配置；新增合集仅追加一行，INV-4）。
 * 实测 16 合集可用（电影 5 / 剧集 8 / 综艺 3），m.douban.com/rexxar/api/v2/subject_collection/{key}/items。
 */

import type { CollectionCategory, CollectionDomain } from '@/api/db/queries/douban-collections'

export interface DoubanCollectionEntry {
  /** 豆瓣 subject_collection key */
  readonly key: string
  /** 归类域（注册表权威，与 item 自带 type 正交） */
  readonly domain: CollectionDomain
  readonly category: CollectionCategory
  /** 该合集封顶取数（缺省 GLOBAL_MAX_ITEMS） */
  readonly maxItems?: number
}

/** 16 个实测可用合集（2026-06-07 探测确认全可用、无限流） */
export const DOUBAN_COLLECTIONS: readonly DoubanCollectionEntry[] = [
  // ── 电影 ──
  { key: 'movie_hot_gaia', domain: 'movie', category: 'trending' }, // 豆瓣热门（~345）
  { key: 'movie_showing', domain: 'movie', category: 'trending' }, // 影院热映（~80）
  { key: 'movie_soon', domain: 'movie', category: 'upcoming' }, // 院线即将上映（~28）
  { key: 'movie_top250', domain: 'movie', category: 'ranking' }, // Top250（250）
  { key: 'movie_weekly_best', domain: 'movie', category: 'ranking' }, // 一周口碑电影榜（~10）
  // ── 剧集 ──
  { key: 'tv_hot', domain: 'tv', category: 'trending' }, // 近期热门剧集（~247）
  { key: 'tv_domestic', domain: 'tv', category: 'trending' }, // 近期热门国产剧（~44）
  { key: 'tv_american', domain: 'tv', category: 'trending' }, // 近期热门美剧（~50）
  { key: 'tv_korean', domain: 'tv', category: 'trending' }, // 近期热门韩剧（~27）
  { key: 'tv_japanese', domain: 'tv', category: 'trending' }, // 近期热门日剧（~35）
  { key: 'tv_animation', domain: 'tv', category: 'trending' }, // 近期热门动画（~43）
  { key: 'tv_documentary', domain: 'tv', category: 'trending' }, // 近期热门纪录片（~18）
  { key: 'tv_chinese_best_weekly', domain: 'tv', category: 'ranking' }, // 华语口碑剧集榜（~10）
  // ── 综艺 ──
  { key: 'show_hot', domain: 'show', category: 'trending' }, // 近期热门综艺（~61）
  { key: 'show_domestic', domain: 'show', category: 'trending' }, // 近期热门国内综艺（~28）
  { key: 'show_foreign', domain: 'show', category: 'trending' }, // 近期热门国外综艺（~33）
]

// ── 抓取常量（D-187-3 / M5）─────────────────────────────────────────────────────

/** 分页页长（对齐 adapter MAX_COLLECTION_COUNT=50，该端点族安全页长） */
export const PAGE_SIZE = 50
/** 单合集封顶（实测最大 movie_hot_gaia 345 × 安全系数；缺省 maxItems 走此值） */
export const GLOBAL_MAX_ITEMS = 600
/** 页间礼貌延时（ms，降反爬） */
export const PAGE_DELAY_MS = 300
/** 合集间礼貌延时（ms） */
export const COLLECTION_DELAY_MS = 2000

/** empty_guard 基线：上轮 item_count ≥ 此值才启用骤降守护（D-187-4） */
export const GUARD_MIN_BASELINE = 10
/** empty_guard 骤降比：新量 < 上轮 × 此比 → 视为异常不替换（防 key 失效静默清空） */
export const GUARD_DROP_RATIO = 0.5

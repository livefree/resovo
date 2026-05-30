/**
 * enrichment-badge.types.ts — EnrichmentBadge 共享组件 Props 契约（ADR-172 / ADR-E）
 *
 * 真源：arch-reviewer (claude-opus-4-8) ADR-172 PASS 契约
 * 依赖：ADR-170（EnrichmentSummary / BangumiStatus）已 Accepted
 *
 * 设计语义：
 *   - 单徽标 EnrichmentBadge：discriminated union props（按 kind 区分 payload，编译期类型安全）
 *   - 组合簇 EnrichmentBadgeCluster：吃 EnrichmentSummary + VideoType，纯派生渲染
 *   - 视觉复用 <Pill>（cell 层原子），零自绘颜色；颜色仅经 Pill 消费 --state-* token
 *   - anime-only：bangumi 徽标仅 type==='anime' 渲染（不依赖 status 值，ADR-170 D-170-4）
 *
 * 不变约束（对齐 LinesPanel R2 / cell 层）：
 *   - 依赖方向单向：admin-ui → @resovo/types，不 import apps/server-next|api/**
 *   - 全部 Props readonly
 *   - Edge Runtime 兼容（纯展示，模块顶层零 fetch/cookie）
 *   - 零图标库依赖（⚠ 为 Unicode 文本字符 U+26A0，非 npm 包）
 */

import type {
  DoubanStatus,
  BangumiStatus,
  SourceCheckStatus,
  EnrichmentSummary,
  VideoType,
} from '@resovo/types'

// ── 共享枚举 ─────────────────────────────────────────────────────

/** 徽标维度（kind）— 5 维度对齐 EnrichmentSummary 信号集 */
export type EnrichmentBadgeKind =
  | 'douban'
  | 'bangumi'
  | 'source'
  | 'meta'
  | 'pinyin'

/** 尺寸（默认 'sm'）— 当前 Pill 固定 xxs 字号，size 落 data-size 供未来 Pill 扩展 + 测试标记 */
export type EnrichmentBadgeSize = 'sm' | 'md'

/** 簇上下文密度 — row=列表行紧凑（dot only）/ header=抽屉头稍宽（含 label + 富集时间 slot） */
export type EnrichmentBadgeDensity = 'row' | 'header'

// ── meta_score 阈值常量（单测对拍真源）─────────────────────────────

/**
 * metaScore (0–100) → Pill variant 阈值色带。
 * ≥ ok 为 ok / [warn, ok) 为 warn / < warn 为 danger。
 * 超界值兜底不抛错（>100 仍 ok / <0 仍 danger）。
 * 导出供映射表实装 + 单测边界对拍（79/80、49/50）。
 */
export const META_SCORE_THRESHOLDS = {
  /** ≥ 80 → ok */
  ok: 80,
  /** ≥ 50 且 < 80 → warn；< 50 → danger */
  warn: 50,
} as const

// ── 单徽标 Props（discriminated union by kind）─────────────────────

/** 各 kind 共享的展示 props（不含 payload） */
interface EnrichmentBadgeCommonProps {
  /** 尺寸（默认 'sm'） */
  readonly size?: EnrichmentBadgeSize
  /**
   * 是否渲染文案 label（默认 true）。
   * false → 仅 dot + aria-label/tooltip（density='row' 紧凑用法）。
   */
  readonly showLabel?: boolean
  /** 测试钩子 */
  readonly testId?: string
}

/** kind='douban'：吃 4 态 DoubanStatus */
export interface DoubanBadgeProps extends EnrichmentBadgeCommonProps {
  readonly kind: 'douban'
  readonly status: DoubanStatus
}

/** kind='bangumi'：吃 4 态 BangumiStatus（镜像 DoubanStatus） */
export interface BangumiBadgeProps extends EnrichmentBadgeCommonProps {
  readonly kind: 'bangumi'
  readonly status: BangumiStatus
}

/** kind='source'：吃 SourceCheckStatus */
export interface SourceBadgeProps extends EnrichmentBadgeCommonProps {
  readonly kind: 'source'
  readonly status: SourceCheckStatus
}

/** kind='meta'：吃 0–100 数值 metaScore（阈值变色） */
export interface MetaBadgeProps extends EnrichmentBadgeCommonProps {
  readonly kind: 'meta'
  /** 元数据完整度评分 0–100（超界值由组件兜底，不抛错） */
  readonly score: number
}

/**
 * kind='pinyin'：吃 boolean。
 * isPinyin=true → warn 警告徽标；false → 组件 return null（不渲染）。
 * 注：作为单徽标直接使用时仍接受 false（消费方可无条件挂载，由组件决定不渲染）。
 */
export interface PinyinBadgeProps extends EnrichmentBadgeCommonProps {
  readonly kind: 'pinyin'
  readonly isPinyin: boolean
}

/** EnrichmentBadge — discriminated union（按 kind 区分 payload，类型安全） */
export type EnrichmentBadgeProps =
  | DoubanBadgeProps
  | BangumiBadgeProps
  | SourceBadgeProps
  | MetaBadgeProps
  | PinyinBadgeProps

// ── 组合簇 Props ─────────────────────────────────────────────────

export interface EnrichmentBadgeClusterProps {
  /** 富集摘要派生投影（ADR-170 D-170-5；@resovo/types owner） */
  readonly summary: EnrichmentSummary

  /** 视频类型（决定 bangumi 徽标是否渲染：仅 'anime'） */
  readonly type: VideoType

  /** 上下文密度（必传，消费方显式声明 row / header） */
  readonly density: EnrichmentBadgeDensity

  /**
   * density='header' 时富集时间显示文案（消费方格式化后传入；i18n/时间库不下沉 admin-ui）。
   * 省略 / undefined → header 下显示「未富集」兜底；density='row' 始终不渲染此 slot。
   * summary.enrichedAt 仅决定语义来源，文案格式化在消费方（对齐 LinesPanel i18n 不下沉边界）。
   */
  readonly enrichedAtLabel?: string

  /** 测试钩子 */
  readonly testId?: string
}

'use client'

/**
 * enrichment-badge.tsx — EnrichmentBadge 单徽标（ADR-172 + AMENDMENT 2）
 *
 * 真源：enrichment-badge.types.ts（arch-reviewer Opus PASS 契约）
 *
 * AMENDMENT 2 后职责收窄：仅承载 meta（元数据完整度阈值变色）+ pinyin（拼音警告）；
 * 外部源 douban/bangumi/tmdb/imdb 改由 SourceLogoBadge（品牌 logo）承载；source 已移除（与 DualSignal 去重）。
 *
 * 实装契约：
 *   - 复用 <Pill> 渲染；颜色仅经 Pill 消费 --state-* token
 *   - meta：阈值变色（≥80 ok / 50–79 warn / <50 danger；超界兜底不抛错）
 *   - pinyin：isPinyin=true→warn「⚠ 拼音」/ false→不渲染（return null）
 *
 * 固定 data attribute：data-enrichment-badge + data-kind + data-status + data-size
 */
import React from 'react'
import { Pill } from '../cell/pill'
import type { PillVariant } from '../cell/pill.types'
import {
  META_SCORE_THRESHOLDS,
  type EnrichmentBadgeProps,
} from './enrichment-badge.types'

/** 派生结果（供单徽标渲染 + 单测对拍；null = 不渲染） */
export interface DerivedEnrichmentBadge {
  readonly label: string
  readonly variant: PillVariant
  readonly ariaLabel: string
  /** data-status 属性值（meta = score；pinyin = 'true'） */
  readonly statusAttr: string
}

/** meta_score 阈值变色（超界兜底不抛错） */
function metaVariant(score: number): PillVariant {
  if (score >= META_SCORE_THRESHOLDS.ok) return 'ok'
  if (score >= META_SCORE_THRESHOLDS.warn) return 'warn'
  return 'danger'
}

/**
 * 纯派生函数：props → 渲染信息（或 null = 不渲染）。
 * 单徽标与簇共用，便于单测直接对拍派生结果。
 */
export function deriveEnrichmentBadge(
  props: EnrichmentBadgeProps,
): DerivedEnrichmentBadge | null {
  switch (props.kind) {
    case 'meta': {
      const variant = metaVariant(props.score)
      const label = String(props.score)
      return { label, variant, ariaLabel: `元数据完整度：${label}`, statusAttr: label }
    }
    case 'pinyin': {
      if (!props.isPinyin) return null
      return { label: '⚠ 拼音', variant: 'warn', ariaLabel: '英文标题疑似拼音', statusAttr: 'true' }
    }
    default: {
      // discriminated union 完备性守卫：新增 kind 未处理 → 编译期报错
      const _exhaustive: never = props
      return _exhaustive
    }
  }
}

export function EnrichmentBadge(props: EnrichmentBadgeProps): React.ReactElement | null {
  const derived = deriveEnrichmentBadge(props)
  if (derived === null) return null

  const size = props.size ?? 'sm'
  const showLabel = props.showLabel ?? true

  return (
    <span
      data-enrichment-badge
      data-kind={props.kind}
      data-status={derived.statusAttr}
      data-size={size}
      data-testid={props.testId}
    >
      <Pill variant={derived.variant} ariaLabel={derived.ariaLabel}>
        {showLabel ? derived.label : ''}
      </Pill>
    </span>
  )
}

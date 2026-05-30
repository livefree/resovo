'use client'

/**
 * enrichment-badge.tsx — EnrichmentBadge 单徽标实装（ADR-172 / ADR-E）
 *
 * 真源：enrichment-badge.types.ts（arch-reviewer Opus PASS 契约）
 *
 * 实装契约（映射表见 ADR-172）：
 *   - 复用 <Pill> 渲染（不自绘视觉）；颜色仅经 Pill 消费 --state-* token
 *   - douban/bangumi：matched→ok / candidate→warn / unmatched→danger / pending→neutral
 *   - source：ok→ok / partial→warn / all_dead→danger / pending→neutral
 *   - meta：阈值变色（≥80 ok / 50–79 warn / <50 danger；超界兜底不抛错）
 *   - pinyin：isPinyin=true→warn「⚠ 拼音」/ false→不渲染（return null）
 *   - showLabel=false → 仅 dot（children 空串）+ aria-label/tooltip 兜底
 *
 * 固定 data attribute：data-enrichment-badge + data-kind + data-status + data-size
 */
import React from 'react'
import { Pill } from '../cell/pill'
import type { PillVariant } from '../cell/pill.types'
import type { DoubanStatus, BangumiStatus, SourceCheckStatus } from '@resovo/types'
import {
  META_SCORE_THRESHOLDS,
  type EnrichmentBadgeProps,
} from './enrichment-badge.types'

/** 派生结果（供单徽标渲染 + 单测对拍；null = 不渲染） */
export interface DerivedEnrichmentBadge {
  readonly label: string
  readonly variant: PillVariant
  readonly ariaLabel: string
  /** data-status 属性值（douban/bangumi/source = status；meta = score；pinyin = 'true'） */
  readonly statusAttr: string
}

/** douban / bangumi 共用 4 态映射（BangumiStatus 镜像 DoubanStatus） */
function matchStatusVisual(
  status: DoubanStatus | BangumiStatus,
): { label: string; variant: PillVariant } {
  switch (status) {
    case 'matched':   return { label: '已匹配', variant: 'ok' }
    case 'candidate': return { label: '候选', variant: 'warn' }
    case 'unmatched': return { label: '未匹配', variant: 'danger' }
    case 'pending':
    default:          return { label: '待匹配', variant: 'neutral' }
  }
}

/** source 活性映射（aria 用无前缀短词，label 用完整文案） */
function sourceVisual(
  status: SourceCheckStatus,
): { label: string; variant: PillVariant; aria: string } {
  switch (status) {
    case 'ok':       return { label: '源正常', variant: 'ok', aria: '正常' }
    case 'partial':  return { label: '部分失效', variant: 'warn', aria: '部分失效' }
    case 'all_dead': return { label: '全部失效', variant: 'danger', aria: '全部失效' }
    case 'pending':
    default:         return { label: '待检', variant: 'neutral', aria: '待检' }
  }
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
    case 'douban':
    case 'bangumi': {
      const prefix = props.kind === 'douban' ? '豆瓣' : 'Bangumi'
      const { label, variant } = matchStatusVisual(props.status)
      return { label, variant, ariaLabel: `${prefix}：${label}`, statusAttr: props.status }
    }
    case 'source': {
      const { label, variant, aria } = sourceVisual(props.status)
      return { label, variant, ariaLabel: `源活性：${aria}`, statusAttr: props.status }
    }
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

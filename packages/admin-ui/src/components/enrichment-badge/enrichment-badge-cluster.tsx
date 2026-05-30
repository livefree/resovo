'use client'

/**
 * enrichment-badge-cluster.tsx — EnrichmentBadgeCluster 组合簇实装（ADR-172 / ADR-E）
 *
 * 真源：enrichment-badge.types.ts（arch-reviewer Opus PASS 契约）
 *
 * 实装契约（纯派生，零受控状态）：
 *   - 固定排序：douban → bangumi(anime only) → source → meta → pinyin(true only)
 *   - anime-only：bangumi 徽标仅 type==='anime' 渲染（不依赖 status 值，ADR-170 D-170-4）
 *   - pinyin 仅 summary.titleEnIsPinyin===true 渲染
 *   - density='row'：size='sm' + showLabel=false（dot only）+ 无 enrichedAt slot
 *   - density='header'：size='md' + showLabel=true + 末尾 enrichedAtLabel（省略→「未富集」）
 *   - enrichedAt 文案格式化不下沉本组件（消费方传 enrichedAtLabel；i18n/时间库不入 admin-ui）
 *   - 颜色仅经子 EnrichmentBadge → Pill 消费 --state-* token；时间文本用 --fg-muted
 *
 * 固定 data attribute：data-enrichment-badge-cluster + data-type + data-density
 */
import React from 'react'
import { EnrichmentBadge } from './enrichment-badge'
import type {
  EnrichmentBadgeClusterProps,
  EnrichmentBadgeSize,
} from './enrichment-badge.types'

const TIME_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-xxs)',
  color: 'var(--fg-muted)',
  whiteSpace: 'nowrap',
}

export function EnrichmentBadgeCluster({
  summary,
  type,
  density,
  enrichedAtLabel,
  testId,
}: EnrichmentBadgeClusterProps): React.ReactElement {
  const isHeader = density === 'header'
  const size: EnrichmentBadgeSize = isHeader ? 'md' : 'sm'
  const showLabel = isHeader
  const isAnime = type === 'anime'

  const rootStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    // header 稍宽（6px），row 紧凑（4px）
    gap: isHeader ? '6px' : '4px',
  }

  return (
    <span
      data-enrichment-badge-cluster
      data-type={type}
      data-density={density}
      data-testid={testId}
      style={rootStyle}
    >
      <EnrichmentBadge
        kind="douban"
        status={summary.doubanStatus}
        size={size}
        showLabel={showLabel}
      />
      {isAnime && (
        <EnrichmentBadge
          kind="bangumi"
          status={summary.bangumiStatus}
          size={size}
          showLabel={showLabel}
        />
      )}
      <EnrichmentBadge
        kind="source"
        status={summary.sourceCheckStatus}
        size={size}
        showLabel={showLabel}
      />
      <EnrichmentBadge
        kind="meta"
        score={summary.metaScore}
        size={size}
        showLabel={showLabel}
      />
      {summary.titleEnIsPinyin && (
        <EnrichmentBadge kind="pinyin" isPinyin size={size} showLabel={showLabel} />
      )}
      {isHeader && (
        <span data-enrichment-cluster-time style={TIME_STYLE}>
          {enrichedAtLabel ?? '未富集'}
        </span>
      )}
    </span>
  )
}

'use client'

/**
 * metadata-source-icon-cluster.tsx — 四来源图标簇 MetadataSourceIconCluster（ADR-201 / META-33-A）
 *
 * 真源：metadata-status.types.ts（arch-reviewer Opus CONDITIONAL-PASS 契约）。
 *
 * 固定顺序 Douban / Bangumi / TMDB / IMDb（遍历 METADATA_PROVIDER_ORDER，不依赖 Record key 序，C5）。
 * 三密度均渲染**全部四图标**（含 missing/not_applicable 灰显占位，D-201-B / DEV-33-2：列宽扫描稳定，
 * 与旧 EnrichmentBadgeCluster row「仅命中」相反）。
 *
 * a11y（R3）：簇为**单一 focus 目标**（role="img" + tabIndex=0 + aria-label），hover 与键盘 focus
 * 经受控状态打开**同一** tooltip（复用 Popover 受控模式 + portal 定位，C6；不裸用原生 title——键盘 focus
 * 不可靠）。图标作非交互状态指示器（不传 href，避免 role=img 内嵌 <a> 产生多 tab stop）；外部链接归
 * -B MetadataStatusPanel 来源卡。
 *
 * 固定 data attribute：data-metadata-source-icon-cluster + data-density
 */
import React, { useState } from 'react'
import { METADATA_PROVIDER_ORDER } from '@resovo/types'
import { Popover } from '../popover'
import { MetadataProviderIcon } from './metadata-provider-icon'
import { buildMetadataTooltip } from './metadata-tooltip'
import { OVERALL_LABEL } from './metadata-status-labels'
import type {
  MetadataIconSize,
  MetadataSourceIconClusterProps,
  MetadataTooltipModel,
} from './metadata-status.types'

const DENSITY_ICON_SIZE: Record<MetadataSourceIconClusterProps['density'], MetadataIconSize> = {
  table: 'sm',
  header: 'md',
  panel: 'md',
}

const DENSITY_GAP: Record<MetadataSourceIconClusterProps['density'], string> = {
  table: '4px',
  header: '6px',
  panel: '6px',
}

const SCORE_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-xxs)',
  color: 'var(--fg-muted)',
  whiteSpace: 'nowrap',
  marginLeft: '2px',
}

const TOOLTIP_STYLE: React.CSSProperties = {
  padding: 'var(--space-2)',
  maxWidth: '320px',
  fontSize: 'var(--font-size-xs)',
  lineHeight: 1.6,
  color: 'var(--fg-default)',
}

const TOOLTIP_HEADLINE_STYLE: React.CSSProperties = {
  fontWeight: 600,
  marginBottom: '2px',
}

const TOOLTIP_LINE_STYLE: React.CSSProperties = {
  whiteSpace: 'nowrap',
  color: 'var(--fg-muted)',
}

function TooltipContent({ model }: { model: MetadataTooltipModel }): React.ReactElement {
  return (
    <div style={TOOLTIP_STYLE}>
      <div data-tooltip-headline style={TOOLTIP_HEADLINE_STYLE}>{model.headline}</div>
      {model.providerLines.map((line, i) => (
        <div key={`p-${i}`} data-tooltip-provider style={TOOLTIP_LINE_STYLE}>{line}</div>
      ))}
      {model.issueLines.map((line, i) => (
        <div key={`i-${i}`} data-tooltip-issue style={TOOLTIP_LINE_STYLE}>{line}</div>
      ))}
      {model.nextActionLine && (
        <div data-tooltip-next style={TOOLTIP_LINE_STYLE}>{model.nextActionLine}</div>
      )}
    </div>
  )
}

export function MetadataSourceIconCluster({
  summary,
  density,
  showScore = false,
  ariaLabel,
  enrichedAtLabel,
  testId,
}: MetadataSourceIconClusterProps): React.ReactElement {
  const [open, setOpen] = useState(false)

  const size = DENSITY_ICON_SIZE[density]
  const resolvedAriaLabel = ariaLabel ?? `元数据状态：${OVERALL_LABEL[summary.overall]}`
  const scoreVisible = showScore && density !== 'table' && summary.score != null
  const model = buildMetadataTooltip(summary, { enrichedAtLabel })

  const rootStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: DENSITY_GAP[density],
    cursor: 'default',
  }

  const trigger = (
    <span
      data-metadata-source-icon-cluster
      data-density={density}
      data-testid={testId}
      role="img"
      aria-label={resolvedAriaLabel}
      tabIndex={0}
      style={rootStyle}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {METADATA_PROVIDER_ORDER.map((provider) => (
        <MetadataProviderIcon
          key={provider}
          provider={provider}
          state={summary.providers[provider].state}
          size={size}
        />
      ))}
      {scoreVisible && (
        <span data-metadata-cluster-score style={SCORE_STYLE}>{summary.score}</span>
      )}
    </span>
  )

  return (
    <Popover
      trigger={trigger}
      content={<TooltipContent model={model} />}
      open={open}
      onOpenChange={setOpen}
      placement="top"
      offset={6}
      hasPopup="dialog"
      aria-label={resolvedAriaLabel}
      data-testid={testId ? `${testId}-tooltip` : undefined}
    />
  )
}

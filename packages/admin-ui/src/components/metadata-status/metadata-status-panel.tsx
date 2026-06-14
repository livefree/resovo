'use client'

/**
 * metadata-status-panel.tsx — 元数据状态面板 MetadataStatusPanel（ADR-201 / META-33-B）
 *
 * 真源：metadata-status.types.ts（arch-reviewer §5 契约，复用 -A gate agentId a910e6bb5fa5df2a7）。
 *
 * 展示整体状态 + 完整度 + 最近增强 + 四来源卡 + 问题列表 + 下一步动作。**不执行 provider API**，
 * 动作经 onAction 回传（整体级 nextAction 主按钮 + 来源卡级 per-provider）。复用 -A：
 * MetadataSourceIconCluster（Header）+ MetadataProviderIcon（来源卡）+ 文案常量 + cell Pill（问题列表）。
 *
 * variant 结构：detail/drawer 全展开（含四来源卡 + 来源证据子区）；compact 折叠（仅 Header 簇 + top-3 问题 + 主动作）。
 *
 * 固定 data attribute：data-metadata-status-panel + data-variant
 */
import React from 'react'
import { METADATA_PROVIDER_ORDER } from '@resovo/types'
import type { MetadataIssueLevel, MetadataStatusIssue } from '@resovo/types'
import { Pill } from '../cell'
import type { PillVariant } from '../cell'
import { AdminButton } from '../admin-button'
import { SOURCE_LABEL } from '../enrichment-badge/enrichment-logos'
import { MetadataSourceIconCluster } from './metadata-source-icon-cluster'
import { MetadataSourceCard } from './metadata-source-card'
import { ISSUE_CODE_LABEL, NEXT_ACTION_LABEL, OVERALL_LABEL } from './metadata-status-labels'
import type { MetadataStatusPanelProps } from './metadata-status.types'

const MAX_COMPACT_ISSUES = 3

const ROOT_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
}
const HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 'var(--space-2)',
}
const OVERALL_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  fontWeight: 600,
  color: 'var(--fg-default)',
}
const META_STYLE: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }
const SECTION_TITLE_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  fontWeight: 600,
  color: 'var(--fg-muted)',
}
const CARDS_STYLE: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }
const ISSUES_STYLE: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }
const ISSUE_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-default)',
}

/** issueLevel → Pill variant（none 不渲染）。 */
const ISSUE_PILL_VARIANT: Record<Exclude<MetadataIssueLevel, 'none'>, PillVariant> = {
  info: 'info',
  warn: 'warn',
  danger: 'danger',
}

function issueText(issue: MetadataStatusIssue): string {
  const providerPart = issue.provider ? `${SOURCE_LABEL[issue.provider]} ` : ''
  return `${providerPart}${ISSUE_CODE_LABEL[issue.code] ?? issue.message}`
}

export function MetadataStatusPanel({
  summary,
  variant,
  onAction,
  enrichedAtLabel,
  sourceEvidence,
  testId,
}: MetadataStatusPanelProps): React.ReactElement {
  const isCompact = variant === 'compact'
  const issuesToShow = (isCompact ? summary.issues.slice(0, MAX_COMPACT_ISSUES) : summary.issues).filter(
    (i) => i.level !== 'none',
  )
  // 下一步主按钮仅在「有动作 + 上层接线 onAction」时渲染：无 handler 不渲染死按钮（避免 no-op 主操作，
  // 与来源卡 per-card 动作同口径；只读用法下状态信息仍由 Header + 问题列表承载）。
  const showNextAction = summary.nextAction !== 'none' && !!onAction

  return (
    <div data-metadata-status-panel data-variant={variant} data-testid={testId} style={ROOT_STYLE}>
      {/* Header：overall + 四来源图标簇 + 完整度 + 最近增强 */}
      <div style={HEADER_STYLE}>
        <span data-panel-overall style={OVERALL_STYLE}>{OVERALL_LABEL[summary.overall]}</span>
        {/* 簇不 showScore：panel 用带标签「完整度」单独显示，避免裸 score 重复 */}
        <MetadataSourceIconCluster
          summary={summary}
          density={isCompact ? 'header' : 'panel'}
          enrichedAtLabel={enrichedAtLabel}
        />
        {summary.score != null && <span style={META_STYLE}>完整度 {summary.score}</span>}
        {enrichedAtLabel && <span style={META_STYLE}>最近 {enrichedAtLabel}</span>}
      </div>

      {/* 四来源卡（detail/drawer 展开；compact 折叠为 Header 簇，不渲染卡） */}
      {!isCompact && (
        <div data-panel-source-cards style={CARDS_STYLE}>
          {METADATA_PROVIDER_ORDER.map((provider) => (
            <MetadataSourceCard
              key={provider}
              status={summary.providers[provider]}
              onAction={onAction}
              testId={testId ? `${testId}-card-${provider}` : undefined}
            />
          ))}
        </div>
      )}

      {/* 问题列表（compact 仅 top-3） */}
      {issuesToShow.length > 0 && (
        <div data-panel-issues style={ISSUES_STYLE}>
          <span style={SECTION_TITLE_STYLE}>问题</span>
          {issuesToShow.map((issue, i) => (
            <div key={`${issue.code}-${i}`} data-panel-issue style={ISSUE_ROW_STYLE}>
              <Pill variant={ISSUE_PILL_VARIANT[issue.level as Exclude<MetadataIssueLevel, 'none'>]}>
                {issueText(issue)}
              </Pill>
            </div>
          ))}
        </div>
      )}

      {/* 下一步动作（整体级，onAction 上层注入执行） */}
      {showNextAction && (
        <div data-panel-next-action>
          <AdminButton
            variant="primary"
            size="sm"
            onClick={() => onAction?.(summary.nextAction)}
            data-testid={testId ? `${testId}-next-action` : undefined}
          >
            {NEXT_ACTION_LABEL[summary.nextAction]}
          </AdminButton>
        </div>
      )}

      {/* 来源证据子区（detail/drawer + 消费方注入；compact 不渲染） */}
      {!isCompact && sourceEvidence && (
        <div data-panel-source-evidence>
          <span style={SECTION_TITLE_STYLE}>来源证据</span>
          {sourceEvidence}
        </div>
      )}
    </div>
  )
}

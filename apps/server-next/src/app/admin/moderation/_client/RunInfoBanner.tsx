'use client'

/**
 * RunInfoBanner.tsx — 审核台来自采集 run 深链 banner
 *
 * 真源：CHG-SN-8-03 / W1 金票 ②
 *
 * 触发：URL 含 `?run_id=<id>` 时显示
 * 视觉：AdminCard surface='subtle' status='info' + 文案 + 「清除筛选」xs btn
 * 行为：「清除筛选」清除 url 的 run_id 参数（保留其它参数）
 *
 * 软深链说明：本期不调用后端按 runId filter（后端 schema 修订属 ADR-端点先后协议范围）；
 * 仅作 UI 提示，让运营知道来自哪次 run；新增视频按 createdAt desc 自然排在队列顶部。
 */

import { type CSSProperties } from 'react'
import { AdminButton, AdminCard } from '@resovo/admin-ui'

export interface RunInfoBannerProps {
  readonly runId: string
  readonly onDismiss: () => void
}

const CARD_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '10px 14px',
  marginBottom: '12px',
}

const TEXT_STYLE: CSSProperties = {
  display: 'inline-flex',
  flexDirection: 'column',
  gap: '2px',
}

const TITLE_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  fontWeight: 600,
  color: 'var(--fg-default)',
}

const SUB_STYLE: CSSProperties = {
  fontSize: '11px',
  color: 'var(--fg-muted)',
}

const MONO_STYLE: CSSProperties = {
  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
  fontSize: '11px',
  color: 'var(--fg-default)',
}

export function RunInfoBanner({ runId, onDismiss }: RunInfoBannerProps) {
  const shortId = runId.slice(0, 8)
  return (
    <AdminCard surface="subtle" status="ok" style={CARD_STYLE} data-testid="moderation-run-info-banner">
      <span style={TEXT_STYLE}>
        <span style={TITLE_STYLE}>
          来自采集 run <span style={MONO_STYLE}>{shortId}</span>
        </span>
        <span style={SUB_STYLE}>
          新增视频按创建时间排在队列顶部；逐条 J/K 翻页处理。当前不按 run 过滤队列。
        </span>
      </span>
      <AdminButton size="sm" variant="default" onClick={onDismiss} data-testid="moderation-run-info-clear">
        清除筛选
      </AdminButton>
    </AdminCard>
  )
}

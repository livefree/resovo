'use client'

/**
 * TabDetail — 审核台 RightPane 详情 Tab
 *
 * CHG-SN-4-FIX-C：从 ModerationConsole.tsx 迁移 RightPaneDetail 函数到独立文件，
 * 作为 RightPane 三 Tab 的 detail 槽位。
 *
 * 信息密度对齐设计稿：DetailRow 单行 < 28px，紧凑（label 等宽字符 + value 右对齐）。
 */
import React from 'react'
import type { VideoQueueRow } from '@resovo/types'
import { M } from '@/i18n/messages/zh-CN/moderation'

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '4px 8px',
  background: 'var(--bg-surface-raised)',
  borderRadius: 4,
  marginBottom: 3,
}

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: 'monospace',
  color: 'var(--fg-muted)',
  fontSize: 11,
}

const SECTION_HEADER_STYLE: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--fg-muted)',
  textTransform: 'uppercase',
  letterSpacing: 1,
  marginBottom: 6,
}

interface DetailRowProps {
  label: string
  value: string
  ok?: boolean
}

function DetailRow({ label, value, ok }: DetailRowProps): React.ReactElement {
  const valueColor = ok === true
    ? 'var(--state-success-fg)'
    : ok === false
      ? 'var(--state-warning-fg)'
      : 'var(--fg-muted)'
  return (
    <div style={ROW_STYLE}>
      <code style={LABEL_STYLE}>{label}</code>
      <span style={{ color: valueColor, fontSize: 12 }}>{value}</span>
    </div>
  )
}

export interface TabDetailProps {
  readonly v: VideoQueueRow
}

export function TabDetail({ v }: TabDetailProps): React.ReactElement {
  const doubanLabel = M.detail[v.doubanStatus as keyof typeof M.detail] ?? v.doubanStatus
  return (
    <div style={{ fontSize: 12 }} data-right-tab="detail">
      <div style={SECTION_HEADER_STYLE}>{M.detail.statusTriad}</div>
      <DetailRow label={M.detail.isPublished} value={String(v.isPublished)} ok={v.isPublished} />
      <DetailRow label={M.detail.visibility} value={v.visibilityStatus} ok={v.visibilityStatus === 'public'} />
      <DetailRow label={M.detail.reviewStatus} value={v.reviewStatus} ok={v.reviewStatus === 'approved'} />

      <div style={{ ...SECTION_HEADER_STYLE, marginTop: 12 }}>{M.detail.doubanStatus}</div>
      <DetailRow label="douban_status" value={String(doubanLabel)} ok={v.doubanStatus === 'matched'} />

      <div style={{ ...SECTION_HEADER_STYLE, marginTop: 12 }}>信息</div>
      <DetailRow label="type" value={v.type} />
      <DetailRow label="year" value={String(v.year ?? '—')} />
      <DetailRow label="country" value={v.country ?? '—'} />
      <DetailRow label="episodeCount" value={String(v.episodeCount)} />
      <DetailRow label="meta_score" value={String(v.metaScore)} />
      <DetailRow label="source_check" value={v.sourceCheckStatus} />
    </div>
  )
}

'use client'

/**
 * TabSimilar — 审核台 RightPane 类似视频 Tab（M-SN-5 占位）
 *
 * CHG-SN-4-FIX-C：本期占位实装；M-SN-5 将基于类型 / 国家 / 年份召回相似视频，
 * 辅助跨视频审核决策。零 API 调用。
 */
import React from 'react'
import { M } from '@/i18n/messages/zh-CN/moderation'

const ROOT_STYLE: React.CSSProperties = {
  textAlign: 'center',
  padding: '32px 16px',
  color: 'var(--fg-subtle)',
}

const ICON_STYLE: React.CSSProperties = {
  fontSize: 28,
  color: 'var(--fg-subtle)',
  marginBottom: 12,
  opacity: 0.5,
}

const TITLE_STYLE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--fg-muted)',
  marginBottom: 6,
}

const NOTE_STYLE: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--fg-subtle)',
  lineHeight: 1.5,
}

export function TabSimilar(): React.ReactElement {
  return (
    <div style={ROOT_STYLE} data-right-tab="similar">
      <div style={ICON_STYLE} aria-hidden="true">⊞</div>
      <div style={TITLE_STYLE}>{M.similar.placeholder}</div>
      <div style={NOTE_STYLE}>{M.similar.note}</div>
    </div>
  )
}

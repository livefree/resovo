/**
 * StatusBadge.tsx — 状态标签（Admin 基础组件库）
 * CHG-24: 颜色圆点 + 文字，深浅主题通用
 */

'use client'

import { cn } from '@/lib/utils'

// ── 类型 ──────────────────────────────────────────────────────────

export type BadgeStatus =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'banned'
  | 'published'
  | 'draft'

interface StatusBadgeProps {
  status: BadgeStatus
  className?: string
}

// ── 配置 ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<BadgeStatus, { label: string; dotColor: string; bgVar: string }> = {
  active:    { label: '活跃',   dotColor: '#22c55e', bgVar: 'rgba(34,197,94,0.12)' },
  inactive:  { label: '停用',   dotColor: '#94a3b8', bgVar: 'rgba(148,163,184,0.12)' },
  pending:   { label: '待审核', dotColor: '#f59e0b', bgVar: 'rgba(245,158,11,0.12)' },
  banned:    { label: '已封禁', dotColor: '#ef4444', bgVar: 'rgba(239,68,68,0.12)' },
  published: { label: '已发布', dotColor: '#22c55e', bgVar: 'rgba(34,197,94,0.12)' },
  draft:     { label: '草稿',   dotColor: '#94a3b8', bgVar: 'rgba(148,163,184,0.12)' },
}

// ── Component ─────────────────────────────────────────────────────

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status]

  return (
    <span
      className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', className)}
      style={{ background: config.bgVar, color: 'var(--text)' }}
      data-testid={`status-badge-${status}`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: config.dotColor }}
        aria-hidden="true"
      />
      {config.label}
    </span>
  )
}

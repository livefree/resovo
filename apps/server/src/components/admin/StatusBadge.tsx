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
  active:    { label: '活跃',   dotColor: 'var(--status-success)', bgVar: 'var(--status-success-bg)' },
  inactive:  { label: '停用',   dotColor: 'var(--status-neutral)', bgVar: 'var(--status-neutral-bg)' },
  pending:   { label: '待审核', dotColor: 'var(--status-warning)', bgVar: 'var(--status-warning-bg)' },
  banned:    { label: '已封禁', dotColor: 'var(--status-danger)',  bgVar: 'var(--status-danger-bg)' },
  published: { label: '已发布', dotColor: 'var(--status-success)', bgVar: 'var(--status-success-bg)' },
  draft:     { label: '草稿',   dotColor: 'var(--status-neutral)', bgVar: 'var(--status-neutral-bg)' },
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

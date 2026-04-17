/**
 * StagingReadinessBadge.tsx — 就绪状态 badge
 * CHG-383/ADMIN-09: 展示视频是否满足自动发布条件
 */

interface ReadinessBadgeProps {
  ready: boolean
  blockers: string[]
}

export function StagingReadinessBadge({ ready, blockers }: ReadinessBadgeProps) {
  if (ready) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-400"
        title="满足发布条件"
        data-testid="staging-badge-ready"
      >
        <span aria-hidden>✓</span>
        就绪
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400 cursor-help"
      title={blockers.join('\n')}
      data-testid="staging-badge-blocked"
    >
      <span aria-hidden>!</span>
      待完善
    </span>
  )
}

/** 豆瓣状态 badge */
export function DoubanStatusBadge({ status }: { status: 'pending' | 'matched' | 'candidate' | 'unmatched' }) {
  const config = {
    matched:   { label: '已匹配', className: 'bg-green-500/15 text-green-400' },
    candidate: { label: '候选', className: 'bg-yellow-500/15 text-yellow-400' },
    unmatched: { label: '未匹配', className: 'bg-red-500/15 text-red-400' },
    pending:   { label: '待检', className: 'bg-[var(--bg3)] text-[var(--muted)]' },
  }[status]

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}
      data-testid={`douban-badge-${status}`}
    >
      {config.label}
    </span>
  )
}

/** 源健康状态 badge */
export function SourceHealthBadge({
  status,
  activeCount,
}: {
  status: 'pending' | 'ok' | 'partial' | 'all_dead'
  activeCount: number
}) {
  if (status === 'all_dead') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-400" data-testid="source-badge-dead">
        <span aria-hidden>✕</span>全失效
      </span>
    )
  }
  if (status === 'partial') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400" data-testid="source-badge-partial">
        <span aria-hidden>⚠</span>{activeCount} 条
      </span>
    )
  }
  if (status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs text-green-400" data-testid="source-badge-ok">
        <span aria-hidden>●</span>{activeCount} 条
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--bg3)] px-2 py-0.5 text-xs text-[var(--muted)]" data-testid="source-badge-pending">
      未检验
    </span>
  )
}

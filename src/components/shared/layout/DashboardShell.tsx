/**
 * DashboardShell.tsx — 仪表盘页容器（shared/layout 层）
 * CHG-323: 统一 section + metric grid 布局模式
 *
 * 用法：
 *   <DashboardShell>
 *     <DashboardSection title="视频" columns={3} testId="videos">
 *       <StatCard ... />
 *     </DashboardSection>
 *   </DashboardShell>
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// ── DashboardShell ────────────────────────────────────────────────

interface DashboardShellProps {
  children: ReactNode
  className?: string
  testId?: string
}

export function DashboardShell({ children, className, testId }: DashboardShellProps) {
  return (
    <div
      className={cn('space-y-8', className)}
      data-testid={testId ?? 'dashboard-shell'}
    >
      {children}
    </div>
  )
}

// ── DashboardSection ──────────────────────────────────────────────

const COLS_CLASS = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
} as const

interface DashboardSectionProps {
  title: string
  /** metric grid 列数（默认 3） */
  columns?: keyof typeof COLS_CLASS
  children: ReactNode
  className?: string
  testId?: string
}

export function DashboardSection({
  title,
  columns = 3,
  children,
  className,
  testId,
}: DashboardSectionProps) {
  return (
    <section data-testid={testId}>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        {title}
      </h2>
      <div className={cn('grid gap-4', COLS_CLASS[columns], className)}>
        {children}
      </div>
    </section>
  )
}

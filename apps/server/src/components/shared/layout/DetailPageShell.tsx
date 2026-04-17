/**
 * DetailPageShell.tsx — 详情页容器（shared/layout 层）
 * CHG-321: 提供 header zone + content zone + sidebar zone 三区结构
 *
 * 布局：
 *   header（全宽）
 *   ┌─────────────────────┬──────────┐
 *   │  content（主内容区） │ sidebar  │
 *   └─────────────────────┴──────────┘
 *
 * sidebar 可选；无 sidebar 时 content 占全宽
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// ── 类型 ─────────────────────────────────────────────────────────

export interface DetailPageShellProps {
  /** 页面顶部标题栏（标题、元信息、操作按钮等） */
  header: ReactNode
  /** 主内容区 */
  children: ReactNode
  /** 侧边栏（可选，占约 1/3 宽度） */
  sidebar?: ReactNode
  className?: string
  testId?: string
}

// ── Component ────────────────────────────────────────────────────

export function DetailPageShell({
  header,
  children,
  sidebar,
  className,
  testId,
}: DetailPageShellProps) {
  return (
    <div
      className={cn('space-y-4', className)}
      data-testid={testId ?? 'detail-page-shell'}
    >
      {/* Header zone */}
      <div
        className="rounded-lg border border-[var(--border)] bg-[var(--bg2)] p-4"
        data-testid="detail-page-shell-header"
      >
        {header}
      </div>

      {/* Body zone */}
      <div
        className={cn(
          'flex gap-4',
          sidebar ? 'items-start' : ''
        )}
      >
        {/* Content zone */}
        <div
          className={cn('min-w-0', sidebar ? 'flex-1' : 'w-full')}
          data-testid="detail-page-shell-content"
        >
          {children}
        </div>

        {/* Sidebar zone */}
        {sidebar ? (
          <aside
            className="w-72 shrink-0 space-y-4"
            data-testid="detail-page-shell-sidebar"
          >
            {sidebar}
          </aside>
        ) : null}
      </div>
    </div>
  )
}

/**
 * ListPageShell.tsx — 跨域列表页容器（shared/layout 层）
 * CHG-319: 提供统一的列表页标题区 + 操作区 + 内容区结构
 *
 * variant="admin"    → 带卡片背景的后台标题栏（原 AdminPageShell 样式）
 * variant="frontend" → 轻量分割线风格，适配前台视觉
 */

import type { ReactNode } from 'react'

// ── 类型 ─────────────────────────────────────────────────────────

export interface ListPageShellProps {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  variant?: 'admin' | 'frontend'
  className?: string
  testId?: string
}

// ── 样式映射 ─────────────────────────────────────────────────────

const HEADER_CLASS = {
  admin:
    'rounded-lg border border-[var(--border)] bg-[var(--bg2)] p-4',
  frontend:
    'border-b border-[var(--border)] pb-4',
} as const

// ── Component ────────────────────────────────────────────────────

export function ListPageShell({
  title,
  description,
  actions,
  children,
  variant = 'admin',
  className,
  testId,
}: ListPageShellProps) {
  return (
    <section
      className={className ?? 'space-y-4'}
      data-testid={testId}
    >
      <div className={HEADER_CLASS[variant]}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="group relative">
            <h1
              className={`text-2xl font-bold ${description ? 'cursor-help' : ''}`}
            >
              {title}
            </h1>
            {description ? (
              <div
                className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-[min(720px,90vw)] rounded-md border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 text-xs leading-5 text-[var(--muted)] opacity-0 shadow transition-opacity duration-150 group-hover:opacity-100"
                role="tooltip"
              >
                {description}
              </div>
            ) : null}
          </div>
          {actions ? (
            <div className="flex items-center gap-2">{actions}</div>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  )
}

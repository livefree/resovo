/**
 * DetailSection.tsx — 详情字段分组展示（shared/layout 层）
 * CHG-321: label + value 对列表，支持只读和可编辑两种模式
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// ── 类型 ─────────────────────────────────────────────────────────

export interface DetailField {
  label: string
  value: ReactNode
  /** 跨占两列（用于长文本字段） */
  span?: boolean
  testId?: string
}

export interface DetailSectionProps {
  title?: string
  fields: DetailField[]
  /** 操作区（如"编辑"按钮） */
  actions?: ReactNode
  className?: string
  testId?: string
}

// ── Component ────────────────────────────────────────────────────

export function DetailSection({
  title,
  fields,
  actions,
  className,
  testId,
}: DetailSectionProps) {
  return (
    <section
      className={cn(
        'rounded-lg border border-[var(--border)] bg-[var(--bg2)] p-4',
        className
      )}
      data-testid={testId ?? 'detail-section'}
    >
      {/* Section header */}
      {(title || actions) ? (
        <div className="mb-3 flex items-center justify-between">
          {title ? (
            <h2 className="text-sm font-semibold text-[var(--text)]">
              {title}
            </h2>
          ) : null}
          {actions ? (
            <div className="flex items-center gap-2">{actions}</div>
          ) : null}
        </div>
      ) : null}

      {/* Fields grid */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
        {fields.map((field, i) => (
          <div
            key={i}
            className={cn('min-w-0', field.span ? 'col-span-2' : '')}
            data-testid={field.testId}
          >
            <dt className="mb-0.5 text-xs text-[var(--muted)]">
              {field.label}
            </dt>
            <dd className="truncate text-sm text-[var(--text)]">
              {field.value ?? '—'}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

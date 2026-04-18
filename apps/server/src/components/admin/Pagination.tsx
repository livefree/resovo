/**
 * Pagination.tsx — 分页控件（Admin 基础组件库）
 * CHG-24: 显示当前页/总页数，前后翻页按钮
 */

'use client'

import { cn } from '@/lib/utils'

// ── 类型 ──────────────────────────────────────────────────────────

interface PaginationProps {
  page: number
  total: number
  pageSize: number
  onChange: (page: number) => void
  className?: string
}

// ── Component ─────────────────────────────────────────────────────

export function Pagination({ page, total, pageSize, onChange, className }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const hasPrev = page > 1
  const hasNext = page < totalPages

  return (
    <div
      className={cn('flex items-center justify-between text-sm', className)}
      data-testid="pagination"
    >
      <span style={{ color: 'var(--muted)' }}>
        共 {total} 条，第 {page} / {totalPages} 页
      </span>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={!hasPrev}
          className="px-3 py-1.5 rounded transition-colors disabled:opacity-40"
          style={
            hasPrev
              ? { background: 'var(--bg3)', color: 'var(--text)' }
              : { background: 'var(--bg2)', color: 'var(--muted)' }
          }
          data-testid="pagination-prev"
        >
          上一页
        </button>

        <button
          onClick={() => onChange(page + 1)}
          disabled={!hasNext}
          className="px-3 py-1.5 rounded transition-colors disabled:opacity-40"
          style={
            hasNext
              ? { background: 'var(--bg3)', color: 'var(--text)' }
              : { background: 'var(--bg2)', color: 'var(--muted)' }
          }
          data-testid="pagination-next"
        >
          下一页
        </button>
      </div>
    </div>
  )
}

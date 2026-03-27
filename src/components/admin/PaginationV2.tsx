/**
 * PaginationV2.tsx — 增强分页控件（CHG-237）
 * 功能：pageSize 切换（20/50/100）、页码窗口含省略号、跳页输入
 */

'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

const DEFAULT_PAGE_SIZE_OPTIONS = [20, 50, 100]

interface PaginationV2Props {
  page: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: number[]
  className?: string
}

/** Build the list of page numbers / ellipsis markers to display */
function buildPageWindow(current: number, totalPages: number): Array<number | '...'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const items: Array<number | '...'> = [1]
  if (current > 3) items.push('...')
  const start = Math.max(2, current - 1)
  const end = Math.min(totalPages - 1, current + 1)
  for (let p = start; p <= end; p++) items.push(p)
  if (current < totalPages - 2) items.push('...')
  items.push(totalPages)
  return items
}

export function PaginationV2({
  page,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  className,
}: PaginationV2Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const [jumpVal, setJumpVal] = useState('')

  const handleJump = () => {
    const n = parseInt(jumpVal, 10)
    if (Number.isFinite(n) && n >= 1 && n <= totalPages) {
      onPageChange(n)
    }
    setJumpVal('')
  }

  const pageWindow = buildPageWindow(page, totalPages)

  return (
    <div
      className={cn('flex flex-wrap items-center gap-3 text-sm', className)}
      data-testid="pagination-v2"
    >
      {/* 总条数 */}
      <span className="text-[var(--muted)]" data-testid="pagination-v2-total">
        共 {total} 条
      </span>

      {/* 每页条数 */}
      {onPageSizeChange && (
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          data-testid="pagination-v2-page-size"
        >
          {pageSizeOptions.map((s) => (
            <option key={s} value={s}>{s} 条/页</option>
          ))}
        </select>
      )}

      {/* 上一页 */}
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)] disabled:opacity-40 hover:bg-[var(--bg2)]"
        data-testid="pagination-v2-prev"
      >
        ‹
      </button>

      {/* 页码窗口 */}
      {pageWindow.map((item, idx) =>
        item === '...' ? (
          <span
            key={`ellipsis-${idx}`}
            className="px-1 text-xs text-[var(--muted)]"
            data-testid="pagination-v2-ellipsis"
          >
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            className={cn(
              'min-w-[28px] rounded border px-2 py-1 text-xs',
              item === page
                ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]'
                : 'border-[var(--border)] bg-[var(--bg3)] text-[var(--text)] hover:bg-[var(--bg2)]',
            )}
            data-testid={`pagination-v2-page-${item}`}
          >
            {item}
          </button>
        )
      )}

      {/* 下一页 */}
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)] disabled:opacity-40 hover:bg-[var(--bg2)]"
        data-testid="pagination-v2-next"
      >
        ›
      </button>

      {/* 跳页 */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-[var(--muted)]">跳至</span>
        <input
          type="number"
          min={1}
          max={totalPages}
          value={jumpVal}
          onChange={(e) => setJumpVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleJump() }}
          className="w-14 rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          data-testid="pagination-v2-jump-input"
        />
        <button
          type="button"
          onClick={handleJump}
          className="rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--bg2)]"
          data-testid="pagination-v2-jump-btn"
        >
          跳转
        </button>
      </div>
    </div>
  )
}

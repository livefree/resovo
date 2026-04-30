'use client'

/**
 * pagination.tsx — Pagination v2
 * 真源：ADR-103 §4.5（CHG-SN-2-15）
 *
 * 职责：页码导航（上/下/窗口页码）+ pageSize 切换；受控；零数据获取。
 * 消费方：DataTable client/server 模式均通过此组件暴露分页 UI，
 * onPageChange / onPageSizeChange 映射到 useTableQuery.patch。
 */
import React, { useCallback } from 'react'

export interface PaginationProps {
  readonly page: number
  readonly pageSize: number
  readonly totalRows: number
  readonly onPageChange: (next: number) => void
  readonly onPageSizeChange?: (next: number) => void
  /** 默认 [20, 50, 100] */
  readonly pageSizeOptions?: readonly number[]
  /** 页码窗口大小（当前页前后各显示几个页码）；默认 2 */
  readonly windowSize?: number
  readonly className?: string
}

const DEFAULT_PAGE_SIZE_OPTIONS = [20, 50, 100] as const

// ── page window builder ──────────────────────────────────────────

export function buildPageWindow(
  page: number,
  totalPages: number,
  windowSize: number,
): number[] {
  if (totalPages <= 0) return []
  const start = Math.max(1, page - windowSize)
  const end = Math.min(totalPages, page + windowSize)
  const pages: number[] = []
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
}

// ── styles ────────────────────────────────────────────────────────

const CONTAINER_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 0',
  fontSize: '13px',
  color: 'var(--fg-default)',
  userSelect: 'none',
}

function pageButtonStyle(active: boolean, disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '28px',
    height: '28px',
    padding: '0 4px',
    border: active ? '1px solid var(--accent-default)' : '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    background: active ? 'var(--admin-accent-soft)' : 'transparent',
    color: disabled ? 'var(--fg-muted)' : active ? 'var(--accent-default)' : 'var(--fg-default)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '12px',
    fontWeight: active ? 600 : 400,
    opacity: disabled ? 0.4 : 1,
  }
}

const ELLIPSIS_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  color: 'var(--fg-muted)',
  fontSize: '12px',
}

const SELECT_STYLE: React.CSSProperties = {
  padding: '2px 6px',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface-elevated)',
  color: 'var(--fg-default)',
  fontSize: '12px',
  cursor: 'pointer',
  marginLeft: '8px',
}

const INFO_STYLE: React.CSSProperties = {
  color: 'var(--fg-muted)',
  fontSize: '12px',
  marginLeft: 'auto',
}

// ── Pagination component ─────────────────────────────────────────

export function Pagination({
  page,
  pageSize,
  totalRows,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  windowSize = 2,
  className,
}: PaginationProps): React.ReactElement {
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const isFirst = page <= 1
  const isLast = page >= totalPages
  const windowPages = buildPageWindow(page, totalPages, windowSize)
  const showFirstEllipsis = windowPages.length > 0 && (windowPages[0] ?? 1) > 2
  const showLastEllipsis = windowPages.length > 0 && (windowPages[windowPages.length - 1] ?? totalPages) < totalPages - 1

  const goTo = useCallback((p: number) => {
    if (p < 1 || p > totalPages) return
    onPageChange(p)
  }, [totalPages, onPageChange])

  const startRow = totalRows === 0 ? 0 : (page - 1) * pageSize + 1
  const endRow = Math.min(page * pageSize, totalRows)

  return (
    <nav
      data-pagination
      role="navigation"
      aria-label="分页导航"
      style={CONTAINER_STYLE}
      className={className}
    >
      {/* 上一页 */}
      <button
        type="button"
        style={pageButtonStyle(false, isFirst)}
        disabled={isFirst}
        onClick={() => goTo(page - 1)}
        aria-label="上一页"
        data-pagination-prev
      >
        ‹
      </button>

      {/* 首页 */}
      {(windowPages[0] ?? 1) > 1 && (
        <button
          type="button"
          style={pageButtonStyle(page === 1, false)}
          onClick={() => goTo(1)}
          aria-label="第 1 页"
          aria-current={page === 1 ? 'page' : undefined}
        >
          1
        </button>
      )}

      {showFirstEllipsis && <span style={ELLIPSIS_STYLE} aria-hidden="true">…</span>}

      {/* 窗口页码 */}
      {windowPages.map((p) => (
        <button
          key={p}
          type="button"
          style={pageButtonStyle(page === p, false)}
          onClick={() => goTo(p)}
          aria-label={`第 ${p} 页`}
          aria-current={page === p ? 'page' : undefined}
        >
          {p}
        </button>
      ))}

      {showLastEllipsis && <span style={ELLIPSIS_STYLE} aria-hidden="true">…</span>}

      {/* 尾页 */}
      {(windowPages[windowPages.length - 1] ?? totalPages) < totalPages && (
        <button
          type="button"
          style={pageButtonStyle(page === totalPages, false)}
          onClick={() => goTo(totalPages)}
          aria-label={`第 ${totalPages} 页`}
          aria-current={page === totalPages ? 'page' : undefined}
        >
          {totalPages}
        </button>
      )}

      {/* 下一页 */}
      <button
        type="button"
        style={pageButtonStyle(false, isLast)}
        disabled={isLast}
        onClick={() => goTo(page + 1)}
        aria-label="下一页"
        data-pagination-next
      >
        ›
      </button>

      {/* pageSize 切换 */}
      {onPageSizeChange && (
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          style={SELECT_STYLE}
          aria-label="每页显示行数"
          data-pagination-pagesize
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size} 条/页
            </option>
          ))}
        </select>
      )}

      {/* 计数信息 */}
      <span style={INFO_STYLE} aria-live="polite" aria-atomic="true">
        {totalRows === 0 ? '暂无数据' : `${startRow}–${endRow} / ${totalRows}`}
      </span>
    </nav>
  )
}

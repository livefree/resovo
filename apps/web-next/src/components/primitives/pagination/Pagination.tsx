'use client'

/**
 * Pagination — 通用分页控件（共享 primitive）
 *
 * 消费 tokens：
 *   --browse-pagination-gap  8px（按钮间距）
 *   --browse-pagination-btn  36px（按钮尺寸）
 *   --radius-base
 *   --border-default
 *   --bg-surface
 *   --fg-default
 *   --fg-muted
 *
 * 由 BrowseGrid 与 SearchPage 共用，避免同功能重复实现。
 */

export interface PaginationProps {
  page: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
  'data-testid'?: string
}

export function Pagination({
  page,
  totalPages,
  onPrev,
  onNext,
  'data-testid': testId = 'pagination',
}: PaginationProps) {
  return (
    <div
      data-testid={testId}
      role="navigation"
      aria-label="分页"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--browse-pagination-gap)',
        marginTop: 'var(--browse-pagination-mt)',
      }}
    >
      <button
        type="button"
        data-testid={`${testId}-prev`}
        disabled={page <= 1}
        onClick={onPrev}
        aria-label="上一页"
        style={{
          width: 'var(--browse-pagination-btn)',
          height: 'var(--browse-pagination-btn)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'var(--radius-base)',
          border: '1px solid var(--border-default)',
          background: 'var(--bg-surface)',
          color: 'var(--fg-default)',
          cursor: page <= 1 ? 'not-allowed' : 'pointer',
          opacity: page <= 1 ? 0.4 : 1,
          fontSize: '18px',
          lineHeight: 1,
        }}
      >
        ‹
      </button>

      <span
        style={{
          fontSize: '14px',
          fontWeight: 500,
          color: 'var(--fg-default)',
          minWidth: '60px',
          textAlign: 'center',
        }}
      >
        {page} / {totalPages}
      </span>

      <button
        type="button"
        data-testid={`${testId}-next`}
        disabled={page >= totalPages}
        onClick={onNext}
        aria-label="下一页"
        style={{
          width: 'var(--browse-pagination-btn)',
          height: 'var(--browse-pagination-btn)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'var(--radius-base)',
          border: '1px solid var(--border-default)',
          background: 'var(--bg-surface)',
          color: 'var(--fg-default)',
          cursor: page >= totalPages ? 'not-allowed' : 'pointer',
          opacity: page >= totalPages ? 0.4 : 1,
          fontSize: '18px',
          lineHeight: 1,
        }}
      >
        ›
      </button>
    </div>
  )
}

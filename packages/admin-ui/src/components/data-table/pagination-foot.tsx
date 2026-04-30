'use client'

/**
 * pagination-foot.tsx — DataTable 内置 .dt__foot pagination（CHG-DESIGN-02 Step 7A）
 *
 * 职责：渲染 sticky bottom footer（summary + 翻页器 + pageSize 切换）。
 * 不持有 page / pageSize 状态：所有切换通过 onQueryChange({ pagination: ... }) 上行。
 *
 * 三态语义（arch-reviewer 必修项 + Codex stop-time review fix）：
 *   - `pagination === undefined`（消费方未传 prop）→ 渲染 **summary-only** foot
 *     （仅 summary 文本，**不渲染** pager / pageSize select），保证 §4.4.1 footer
 *     一体性同时与现有外置 PaginationV2 消费方零冲突（不出现双 pager）
 *   - `pagination === { ... }`（显式传入 config，含空对象 `{}`）→ 渲染 **完整 foot**
 *     （summary + pager + pageSize select），消费方明示选用一体化分页
 *   - `pagination === { hidden: true }` → 完全不渲染 foot（嵌入式兜底）
 *
 * 设计契约：reference.md §4.4.1 / §4.4.3 — `.dt__foot` 紧凑 24px 高页码按钮，
 * 复用 `--row-h-compact` token。
 */
import React, { useMemo } from 'react'
import type { PaginationConfig, PaginationSummaryContext, TableQueryPatch } from './types'

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const

interface PaginationFootProps {
  readonly config: PaginationConfig | undefined
  readonly page: number
  readonly pageSize: number
  readonly total: number
  readonly selectedCount: number
  readonly onChange: (patch: TableQueryPatch) => void
}

export function PaginationFoot({
  config,
  page,
  pageSize,
  total,
  selectedCount,
  onChange,
}: PaginationFootProps): React.ReactElement | null {
  if (config?.hidden) return null

  // 显式传 prop（含空对象）→ 完整 foot；省略 prop → summary-only（避免与外置 PaginationV2 双 pager）
  const isExplicit = config !== undefined

  const safePageSize = Math.max(1, pageSize)
  const totalPages = Math.max(1, Math.ceil(total / safePageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)

  const summaryCtx: PaginationSummaryContext = {
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
    selectedCount,
  }

  const summary = config?.summaryRender
    ? config.summaryRender(summaryCtx)
    : defaultSummary(summaryCtx)

  const pageSizeOptions = useMemo(
    () => config?.pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS,
    [config?.pageSizeOptions],
  )

  // summary-only 模式（pagination prop 缺省）禁用所有主动控件
  const showPager = isExplicit && totalPages > 1
  const showPageSize = isExplicit && pageSizeOptions.length > 1

  const goPage = (next: number) => {
    if (next === safePage || next < 1 || next > totalPages) return
    onChange({ pagination: { page: next } })
  }

  const setPageSize = (next: number) => {
    if (next === safePageSize) return
    // 切换 pageSize 时回到第 1 页（避免越界）
    onChange({ pagination: { page: 1, pageSize: next } })
  }

  const pageNumbers = pageWindow(safePage, totalPages, 5)

  return (
    <div data-table-foot role="region" aria-label="表格分页">
      {summary !== null && summary !== undefined && (
        <div data-table-foot-summary>{summary}</div>
      )}
      <span style={{ flex: 1 }} aria-hidden="true" />
      {showPageSize && (
        <label data-table-foot-pagesize>
          <span data-table-foot-pagesize-label>每页</span>
          <select
            value={safePageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            aria-label="每页条数"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </label>
      )}
      {showPager && (
        <nav data-table-foot-pager aria-label="翻页">
          <button
            type="button"
            data-table-foot-pager-btn
            disabled={safePage <= 1}
            onClick={() => goPage(safePage - 1)}
            aria-label="上一页"
          >‹</button>
          {pageNumbers.map((p, idx) =>
            p === '…' ? (
              <span key={`ell-${idx}`} data-table-foot-pager-ellipsis aria-hidden="true">…</span>
            ) : (
              <button
                key={p}
                type="button"
                data-table-foot-pager-btn
                data-active={p === safePage ? 'true' : undefined}
                aria-current={p === safePage ? 'page' : undefined}
                onClick={() => goPage(p)}
              >{p}</button>
            ),
          )}
          <button
            type="button"
            data-table-foot-pager-btn
            disabled={safePage >= totalPages}
            onClick={() => goPage(safePage + 1)}
            aria-label="下一页"
          >›</button>
        </nav>
      )}
    </div>
  )
}

function defaultSummary(ctx: PaginationSummaryContext): React.ReactNode {
  const base = `共 ${ctx.total} 条 · 第 ${ctx.page}/${ctx.totalPages} 页`
  if (ctx.selectedCount > 0) return `${base} · 已选 ${ctx.selectedCount} 项`
  return base
}

/**
 * 计算翻页窗口：当前页 ± 2，首末页保留，超出窗口处用 '…' 占位。
 * 例：current=7 / total=20 → [1, '…', 5, 6, 7, 8, 9, '…', 20]
 */
function pageWindow(current: number, total: number, windowSize: number): readonly (number | '…')[] {
  if (total <= windowSize + 4) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const half = Math.floor(windowSize / 2)
  let start = Math.max(2, current - half)
  let end = Math.min(total - 1, current + half)
  if (current - half < 2) end = Math.min(total - 1, end + (2 - (current - half)))
  if (current + half > total - 1) start = Math.max(2, start - ((current + half) - (total - 1)))
  const result: (number | '…')[] = [1]
  if (start > 2) result.push('…')
  for (let i = start; i <= end; i++) result.push(i)
  if (end < total - 1) result.push('…')
  result.push(total)
  return result
}

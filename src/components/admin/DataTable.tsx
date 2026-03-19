/**
 * DataTable.tsx — 泛型数据表格（Admin 基础组件库）
 * CHG-24: 支持列渲染、排序回调、loading 骨架屏、空状态
 */

'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// ── 类型 ──────────────────────────────────────────────────────────

export interface Column<T> {
  key: string
  title: string
  /** 自定义单元格渲染 */
  render?: (row: T) => ReactNode
  /** 排序字段（存在时列标题可点击） */
  sortKey?: string
  width?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  isLoading?: boolean
  emptyText?: string
  /** 当前排序字段 */
  sortBy?: string
  /** 排序方向 */
  sortDir?: 'asc' | 'desc'
  /** 点击可排序列标题时回调 */
  onSort?: (key: string) => void
  className?: string
}

// ── 骨架屏行 ──────────────────────────────────────────────────────

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div
            className="h-4 rounded animate-pulse"
            style={{ background: 'var(--bg3)', width: i === 0 ? '60%' : '80%' }}
          />
        </td>
      ))}
    </tr>
  )
}

// ── Component ─────────────────────────────────────────────────────

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  isLoading = false,
  emptyText = '暂无数据',
  sortBy,
  sortDir = 'asc',
  onSort,
  className,
}: DataTableProps<T>) {
  return (
    <div
      className={cn('w-full overflow-x-auto rounded-lg', className)}
      style={{ border: '1px solid var(--border)' }}
      data-testid="data-table"
    >
      <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
        {/* 表头 */}
        <thead>
          <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3 text-left font-medium whitespace-nowrap',
                  col.sortKey && 'cursor-pointer select-none hover:opacity-80'
                )}
                style={{ color: 'var(--muted)', width: col.width }}
                onClick={() => col.sortKey && onSort?.(col.sortKey)}
                data-testid={`th-${col.key}`}
              >
                {col.title}
                {col.sortKey && sortBy === col.sortKey && (
                  <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>

        {/* 表体 */}
        <tbody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} cols={columns.length} />
            ))
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center text-sm"
                style={{ color: 'var(--muted)' }}
                data-testid="table-empty"
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={i}
                style={{ borderBottom: '1px solid var(--subtle, var(--border))' }}
                className="hover:bg-[var(--bg2)] transition-colors"
                data-testid={`table-row-${i}`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="px-4 py-3"
                    style={{ color: 'var(--text)' }}
                    data-testid={`cell-${col.key}-${i}`}
                  >
                    {col.render ? col.render(row) : String(row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

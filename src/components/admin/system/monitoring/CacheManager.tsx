/**
 * CacheManager.tsx — 缓存管理面板（Client Component）
 * CHG-30: 展示各类型缓存统计，支持逐类清除和全部清除（二次确认）
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiClient } from '@/lib/api-client'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { AdminToolbar } from '@/components/admin/shared/toolbar/AdminToolbar'
import { AdminTableFrame } from '@/components/admin/shared/table/AdminTableFrame'
import { AdminTableState } from '@/components/admin/shared/feedback/AdminTableState'
import { useAdminTableColumns, type AdminColumnMeta } from '@/components/admin/shared/table/useAdminTableColumns'
import { useAdminTableSort } from '@/components/admin/shared/table/useAdminTableSort'
import type { CacheStat, CacheType } from '@/api/services/CacheService'
import type { AdminTableState as SharedAdminTableState } from '@/components/admin/shared/table/useAdminTableState'

type CacheColumnId = 'type' | 'count' | 'sizeKb' | 'actions'

const CACHE_COLUMNS: AdminColumnMeta[] = [
  { id: 'type', visible: true, width: 220, minWidth: 160, maxWidth: 320, resizable: true },
  { id: 'count', visible: true, width: 160, minWidth: 120, maxWidth: 240, resizable: true },
  { id: 'sizeKb', visible: true, width: 180, minWidth: 140, maxWidth: 260, resizable: true },
  { id: 'actions', visible: true, width: 140, minWidth: 120, maxWidth: 200, resizable: false },
]

const CACHE_DEFAULT_STATE: Omit<SharedAdminTableState, 'columns'> = {
  sort: { field: 'count', dir: 'desc' },
}

const CACHE_LABELS: Record<CacheColumnId, string> = {
  type: '缓存类型',
  count: 'Key 数量',
  sizeKb: '估算大小',
  actions: '操作',
}

const CACHE_SORTABLE: Record<CacheColumnId, boolean> = {
  type: true,
  count: true,
  sizeKb: true,
  actions: false,
}

function toComparableValue(row: CacheStat, field: string): string | number {
  switch (field) {
    case 'type':
      return row.type
    case 'count':
      return row.count
    case 'sizeKb':
      return row.sizeKb
    default:
      return ''
  }
}

const TYPE_LABELS: Record<string, string> = {
  search: '搜索缓存',
  video: '视频详情缓存',
  danmaku: '弹幕缓存',
  analytics: '统计缓存',
}

export function CacheManager() {
  const [stats, setStats] = useState<CacheStat[]>([])
  const [loading, setLoading] = useState(false)
  const [clearingType, setClearingType] = useState<CacheType | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<CacheType | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [showColumnsPanel, setShowColumnsPanel] = useState(false)

  const columnsState = useAdminTableColumns({
    route: '/admin/system/cache',
    tableId: 'cache-manager-table',
    columns: CACHE_COLUMNS,
    defaultState: CACHE_DEFAULT_STATE,
  })

  const sortState = useAdminTableSort({
    tableState: columnsState,
    columnsById: columnsState.columnsById,
    defaultSort: CACHE_DEFAULT_STATE.sort,
    sortable: CACHE_SORTABLE,
  })

  const visibleColumnIds = useMemo(
    () =>
      columnsState.columns
        .filter((column) => column.visible)
        .map((column) => column.id as CacheColumnId),
    [columnsState.columns],
  )

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.getCacheStats()
      setStats(res.data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  async function handleClear(type: CacheType) {
    setClearingType(type)
    try {
      const res = await apiClient.clearCache(type)
      showToast(`已清除 ${res.data.deleted} 个缓存 key`)
      fetchStats()
    } catch {
      showToast('清除失败，请稍后重试')
    } finally {
      setClearingType(null)
      setConfirmTarget(null)
    }
  }

  const sortedStats = useMemo(() => {
    if (!sortState.sort) return stats
    const next = [...stats]
    next.sort((a, b) => {
      const va = toComparableValue(a, sortState.sort?.field ?? '')
      const vb = toComparableValue(b, sortState.sort?.field ?? '')
      if (va === vb) return 0
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortState.sort?.dir === 'asc' ? va - vb : vb - va
      }
      const sa = String(va)
      const sb = String(vb)
      return sortState.sort?.dir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa)
    })
    return next
  }, [stats, sortState.sort])

  function renderSortIndicator(columnId: CacheColumnId): string {
    if (!sortState.isSortedBy(columnId)) return ''
    return sortState.sort?.dir === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div data-testid="cache-manager">
      {toast && (
        <div
          className="mb-4 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-2 text-sm text-green-400"
          data-testid="cache-toast"
        >
          {toast}
        </div>
      )}

      <AdminToolbar
        className="mb-2 gap-3"
        actions={null}
      />

      {showColumnsPanel && (
        <div className="mb-2 rounded border border-[var(--border)] bg-[var(--bg2)] p-2" data-testid="cache-columns-panel">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs text-[var(--muted)]">显示列</span>
            <button
              type="button"
              className="text-xs text-[var(--muted)] hover:text-[var(--text)]"
              onClick={() => columnsState.resetColumnsMeta()}
              data-testid="cache-columns-reset"
            >
              重置
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {columnsState.columns.map((column) => (
              <label key={column.id} className="flex items-center gap-2 text-xs text-[var(--text)]">
                <input
                  type="checkbox"
                  checked={column.visible}
                  onChange={() => columnsState.toggleColumnVisibility(column.id)}
                  className="accent-[var(--accent)]"
                  data-testid={`cache-column-toggle-${column.id}`}
                />
                {CACHE_LABELS[column.id as CacheColumnId]}
              </label>
            ))}
          </div>
        </div>
      )}

      <AdminTableFrame minWidth={680}>
        <thead className="bg-[var(--bg2)] text-[var(--muted)]">
          <tr>
            {visibleColumnIds.map((columnId) => {
              const meta = columnsState.columnsById[columnId]
              const sortable = sortState.isSortable(columnId)
              const isLastVisible = columnId === visibleColumnIds[visibleColumnIds.length - 1]
              return (
                <th key={columnId} className="relative px-4 py-3 text-left" style={{ width: `${meta.width}px` }}>
                  {sortable ? (
                    <button
                      type="button"
                      className="text-left text-sm hover:text-[var(--text)]"
                      onClick={() => sortState.toggleSort(columnId)}
                      data-testid={`cache-sort-${columnId}`}
                    >
                      {CACHE_LABELS[columnId]}
                      {renderSortIndicator(columnId)}
                    </button>
                  ) : (
                    <span className="text-sm">{CACHE_LABELS[columnId]}</span>
                  )}
                  {isLastVisible && (
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 rounded border border-[var(--border)] bg-[var(--bg3)] px-1.5 py-0.5 text-xs text-[var(--muted)] hover:text-[var(--text)]"
                      onClick={() => setShowColumnsPanel((prev) => !prev)}
                      data-testid="cache-columns-toggle"
                      aria-label="列设置"
                      title="列设置"
                    >
                      ⚙
                    </button>
                  )}
                  {meta.resizable && (
                    <button
                      type="button"
                      aria-label={`${CACHE_LABELS[columnId]}列宽拖拽`}
                      data-testid={`cache-resize-${columnId}`}
                      onMouseDown={(event) => columnsState.startResize(columnId, event.clientX)}
                      className="absolute right-0 top-0 h-full w-2 cursor-col-resize before:absolute before:right-0 before:top-0 before:h-full before:w-px before:bg-[var(--border)] hover:bg-[var(--bg3)]/40"
                    />
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          <AdminTableState
            isLoading={loading}
            isEmpty={!loading && sortedStats.length === 0}
            colSpan={visibleColumnIds.length}
            emptyText="暂无缓存统计"
          />
          {!loading &&
            sortedStats.map((row) => (
              <tr
                key={row.type}
                className="h-[56px] bg-[var(--bg)] hover:bg-[var(--bg2)]"
                style={{ borderBottom: '1px solid var(--subtle, var(--border))' }}
                data-testid={`cache-row-${row.type}`}
              >
                {visibleColumnIds.includes('type') && (
                  <td className="px-4 py-3 align-middle font-medium text-[var(--text)]">
                    {TYPE_LABELS[row.type] ?? row.type}
                  </td>
                )}
                {visibleColumnIds.includes('count') && (
                  <td className="px-4 py-3 align-middle text-[var(--muted)]" data-testid={`cache-count-${row.type}`}>
                    {row.count.toLocaleString()}
                  </td>
                )}
                {visibleColumnIds.includes('sizeKb') && (
                  <td className="px-4 py-3 align-middle text-[var(--muted)]">
                    {row.sizeKb < 1 ? '< 1 KB' : `${row.sizeKb.toLocaleString()} KB`}
                  </td>
                )}
                {visibleColumnIds.includes('actions') && (
                  <td className="px-4 py-3 align-middle">
                    <button
                      onClick={() => setConfirmTarget(row.type)}
                      disabled={clearingType !== null || row.count === 0}
                      className="rounded px-2 py-0.5 text-xs bg-red-600/20 text-red-400 hover:bg-red-600/40 disabled:opacity-40"
                      data-testid={`cache-clear-btn-${row.type}`}
                    >
                      {clearingType === row.type ? '清除中…' : '清除'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
        </tbody>
      </AdminTableFrame>

      <div className="mt-4 flex justify-end">
        <button
          onClick={() => setConfirmTarget('all')}
          disabled={clearingType !== null}
          className="rounded-md px-4 py-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-40"
          data-testid="cache-clear-all-btn"
        >
          清除全部缓存
        </button>
      </div>

      <ConfirmDialog
        open={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        title={confirmTarget === 'all' ? '清除全部缓存' : `清除${TYPE_LABELS[confirmTarget ?? ''] ?? ''}` }
        description={
          confirmTarget === 'all'
            ? '将清除所有业务缓存（搜索、视频、弹幕、统计），不影响 Bull 队列和登录状态。此操作不可撤销。'
            : `确认清除"${TYPE_LABELS[confirmTarget ?? ''] ?? confirmTarget}"的全部缓存 key？`
        }
        confirmText="确认清除"
        onConfirm={() => { if (confirmTarget) handleClear(confirmTarget) }}
        loading={clearingType !== null}
        danger
      />
    </div>
  )
}

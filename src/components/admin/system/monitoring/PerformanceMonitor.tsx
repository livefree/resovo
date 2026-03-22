/**
 * PerformanceMonitor.tsx — 性能监控面板（Client Component）
 * CHG-32: 每 10 秒自动刷新，展示 4 张指标卡片 + 慢请求列表
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiClient } from '@/lib/api-client'
import { AdminToolbar } from '@/components/admin/shared/toolbar/AdminToolbar'
import { AdminTableFrame } from '@/components/admin/shared/table/AdminTableFrame'
import { AdminTableState } from '@/components/admin/shared/feedback/AdminTableState'
import { useAdminTableColumns, type AdminColumnMeta } from '@/components/admin/shared/table/useAdminTableColumns'
import { useAdminTableSort } from '@/components/admin/shared/table/useAdminTableSort'
import type { AdminTableState as SharedAdminTableState } from '@/components/admin/shared/table/useAdminTableState'

interface PerformanceStats {
  requests: { perMinute: number; total24h: number }
  latency: { avgMs: number; p95Ms: number }
  memory: { heapUsedMb: number; heapTotalMb: number; rssMb: number }
  uptime: number
  slowRequests: Array<{
    timestamp: number
    durationMs: number
    method: string
    url: string
    statusCode: number
  }>
}

type SlowRequestRow = PerformanceStats['slowRequests'][number]
type SlowRequestColumnId = 'timestamp' | 'method' | 'url' | 'statusCode' | 'durationMs'

const SLOW_REQUEST_COLUMNS: AdminColumnMeta[] = [
  { id: 'timestamp', visible: true, width: 130, minWidth: 100, maxWidth: 220, resizable: true },
  { id: 'method', visible: true, width: 100, minWidth: 80, maxWidth: 160, resizable: true },
  { id: 'url', visible: true, width: 320, minWidth: 220, maxWidth: 520, resizable: true },
  { id: 'statusCode', visible: true, width: 110, minWidth: 90, maxWidth: 180, resizable: true },
  { id: 'durationMs', visible: true, width: 120, minWidth: 100, maxWidth: 200, resizable: true },
]

const SLOW_REQUEST_DEFAULT_STATE: Omit<SharedAdminTableState, 'columns'> = {
  sort: { field: 'durationMs', dir: 'desc' },
}

const SLOW_REQUEST_LABELS: Record<SlowRequestColumnId, string> = {
  timestamp: '时间',
  method: '方法',
  url: 'URL',
  statusCode: '状态码',
  durationMs: '耗时',
}

const SLOW_REQUEST_SORTABLE: Record<SlowRequestColumnId, boolean> = {
  timestamp: true,
  method: true,
  url: true,
  statusCode: true,
  durationMs: true,
}

function toComparableValue(row: SlowRequestRow, field: string): string | number {
  switch (field) {
    case 'timestamp':
      return row.timestamp
    case 'method':
      return row.method
    case 'url':
      return row.url
    case 'statusCode':
      return row.statusCode
    case 'durationMs':
      return row.durationMs
    default:
      return ''
  }
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      className="rounded-lg border border-[var(--border)] bg-[var(--bg2)] p-4"
      data-testid={`stat-card-${label.replace(/\s+/g, '-').toLowerCase()}`}
    >
      <p className="mb-1 text-xs text-[var(--muted)]">{label}</p>
      <p className="text-2xl font-bold text-[var(--text)]">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[var(--muted)]">{sub}</p>}
    </div>
  )
}

export function PerformanceMonitor() {
  const [stats, setStats] = useState<PerformanceStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [showColumnsPanel, setShowColumnsPanel] = useState(false)

  const columnsState = useAdminTableColumns({
    route: '/admin/system/monitor',
    tableId: 'performance-slow-request-table',
    columns: SLOW_REQUEST_COLUMNS,
    defaultState: SLOW_REQUEST_DEFAULT_STATE,
  })

  const sortState = useAdminTableSort({
    tableState: columnsState,
    columnsById: columnsState.columnsById,
    defaultSort: SLOW_REQUEST_DEFAULT_STATE.sort,
    sortable: SLOW_REQUEST_SORTABLE,
  })

  const visibleColumnIds = useMemo(
    () =>
      columnsState.columns
        .filter((column) => column.visible)
        .map((column) => column.id as SlowRequestColumnId),
    [columnsState.columns],
  )

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<{ data: PerformanceStats }>('/admin/performance/stats')
      setStats(res.data)
      setLastUpdated(new Date())
    } catch {
      // silent — keep showing old data
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    const timer = setInterval(fetchStats, 10_000)
    return () => clearInterval(timer)
  }, [fetchStats])

  const sortedSlowRequests = useMemo(() => {
    const source = stats?.slowRequests ?? []
    if (!sortState.sort) return source
    const next = [...source]
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
  }, [stats?.slowRequests, sortState.sort])

  function renderSortIndicator(columnId: SlowRequestColumnId): string {
    if (!sortState.isSortedBy(columnId)) return ''
    return sortState.sort?.dir === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div data-testid="performance-monitor">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-[var(--muted)]">
          {lastUpdated ? `上次更新：${lastUpdated.toLocaleTimeString()}` : '加载中…'}
          {loading && ' · 刷新中…'}
        </p>
        <span className="text-xs text-[var(--muted)]">每 10 秒自动刷新</span>
      </div>

      {/* 4 张指标卡片 */}
      {stats && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="请求/分钟"
              value={stats.requests.perMinute.toString()}
              sub={`24h: ${stats.requests.total24h.toLocaleString()}`}
            />
            <StatCard
              label="平均响应时间"
              value={`${stats.latency.avgMs} ms`}
              sub={`P95: ${stats.latency.p95Ms} ms`}
            />
            <StatCard
              label="堆内存占用"
              value={`${stats.memory.heapUsedMb} MB`}
              sub={`总: ${stats.memory.heapTotalMb} MB / RSS: ${stats.memory.rssMb} MB`}
            />
            <StatCard
              label="运行时长"
              value={formatUptime(stats.uptime)}
            />
          </div>

          {/* 慢请求列表（>500ms）*/}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">
              最近慢请求（&gt;500ms）
            </h2>
            <AdminToolbar
              className="mb-2 gap-3"
              actions={(
                <button
                  type="button"
                  className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--text)]"
                  onClick={() => setShowColumnsPanel((prev) => !prev)}
                  data-testid="slow-request-columns-toggle"
                >
                  列设置
                </button>
              )}
            />
            {showColumnsPanel && (
              <div className="mb-2 rounded border border-[var(--border)] bg-[var(--bg2)] p-2" data-testid="slow-request-columns-panel">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs text-[var(--muted)]">显示列</span>
                  <button
                    type="button"
                    className="text-xs text-[var(--muted)] hover:text-[var(--text)]"
                    onClick={() => columnsState.resetColumnsMeta()}
                    data-testid="slow-request-columns-reset"
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
                        data-testid={`slow-request-column-toggle-${column.id}`}
                      />
                      {SLOW_REQUEST_LABELS[column.id as SlowRequestColumnId]}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <AdminTableFrame minWidth={860}>
              <thead className="bg-[var(--bg2)] text-[var(--muted)]">
                <tr>
                  {visibleColumnIds.map((columnId) => {
                    const meta = columnsState.columnsById[columnId]
                    return (
                      <th key={columnId} className="relative px-3 py-2 text-left text-xs" style={{ width: `${meta.width}px` }}>
                        <button
                          type="button"
                          className="text-left hover:text-[var(--text)]"
                          onClick={() => sortState.toggleSort(columnId)}
                          data-testid={`slow-request-sort-${columnId}`}
                        >
                          {SLOW_REQUEST_LABELS[columnId]}
                          {renderSortIndicator(columnId)}
                        </button>
                        {meta.resizable && (
                          <button
                            type="button"
                            aria-label={`${SLOW_REQUEST_LABELS[columnId]}列宽拖拽`}
                            data-testid={`slow-request-resize-${columnId}`}
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
                  isLoading={false}
                  isEmpty={sortedSlowRequests.length === 0}
                  colSpan={visibleColumnIds.length}
                  emptyText="暂无慢请求"
                />
                {sortedSlowRequests.map((req, i) => (
                  <tr
                    key={`${req.timestamp}-${req.url}-${i}`}
                    className="h-[52px] bg-[var(--bg)] hover:bg-[var(--bg2)]"
                    style={{ borderBottom: '1px solid var(--subtle, var(--border))' }}
                    data-testid={`slow-request-row-${i}`}
                  >
                    {visibleColumnIds.includes('timestamp') && (
                      <td className="px-3 py-2 align-middle text-[var(--muted)]">
                        {new Date(req.timestamp).toLocaleTimeString()}
                      </td>
                    )}
                    {visibleColumnIds.includes('method') && (
                      <td className="px-3 py-2 align-middle font-mono text-[var(--text)]">{req.method}</td>
                    )}
                    {visibleColumnIds.includes('url') && (
                      <td className="px-3 py-2 align-middle font-mono text-[var(--muted)]">
                        <span className="inline-block max-w-[320px] truncate" title={req.url}>
                          {req.url}
                        </span>
                      </td>
                    )}
                    {visibleColumnIds.includes('statusCode') && (
                      <td className="px-3 py-2 align-middle text-[var(--muted)]">{req.statusCode}</td>
                    )}
                    {visibleColumnIds.includes('durationMs') && (
                      <td className="px-3 py-2 align-middle font-medium text-yellow-400">{req.durationMs} ms</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </AdminTableFrame>
          </div>
        </>
      )}
    </div>
  )
}

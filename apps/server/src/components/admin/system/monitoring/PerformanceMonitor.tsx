/**
 * PerformanceMonitor.tsx — 性能监控面板（Client Component）
 * CHG-32: 每 10 秒自动刷新，展示 4 张指标卡片 + 慢请求列表
 * CHG-311: AdminTableFrame → ModernDataTable + useTableSettings + settingsSlot；客户端排序保留
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiClient } from '@/lib/api-client'
import { AdminToolbar } from '@/components/admin/shared/toolbar/AdminToolbar'
import { ModernDataTable } from '@/components/admin/shared/modern-table/ModernDataTable'
import type { TableColumn, TableSortState } from '@/components/admin/shared/modern-table/types'
import { useTableSettings } from '@/components/admin/shared/modern-table/settings'

// ── 类型 ─────────────────────────────────────────────────────────────────────

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

// ── 列标签与设置描述 ──────────────────────────────────────────────────────────

const SLOW_REQUEST_LABELS: Record<SlowRequestColumnId, string> = {
  timestamp:  '时间',
  method:     '方法',
  url:        'URL',
  statusCode: '状态码',
  durationMs: '耗时',
}

const SLOW_REQUEST_SETTINGS_COLUMNS = [
  { id: 'timestamp',  label: SLOW_REQUEST_LABELS.timestamp,  defaultVisible: true, defaultSortable: true },
  { id: 'method',     label: SLOW_REQUEST_LABELS.method,     defaultVisible: true, defaultSortable: true },
  { id: 'url',        label: SLOW_REQUEST_LABELS.url,        defaultVisible: true, defaultSortable: true },
  { id: 'statusCode', label: SLOW_REQUEST_LABELS.statusCode, defaultVisible: true, defaultSortable: true },
  { id: 'durationMs', label: SLOW_REQUEST_LABELS.durationMs, defaultVisible: true, defaultSortable: true },
]

// ── 客户端排序辅助 ────────────────────────────────────────────────────────────

function toComparableValue(row: SlowRequestRow, field: string): string | number {
  switch (field) {
    case 'timestamp':  return row.timestamp
    case 'method':     return row.method
    case 'url':        return row.url
    case 'statusCode': return row.statusCode
    case 'durationMs': return row.durationMs
    default:           return ''
  }
}

// ── 辅助组件 ─────────────────────────────────────────────────────────────────

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

// ── 组件 ─────────────────────────────────────────────────────────────────────

export function PerformanceMonitor() {
  const [stats, setStats] = useState<PerformanceStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [sort, setSort] = useState<TableSortState>({ field: 'durationMs', direction: 'desc' })

  const tableSettings = useTableSettings({
    tableId: 'performance-slow-request-table',
    columns: SLOW_REQUEST_SETTINGS_COLUMNS,
  })

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
    const next = [...source]
    next.sort((a, b) => {
      const va = toComparableValue(a, sort.field)
      const vb = toComparableValue(b, sort.field)
      if (va === vb) return 0
      if (typeof va === 'number' && typeof vb === 'number') {
        return sort.direction === 'asc' ? va - vb : vb - va
      }
      return sort.direction === 'asc'
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va))
    })
    return next
  }, [stats?.slowRequests, sort])

  const allTableColumns = useMemo<TableColumn<SlowRequestRow>[]>(() => [
    {
      id: 'timestamp',
      header: SLOW_REQUEST_LABELS.timestamp,
      accessor: (row) => row.timestamp,
      width: 130, minWidth: 100, enableResizing: true, enableSorting: true,
      cell: ({ row }) => (
        <span className="text-[var(--muted)]">
          {new Date(row.timestamp).toLocaleTimeString()}
        </span>
      ),
    },
    {
      id: 'method',
      header: SLOW_REQUEST_LABELS.method,
      accessor: (row) => row.method,
      width: 100, minWidth: 80, enableResizing: true, enableSorting: true,
      cell: ({ row }) => (
        <span className="font-mono text-[var(--text)]">{row.method}</span>
      ),
    },
    {
      id: 'url',
      header: SLOW_REQUEST_LABELS.url,
      accessor: (row) => row.url,
      width: 320, minWidth: 220, enableResizing: true, enableSorting: true,
      cell: ({ row }) => (
        <span className="inline-block max-w-[320px] truncate font-mono text-[var(--muted)]" title={row.url}>
          {row.url}
        </span>
      ),
    },
    {
      id: 'statusCode',
      header: SLOW_REQUEST_LABELS.statusCode,
      accessor: (row) => row.statusCode,
      width: 110, minWidth: 90, enableResizing: true, enableSorting: true,
      cell: ({ row }) => (
        <span className="text-[var(--muted)]">{row.statusCode}</span>
      ),
    },
    {
      id: 'durationMs',
      header: SLOW_REQUEST_LABELS.durationMs,
      accessor: (row) => row.durationMs,
      width: 120, minWidth: 100, enableResizing: true, enableSorting: true,
      cell: ({ row }) => (
        <span className="font-medium text-yellow-400">{row.durationMs} ms</span>
      ),
    },
  ], [])

  const tableColumns = useMemo(
    () => tableSettings.applyToColumns(allTableColumns),
    [tableSettings, allTableColumns],
  )

  return (
    <div data-testid="performance-monitor">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-[var(--muted)]">
          {lastUpdated ? `上次更新：${lastUpdated.toLocaleTimeString()}` : '加载中…'}
          {loading && ' · 刷新中…'}
        </p>
        <span className="text-xs text-[var(--muted)]">每 10 秒自动刷新</span>
      </div>

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

          <div>
            <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">
              最近慢请求（&gt;500ms）
            </h2>
            <AdminToolbar
              className="mb-2 gap-3"
              actions={null}
            />
            <ModernDataTable
              columns={tableColumns}
              rows={sortedSlowRequests}
              sort={sort}
              onSortChange={setSort}
              loading={false}
              emptyText="暂无慢请求"
              scrollTestId="perf-slow-request-table-scroll"
              getRowId={(_, rowIndex) => String(rowIndex)}
              settingsSlot={{
                settingsColumns: tableSettings.orderedSettings,
                onSettingsChange: tableSettings.updateSetting,
                onSettingsReset: tableSettings.reset,
              }}
            />
          </div>
        </>
      )}
    </div>
  )
}

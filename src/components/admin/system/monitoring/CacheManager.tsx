/**
 * CacheManager.tsx — 缓存管理面板（Client Component）
 * CHG-30: 展示各类型缓存统计，支持逐类清除和全部清除（二次确认）
 * CHG-310: AdminTableFrame → ModernDataTable + useTableSettings + settingsSlot；客户端排序保留
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiClient } from '@/lib/api-client'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { AdminToolbar } from '@/components/admin/shared/toolbar/AdminToolbar'
import { ModernDataTable } from '@/components/admin/shared/modern-table/ModernDataTable'
import type { TableColumn, TableSortState } from '@/components/admin/shared/modern-table/types'
import { useTableSettings } from '@/components/admin/shared/modern-table/settings'
import type { CacheStat, CacheType } from '@/types/contracts/v1/admin'

// ── 列标签与设置描述 ──────────────────────────────────────────────────────────

type CacheColumnId = 'type' | 'count' | 'sizeKb' | 'actions'

const CACHE_LABELS: Record<CacheColumnId, string> = {
  type:    '缓存类型',
  count:   'Key 数量',
  sizeKb:  '估算大小',
  actions: '操作',
}

const TYPE_LABELS: Record<string, string> = {
  search:    '搜索缓存',
  video:     '视频详情缓存',
  danmaku:   '弹幕缓存',
  analytics: '统计缓存',
}

const CACHE_SETTINGS_COLUMNS = [
  { id: 'type',    label: CACHE_LABELS.type,    defaultVisible: true, defaultSortable: true  },
  { id: 'count',   label: CACHE_LABELS.count,   defaultVisible: true, defaultSortable: true  },
  { id: 'sizeKb',  label: CACHE_LABELS.sizeKb,  defaultVisible: true, defaultSortable: true  },
  { id: 'actions', label: CACHE_LABELS.actions, defaultVisible: true, defaultSortable: false, required: true },
]

// ── 客户端排序辅助 ────────────────────────────────────────────────────────────

function toComparableValue(row: CacheStat, field: string): string | number {
  switch (field) {
    case 'type':   return row.type
    case 'count':  return row.count
    case 'sizeKb': return row.sizeKb
    default:       return ''
  }
}

// ── 组件 ─────────────────────────────────────────────────────────────────────

export function CacheManager() {
  const [stats, setStats] = useState<CacheStat[]>([])
  const [loading, setLoading] = useState(false)
  const [clearingType, setClearingType] = useState<CacheType | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<CacheType | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [sort, setSort] = useState<TableSortState>({ field: 'count', direction: 'desc' })

  const tableSettings = useTableSettings({
    tableId: 'cache-manager-table',
    columns: CACHE_SETTINGS_COLUMNS,
  })

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
    const next = [...stats]
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
  }, [stats, sort])

  const allTableColumns = useMemo<TableColumn<CacheStat>[]>(() => [
    {
      id: 'type',
      header: CACHE_LABELS.type,
      accessor: (row) => row.type,
      width: 220, minWidth: 160, enableResizing: true, enableSorting: true,
      cell: ({ row }) => (
        <span className="font-medium text-[var(--text)]">
          {TYPE_LABELS[row.type] ?? row.type}
        </span>
      ),
    },
    {
      id: 'count',
      header: CACHE_LABELS.count,
      accessor: (row) => row.count,
      width: 160, minWidth: 120, enableResizing: true, enableSorting: true,
      cell: ({ row }) => (
        <span className="text-[var(--muted)]" data-testid={`cache-count-${row.type}`}>
          {row.count.toLocaleString()}
        </span>
      ),
    },
    {
      id: 'sizeKb',
      header: CACHE_LABELS.sizeKb,
      accessor: (row) => row.sizeKb,
      width: 180, minWidth: 140, enableResizing: true, enableSorting: true,
      cell: ({ row }) => (
        <span className="text-[var(--muted)]">
          {row.sizeKb < 1 ? '< 1 KB' : `${row.sizeKb.toLocaleString()} KB`}
        </span>
      ),
    },
    {
      id: 'actions',
      header: CACHE_LABELS.actions,
      accessor: (row) => row.type,
      width: 140, minWidth: 120, enableResizing: false, enableSorting: false,
      cell: ({ row }) => (
        <button
          onClick={() => setConfirmTarget(row.type)}
          disabled={clearingType !== null || row.count === 0}
          className="rounded px-2 py-0.5 text-xs bg-red-600/20 text-red-400 hover:bg-red-600/40 disabled:opacity-40"
          data-testid={`cache-clear-btn-${row.type}`}
        >
          {clearingType === row.type ? '清除中…' : '清除'}
        </button>
      ),
    },
  ], [clearingType])

  const tableColumns = useMemo(
    () => tableSettings.applyToColumns(allTableColumns),
    [tableSettings, allTableColumns],
  )

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

      <ModernDataTable
        columns={tableColumns}
        rows={sortedStats}
        sort={sort}
        onSortChange={setSort}
        loading={loading}
        emptyText="暂无缓存统计"
        scrollTestId="cache-manager-table-scroll"
        getRowId={(row) => row.type}
        settingsSlot={{
          settingsColumns: tableSettings.orderedSettings,
          onSettingsChange: tableSettings.updateSetting,
          onSettingsReset: tableSettings.reset,
        }}
      />

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
        title={confirmTarget === 'all' ? '清除全部缓存' : `清除${TYPE_LABELS[confirmTarget ?? ''] ?? ''}`}
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

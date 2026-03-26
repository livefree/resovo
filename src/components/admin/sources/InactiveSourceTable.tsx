/**
 * InactiveSourceTable.tsx — Tab 1 失效源表格（CHG-229）
 * 使用 ModernDataTable + Cell 组件库
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiClient } from '@/lib/api-client'
import { Pagination } from '@/components/admin/Pagination'
import { SourceVerifyButton } from '@/components/admin/sources/SourceVerifyButton'
import { SourceUrlReplaceModal } from '@/components/admin/sources/SourceUrlReplaceModal'
import { BatchDeleteBar } from '@/components/admin/sources/BatchDeleteBar'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { ModernDataTable } from '@/components/admin/shared/modern-table/ModernDataTable'
import {
  TableBadgeCell,
  TableDateCell,
  TableTextCell,
  TableUrlCell,
} from '@/components/admin/shared/modern-table/cells'
import type { TableColumn } from '@/components/admin/shared/modern-table/types'

const PAGE_SIZE = 20

export interface SourceRow {
  id: string
  video_id: string
  source_url: string
  source_name: string
  quality: string | null
  type: string
  is_active: boolean
  season_number?: number
  episode_number?: number
  last_checked: string | null
  created_at: string
  video_title?: string
}

function buildColumns(
  page: number,
  onReplace: (row: SourceRow) => void,
  onDelete: (row: SourceRow) => void,
  onVerified: (page: number) => void,
): TableColumn<SourceRow>[] {
  return [
    {
      id: 'video_title', header: '视频标题', width: 220, minWidth: 160,
      accessor: (r) => r.video_title ?? '—',
      cell: ({ row }) => <TableTextCell value={row.video_title ?? '—'} />,
    },
    {
      id: 'coordinate', header: 'S/E', width: 110, minWidth: 90,
      accessor: (r) => `S${r.season_number ?? 1}/E${r.episode_number ?? 1}`,
      cell: ({ row }) => (
        <TableTextCell value={`S${row.season_number ?? 1} / E${row.episode_number ?? 1}`} className="text-xs text-[var(--muted)]" />
      ),
    },
    {
      id: 'source_url', header: '源 URL', width: 340, minWidth: 220,
      accessor: (r) => r.source_url,
      cell: ({ row }) => <TableUrlCell url={row.source_url} maxLength={60} />,
    },
    {
      id: 'status', header: '状态', width: 120, minWidth: 100,
      accessor: (r) => r.is_active ? '活跃' : '失效',
      cell: ({ row }) => (
        <TableBadgeCell label={row.is_active ? '活跃' : '失效'} tone={row.is_active ? 'success' : 'danger'} />
      ),
    },
    {
      id: 'last_checked', header: '最后验证', width: 170, minWidth: 130,
      accessor: (r) => r.last_checked ?? '',
      cell: ({ row }) => <TableDateCell value={row.last_checked} fallback="—" className="text-xs" />,
    },
    {
      id: 'actions', header: '操作', width: 180, minWidth: 150, enableResizing: false,
      accessor: (r) => r.id,
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-1">
          <SourceVerifyButton sourceId={row.id} onVerified={() => onVerified(page)} />
          <button type="button" onClick={() => onReplace(row)}
            className="rounded bg-[var(--bg3)] px-2 py-0.5 text-xs text-[var(--muted)] hover:text-[var(--text)]"
            data-testid={`source-replace-btn-${row.id}`}
          >替换URL</button>
          <button type="button" onClick={() => onDelete(row)}
            className="rounded bg-red-900/30 px-2 py-0.5 text-xs text-red-400 hover:bg-red-900/60"
            data-testid={`source-delete-btn-${row.id}`}
          >删除</button>
        </div>
      ),
    },
  ]
}

export function InactiveSourceTable() {
  const [sources, setSources] = useState<SourceRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deleteTarget, setDeleteTarget] = useState<SourceRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [replaceTarget, setReplaceTarget] = useState<SourceRow | null>(null)

  const fetchSources = useCallback(async (pageVal: number) => {
    setLoading(true)
    setSelectedIds([])
    try {
      const params = new URLSearchParams({ page: String(pageVal), limit: String(PAGE_SIZE), status: 'inactive' })
      const res = await apiClient.get<{ data: SourceRow[]; total: number }>(`/admin/sources?${params}`)
      setSources(res.data)
      setTotal(res.total)
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { void fetchSources(page) }, [fetchSources, page])

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await apiClient.delete(`/admin/sources/${deleteTarget.id}`)
      void fetchSources(page)
      setDeleteTarget(null)
    } catch { /* silent */ } finally { setDeleteLoading(false) }
  }, [deleteTarget, fetchSources, page])

  const tableColumns = useMemo(
    () => buildColumns(page, setReplaceTarget, setDeleteTarget, fetchSources),
    [page, fetchSources]
  )

  return (
    <div className="space-y-2">
      <ModernDataTable
        columns={tableColumns}
        rows={sources}
        loading={loading}
        emptyText="暂无失效源"
        getRowId={(r) => r.id}
        scrollTestId="inactive-source-table-scroll"
      />

      {total > PAGE_SIZE ? (
        <div className="mt-4">
          <Pagination page={page} total={total} pageSize={PAGE_SIZE}
            onChange={(p) => { setPage(p); void fetchSources(p) }}
          />
        </div>
      ) : null}

      <BatchDeleteBar selectedIds={selectedIds} onSuccess={() => void fetchSources(page)} onClear={() => setSelectedIds([])} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => { if (!deleteLoading) setDeleteTarget(null) }}
        title="确认删除播放源"
        description={deleteTarget ? `确定要删除播放源「${deleteTarget.source_name || deleteTarget.source_url}」吗？此操作不可撤销。` : '确定要删除该播放源吗？此操作不可撤销。'}
        confirmText="删除"
        onConfirm={handleDelete}
        loading={deleteLoading}
        danger
      />

      <SourceUrlReplaceModal
        sourceId={replaceTarget?.id ?? null}
        currentUrl={replaceTarget?.source_url ?? ''}
        open={replaceTarget !== null}
        onClose={() => setReplaceTarget(null)}
        onSuccess={() => void fetchSources(page)}
      />
    </div>
  )
}

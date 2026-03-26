/**
 * SubmissionTable.tsx — Tab 2 用户纠错表格（CHG-229）
 * 使用 ModernDataTable + Cell 组件库
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiClient } from '@/lib/api-client'
import { Pagination } from '@/components/admin/Pagination'
import { ModernDataTable } from '@/components/admin/shared/modern-table/ModernDataTable'
import { TableDateCell, TableTextCell, TableUrlCell } from '@/components/admin/shared/modern-table/cells'
import type { TableColumn } from '@/components/admin/shared/modern-table/types'

const PAGE_SIZE = 20

interface SubmissionRow {
  id: string
  video_id: string
  source_url: string
  source_name: string
  is_active: boolean
  submitted_by_username?: string | null
  created_at: string
  video_title?: string
}

function buildColumns(
  onApprove: (id: string) => Promise<void>,
  onReject: (id: string) => Promise<void>,
): TableColumn<SubmissionRow>[] {
  return [
    {
      id: 'video_title', header: '视频标题', width: 220, minWidth: 160,
      accessor: (r) => r.video_title ?? '—',
      cell: ({ row }) => <TableTextCell value={row.video_title ?? '—'} />,
    },
    {
      id: 'source_url', header: '来源 URL', width: 340, minWidth: 220,
      accessor: (r) => r.source_url,
      cell: ({ row }) => <TableUrlCell url={row.source_url} maxLength={60} />,
    },
    {
      id: 'submitted_by', header: '提交者', width: 120, minWidth: 100,
      accessor: (r) => r.submitted_by_username ?? '匿名',
      cell: ({ row }) => <TableTextCell value={row.submitted_by_username ?? '匿名'} className="text-[var(--muted)]" />,
    },
    {
      id: 'created_at', header: '提交时间', width: 160, minWidth: 130,
      accessor: (r) => r.created_at,
      cell: ({ row }) => <TableDateCell value={row.created_at} className="text-xs" />,
    },
    {
      id: 'actions', header: '操作', width: 130, minWidth: 110, enableResizing: false,
      accessor: (r) => r.id,
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button type="button" onClick={() => void onApprove(row.id)}
            className="rounded border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs text-green-300"
            data-testid={`submission-approve-btn-${row.id}`}
          >采纳</button>
          <button type="button" onClick={() => void onReject(row.id)}
            className="rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs text-red-300"
            data-testid={`submission-reject-btn-${row.id}`}
          >忽略</button>
        </div>
      ),
    },
  ]
}

export function SubmissionTable() {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const fetchSubmissions = useCallback(async (pageVal: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(pageVal), limit: String(PAGE_SIZE) })
      const res = await apiClient.get<{ data: SubmissionRow[]; total: number }>(`/admin/submissions?${params}`)
      setSubmissions(res.data)
      setTotal(res.total)
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { void fetchSubmissions(page) }, [fetchSubmissions, page])

  const handleApprove = useCallback(async (id: string) => {
    try {
      await apiClient.post(`/admin/submissions/${id}/approve`)
      void fetchSubmissions(page)
    } catch { /* silent */ }
  }, [fetchSubmissions, page])

  const handleReject = useCallback(async (id: string) => {
    try {
      await apiClient.post(`/admin/submissions/${id}/reject`, {})
      void fetchSubmissions(page)
    } catch { /* silent */ }
  }, [fetchSubmissions, page])

  const tableColumns = useMemo(
    () => buildColumns(handleApprove, handleReject),
    [handleApprove, handleReject]
  )

  return (
    <div className="space-y-2">
      <ModernDataTable
        columns={tableColumns}
        rows={submissions}
        loading={loading}
        emptyText="暂无用户纠错数据"
        getRowId={(r) => r.id}
        scrollTestId="submission-table-scroll"
      />
      {total > PAGE_SIZE ? (
        <div className="mt-4">
          <Pagination page={page} total={total} pageSize={PAGE_SIZE}
            onChange={(p) => { setPage(p); void fetchSubmissions(p) }}
          />
        </div>
      ) : null}
    </div>
  )
}

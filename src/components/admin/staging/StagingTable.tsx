/**
 * StagingTable.tsx — 暂存队列表格（Client Component）
 * ADMIN-09: ModernDataTable + 就绪状态 + 行级操作
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { ModernDataTable } from '@/components/admin/shared/modern-table/ModernDataTable'
import { PaginationV2 } from '@/components/admin/PaginationV2'
import { SelectionActionBar } from '@/components/admin/shared/batch/SelectionActionBar'
import { AdminDropdown } from '@/components/admin/shared/dropdown/AdminDropdown'
import {
  StagingReadinessBadge,
  DoubanStatusBadge,
  SourceHealthBadge,
} from '@/components/admin/staging/StagingReadinessBadge'
import type { TableColumn } from '@/components/admin/shared/modern-table/types'

// ── 类型 ─────────────────────────────────────────────────────────

interface StagingRules {
  minMetaScore: number
  requireDoubanMatched: boolean
  requireCoverUrl: boolean
  minActiveSourceCount: number
}

interface ReadinessResult {
  ready: boolean
  blockers: string[]
}

interface StagingRow {
  id: string
  shortId: string
  slug: string | null
  title: string
  titleEn: string | null
  coverUrl: string | null
  type: string
  year: number | null
  doubanStatus: 'pending' | 'matched' | 'candidate' | 'unmatched'
  sourceCheckStatus: 'pending' | 'ok' | 'partial' | 'all_dead'
  metaScore: number
  activeSourceCount: number
  approvedAt: string | null
  updatedAt: string
  readiness: ReadinessResult
}

interface StagingTableProps {
  rules: StagingRules
}

// ── 工具 ─────────────────────────────────────────────────────────

function formatStagingDuration(approvedAt: string | null): string {
  if (!approvedAt) return '—'
  const ms = Date.now() - new Date(approvedAt).getTime()
  const minutes = Math.floor(ms / 60000)
  if (minutes < 60) return `${minutes}分钟`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时`
  return `${Math.floor(hours / 24)}天`
}

// ── 组件 ─────────────────────────────────────────────────────────

export function StagingTable({ rules }: StagingTableProps) {
  const router = useRouter()
  const [rows, setRows] = useState<StagingRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [publishingIds, setPublishingIds] = useState<string[]>([])
  const [refreshKey, setRefreshKey] = useState(0)

  const pageSize = 20

  const fetchData = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await apiClient.get<{
        data: StagingRow[]
        total: number
        rules: StagingRules
      }>(`/admin/staging?page=${page}&limit=${pageSize}`)
      setRows(res.data)
      setTotal(res.total)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载失败，请刷新重试'
      setFetchError(msg)
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void fetchData() }, [fetchData])

  async function handlePublishSingle(id: string) {
    setPublishingIds((prev) => [...prev, id])
    try {
      await apiClient.post(`/admin/staging/${id}/publish`)
      setRefreshKey((k) => k + 1)
    } catch {
      // 发布失败不需要提示，刷新后状态会更新
    } finally {
      setPublishingIds((prev) => prev.filter((x) => x !== id))
    }
  }

  async function handleBatchPublish() {
    setLoading(true)
    try {
      await apiClient.post('/admin/staging/batch-publish')
      setSelectedIds([])
      setRefreshKey((k) => k + 1)
    } finally {
      setLoading(false)
    }
  }

  const columns: TableColumn<StagingRow>[] = useMemo(() => [
    {
      id: 'title',
      header: '视频标题',
      accessor: (r) => r.title,
      width: 240,
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-sm text-[var(--text)] truncate" title={row.title}>{row.title}</span>
          {row.titleEn && (
            <span className="text-xs text-[var(--muted)] truncate" title={row.titleEn}>{row.titleEn}</span>
          )}
        </div>
      ),
    },
    {
      id: 'type',
      header: '类型',
      accessor: (r) => r.type,
      width: 80,
      cell: ({ row }) => (
        <span className="text-xs text-[var(--muted)]">{row.type}</span>
      ),
    },
    {
      id: 'metaScore',
      header: '元数据',
      accessor: (r) => r.metaScore,
      width: 100,
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-12 rounded-full bg-[var(--bg3)] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${row.metaScore}%`,
                backgroundColor: row.metaScore >= 60 ? 'var(--accent)' : row.metaScore >= 40 ? 'var(--status-warning)' : 'var(--status-danger)',
              }}
            />
          </div>
          <span className="text-xs text-[var(--muted)]">{row.metaScore}</span>
        </div>
      ),
    },
    {
      id: 'doubanStatus',
      header: '豆瓣',
      accessor: (r) => r.doubanStatus,
      width: 90,
      cell: ({ row }) => <DoubanStatusBadge status={row.doubanStatus} />,
    },
    {
      id: 'sourceHealth',
      header: '源健康',
      accessor: (r) => r.sourceCheckStatus,
      width: 100,
      cell: ({ row }) => (
        <SourceHealthBadge
          status={row.sourceCheckStatus}
          activeCount={row.activeSourceCount}
        />
      ),
    },
    {
      id: 'stagingDuration',
      header: '暂存时长',
      accessor: (r) => r.approvedAt,
      width: 90,
      cell: ({ row }) => (
        <span className="text-xs text-[var(--muted)]">{formatStagingDuration(row.approvedAt)}</span>
      ),
    },
    {
      id: 'readiness',
      header: '就绪状态',
      accessor: (r) => r.readiness.ready,
      width: 100,
      cell: ({ row }) => (
        <StagingReadinessBadge
          ready={row.readiness.ready}
          blockers={row.readiness.blockers}
        />
      ),
    },
    {
      id: 'actions',
      header: '',
      accessor: (r) => r.id,
      width: 80,
      overflowVisible: true,
      cell: ({ row }) => (
        <AdminDropdown
          align="right"
          data-testid={`staging-action-${row.id}`}
          trigger={
            <button
              type="button"
              className="rounded px-2 py-1 text-xs text-[var(--muted)] hover:bg-[var(--bg3)] hover:text-[var(--text)]"
            >
              操作 ▾
            </button>
          }
          items={[
            {
              key: 'publish',
              label: publishingIds.includes(row.id) ? '发布中…' : '立即发布',
              disabled: publishingIds.includes(row.id),
              onClick: () => void handlePublishSingle(row.id),
            },
            {
              key: 'edit',
              label: '编辑元数据',
              onClick: () => router.push(`/admin/videos?edit=${row.id}`),
            },
          ]}
        />
      ),
    },
  ], [publishingIds, router]) // eslint-disable-line react-hooks/exhaustive-deps

  const readyCount = rows.filter((r) => r.readiness.ready).length

  return (
    <div className="flex flex-col gap-4" data-testid="staging-table-container">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--muted)]">
            共 <strong className="text-[var(--text)]">{total}</strong> 条暂存
            {readyCount > 0 && (
              <>，<strong className="text-green-400">{readyCount}</strong> 条就绪</>
            )}
          </span>
        </div>
        <button
          type="button"
          onClick={handleBatchPublish}
          disabled={loading || readyCount === 0}
          className="rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-black hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid="batch-publish-btn"
        >
          一键发布全部就绪（{readyCount}）
        </button>
      </div>

      {/* 错误提示 */}
      {fetchError && (
        <div
          className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400"
          data-testid="staging-table-error"
        >
          加载暂存队列失败：{fetchError}（请确认后端服务已重启且 migrations 已执行）
        </div>
      )}

      {/* 表格 */}
      <ModernDataTable
        columns={columns}
        rows={rows}
        loading={loading}
        loadingText="加载暂存视频…"
        emptyText="暂无暂存视频"
        getRowId={(row) => row.id}
        scrollTestId="staging-table-scroll"
      />

      {/* 批量操作栏 */}
      {selectedIds.length > 0 && (
        <SelectionActionBar
          selectedCount={selectedIds.length}
          variant="sticky-bottom"
          actions={[
            {
              key: 'publish-selected',
              label: `发布选中 (${selectedIds.length})`,
              variant: 'primary',
              onClick: () => {
                void Promise.all(selectedIds.map((id) => handlePublishSingle(id))).then(() => {
                  setSelectedIds([])
                })
              },
            },
            {
              key: 'clear',
              label: '取消选择',
              onClick: () => setSelectedIds([]),
            },
          ]}
        />
      )}

      {/* 分页 */}
      {total > pageSize && (
        <PaginationV2
          page={page}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}

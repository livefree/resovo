/**
 * StagingTable.tsx — 暂存队列表格（Client Component）
 * ADMIN-09: ModernDataTable + 就绪状态 + 行级操作
 * ADMIN-10: 批量豆瓣同步 + [处理]按钮打开侧滑面板
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
import { StagingEditPanel } from '@/components/admin/staging/StagingEditPanel'
import { notify } from '@/components/admin/shared/toast/useAdminToast'
import type { TableColumn } from '@/components/admin/shared/modern-table/types'

// ── 常量 ─────────────────────────────────────────────────────────

const VIDEO_TYPES = ['movie', 'series', 'anime', 'variety', 'documentary', 'short', 'sports', 'music', 'news', 'kids', 'other'] as const
const VIDEO_TYPE_LABELS: Record<string, string> = {
  movie: '电影', series: '剧集', anime: '动画', variety: '综艺',
  documentary: '纪录片', short: '短剧', sports: '体育', music: '音乐',
  news: '新闻', kids: '儿童', other: '其他',
}

type ReadinessFilter = 'all' | 'ready' | 'warning' | 'blocked'

const READINESS_LABELS: Record<ReadinessFilter, string> = {
  all: '全部', ready: '就绪', warning: '警告', blocked: '阻塞',
}

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

interface StagingSummary {
  all: number
  ready: number
  warning: number
  blocked: number
  siteKeys: string[]
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
  /** 当前用户是否为 admin（控制 adminOnly 操作的可见性） */
  isAdmin: boolean
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

export function StagingTable({ rules, isAdmin }: StagingTableProps) {
  const router = useRouter()
  const [rows, setRows] = useState<StagingRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [publishingIds, setPublishingIds] = useState<string[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>('all')
  const [typeFilter, setTypeFilter] = useState('')
  const [siteKeyFilter, setSiteKeyFilter] = useState('')
  const [summary, setSummary] = useState<StagingSummary | null>(null)
  const [editPanelVideoId, setEditPanelVideoId] = useState<string | null>(null)
  const [batchDoubanLoading, setBatchDoubanLoading] = useState(false)

  const pageSize = 20

  const fetchData = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const qs = new URLSearchParams({ page: String(page), limit: String(pageSize) })
      if (readinessFilter !== 'all') qs.set('readiness', readinessFilter)
      if (typeFilter) qs.set('type', typeFilter)
      if (siteKeyFilter) qs.set('siteKey', siteKeyFilter)
      const res = await apiClient.get<{
        data: StagingRow[]
        total: number
        rules: StagingRules
        summary: StagingSummary
      }>(`/admin/staging?${qs}`)
      setRows(res.data)
      setTotal(res.total)
      setSummary(res.summary)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载失败，请刷新重试'
      setFetchError(msg)
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, refreshKey, readinessFilter, typeFilter, siteKeyFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void fetchData() }, [fetchData])

  function handleReadinessChange(next: ReadinessFilter) {
    setReadinessFilter(next)
    setPage(1)
    setSelectedIds([])
  }

  function handleTypeChange(next: string) {
    setTypeFilter(next)
    setPage(1)
    setSelectedIds([])
  }

  function handleSiteKeyChange(next: string) {
    setSiteKeyFilter(next)
    setPage(1)
    setSelectedIds([])
  }

  async function handlePublishSingle(id: string) {
    setPublishError(null)

    // 前置校验：无活跃源时直接提示，无需发请求
    const row = rows.find((r) => r.id === id)
    if (row && row.activeSourceCount === 0) {
      setPublishError(`视频「${row.title}」暂无活跃播放源，请先添加有效的视频源后再发布`)
      return
    }

    setPublishingIds((prev) => [...prev, id])
    try {
      await apiClient.post(`/admin/staging/${id}/publish`)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '发布失败，请重试'
      setPublishError(msg)
    } finally {
      setPublishingIds((prev) => prev.filter((x) => x !== id))
    }
  }

  async function handleBatchPublish() {
    setLoading(true)
    setPublishError(null)
    try {
      await apiClient.post('/admin/staging/batch-publish')
      setSelectedIds([])
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : '批量发布失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  async function handleBatchDoubanSync() {
    if (selectedIds.length === 0) return
    setBatchDoubanLoading(true)
    try {
      const res = await apiClient.post<{ data: { queued: number; skipped: number } }>(
        '/admin/staging/batch-douban-sync',
        { ids: selectedIds },
      )
      notify.success(`豆瓣同步已入队 ${res.data.queued} 条${res.data.skipped > 0 ? `，跳过 ${res.data.skipped} 条` : ''}`)
      setSelectedIds([])
    } catch (err) {
      notify.error(err instanceof Error ? err.message : '批量豆瓣同步失败')
    } finally {
      setBatchDoubanLoading(false)
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
              key: 'process',
              label: '处理',
              onClick: () => setEditPanelVideoId(row.id),
            },
            {
              key: 'publish',
              label: publishingIds.includes(row.id) ? '发布中…' : '立即发布',
              disabled: publishingIds.includes(row.id),
              onClick: () => void handlePublishSingle(row.id),
            },
            {
              key: 'edit',
              label: '编辑元数据',
              onClick: () => router.push(`/admin/videos/${row.id}/edit?from=/admin/staging`),
            },
          ]}
        />
      ),
    },
  ], [publishingIds, router]) // eslint-disable-line react-hooks/exhaustive-deps

  const readyCount = summary?.ready ?? rows.filter((r) => r.readiness.ready).length

  return (
    <div className="flex flex-col gap-4" data-testid="staging-table-container">
      {/* 筛选栏：readiness tab + type/siteKey select */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Readiness tabs */}
        <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg2)] p-1">
          {(['all', 'ready', 'warning', 'blocked'] as ReadinessFilter[]).map((tab) => {
            const count = tab === 'all' ? (summary?.all ?? total) : (summary?.[tab] ?? 0)
            return (
              <button
                key={tab}
                type="button"
                onClick={() => handleReadinessChange(tab)}
                data-testid={`readiness-tab-${tab}`}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  readinessFilter === tab
                    ? 'bg-[var(--accent)] text-black'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                {READINESS_LABELS[tab]}
                {summary && (
                  <span className={`ml-1 ${readinessFilter === tab ? 'opacity-70' : 'opacity-50'}`}>
                    ({count})
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* 类型筛选 */}
        <select
          value={typeFilter}
          onChange={(e) => handleTypeChange(e.target.value)}
          data-testid="type-filter-select"
          className="rounded border border-[var(--border)] bg-[var(--bg2)] px-2 py-1 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        >
          <option value="">全部类型</option>
          {VIDEO_TYPES.map((t) => (
            <option key={t} value={t}>{VIDEO_TYPE_LABELS[t]}</option>
          ))}
        </select>

        {/* 站点筛选 */}
        {(summary?.siteKeys ?? []).length > 0 && (
          <select
            value={siteKeyFilter}
            onChange={(e) => handleSiteKeyChange(e.target.value)}
            data-testid="site-key-filter-select"
            className="rounded border border-[var(--border)] bg-[var(--bg2)] px-2 py-1 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          >
            <option value="">全部站点</option>
            {(summary?.siteKeys ?? []).map((key) => (
              <option key={key} value={key}>{key}</option>
            ))}
          </select>
        )}
      </div>

      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--muted)]">
            共 <strong className="text-[var(--text)]">{total}</strong> 条
            {readyCount > 0 && (
              <>，<strong className="text-green-400">{readyCount}</strong> 条就绪</>
            )}
          </span>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={handleBatchPublish}
            disabled={loading || readyCount === 0}
            className="rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-black hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="batch-publish-btn"
          >
            一键发布全部就绪（{readyCount}）
          </button>
        )}
      </div>

      {/* 加载错误提示 */}
      {fetchError && (
        <div
          className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400"
          data-testid="staging-table-error"
        >
          加载暂存队列失败：{fetchError}（请确认后端服务已重启且 migrations 已执行）
        </div>
      )}

      {/* 发布错误提示 */}
      {publishError && (
        <div
          className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400"
          data-testid="staging-publish-error"
        >
          发布失败：{publishError}
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
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      {/* 批量操作栏 */}
      {selectedIds.length > 0 && (
        <SelectionActionBar
          selectedCount={selectedIds.length}
          variant="sticky-bottom"
          actions={[
            {
              key: 'batch-douban-sync',
              label: batchDoubanLoading ? '同步中…' : `批量豆瓣同步 (${selectedIds.length})`,
              variant: 'default',
              disabled: batchDoubanLoading,
              onClick: () => void handleBatchDoubanSync(),
            },
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

      {/* 侧滑编辑面板 */}
      <StagingEditPanel
        videoId={editPanelVideoId}
        onClose={() => setEditPanelVideoId(null)}
        onUpdated={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  )
}

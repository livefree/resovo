'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { CSSProperties } from 'react'
import {
  DataTable, Toolbar, FilterChipBar, ColumnSettingsPanel, Pagination,
  EmptyState, ErrorState, LoadingState, useTableQuery,
  SelectionActionBar,
  type TableColumn, type TableQueryPatch, type TableSelectionState, type SelectionAction,
} from '@resovo/admin-ui'
import { useTableRouterAdapter } from '@/lib/table-router-adapter'
import { VIDEO_COLUMN_DESCRIPTORS } from '@/lib/videos/columns'
import { listVideos, batchPublish, batchUnpublish, reviewVideo } from '@/lib/videos/api'
import { listCrawlerSites } from '@/lib/crawler/api'
import type { VideoAdminRow, CrawlerSite } from '@/lib/videos'
import { VideoStatusIndicator } from '@/components/admin/shared/VideoStatusIndicator'
import { VideoTypeChip } from '@/components/admin/shared/VideoTypeChip'
import { buildVideoFilter, buildFilterChips, VideoFilterBar } from './VideoFilterFields'
import { VideoRowActions } from './VideoRowActions'
import { VideoEditDrawer } from './VideoEditDrawer'

// ── batch actions ─────────────────────────────────────────────────

const BATCH_PUBLISH_LIMIT = 100
const BATCH_DANGER_LIMIT = 50

function buildBatchActions(
  selectedKeys: ReadonlySet<string>,
  onComplete: () => void,
): readonly SelectionAction[] {
  const ids = Array.from(selectedKeys)
  const count = ids.length
  return [
    {
      key: 'batch-publish',
      label: '批量公开',
      disabled: count > BATCH_PUBLISH_LIMIT,
      onClick: () => { void batchPublish(ids).then(onComplete) },
    },
    {
      key: 'batch-unpublish',
      label: '批量隐藏',
      variant: 'danger',
      disabled: count > BATCH_DANGER_LIMIT,
      confirm: { title: `确认隐藏 ${count} 条视频？`, description: '已上架视频将同步下架' },
      onClick: () => { void batchUnpublish(ids).then(onComplete) },
    },
    {
      key: 'batch-approve',
      label: '批量通过审核',
      disabled: count > BATCH_DANGER_LIMIT,
      onClick: () => { void Promise.all(ids.map((id) => reviewVideo(id, 'approve'))).then(onComplete) },
    },
    {
      key: 'batch-reject',
      label: '批量拒绝审核',
      variant: 'danger',
      disabled: count > BATCH_DANGER_LIMIT,
      confirm: { title: `确认拒绝 ${count} 条视频审核？` },
      onClick: () => { void Promise.all(ids.map((id) => reviewVideo(id, 'reject'))).then(onComplete) },
    },
  ]
}

// ── column definitions ────────────────────────────────────────────

const COVER_IMG_STYLE: CSSProperties = {
  width: 64, height: 36, objectFit: 'cover',
  borderRadius: 'var(--radius-sm)', display: 'block',
}
const COVER_PLACEHOLDER_STYLE: CSSProperties = {
  width: 64, height: 36, display: 'inline-flex',
  background: 'var(--bg-surface-elevated)',
  borderRadius: 'var(--radius-sm)', flexShrink: 0,
}
const TITLE_CELL_STYLE: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', minWidth: 0,
}
const TITLE_TEXT_STYLE: CSSProperties = {
  fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}

function buildVideoColumns(
  isAdmin: boolean,
  onRowUpdate: (id: string, patch: Partial<VideoAdminRow>) => void,
  onEditRequest: (id: string) => void,
): readonly TableColumn<VideoAdminRow>[] {
  return [
    {
      id: 'cover', header: '封面', accessor: (r) => r.cover_url,
      width: 88, minWidth: 76, enableResizing: true, defaultVisible: true,
      cell: ({ row }) => row.cover_url
        ? <img src={row.cover_url} alt="" aria-hidden="true" style={COVER_IMG_STYLE} />
        : <span style={COVER_PLACEHOLDER_STYLE} />,
    },
    {
      id: 'title', header: '标题', accessor: (r) => r.title,
      width: 320, minWidth: 220, enableResizing: true, enableSorting: true, defaultVisible: true,
      cell: ({ row }) => (
        <div style={TITLE_CELL_STYLE}>
          <span style={TITLE_TEXT_STYLE}>{row.title}</span>
          <VideoStatusIndicator
            reviewStatus={row.review_status}
            visibilityStatus={row.visibility_status}
            isPublished={row.is_published}
            compact
          />
        </div>
      ),
    },
    {
      id: 'type', header: '类型', accessor: (r) => r.type,
      width: 132, minWidth: 110, enableResizing: true, enableSorting: true, defaultVisible: true,
      cell: ({ row }) => <VideoTypeChip type={row.type} />,
    },
    {
      id: 'year', header: '年份', accessor: (r) => r.year ?? '',
      width: 100, minWidth: 80, enableResizing: true, enableSorting: true, defaultVisible: false,
    },
    {
      id: 'source_health', header: '源健康度', accessor: (r) => r.active_source_count ?? r.source_count,
      width: 160, minWidth: 140, enableResizing: true, defaultVisible: true,
      cell: ({ row }) => {
        const active = parseInt(row.active_source_count ?? row.source_count ?? '0', 10)
        const total = parseInt(row.total_source_count ?? row.source_count ?? '0', 10)
        return <span data-testid="source-health">{active}/{total}</span>
      },
    },
    {
      id: 'image_health', header: '图片健康', accessor: (r) => `${r.poster_status ?? '-'}/${r.backdrop_status ?? '-'}`,
      width: 140, minWidth: 120, enableResizing: true, defaultVisible: true,
      cell: ({ row }) => (
        <span data-testid="image-health">{row.poster_status ?? '-'}/{row.backdrop_status ?? '-'}</span>
      ),
    },
    {
      id: 'visibility', header: '可见性', accessor: (r) => r.visibility_status ?? '',
      width: 132, minWidth: 110, enableResizing: true, defaultVisible: true,
      cell: ({ row }) => row.visibility_status
        ? <VideoStatusIndicator visibilityStatus={row.visibility_status} isPublished={row.is_published} />
        : null,
    },
    {
      id: 'review_status', header: '审核状态', accessor: (r) => r.review_status ?? '',
      width: 132, minWidth: 110, enableResizing: true, defaultVisible: true,
      cell: ({ row }) => row.review_status
        ? <VideoStatusIndicator reviewStatus={row.review_status} isPublished={row.is_published} />
        : null,
    },
    {
      id: 'douban_status', header: '豆瓣状态', accessor: (r) => r.douban_status ?? '',
      width: 180, minWidth: 160, enableResizing: true, defaultVisible: false,
    },
    {
      id: 'meta_score', header: '元数据完整度', accessor: (r) => r.meta_score ?? '',
      width: 160, minWidth: 140, enableResizing: true, defaultVisible: false,
    },
    {
      id: 'created_at', header: '创建时间', accessor: (r) => r.created_at,
      width: 160, minWidth: 140, enableResizing: true, enableSorting: true, defaultVisible: false,
    },
    {
      id: 'updated_at', header: '更新时间', accessor: (r) => r.updated_at ?? '',
      width: 160, minWidth: 140, enableResizing: true, enableSorting: true, defaultVisible: false,
    },
    {
      id: 'actions', header: '操作', accessor: () => null,
      width: 168, minWidth: 148, enableResizing: false, defaultVisible: true,
      cell: ({ row }) => (
        <VideoRowActions
          row={row}
          isAdmin={isAdmin}
          onRowUpdate={onRowUpdate}
          onEditRequest={onEditRequest}
        />
      ),
    },
  ]
}

// ── main component ────────────────────────────────────────────────

const PAGE_STYLE: CSSProperties = { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }
const COL_BTN_STYLE: CSSProperties = {
  background: 'transparent', border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)', padding: '4px 8px', cursor: 'pointer',
  color: 'var(--fg-muted)', fontSize: 'var(--font-size-sm)',
}

export function VideoListClient() {
  const router = useTableRouterAdapter()
  const isAdmin = false // CHG-SN-3-12 将从 session/context 注入
  const { snapshot, patch } = useTableQuery({
    tableId: 'admin-videos',
    router,
    defaults: {
      pagination: { page: 1, pageSize: 20 },
      sort: { field: 'created_at', direction: 'desc' },
    },
    urlNamespace: 'v',
    columns: VIDEO_COLUMN_DESCRIPTORS,
  })

  const [rows, setRows] = useState<VideoAdminRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | undefined>()
  const [retryKey, setRetryKey] = useState(0)
  const [sites, setSites] = useState<readonly CrawlerSite[]>([])
  const [colSettingsOpen, setColSettingsOpen] = useState(false)
  const [selection, setSelection] = useState<TableSelectionState>({ selectedKeys: new Set(), mode: 'page' })
  const [editVideoId, setEditVideoId] = useState<string | null>(null)
  const colBtnRef = useRef<HTMLButtonElement | null>(null)

  const handleRowUpdate = useCallback((id: string, patch2: Partial<VideoAdminRow>) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, ...patch2 } : r))
  }, [])

  const handleEditRequest = useCallback((id: string) => {
    setEditVideoId(id)
  }, [])

  const clearSelection = useCallback(
    () => setSelection({ selectedKeys: new Set(), mode: 'page' }),
    [],
  )

  const handleBatchComplete = useCallback(() => {
    clearSelection()
    setRetryKey((k) => k + 1)
  }, [clearSelection])

  const columns = useMemo(
    () => buildVideoColumns(isAdmin, handleRowUpdate, handleEditRequest),
    [isAdmin, handleRowUpdate, handleEditRequest],
  )

  useEffect(() => {
    listCrawlerSites().then(setSites).catch(() => {/* site 加载失败时下拉为空 */})
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(undefined)
    listVideos(buildVideoFilter(snapshot))
      .then((result) => {
        if (cancelled) return
        setRows(result.data)
        setTotal(result.total)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [snapshot, retryKey])

  const clearFilter = useCallback((key: string) => {
    const next = new Map(snapshot.filters)
    next.delete(key)
    patch({ filters: next })
  }, [snapshot.filters, patch])

  const chips = buildFilterChips(snapshot, clearFilter)

  const handlePatch = useCallback((next: TableQueryPatch) => patch(next), [patch])

  return (
    <div data-video-list-client style={PAGE_STYLE}>
      <Toolbar
        leading={
          <>
            <VideoFilterBar snapshot={snapshot} sites={sites} onPatch={handlePatch} />
            {chips.length > 0 && (
              <FilterChipBar items={chips} onClearAll={() => patch({ filters: new Map() })} />
            )}
          </>
        }
        columnSettings={
          <>
            <button
              ref={colBtnRef}
              type="button"
              onClick={() => setColSettingsOpen((o) => !o)}
              data-testid="col-settings-btn"
              style={COL_BTN_STYLE}
            >
              列设置
            </button>
            <ColumnSettingsPanel
              open={colSettingsOpen}
              columns={VIDEO_COLUMN_DESCRIPTORS}
              value={snapshot.columns}
              onChange={(cols) => patch({ columns: cols })}
              onClose={() => setColSettingsOpen(false)}
              anchorRef={colBtnRef}
            />
          </>
        }
      />
      {loading && rows.length === 0
        ? <LoadingState variant="skeleton" />
        : (
          <>
            {error
              ? <ErrorState error={error} title="加载失败" onRetry={() => setRetryKey((k) => k + 1)} />
              : (
                <DataTable<VideoAdminRow>
                  rows={rows}
                  columns={columns}
                  rowKey={(row) => row.id}
                  mode="server"
                  query={snapshot}
                  onQueryChange={patch}
                  totalRows={total}
                  loading={loading}
                  selection={selection}
                  onSelectionChange={setSelection}
                  emptyState={<EmptyState title="暂无视频" description="调整筛选条件后重试" />}
                  data-testid="video-list-table"
                  enableHeaderMenu
                />
              )
            }
          </>
        )
      }
      <SelectionActionBar
        visible={selection.selectedKeys.size > 0}
        selectedCount={selection.selectedKeys.size}
        selectionMode={selection.mode}
        onClearSelection={clearSelection}
        actions={buildBatchActions(selection.selectedKeys, handleBatchComplete)}
        data-testid="video-selection-bar"
      />
      {!error && (
        <Pagination
          page={snapshot.pagination.page}
          pageSize={snapshot.pagination.pageSize}
          totalRows={total}
          onPageChange={(page) => patch({ pagination: { page } })}
          onPageSizeChange={(pageSize) => patch({ pagination: { page: 1, pageSize } })}
          pageSizeOptions={[10, 20, 50]}
        />
      )}
      <VideoEditDrawer
        open={editVideoId !== null}
        videoId={editVideoId}
        onClose={() => setEditVideoId(null)}
        onSaved={() => { setEditVideoId(null); setRetryKey((k) => k + 1) }}
      />
    </div>
  )
}

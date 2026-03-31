/**
 * useVideoTableColumns.ts — 视频管理表格列定义（CHG-227）
 */

'use client'

import { useMemo } from 'react'
import { AdminDropdown } from '@/components/admin/shared/dropdown/AdminDropdown'
import {
  TableBadgeCell,
  TableCheckboxCell,
  TableImageCell,
  TableSwitchCell,
  TableTextCell,
} from '@/components/admin/shared/modern-table/cells'
import type { TableColumn } from '@/components/admin/shared/modern-table/types'
import type { AdminColumnMeta } from '@/components/admin/shared/table/adminColumnTypes'
import type { AdminTableState as SharedAdminTableState } from '@/components/admin/shared/table/useAdminTableState'

// ── 类型与常量 ────────────────────────────────────────────────────

export interface VideoAdminRow {
  id: string
  short_id: string
  title: string
  title_en: string | null
  cover_url: string | null
  type: string
  year: number | null
  is_published: boolean
  source_count: string
  active_source_count?: string
  total_source_count?: string
  visibility_status?: 'public' | 'internal' | 'hidden'
  review_status?: 'pending_review' | 'approved' | 'rejected'
  created_at: string
}

export type VideoColumnId =
  | 'cover' | 'title' | 'type' | 'source_health' | 'visibility' | 'review_status' | 'actions'

export const VIDEO_COLUMNS: AdminColumnMeta[] = [
  { id: 'cover', visible: true, width: 88, minWidth: 76, maxWidth: 120, resizable: true },
  { id: 'title', visible: true, width: 320, minWidth: 220, maxWidth: 520, resizable: true },
  { id: 'type', visible: true, width: 132, minWidth: 110, maxWidth: 200, resizable: true },
  { id: 'source_health', visible: true, width: 160, minWidth: 140, maxWidth: 240, resizable: true },
  { id: 'visibility', visible: true, width: 132, minWidth: 120, maxWidth: 180, resizable: true },
  { id: 'review_status', visible: true, width: 132, minWidth: 120, maxWidth: 180, resizable: true },
  { id: 'actions', visible: true, width: 168, minWidth: 148, maxWidth: 240, resizable: false },
]

export const VIDEO_DEFAULT_TABLE_STATE: Omit<SharedAdminTableState, 'columns'> = {
  sort: { field: 'title', dir: 'asc' },
}

export const COLUMN_LABELS: Record<VideoColumnId, string> = {
  cover: '封面', title: '标题', type: '类型',
  source_health: '源健康度', visibility: '可见性',
  review_status: '审核状态', actions: '操作',
}

// Only fields present in the backend SORT_FIELDS whitelist are sortable
export const SORTABLE_MAP: Record<VideoColumnId, boolean> = {
  cover: false, title: true, type: true, source_health: false,
  visibility: false, review_status: false, actions: false,
}

const TYPE_LABELS: Record<string, string> = {
  movie: '电影', series: '剧集', anime: '动漫', variety: '综艺',
  documentary: '纪录片', short: '短片', sports: '体育', music: '音乐',
  news: '新闻', kids: '少儿', other: '其他',
}

// ── 辅助函数 ──────────────────────────────────────────────────────

export function getTypeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type
}

export function getSourceCounts(row: VideoAdminRow): { active: number; total: number } {
  const active = Number.parseInt(row.active_source_count ?? row.source_count ?? '0', 10)
  const total = Number.parseInt(row.total_source_count ?? row.source_count ?? '0', 10)
  return {
    active: Number.isFinite(active) ? active : 0,
    total: Number.isFinite(total) ? total : 0,
  }
}

export function getReviewLabel(reviewStatus?: VideoAdminRow['review_status']): string {
  if (reviewStatus === 'approved') return '已通过'
  if (reviewStatus === 'rejected') return '已拒绝'
  return '待审核'
}

export function getReviewTone(reviewStatus?: VideoAdminRow['review_status']): 'success' | 'danger' | 'warning' {
  if (reviewStatus === 'approved') return 'success'
  if (reviewStatus === 'rejected') return 'danger'
  return 'warning'
}

export function getVisibilityLabel(visibility?: VideoAdminRow['visibility_status']): string {
  if (visibility === 'public') return '公开'
  if (visibility === 'hidden') return '隐藏'
  return '内部'
}

export function getSourceHealthLabel(row: VideoAdminRow): string {
  const { active, total } = getSourceCounts(row)
  if (total <= 0) return '🟡 暂无源'
  if (active <= 0) return '🔴 全失效'
  if (active < total) return `🟡 ${active}/${total} 活跃`
  return `🟢 ${active} 活跃`
}

export function toComparableValue(row: VideoAdminRow, field: string): string | number {
  switch (field) {
    case 'title': return row.title.toLowerCase()
    case 'type': return getTypeLabel(row.type)
    case 'source_health': { const { active, total } = getSourceCounts(row); return total * 1000 + active }
    case 'visibility': return getVisibilityLabel(row.visibility_status)
    case 'review_status': return getReviewLabel(row.review_status)
    default: return ''
  }
}

// ── 单列构建器 ────────────────────────────────────────────────────

interface ColumnDeps {
  sortable: Record<string, boolean>
  selectedIds: string[]
  visibilityPendingIds: string[]
  publishPendingIds: string[]
  doubanSyncPendingIds: string[]
  canSyncDouban: boolean
  handleCheck: (id: string, checked: boolean) => void
  handleVisibilityToggle: (row: VideoAdminRow, next: boolean) => Promise<void>
  handlePublishToggle: (row: VideoAdminRow) => Promise<void>
  handleDoubanSync: (id: string) => Promise<void>
  setDrawerVideoId: (id: string) => void
  openFullEdit: (id: string) => void
}

function buildDataColumn(columnId: VideoColumnId, deps: ColumnDeps): TableColumn<VideoAdminRow> {
  const meta = VIDEO_COLUMNS.find((c) => c.id === columnId)
  const canSort = deps.sortable[columnId] ?? false
  const col: TableColumn<VideoAdminRow> = {
    id: columnId,
    header: COLUMN_LABELS[columnId],
    accessor: (row) => row.title,
    width: meta?.width,
    minWidth: meta?.minWidth,
    enableResizing: meta?.resizable,
    enableSorting: canSort,
    columnMenu: columnId !== 'actions' ? { canSort, canHide: true } : undefined,
  }
  switch (columnId) {
    case 'cover':
      col.accessor = (row) => row.cover_url
      col.cell = ({ row }) => <TableImageCell src={row.cover_url} alt={row.title} width={40} height={56} />
      break
    case 'title':
      col.accessor = (row) => row.title
      col.cell = ({ row }) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <TableTextCell value={row.title} className="font-medium text-[var(--text)]" />
          <TableTextCell value={row.short_id} className="font-mono text-xs text-[var(--muted)]" />
        </div>
      )
      break
    case 'type':
      col.accessor = (row) => getTypeLabel(row.type)
      col.cell = ({ row }) => <TableBadgeCell label={getTypeLabel(row.type)} tone="info" />
      break
    case 'source_health':
      col.accessor = (row) => getSourceHealthLabel(row)
      col.cell = ({ row }) => {
        const { active, total } = getSourceCounts(row)
        const tone = total <= 0 ? 'warning' : active <= 0 ? 'danger' : active < total ? 'warning' : 'success'
        return <TableBadgeCell label={getSourceHealthLabel(row)} tone={tone} />
      }
      break
    case 'visibility':
      col.accessor = (row) => getVisibilityLabel(row.visibility_status)
      col.cell = ({ row }) => (
        <div className="flex items-center gap-2">
          <TableSwitchCell
            value={row.visibility_status === 'public'}
            disabled={deps.visibilityPendingIds.includes(row.id)}
            onToggle={(next) => deps.handleVisibilityToggle(row, next)}
          />
          <span className="text-xs text-[var(--muted)]">{getVisibilityLabel(row.visibility_status)}</span>
        </div>
      )
      break
    case 'review_status':
      col.accessor = (row) => getReviewLabel(row.review_status)
      col.cell = ({ row }) => <TableBadgeCell label={getReviewLabel(row.review_status)} tone={getReviewTone(row.review_status)} />
      break
    case 'actions':
      col.accessor = (row) => row.id
      col.cell = ({ row }) => (
        <AdminDropdown
          data-testid={`video-actions-${row.id}`}
          align="right"
          trigger={
            <button
              type="button"
              className="rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--bg2)]"
            >操作 ▾</button>
          }
          items={[
            { key: 'quick-edit', label: '快速编辑', onClick: () => deps.setDrawerVideoId(row.id) },
            { key: 'full-edit', label: '完整编辑', onClick: () => deps.openFullEdit(row.id) },
            {
              key: 'publish-toggle',
              label: row.is_published ? '下架' : '上架',
              onClick: () => { void deps.handlePublishToggle(row) },
              disabled: deps.publishPendingIds.includes(row.id),
            },
            ...(deps.canSyncDouban
              ? [{
                  key: 'douban-sync',
                  label: '豆瓣同步',
                  onClick: () => { void deps.handleDoubanSync(row.id) },
                  disabled: deps.doubanSyncPendingIds.includes(row.id),
                }]
              : []),
          ]}
        />
      )
      break
  }
  return col
}

// ── 主 Hook ───────────────────────────────────────────────────────

interface UseVideoTableColumnsParams {
  visibleColumnIds: VideoColumnId[]
  allSelected: boolean
  handleSelectAll: (checked: boolean) => void
  deps: ColumnDeps
}

export function useVideoTableColumns({
  visibleColumnIds,
  allSelected,
  handleSelectAll,
  deps,
}: UseVideoTableColumnsParams): TableColumn<VideoAdminRow>[] {
  return useMemo<TableColumn<VideoAdminRow>[]>(() => {
    const selectionCol: TableColumn<VideoAdminRow> = {
      id: 'selection',
      header: <TableCheckboxCell checked={allSelected} ariaLabel="全选当前页视频" onChange={handleSelectAll} />,
      accessor: (row) => row.id,
      width: 44, minWidth: 44, enableResizing: false,
      cell: ({ row }) => (
        <TableCheckboxCell
          checked={deps.selectedIds.includes(row.id)}
          ariaLabel={`选择 ${row.title}`}
          onChange={(checked) => deps.handleCheck(row.id, checked)}
        />
      ),
    }
    const dataCols = visibleColumnIds.map((id) => buildDataColumn(id, deps))
    return [selectionCol, ...dataCols]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    allSelected,
    handleSelectAll,
    visibleColumnIds,
    deps.selectedIds,
    deps.visibilityPendingIds,
    deps.publishPendingIds,
    deps.doubanSyncPendingIds,
    deps.canSyncDouban,
    deps.sortable,
  ])
}

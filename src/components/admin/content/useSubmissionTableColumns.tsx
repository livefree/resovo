/**
 * useSubmissionTableColumns.tsx — 投稿审核表格列定义（CHG-259）
 * 列：视频标题 / 源 URL / 投稿人 / 时间 / 操作（AdminDropdown）
 */

'use client'

import { useMemo } from 'react'
import type { TableColumn } from '@/components/admin/shared/modern-table/types'
import type { AdminColumnMeta } from '@/components/admin/shared/table/adminColumnTypes'
import type { ReviewTarget } from '@/components/admin/content/ReviewModal'

export interface SubmissionRow {
  id: string
  video_id: string
  source_url: string
  source_name: string
  submitted_by: string | null
  submitted_by_username?: string
  video_title?: string
  created_at: string
}

export type SubmissionColumnId = 'video' | 'source_url' | 'submitted_by' | 'created_at' | 'actions'

export const SUBMISSION_COLUMN_LABELS: Record<SubmissionColumnId, string> = {
  video: '视频',
  source_url: '源 URL',
  submitted_by: '投稿人',
  created_at: '时间',
  actions: '操作',
}

export const SUBMISSION_SORTABLE_MAP: Record<SubmissionColumnId, boolean> = {
  video: true,
  source_url: true,
  submitted_by: true,
  created_at: true,
  actions: false,
}

export const SUBMISSION_COLUMNS_META: AdminColumnMeta[] = [
  { id: 'video', visible: true, width: 240, minWidth: 180, maxWidth: 420, resizable: true },
  { id: 'source_url', visible: true, width: 320, minWidth: 220, maxWidth: 520, resizable: true },
  { id: 'submitted_by', visible: true, width: 140, minWidth: 120, maxWidth: 260, resizable: true },
  { id: 'created_at', visible: true, width: 170, minWidth: 130, maxWidth: 240, resizable: true },
  { id: 'actions', visible: true, width: 120, minWidth: 110, maxWidth: 180, resizable: false },
]

export const SUBMISSION_DEFAULT_TABLE_STATE = {
  sort: { field: 'created_at', dir: 'desc' as const },
}

interface UseSubmissionTableColumnsOptions {
  visibleColumnIds: SubmissionColumnId[]
  setReviewTarget: (target: ReviewTarget) => void
}

export function useSubmissionTableColumns({
  visibleColumnIds,
  setReviewTarget,
}: UseSubmissionTableColumnsOptions): TableColumn<SubmissionRow>[] {
  return useMemo((): TableColumn<SubmissionRow>[] => {
    const all: TableColumn<SubmissionRow>[] = [
      {
        id: 'video',
        header: SUBMISSION_COLUMN_LABELS.video,
        accessor: (row) => row.video_title ?? row.video_id,
        width: 240,
        minWidth: 180,
        enableSorting: SUBMISSION_SORTABLE_MAP.video,
        enableResizing: true,
        columnMenu: { canSort: SUBMISSION_SORTABLE_MAP.video, canHide: true },
        cell: ({ row }) => (
          <span
            className="inline-block max-w-[240px] truncate text-[var(--text)]"
            title={row.video_title ?? row.video_id}
          >
            {row.video_title ?? row.video_id}
          </span>
        ),
      },
      {
        id: 'source_url',
        header: SUBMISSION_COLUMN_LABELS.source_url,
        accessor: (row) => row.source_url,
        width: 320,
        minWidth: 220,
        enableSorting: SUBMISSION_SORTABLE_MAP.source_url,
        enableResizing: true,
        columnMenu: { canSort: SUBMISSION_SORTABLE_MAP.source_url, canHide: true },
        cell: ({ row }) => (
          <span
            className="inline-block max-w-[320px] truncate font-mono text-xs text-[var(--muted)]"
            title={row.source_url}
          >
            {row.source_url}
          </span>
        ),
      },
      {
        id: 'submitted_by',
        header: SUBMISSION_COLUMN_LABELS.submitted_by,
        accessor: (row) => row.submitted_by_username ?? row.submitted_by ?? '',
        width: 140,
        minWidth: 120,
        enableSorting: SUBMISSION_SORTABLE_MAP.submitted_by,
        enableResizing: true,
        columnMenu: { canSort: SUBMISSION_SORTABLE_MAP.submitted_by, canHide: true },
        cell: ({ row }) => (
          <span className="text-[var(--muted)]">
            {row.submitted_by_username ?? row.submitted_by ?? '—'}
          </span>
        ),
      },
      {
        id: 'created_at',
        header: SUBMISSION_COLUMN_LABELS.created_at,
        accessor: (row) => row.created_at,
        width: 170,
        minWidth: 130,
        enableSorting: SUBMISSION_SORTABLE_MAP.created_at,
        enableResizing: true,
        columnMenu: { canSort: SUBMISSION_SORTABLE_MAP.created_at, canHide: true },
        cell: ({ row }) => (
          <span className="text-xs text-[var(--muted)]">
            {new Date(row.created_at).toLocaleDateString()}
          </span>
        ),
      },
      {
        id: 'actions',
        header: SUBMISSION_COLUMN_LABELS.actions,
        accessor: () => null,
        width: 120,
        minWidth: 110,
        enableSorting: false,
        enableResizing: false,
        overflowVisible: true,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => setReviewTarget({ id: row.id, type: 'submission', title: row.video_title })}
            className="rounded px-2 py-0.5 text-xs bg-[var(--accent)]/20 text-[var(--accent)] hover:bg-[var(--accent)]/40"
            data-testid={`submission-review-btn-${row.id}`}
          >
            审核
          </button>
        ),
      },
    ]

    return all.filter((col) => visibleColumnIds.includes(col.id as SubmissionColumnId))
  }, [visibleColumnIds, setReviewTarget])
}

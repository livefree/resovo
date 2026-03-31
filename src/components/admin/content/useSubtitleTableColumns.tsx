/**
 * useSubtitleTableColumns.tsx — 字幕审核表格列定义（CHG-260）
 * 列：视频标题 / 语言 / 格式 / 上传人 / 时间 / 操作（直接审核按钮）
 */

'use client'

import { useMemo } from 'react'
import type { TableColumn } from '@/components/admin/shared/modern-table/types'
import type { AdminColumnMeta } from '@/components/admin/shared/table/adminColumnTypes'
import type { ReviewTarget } from '@/components/admin/content/ReviewModal'

export interface SubtitleRow {
  id: string
  video_id: string
  language: string
  format: string
  label: string | null
  file_url: string
  uploaded_by: string | null
  created_at: string
  video_title?: string
  uploader_username?: string
}

export type SubtitleColumnId = 'video' | 'language' | 'format' | 'uploaded_by' | 'created_at' | 'actions'

export const SUBTITLE_COLUMN_LABELS: Record<SubtitleColumnId, string> = {
  video: '视频',
  language: '语言',
  format: '格式',
  uploaded_by: '上传人',
  created_at: '时间',
  actions: '操作',
}

export const SUBTITLE_SORTABLE_MAP: Record<SubtitleColumnId, boolean> = {
  video: true,
  language: true,
  format: true,
  uploaded_by: true,
  created_at: true,
  actions: false,
}

export const SUBTITLE_COLUMNS_META: AdminColumnMeta[] = [
  { id: 'video', visible: true, width: 240, minWidth: 180, maxWidth: 420, resizable: true },
  { id: 'language', visible: true, width: 130, minWidth: 110, maxWidth: 220, resizable: true },
  { id: 'format', visible: true, width: 110, minWidth: 90, maxWidth: 180, resizable: true },
  { id: 'uploaded_by', visible: true, width: 140, minWidth: 120, maxWidth: 260, resizable: true },
  { id: 'created_at', visible: true, width: 170, minWidth: 130, maxWidth: 240, resizable: true },
  { id: 'actions', visible: true, width: 120, minWidth: 110, maxWidth: 180, resizable: false },
]

export const SUBTITLE_DEFAULT_TABLE_STATE = {
  sort: { field: 'created_at', dir: 'desc' as const },
}

interface UseSubtitleTableColumnsOptions {
  setReviewTarget: (target: ReviewTarget) => void
}

export function useSubtitleTableColumns({
  setReviewTarget,
}: UseSubtitleTableColumnsOptions): TableColumn<SubtitleRow>[] {
  return useMemo((): TableColumn<SubtitleRow>[] => {
    const all: TableColumn<SubtitleRow>[] = [
      {
        id: 'video',
        header: SUBTITLE_COLUMN_LABELS.video,
        accessor: (row) => row.video_title ?? row.video_id,
        width: 240,
        minWidth: 180,
        enableSorting: SUBTITLE_SORTABLE_MAP.video,
        enableResizing: true,
        columnMenu: { canSort: SUBTITLE_SORTABLE_MAP.video, canHide: true },
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
        id: 'language',
        header: SUBTITLE_COLUMN_LABELS.language,
        accessor: (row) => row.language,
        width: 130,
        minWidth: 110,
        enableSorting: SUBTITLE_SORTABLE_MAP.language,
        enableResizing: true,
        columnMenu: { canSort: SUBTITLE_SORTABLE_MAP.language, canHide: true },
        cell: ({ row }) => (
          <span className="text-[var(--muted)]">{row.language}</span>
        ),
      },
      {
        id: 'format',
        header: SUBTITLE_COLUMN_LABELS.format,
        accessor: (row) => row.format,
        width: 110,
        minWidth: 90,
        enableSorting: SUBTITLE_SORTABLE_MAP.format,
        enableResizing: true,
        columnMenu: { canSort: SUBTITLE_SORTABLE_MAP.format, canHide: true },
        cell: ({ row }) => (
          <span className="uppercase text-[var(--muted)]">{row.format}</span>
        ),
      },
      {
        id: 'uploaded_by',
        header: SUBTITLE_COLUMN_LABELS.uploaded_by,
        accessor: (row) => row.uploader_username ?? row.uploaded_by ?? '',
        width: 140,
        minWidth: 120,
        enableSorting: SUBTITLE_SORTABLE_MAP.uploaded_by,
        enableResizing: true,
        columnMenu: { canSort: SUBTITLE_SORTABLE_MAP.uploaded_by, canHide: true },
        cell: ({ row }) => (
          <span
            className="inline-block max-w-[140px] truncate text-[var(--muted)]"
            title={row.uploader_username ?? row.uploaded_by ?? '—'}
          >
            {row.uploader_username ?? row.uploaded_by ?? '—'}
          </span>
        ),
      },
      {
        id: 'created_at',
        header: SUBTITLE_COLUMN_LABELS.created_at,
        accessor: (row) => row.created_at,
        width: 170,
        minWidth: 130,
        enableSorting: SUBTITLE_SORTABLE_MAP.created_at,
        enableResizing: true,
        columnMenu: { canSort: SUBTITLE_SORTABLE_MAP.created_at, canHide: true },
        cell: ({ row }) => (
          <span className="text-xs text-[var(--muted)]">
            {new Date(row.created_at).toLocaleDateString()}
          </span>
        ),
      },
      {
        id: 'actions',
        header: SUBTITLE_COLUMN_LABELS.actions,
        accessor: () => null,
        width: 120,
        minWidth: 110,
        enableSorting: false,
        enableResizing: false,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => setReviewTarget({ id: row.id, type: 'subtitle', title: row.video_title })}
            className="rounded px-2 py-0.5 text-xs bg-[var(--accent)]/20 text-[var(--accent)] hover:bg-[var(--accent)]/40"
            data-testid={`subtitle-review-btn-${row.id}`}
          >
            审核
          </button>
        ),
      },
    ]

    return all
  }, [setReviewTarget])
}

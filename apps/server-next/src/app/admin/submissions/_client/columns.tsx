'use client'

/**
 * columns.tsx — `/admin/submissions` 列定义 + 行操作 cell（CHG-SN-5-01）
 *
 * 拆自 SubmissionsListClient.tsx（满足 CLAUDE.md "文件 ≤ 500 行" 硬约束）。
 * 包含：
 *   - cell 样式常量（title 双行 / URL mono / actions inline-flex）
 *   - formatDate 工具
 *   - buildColumns(): 5 列定义（video / source_url / submitted_by / created_at / actions）
 */

import type { CSSProperties } from 'react'
import { AdminButton, type TableColumn } from '@resovo/admin-ui'
import type { SubmissionRow } from '@/lib/submissions/types'
import { SubmissionRejectPopover } from './SubmissionRejectPopover'

const TITLE_CELL_STYLE: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0,
}
const TITLE_TEXT_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--fg-default)',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}
const TITLE_META_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)',
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
}
const URL_CELL_STYLE: CSSProperties = {
  fontFamily: 'ui-monospace, "SF Mono", Consolas, monospace',
  fontSize: 'var(--font-size-2xs)',
  color: 'var(--fg-muted)',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  display: 'inline-block', maxWidth: '100%',
}
const ACTIONS_CELL_STYLE: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '4px',
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('zh-CN', { year: '2-digit', month: '2-digit', day: '2-digit' })
}

export interface BuildColumnsOptions {
  readonly onApprove: (id: string) => void
  readonly onReject: (id: string, reason: string | undefined) => void
  readonly pendingId: string | null
}

export function buildSubmissionColumns({
  onApprove,
  onReject,
  pendingId,
}: BuildColumnsOptions): readonly TableColumn<SubmissionRow>[] {
  return [
    {
      id: 'video',
      header: '视频',
      accessor: (r) => r.video_title ?? r.video_id,
      minWidth: 200,
      enableResizing: true,
      enableSorting: true,
      defaultVisible: true,
      pinned: true,
      cell: ({ row }) => (
        <div style={TITLE_CELL_STYLE}>
          <span style={TITLE_TEXT_STYLE} title={row.video_title ?? row.video_id}>
            {row.video_title ?? row.video_id}
          </span>
          <span style={TITLE_META_STYLE}>
            {row.video_type ?? '—'} · {row.source_name}
          </span>
        </div>
      ),
    },
    {
      id: 'source_url',
      header: '源 URL',
      accessor: (r) => r.source_url,
      width: 280, minWidth: 200,
      enableResizing: true, enableSorting: true, defaultVisible: true,
      cell: ({ row }) => (
        <span style={URL_CELL_STYLE} title={row.source_url}>{row.source_url}</span>
      ),
    },
    {
      id: 'submitted_by',
      header: '投稿人',
      accessor: (r) => r.submitted_by_username ?? r.submitted_by ?? '',
      width: 140, minWidth: 100,
      enableResizing: true, enableSorting: true, defaultVisible: true,
      cell: ({ row }) => (
        <span style={{ color: 'var(--fg-muted)', fontSize: 'var(--font-size-xs)' }}>
          {row.submitted_by_username ?? row.submitted_by ?? '—'}
        </span>
      ),
    },
    {
      id: 'created_at',
      header: '时间',
      accessor: (r) => r.created_at,
      width: 100, minWidth: 90,
      enableResizing: true, enableSorting: true, defaultVisible: true,
      cell: ({ row }) => (
        <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--fg-muted)' }}>
          {formatDate(row.created_at)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '操作',
      accessor: () => null,
      width: 140, minWidth: 130,
      enableResizing: false, enableSorting: false, defaultVisible: true,
      overflowVisible: true,
      cell: ({ row }) => {
        const isPending = pendingId === row.id
        return (
          <span style={ACTIONS_CELL_STYLE}>
            <AdminButton
              variant="primary"
              size="sm"
              loading={isPending}
              onClick={() => onApprove(row.id)}
              data-testid={`submission-approve-${row.id}`}
            >
              通过
            </AdminButton>
            <SubmissionRejectPopover
              pending={isPending}
              onConfirm={(reason) => onReject(row.id, reason)}
              data-testid={`submission-reject-popover-${row.id}`}
              trigger={
                <AdminButton
                  variant="danger"
                  size="sm"
                  data-testid={`submission-reject-${row.id}`}
                >
                  拒绝
                </AdminButton>
              }
            />
          </span>
        )
      },
    },
  ]
}

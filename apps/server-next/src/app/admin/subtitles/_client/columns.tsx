'use client'

/**
 * columns.tsx — `/admin/subtitles` 列定义 + 行操作 cell（CHG-SN-5-02）
 *
 * 列结构：video（双行标题，pinned）/ language + label / format / created_at / actions
 */

import type { CSSProperties } from 'react'
import { AdminButton, type TableColumn } from '@resovo/admin-ui'
import type { SubtitleRow } from '@/lib/subtitles/types'
import { SubtitleRejectPopover } from './SubtitleRejectPopover'

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
const LANG_CELL_STYLE: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0,
}
const FORMAT_STYLE: CSSProperties = {
  display: 'inline-block',
  padding: '1px 6px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  fontSize: 'var(--font-size-2xs)',
  color: 'var(--fg-muted)',
  fontFamily: 'ui-monospace, "SF Mono", Consolas, monospace',
  textTransform: 'uppercase',
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

export function buildSubtitleColumns({
  onApprove,
  onReject,
  pendingId,
}: BuildColumnsOptions): readonly TableColumn<SubtitleRow>[] {
  return [
    // EP-3-E（2026-05-24）：AMD2 D-150-AMD2-2 kind: 'computed' opt-out
    //   - filter 业务无意义（字幕审核工作流 / 非数据列表）→ filter 默认禁用
    //   - sort 显式 enableSorting: true 保留（后端 SUBTITLE_SORT_FIELDS 5 字段已支持）
    {
      id: 'video',
      kind: 'computed',
      header: '视频',
      accessor: (r) => r.video_title ?? r.video_id,
      minWidth: 200,
      enableResizing: true,
      enableSorting: true,
      defaultVisible: true,
      pinned: true,
      cell: ({ row }) => {
        const epLabel = row.episode_number != null ? ` 第 ${row.episode_number} 集` : ''
        return (
          <div style={TITLE_CELL_STYLE}>
            <span style={TITLE_TEXT_STYLE} title={row.video_title ?? row.video_id}>
              {row.video_title ?? row.video_id}
            </span>
            {epLabel ? (
              <span style={TITLE_META_STYLE}>{epLabel}</span>
            ) : null}
          </div>
        )
      },
    },
    {
      id: 'language',
      kind: 'computed',
      header: '语言',
      accessor: (r) => r.label || r.language,
      width: 130, minWidth: 100,
      enableResizing: true,
      enableSorting: true,
      defaultVisible: true,
      cell: ({ row }) => (
        <div style={LANG_CELL_STYLE}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-default)' }}>
            {row.label}
          </span>
          <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--fg-muted)' }}>
            {row.language}
          </span>
        </div>
      ),
    },
    {
      id: 'format',
      kind: 'computed',
      header: '格式',
      accessor: (r) => r.format,
      width: 90, minWidth: 80,
      enableResizing: true,
      enableSorting: true,
      defaultVisible: true,
      cell: ({ row }) => (
        <span style={FORMAT_STYLE}>{row.format}</span>
      ),
    },
    {
      id: 'created_at',
      kind: 'computed',
      header: '时间',
      accessor: (r) => r.created_at,
      width: 100, minWidth: 90,
      enableResizing: true,
      enableSorting: true,
      defaultVisible: true,
      cell: ({ row }) => (
        <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--fg-muted)' }}>
          {formatDate(row.created_at)}
        </span>
      ),
    },
    {
      id: 'actions',
      kind: 'action',
      header: '操作',
      accessor: () => null,
      width: 140, minWidth: 130,
      enableResizing: false,
      defaultVisible: true,
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
              data-testid={`subtitle-approve-${row.id}`}
            >
              通过
            </AdminButton>
            <SubtitleRejectPopover
              pending={isPending}
              onConfirm={(reason) => onReject(row.id, reason)}
              data-testid={`subtitle-reject-popover-${row.id}`}
              trigger={
                <AdminButton
                  variant="danger"
                  size="sm"
                  disabled={isPending}
                  data-testid={`subtitle-reject-${row.id}`}
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

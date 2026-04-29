'use client'

import React, { useState, useCallback } from 'react'
import { AdminDropdown, type AdminDropdownItem } from '@resovo/admin-ui'
import type { VideoAdminRow, VisibilityStatus } from '@/lib/videos'
import { updateVisibility, stateTransition, doubanSync, refetchSources } from '@/lib/videos/api'

// ── helpers ───────────────────────────────────────────────────────

const PRIMARY_TYPES = new Set(['movie', 'series', 'anime', 'variety'])
const TYPE_SEGMENT: Partial<Record<string, string>> = { variety: 'tvshow' }

function getDetailHref(row: VideoAdminRow): string {
  const segment = PRIMARY_TYPES.has(row.type)
    ? (TYPE_SEGMENT[row.type] ?? row.type)
    : 'others'
  return `/${segment}/${row.short_id}`
}

// ── types ─────────────────────────────────────────────────────────

export interface VideoRowActionsProps {
  readonly row: VideoAdminRow
  readonly isAdmin: boolean
  readonly onRowUpdate: (id: string, patch: Partial<VideoAdminRow>) => void
  readonly onEditRequest: (id: string) => void
}

// ── menu items builder ────────────────────────────────────────────

function buildItems(
  row: VideoAdminRow,
  isAdmin: boolean,
  onEdit: () => void,
  onVisibility: (v: VisibilityStatus) => void,
  onTransition: (action: Parameters<typeof stateTransition>[1]) => void,
  onDouban: () => void,
  onRefetch: () => void,
  onViewDetail: () => void,
): readonly AdminDropdownItem[] {
  const items: AdminDropdownItem[] = [
    { key: 'edit', label: '编辑基础信息', onClick: onEdit },
  ]

  if (row.visibility_status !== 'public') {
    items.push({ key: 'set-public', label: '设为公开', onClick: () => onVisibility('public') })
  }
  if (row.visibility_status !== 'internal') {
    items.push({ key: 'set-internal', label: '设为内部', onClick: () => onVisibility('internal') })
  }
  if (row.visibility_status !== 'hidden') {
    items.push({ key: 'set-hidden', label: '设为隐藏', danger: true, onClick: () => onVisibility('hidden') })
  }

  if (!row.is_published) {
    items.push({ key: 'publish', label: '上架', onClick: () => onTransition('publish') })
  } else {
    items.push({ key: 'unpublish', label: '下架', danger: true, onClick: () => onTransition('unpublish') })
  }

  if (row.review_status === 'pending_review') {
    items.push({ key: 'approve', label: '通过审核', onClick: () => onTransition('approve') })
    items.push({ key: 'reject', label: '拒绝审核', danger: true, onClick: () => onTransition('reject') })
  }
  if (row.review_status === 'rejected') {
    items.push({ key: 'reopen', label: '重开审核', onClick: () => onTransition('reopen_pending') })
  }

  items.push(
    { key: 'douban-sync', label: '豆瓣同步', disabled: !isAdmin, onClick: onDouban },
    { key: 'refetch', label: '重新采集', onClick: onRefetch },
    { key: 'view-detail', label: '查看详情（前台）', onClick: onViewDetail },
  )

  return items
}

// ── component ─────────────────────────────────────────────────────

const TRIGGER_STYLE: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: '4px 8px',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--fg-muted)',
  fontSize: '16px',
  lineHeight: 1,
}

export function VideoRowActions({ row, isAdmin, onRowUpdate, onEditRequest }: VideoRowActionsProps) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const withOptimistic = useCallback(
    async (patch: Partial<VideoAdminRow>, apiCall: () => Promise<unknown>) => {
      const rollback: Partial<VideoAdminRow> = {
        visibility_status: row.visibility_status,
        is_published: row.is_published,
        review_status: row.review_status,
      }
      setPending(true)
      setOpen(false)
      onRowUpdate(row.id, patch)
      try {
        await apiCall()
      } catch {
        onRowUpdate(row.id, rollback)
      } finally {
        setPending(false)
      }
    },
    [row, onRowUpdate],
  )

  const withSimple = useCallback(async (apiCall: () => Promise<unknown>) => {
    setPending(true)
    setOpen(false)
    try {
      await apiCall()
    } catch {
      // non-optimistic: nothing to roll back
    } finally {
      setPending(false)
    }
  }, [])

  const items = buildItems(
    row,
    isAdmin,
    () => { setOpen(false); onEditRequest(row.id) },
    (v) => withOptimistic({ visibility_status: v }, () => updateVisibility(row.id, v)),
    (action) => {
      const patch: Partial<VideoAdminRow> =
        action === 'publish' ? { is_published: true }
        : action === 'unpublish' ? { is_published: false }
        : action === 'approve' ? { review_status: 'approved' }
        : action === 'reject' ? { review_status: 'rejected' }
        : action === 'reopen_pending' ? { review_status: 'pending_review' }
        : {}
      return withOptimistic(patch, () => stateTransition(row.id, action))
    },
    () => withSimple(() => doubanSync(row.id)),
    () => withSimple(() => refetchSources(row.id)),
    () => { setOpen(false); window.open(getDetailHref(row), '_blank') },
  )

  return (
    <AdminDropdown
      open={open}
      trigger={
        <button
          type="button"
          disabled={pending}
          data-pending={pending || undefined}
          data-testid="row-actions-trigger"
          aria-label={`${row.title} 行操作`}
          style={TRIGGER_STYLE}
        >
          ⋯
        </button>
      }
      items={items}
      onOpenChange={setOpen}
      align="right"
      data-testid="row-actions-dropdown"
    />
  )
}

'use client'

/**
 * HomeModuleCard.tsx — 运营位单条模块卡片（可拖拽排序）
 * 消费：HomeOpsClient.tsx（CHG-SN-5-07）
 *
 * 职责单一：展示模块信息 + 拖拽 handle + 操作按钮（发布切换/编辑/删除）
 */

import type { CSSProperties } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { AdminButton } from '@resovo/admin-ui'
import type { HomeModule } from '@/lib/home-modules/types'

// ── 常量 ─────────────────────────────────────────────────────────

const CONTENT_REF_TYPE_LABEL: Record<string, string> = {
  video: '视频',
  external_url: '外部链接',
  custom_html: '自定义 HTML',
  video_type: '视频类型',
}

const CARD_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '10px 14px',
  background: 'var(--bg-surface-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  marginBottom: '6px',
  userSelect: 'none',
}

const DRAG_HANDLE_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  color: 'var(--fg-muted)',
  cursor: 'grab',
  flexShrink: 0,
  padding: '2px',
}

const INFO_STYLE: CSSProperties = {
  flex: '1 1 auto',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
}

const REF_TEXT_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-default)',
  fontWeight: 500,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const META_TEXT_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-2xs)',
  color: 'var(--fg-muted)',
}

const BADGE_BASE: CSSProperties = {
  display: 'inline-block',
  padding: '1px 6px',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--font-size-2xs)',
  fontWeight: 500,
  border: '1px solid transparent',
  whiteSpace: 'nowrap',
}

const ENABLED_BADGE: CSSProperties = {
  ...BADGE_BASE,
  background: 'var(--state-success-bg)',
  color: 'var(--state-success-fg)',
  borderColor: 'var(--state-success-border)',
}

const DISABLED_BADGE: CSSProperties = {
  ...BADGE_BASE,
  background: 'var(--bg-subtle, var(--bg-surface))',
  color: 'var(--fg-muted)',
  borderColor: 'var(--border-subtle)',
}

const ACTIONS_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  flexShrink: 0,
}

// ── Props ─────────────────────────────────────────────────────────

export interface HomeModuleCardProps {
  readonly module: HomeModule
  readonly pendingId: string | null
  readonly onEdit: (module: HomeModule) => void
  readonly onDelete: (id: string) => void
  readonly onPublishToggle: (id: string, enabled: boolean) => void
}

// ── 组件 ─────────────────────────────────────────────────────────

export function HomeModuleCard({ module, pendingId, onEdit, onDelete, onPublishToggle }: HomeModuleCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: module.id })

  const style: CSSProperties = {
    ...CARD_STYLE,
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const isPending = pendingId === module.id
  const typeLabel = CONTENT_REF_TYPE_LABEL[module.contentRefType] ?? module.contentRefType

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`home-module-card-${module.id}`}
    >
      <div style={DRAG_HANDLE_STYLE} {...attributes} {...listeners} aria-label="拖拽排序">
        <GripVertical size={16} />
      </div>

      <div style={INFO_STYLE}>
        <span style={REF_TEXT_STYLE} title={module.contentRefId}>
          [{typeLabel}] {module.contentRefId}
        </span>
        <span style={META_TEXT_STYLE}>
          排序 {module.ordering}
          {module.brandScope === 'brand-specific' && module.brandSlug ? ` · ${module.brandSlug}` : ''}
          {module.startAt || module.endAt ? ` · ${module.startAt ?? '—'} → ${module.endAt ?? '—'}` : ''}
        </span>
      </div>

      <span style={module.enabled ? ENABLED_BADGE : DISABLED_BADGE}>
        {module.enabled ? '已发布' : '隐藏'}
      </span>

      <div style={ACTIONS_STYLE}>
        <AdminButton
          variant={module.enabled ? 'default' : 'default'}
          size="sm"
          loading={isPending}
          onClick={() => onPublishToggle(module.id, !module.enabled)}
          data-testid={`home-module-toggle-${module.id}`}
        >
          {module.enabled ? '隐藏' : '发布'}
        </AdminButton>
        <AdminButton
          variant="default"
          size="sm"
          disabled={isPending}
          onClick={() => onEdit(module)}
          data-testid={`home-module-edit-${module.id}`}
        >
          编辑
        </AdminButton>
        <AdminButton
          variant="danger"
          size="sm"
          loading={isPending}
          onClick={() => onDelete(module.id)}
          data-testid={`home-module-delete-${module.id}`}
        >
          删除
        </AdminButton>
      </div>
    </div>
  )
}

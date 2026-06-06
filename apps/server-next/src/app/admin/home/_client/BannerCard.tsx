'use client'

/**
 * BannerCard.tsx — home_banners 单条 Banner 卡片（可拖拽排序）
 * （CHG-HOME-BANNER-UNIFY-B / ADR-181 D-181-1）
 *
 * 消费：BannerOpsSection.tsx。形态参照 HomeModuleCard（设计稿 §5.7 同范式）：
 * drag handle + #序号 + 120×54 横图 + title/meta + 状态 Pill + 操作。
 * home_banners.image_url NOT NULL（migration 049）——无缺图占位分支；
 * 尺寸/比例警告级校验归 Phase 2 CHG-HOME-IMAGE-GUARD-BANNER。
 */

import type { CSSProperties } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { AdminButton, Pill } from '@resovo/admin-ui'
import type { Banner } from '@/lib/banners/types'

// ── 常量（与 HomeModuleCard 同规格）──────────────────────────────

const LINK_TYPE_LABEL: Record<string, string> = {
  video: '视频',
  external: '外部链接',
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

const INDEX_STYLE: CSSProperties = {
  width: 24,
  fontSize: 'var(--font-size-xs)',
  fontWeight: 600,
  color: 'var(--fg-muted)',
  textAlign: 'right',
  flexShrink: 0,
}

const THUMB_STYLE: CSSProperties = {
  width: 120,
  height: 54,
  borderRadius: 'var(--radius-sm)',
  objectFit: 'cover',
  flexShrink: 0,
  background: 'var(--bg-surface-sunken)',
  border: '1px solid var(--border-subtle)',
}

const INFO_STYLE: CSSProperties = {
  flex: '1 1 auto',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
}

const TITLE_TEXT_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--fg-default)',
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const META_TEXT_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-2xs)',
  color: 'var(--fg-muted)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const ACTIONS_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  flexShrink: 0,
}

// ── 展示派生 ─────────────────────────────────────────────────────

/** 标题降级链：title.zh-CN → title.en → 首个 locale 值 → linkTarget 摘要 */
export function deriveBannerTitle(banner: Banner): string {
  const fromColumn = banner.title['zh-CN'] || banner.title['en'] || Object.values(banner.title)[0]
  if (fromColumn) return fromColumn
  return `[${LINK_TYPE_LABEL[banner.linkType] ?? banner.linkType}] ${banner.linkTarget || banner.id}`
}

export interface BannerStatus {
  readonly variant: 'ok' | 'warn' | 'neutral'
  readonly label: string
}

/**
 * 状态派生（与 home_modules deriveModuleStatus 同语义同 variant 口径，
 * 字段映射 D-181-3：is_active→enabled / active_from→startAt / active_to→endAt；
 * banner 无引用失效态——image_url NOT NULL 且 linkTarget 不做存活探测）。
 */
export function deriveBannerStatus(banner: Banner, now: Date = new Date()): BannerStatus {
  if (!banner.isActive) return { variant: 'neutral', label: '已停用' }
  if (banner.activeTo && new Date(banner.activeTo).getTime() <= now.getTime()) return { variant: 'neutral', label: '已过期' }
  if (banner.activeFrom && new Date(banner.activeFrom).getTime() > now.getTime()) return { variant: 'warn', label: '待生效' }
  return { variant: 'ok', label: '生效中' }
}

/** 时间窗本地化（与 HomeModuleCard.formatTimeWindow 同实现；第 3 消费方出现时抽 lib） */
function formatTimeWindow(activeFrom: string | null, activeTo: string | null): string | null {
  if (!activeFrom && !activeTo) return null
  const fmt = (iso: string) => {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  return `${activeFrom ? fmt(activeFrom) : '即时'} → ${activeTo ? fmt(activeTo) : '永久'}`
}

// ── Props ─────────────────────────────────────────────────────────

export interface BannerCardProps {
  readonly banner: Banner
  /** 列表内序号（0 起，显示为 #N+1） */
  readonly index: number
  readonly pendingId: string | null
  readonly onEdit: (banner: Banner) => void
  readonly onDelete: (banner: Banner) => void
  readonly onActiveToggle: (id: string, isActive: boolean) => void
}

// ── 组件 ─────────────────────────────────────────────────────────

export function BannerCard({ banner, index, pendingId, onEdit, onDelete, onActiveToggle }: BannerCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: banner.id })

  const style: CSSProperties = {
    ...CARD_STYLE,
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const isPending = pendingId === banner.id
  const displayTitle = deriveBannerTitle(banner)
  const status = deriveBannerStatus(banner)
  const timeWindow = formatTimeWindow(banner.activeFrom, banner.activeTo)

  const metaParts = [
    LINK_TYPE_LABEL[banner.linkType] ?? banner.linkType,
    banner.brandScope === 'brand-specific' && banner.brandSlug ? banner.brandSlug : null,
    timeWindow,
  ].filter(Boolean)

  return (
    <div ref={setNodeRef} style={style} data-testid={`banner-card-${banner.id}`}>
      <div style={DRAG_HANDLE_STYLE} {...attributes} {...listeners} aria-label="拖拽排序">
        <GripVertical size={16} />
      </div>

      <span style={INDEX_STYLE} data-testid={`banner-index-${banner.id}`}>#{index + 1}</span>

      {/* image_url NOT NULL，恒有图；装饰性配图 alt 留空（标题承载语义） */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={banner.imageUrl}
        alt=""
        aria-hidden="true"
        loading="lazy"
        style={THUMB_STYLE}
        data-testid={`banner-thumb-${banner.id}`}
      />

      <div style={INFO_STYLE}>
        <span style={TITLE_TEXT_STYLE} title={displayTitle}>
          {displayTitle}
        </span>
        <span style={META_TEXT_STYLE} title={banner.linkTarget}>
          {metaParts.join(' · ')}
        </span>
      </div>

      <Pill variant={status.variant} testId={`banner-status-${banner.id}`}>
        {status.label}
      </Pill>

      <div style={ACTIONS_STYLE}>
        <AdminButton
          variant={banner.isActive ? 'default' : 'primary'}
          size="sm"
          loading={isPending}
          onClick={() => onActiveToggle(banner.id, !banner.isActive)}
          data-testid={`banner-toggle-${banner.id}`}
        >
          {banner.isActive ? '停用' : '启用'}
        </AdminButton>
        <AdminButton
          variant="default"
          size="sm"
          disabled={isPending}
          onClick={() => onEdit(banner)}
          data-testid={`banner-edit-${banner.id}`}
        >
          编辑
        </AdminButton>
        <AdminButton
          variant="danger"
          size="sm"
          loading={isPending}
          onClick={() => onDelete(banner)}
          data-testid={`banner-delete-${banner.id}`}
        >
          删除
        </AdminButton>
      </div>
    </div>
  )
}

'use client'

/**
 * HomeModuleCard.tsx — 运营位单条模块卡片（可拖拽排序）
 * 消费：HomeOpsClient.tsx（CHG-SN-5-07；CHG-HOME-UX-04-A 设计稿 §5.7 重排）
 *
 * 形态（reference.md §5.7）：drag handle + #序号 + 120×54 横图 + title/meta + 四色 Pill + 操作。
 *   - 横图降级链：module.imageUrl → videoMeta.coverUrl → 占位（D-052-10）
 *   - 标题降级链：title.zh-CN → title.en → videoMeta.title → [类型] refId
 *   - 120×54 用页面本地 img，不扩 admin-ui Thumb（D-104-10）
 *   - 状态 Pill：deriveModuleStatus 四色（P-home §6）
 */

import type { CSSProperties } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ImageOff } from 'lucide-react'
import { AdminButton, Pill } from '@resovo/admin-ui'
import type { HomeModule } from '@/lib/home-modules/types'
import type { VideoMeta } from '@/lib/home-modules/use-video-meta-map'
import { deriveModuleStatus } from '@/lib/home-modules/derive-status'

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

const INDEX_STYLE: CSSProperties = {
  width: 24,
  fontSize: 'var(--font-size-xs)',
  fontWeight: 600,
  color: 'var(--fg-muted)',
  textAlign: 'right',
  flexShrink: 0,
}

// 设计稿 §5.7：120×54 横图（页面本地 img，D-104-10 不扩 Thumb）
const THUMB_STYLE: CSSProperties = {
  width: 120,
  height: 54,
  borderRadius: 'var(--radius-sm)',
  objectFit: 'cover',
  flexShrink: 0,
  background: 'var(--bg-surface-sunken)',
  border: '1px solid var(--border-subtle)',
}

const THUMB_PLACEHOLDER_STYLE: CSSProperties = {
  ...THUMB_STYLE,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--fg-subtle)',
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

/** 标题降级链：title.zh-CN → title.en → 视频标题 → [类型] refId */
function deriveDisplayTitle(module: HomeModule, videoMeta: VideoMeta | null | undefined): string {
  const fromColumn = module.title['zh-CN'] || module.title['en']
  if (fromColumn) return fromColumn
  if (videoMeta?.title) return videoMeta.title
  const typeLabel = CONTENT_REF_TYPE_LABEL[module.contentRefType] ?? module.contentRefType
  return `[${typeLabel}] ${module.contentRefId}`
}

/** 时间窗本地化：「06-01 08:00 → 06-30 23:59」；无时效返回 null 不占 meta 位 */
function formatTimeWindow(startAt: string | null, endAt: string | null): string | null {
  if (!startAt && !endAt) return null
  const fmt = (iso: string) => {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  return `${startAt ? fmt(startAt) : '即时'} → ${endAt ? fmt(endAt) : '永久'}`
}

// ── Props ─────────────────────────────────────────────────────────

export interface HomeModuleCardProps {
  readonly module: HomeModule
  /** 列表内序号（0 起，显示为 #N+1，设计稿 §5.7） */
  readonly index: number
  /** video 类型充实数据；null=引用失效（红 pill），undefined=未取回/非 video */
  readonly videoMeta?: VideoMeta | null
  readonly pendingId: string | null
  readonly onEdit: (module: HomeModule) => void
  readonly onDelete: (id: string) => void
  readonly onPublishToggle: (id: string, enabled: boolean) => void
}

// ── 组件 ─────────────────────────────────────────────────────────

export function HomeModuleCard({ module, index, videoMeta, pendingId, onEdit, onDelete, onPublishToggle }: HomeModuleCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: module.id })

  const style: CSSProperties = {
    ...CARD_STYLE,
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const isPending = pendingId === module.id
  const typeLabel = CONTENT_REF_TYPE_LABEL[module.contentRefType] ?? module.contentRefType
  const displayTitle = deriveDisplayTitle(module, videoMeta)
  const imageSrc = module.imageUrl ?? videoMeta?.coverUrl ?? null
  const status = deriveModuleStatus(module, videoMeta)
  const timeWindow = formatTimeWindow(module.startAt, module.endAt)

  const metaParts = [
    typeLabel,
    `排序 ${module.ordering}`,
    module.brandScope === 'brand-specific' && module.brandSlug ? module.brandSlug : null,
    timeWindow,
  ].filter(Boolean)

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`home-module-card-${module.id}`}
    >
      <div style={DRAG_HANDLE_STYLE} {...attributes} {...listeners} aria-label="拖拽排序">
        <GripVertical size={16} />
      </div>

      <span style={INDEX_STYLE} data-testid={`home-module-index-${module.id}`}>#{index + 1}</span>

      {imageSrc ? (
        // 运营横图为装饰性配图（标题已承载语义），alt 留空
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc}
          alt=""
          aria-hidden="true"
          loading="lazy"
          style={THUMB_STYLE}
          data-testid={`home-module-thumb-${module.id}`}
        />
      ) : (
        <div style={THUMB_PLACEHOLDER_STYLE} aria-hidden="true" data-testid={`home-module-thumb-placeholder-${module.id}`}>
          <ImageOff size={18} />
        </div>
      )}

      <div style={INFO_STYLE}>
        <span style={TITLE_TEXT_STYLE} title={displayTitle}>
          {displayTitle}
        </span>
        <span style={META_TEXT_STYLE} title={module.contentRefId}>
          {metaParts.join(' · ')}
        </span>
      </div>

      <Pill variant={status.variant} testId={`home-module-status-${module.id}`}>
        {status.label}
      </Pill>

      <div style={ACTIONS_STYLE}>
        <AdminButton
          variant={module.enabled ? 'default' : 'primary'}
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

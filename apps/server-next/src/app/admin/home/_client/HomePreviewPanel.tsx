'use client'

/**
 * HomePreviewPanel.tsx — /admin/home 右侧 sticky 前台预览面板（CHG-SN-7-MISC-HOME-1）
 *
 * 设计：reference.md §5.7「预览卡保留前台视觉，不套后台表格语言」
 * 布局定位：HomeOpsClient 1fr/360px grid 右侧，position:sticky。
 *
 * 仅消费已加载的 modules 数据（无额外 API 调用），实时响应拖拽/发布切换。
 * CHG-HOME-UX-06 轻拟真：emoji/UUID 占位 → 真实封面 + 标题（videoMetaMap 由父级
 * HomeOpsClient 下传，本组件保持不自取数据原则）。
 */
import type { CSSProperties } from 'react'
import { ImageOff, Link2 } from 'lucide-react'
import type { HomeModule, HomeModuleSlot } from '@/lib/home-modules/types'
import type { VideoMeta, VideoMetaMap } from '@/lib/home-modules/use-video-meta-map'

// ── 样式常量 ───────────────────────────────────────────────────────

const PANEL_STYLE: CSSProperties = {
  position: 'sticky',
  top: 0,
  width: '360px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  overflow: 'hidden',
  maxHeight: 'calc(100vh - 80px)',
}

const PANEL_HEADER_STYLE: CSSProperties = {
  padding: '12px 14px 10px',
  borderBottom: '1px solid var(--border-subtle)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexShrink: 0,
}

const PANEL_TITLE_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  fontWeight: 600,
  color: 'var(--fg-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
}

const PANEL_COUNT_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  background: 'var(--bg-surface-sunken)',
  padding: '2px 6px',
  borderRadius: 'var(--radius-pill)',
}

const PANEL_BODY_STYLE: CSSProperties = {
  padding: '8px 10px',
  overflowY: 'auto',
  flex: '1 1 auto',
  minHeight: 0,
}

const EMPTY_STYLE: CSSProperties = {
  padding: '24px 0',
  textAlign: 'center',
  color: 'var(--fg-muted)',
  fontSize: 'var(--font-size-xs)',
}

// ── slot-specific preview item styles ─────────────────────────────

const BANNER_ITEM_STYLE: CSSProperties = {
  display: 'flex',
  gap: '8px',
  padding: '8px',
  background: 'var(--bg-surface-elevated)',
  borderRadius: 'var(--radius-sm)',
  marginBottom: '6px',
  alignItems: 'center',
  border: '1px solid var(--border-subtle)',
}

const BANNER_THUMB_STYLE: CSSProperties = {
  width: 100,
  height: 45,
  background: 'var(--bg-surface-sunken)',
  borderRadius: 'var(--radius-xs)',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 'var(--font-size-xxs)',
  color: 'var(--fg-subtle)',
}

const POSTER_ITEM_STYLE: CSSProperties = {
  display: 'flex',
  gap: '8px',
  padding: '6px 8px',
  background: 'var(--bg-surface-elevated)',
  borderRadius: 'var(--radius-sm)',
  marginBottom: '4px',
  alignItems: 'center',
  border: '1px solid var(--border-subtle)',
}

const POSTER_THUMB_STYLE: CSSProperties = {
  width: 36,
  height: 52,
  background: 'var(--bg-surface-sunken)',
  borderRadius: 'var(--radius-xs)',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 'var(--font-size-xxs)',
  color: 'var(--fg-subtle)',
}

const PILLS_WRAP_STYLE: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
  padding: '6px 0',
}

const PILL_STYLE: CSSProperties = {
  padding: '4px 10px',
  borderRadius: 'var(--radius-pill)',
  background: 'var(--bg-surface-elevated)',
  border: '1px solid var(--border-default)',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-default)',
  fontWeight: 500,
}

const REF_TEXT_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-default)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '180px',
}

const DISABLED_OVERLAY: CSSProperties = {
  opacity: 0.4,
  textDecoration: 'line-through',
}

const RANK_STYLE: CSSProperties = {
  width: 20,
  fontSize: 'var(--font-size-xs)',
  fontWeight: 700,
  color: 'var(--fg-muted)',
  flexShrink: 0,
  textAlign: 'right',
}

const SLOT_LABEL: Record<HomeModuleSlot, string> = {
  banner: '轮播广告',
  featured: '精选推荐',
  top10: 'TOP 10',
  type_shortcuts: '类型快捷',
}

// ── video type label mapping ───────────────────────────────────────

const VIDEO_TYPE_LABEL: Record<string, string> = {
  movie: '电影',
  series: '剧集',
  anime: '动漫',
  variety: '综艺',
  documentary: '纪录片',
  short: '短片',
}

// ── 展示派生（CHG-HOME-UX-06：与 HomeModuleCard 同降级口径）─────────

/** 标题降级链：title.zh-CN → title.en → 视频标题 → contentRefId */
function previewTitle(module: HomeModule, meta: VideoMeta | null | undefined): string {
  return module.title['zh-CN'] || module.title['en'] || meta?.title || module.contentRefId
}

// ── Preview Items ──────────────────────────────────────────────────

function BannerPreviewItem({ module, rank, meta }: { module: HomeModule; rank: number; meta: VideoMeta | null | undefined }) {
  const itemStyle = module.enabled ? BANNER_ITEM_STYLE : { ...BANNER_ITEM_STYLE, ...DISABLED_OVERLAY }
  // 横图降级链与卡片一致：imageUrl → coverUrl → icon 占位（emoji 退役）
  const imageSrc = module.imageUrl ?? meta?.coverUrl ?? null
  return (
    <div style={itemStyle} data-preview-banner-item>
      {imageSrc ? (
        // 装饰性配图（标题已承载语义）
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageSrc} alt="" aria-hidden="true" loading="lazy" style={{ ...BANNER_THUMB_STYLE, objectFit: 'cover' }} data-preview-banner-img />
      ) : (
        <div style={BANNER_THUMB_STYLE} aria-hidden="true">
          {module.contentRefType === 'video' ? <ImageOff size={14} /> : <Link2 size={14} />}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--fg-muted)', marginBottom: 2 }}>
          #{rank} · {module.contentRefType}
        </div>
        <div style={REF_TEXT_STYLE} title={previewTitle(module, meta)}>
          {previewTitle(module, meta)}
        </div>
      </div>
    </div>
  )
}

function PosterPreviewItem({ module, rank, meta }: { module: HomeModule; rank: number; meta: VideoMeta | null | undefined }) {
  const itemStyle = module.enabled ? POSTER_ITEM_STYLE : { ...POSTER_ITEM_STYLE, ...DISABLED_OVERLAY }
  // 海报位优先视频封面（竖版语义），imageUrl 横图兜底
  const posterSrc = meta?.coverUrl ?? module.imageUrl ?? null
  return (
    <div style={itemStyle} data-preview-poster-item>
      <div style={RANK_STYLE}>{rank}</div>
      {posterSrc ? (
        // 装饰性配图
        // eslint-disable-next-line @next/next/no-img-element
        <img src={posterSrc} alt="" aria-hidden="true" loading="lazy" style={{ ...POSTER_THUMB_STYLE, objectFit: 'cover' }} data-preview-poster-img />
      ) : (
        <div style={POSTER_THUMB_STYLE} aria-hidden="true"><ImageOff size={14} /></div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={REF_TEXT_STYLE} title={previewTitle(module, meta)}>
          {previewTitle(module, meta)}
        </div>
      </div>
    </div>
  )
}

function TypeShortcutsPreview({ modules }: { modules: readonly HomeModule[] }) {
  return (
    <div style={PILLS_WRAP_STYLE} data-preview-shortcuts>
      {modules.map((m) => {
        const label = VIDEO_TYPE_LABEL[m.contentRefId] ?? m.contentRefId
        const pillStyle = m.enabled ? PILL_STYLE : { ...PILL_STYLE, opacity: 0.4, textDecoration: 'line-through' as const }
        return (
          <span key={m.id} style={pillStyle} data-preview-pill>
            {label}
          </span>
        )
      })}
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────

const EMPTY_META_MAP: VideoMetaMap = new Map()

export interface HomePreviewPanelProps {
  readonly slot: HomeModuleSlot
  readonly modules: readonly HomeModule[]
  /** video 引用充实数据（CHG-HOME-UX-06；父级 HomeOpsClient 下传，本组件不自取） */
  readonly videoMetaMap?: VideoMetaMap
}

export function HomePreviewPanel({ slot, modules, videoMetaMap = EMPTY_META_MAP }: HomePreviewPanelProps) {
  const enabledCount = modules.filter((m) => m.enabled).length
  const metaOf = (m: HomeModule): VideoMeta | null | undefined =>
    m.contentRefType === 'video' ? videoMetaMap.get(m.contentRefId) : undefined

  return (
    <div data-home-preview-panel style={PANEL_STYLE}>
      <div style={PANEL_HEADER_STYLE}>
        <span style={PANEL_TITLE_STYLE}>前台预览 · {SLOT_LABEL[slot]}</span>
        <span style={PANEL_COUNT_STYLE}>{enabledCount}/{modules.length}</span>
      </div>
      <div style={PANEL_BODY_STYLE}>
        {modules.length === 0 ? (
          <div style={EMPTY_STYLE}>暂无模块</div>
        ) : slot === 'type_shortcuts' ? (
          <TypeShortcutsPreview modules={modules} />
        ) : slot === 'banner' ? (
          modules.map((m, i) => (
            <BannerPreviewItem key={m.id} module={m} rank={i + 1} meta={metaOf(m)} />
          ))
        ) : (
          modules.map((m, i) => (
            <PosterPreviewItem key={m.id} module={m} rank={i + 1} meta={metaOf(m)} />
          ))
        )}
      </div>
    </div>
  )
}

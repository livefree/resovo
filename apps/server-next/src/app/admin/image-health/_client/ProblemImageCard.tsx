'use client'

/**
 * ProblemImageCard.tsx — 问题图片卡（ADR-211 D-211-3/D-211-6 / 设计 §6）
 *
 * 缩略 = 真实 `imageUrl` + `<img onError>` → 「✗ 加载失败」失败态（`--state-error-border` 红框，
 * 非原生裂图、非前台 FallbackCover）。语义 =「亮问题给运维」（区别前台 FallbackCover「藏问题给用户」）。
 * **不复用 admin-ui `Thumb`**（其 hasSrc 分支无 onError 会原生裂图，D-211-6）。
 * 卡下显影片标题（取代域名，truncate）；hover/focus 详情浮层（状态/来源/原因/域/次数/时间，
 * secondary 空字段隐藏 Codex L-2）；problemReason 分色（真坏 danger）。
 * 点击 → onOpen(row)（父级开 ImageGovernanceDrawer 定位该 kind）。
 */
import { useState, type CSSProperties } from 'react'
import { Pill } from '@resovo/admin-ui'
import type { ProblemImageRow, ProblemImageKind, ProblemReason } from '@/lib/image-health/api'

// ── 缩略比例按 kind（封面 2:3 / 背景·Banner 16:9 / 台标 1:1）─────────
const KIND_ASPECT: Record<ProblemImageKind, string> = {
  poster: '2 / 3',
  backdrop: '16 / 9',
  logo: '1 / 1',
  banner_backdrop: '16 / 9',
}

// problemReason → Pill variant + 中文标签（分色：真坏 danger，unknown 待验证 warn，low_quality info）
// ADR-213 D-213-7：broken_event→client_error（浏览器上报）；新增 unknown（stale-ok：status=ok 但久未复检）。
const REASON_META: Record<ProblemReason, { variant: 'danger' | 'warn' | 'info'; label: string }> = {
  client_error:   { variant: 'danger', label: '加载失败' },
  broken:         { variant: 'danger', label: '已标破损' },
  low_quality:    { variant: 'info',   label: '低质量' },
  pending_review: { variant: 'warn',   label: '待复核' },
  unknown:        { variant: 'warn',   label: '未验证' },
  other:          { variant: 'info',   label: '其他' },
}

// ── 样式常量（全 token，零硬编码色）────────────────────────────────
const WRAP_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  minWidth: 0,
}

const CARD_STYLE: CSSProperties = {
  position: 'relative',
  width: '100%',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  overflow: 'hidden',
  background: 'var(--bg-surface-sunken)',
  padding: 0,
  cursor: 'pointer',
  font: 'inherit',
  color: 'inherit',
  display: 'block',
}

const IMG_STYLE: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
}

// onError → 失败态（--state-error-border 红框 + ✗ 图标 + 文案）
const FAILED_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  border: '2px solid var(--state-error-border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--state-error-bg)',
  color: 'var(--state-error-border)',
  fontSize: '20px',
}

const FAILED_TEXT_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  fontWeight: 600,
}

// reason 角标（左上）
const REASON_BADGE_STYLE: CSSProperties = {
  position: 'absolute',
  top: '4px',
  left: '4px',
  zIndex: 1,
}

// 分辨率角标（右下，常显）——便于扫图判 low_quality 阈值（natural 尺寸 = worker 测量同源）。全 token。
const DIM_BADGE_STYLE: CSSProperties = {
  position: 'absolute',
  bottom: '4px',
  right: '4px',
  zIndex: 1,
  padding: '0 4px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-muted)',
  border: '1px solid var(--border-default)',
  fontSize: 'var(--font-size-xs)',
  fontVariantNumeric: 'tabular-nums',
  pointerEvents: 'none',
}

// hover/focus 详情浮层（绝对定位盖缩略上方）
const DETAIL_OVERLAY_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  padding: '6px',
  background: 'var(--bg-surface)',
  color: 'var(--fg-default)',
  fontSize: 'var(--font-size-xs)',
  lineHeight: 1.3,
  textAlign: 'left',
  overflow: 'hidden',
  transition: 'opacity 120ms ease',
  pointerEvents: 'none',
}

const TITLE_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-default)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

export interface ProblemImageCardProps {
  readonly row: ProblemImageRow
  readonly onOpen: (row: ProblemImageRow) => void
}

export function ProblemImageCard({ row, onOpen }: ProblemImageCardProps) {
  const [failed, setFailed] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  const reason = REASON_META[row.problemReason] ?? REASON_META.other

  return (
    <div style={WRAP_STYLE} data-problem-card data-problem-reason={row.problemReason}>
      <button
        type="button"
        style={{ ...CARD_STYLE, aspectRatio: KIND_ASPECT[row.kind] }}
        title={row.title}
        aria-label={`治理问题图片：${row.title}`}
        onClick={() => onOpen(row)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      >
        {failed ? (
          <span style={FAILED_STYLE} data-problem-failed>
            <span aria-hidden>✕</span>
            <span style={FAILED_TEXT_STYLE}>加载失败</span>
          </span>
        ) : (
          <img
            src={row.imageUrl}
            alt={row.title}
            style={IMG_STYLE}
            loading="lazy"
            onError={() => setFailed(true)}
            onLoad={(e) => {
              const img = e.currentTarget
              if (img.naturalWidth > 0) setDims({ w: img.naturalWidth, h: img.naturalHeight })
            }}
            data-problem-thumb
          />
        )}

        <span style={REASON_BADGE_STYLE} aria-hidden>
          <Pill variant={reason.variant}>{reason.label}</Pill>
        </span>

        {!failed && dims && (
          <span style={DIM_BADGE_STYLE} data-problem-dims aria-hidden>
            {dims.w}×{dims.h}
          </span>
        )}

        <span
          style={{ ...DETAIL_OVERLAY_STYLE, opacity: hovered ? 1 : 0 }}
          data-problem-detail
          aria-hidden={!hovered}
        >
          <span>状态 {row.status}</span>
          {dims && <span>尺寸 {dims.w}×{dims.h}</span>}
          {row.source && <span>来源 {row.source}</span>}
          {row.eventType && <span>原因 {row.eventType}</span>}
          {row.brokenDomain && <span>域 {row.brokenDomain}</span>}
          {row.occurrenceCount > 0 && <span>次数 {row.occurrenceCount}</span>}
          {row.lastSeenBrokenAt && <span>最近 {row.lastSeenBrokenAt.slice(0, 10)}</span>}
        </span>
      </button>

      <span style={TITLE_STYLE} data-problem-title>{row.title}</span>
    </div>
  )
}

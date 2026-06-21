'use client'

/**
 * BrokenSamplesGrid.tsx — 破损样本瀑布格（CHG-SN-7-MISC-IMAGE-2 / IMGH-P1-3 接入 Lightbox）
 *
 * 设计：reference.md §5.8「右侧 破损样本（grid，2:3 ratio placeholder、
 *       danger dashed border、底部错误信息 overlay）」
 *
 * IMGH-P1-3：缩略点击 → 打开共享 ImageLightbox（放大 + 元信息诊断）。
 *   破损图 URL 多失效 → Lightbox 走降级占位 + 尺寸 '—'，核心价值是元信息 + URL 复制。
 *
 * 数据来源（ADR-210，IMGH-P3-1B）：ImageHealthClient 传入 recent-broken-samples 端点结果
 *   （broken_image_events 事件流口径，与 KPI/趋势/TOP域名同源）。每行即破损样本，无需 client 过滤。
 *   取代旧「借治理表第一页 missingRows + client-side 过滤 posterStatus='broken'」——
 *   该旧设计因 media_catalog.poster_status 全库无 'broken' 恒空（破损样本区空白根因）。
 */
import { useState, type CSSProperties } from 'react'
import { ImageLightbox, type ImageStatus } from '@resovo/admin-ui'
import type { BrokenSampleRow } from '@/lib/image-health/api'

// ── 样式常量 ──────────────────────────────────────────────────────

const GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
  gap: '8px',
}

const CARD_STYLE: CSSProperties = {
  position: 'relative',
  aspectRatio: '2 / 3',
  border: '2px dashed var(--state-danger-fg)',
  borderRadius: 'var(--radius-sm)',
  overflow: 'hidden',
  background: 'var(--bg-surface-sunken)',
  padding: 0,
  cursor: 'pointer',
  font: 'inherit',
  color: 'inherit',
  width: '100%',
}

const PLACEHOLDER_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '20px',
  color: 'var(--state-danger-fg)',
  opacity: 0.4,
}

const OVERLAY_STYLE: CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  background: 'var(--state-error-bg)',
  padding: '3px 4px',
  fontSize: '9px',
  lineHeight: '1.2',
  color: 'var(--state-danger-fg)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const EMPTY_STYLE: CSSProperties = {
  padding: '24px 0',
  textAlign: 'center',
  color: 'var(--fg-muted)',
  fontSize: 'var(--font-size-xs)',
}

const HEADER_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  marginBottom: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}

const COUNT_BADGE_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--state-danger-fg)',
  background: 'var(--state-error-bg)',
  padding: '2px 6px',
  borderRadius: 'var(--radius-pill)',
  fontWeight: 600,
}

// ── 最多渲染 n 个破损样本 ─────────────────────────────────────────
const MAX_SAMPLES = 24

// posterStatus（union with string）→ ImageStatus（Lightbox meta）
const IMAGE_STATUS_SET: ReadonlySet<string> = new Set<ImageStatus>([
  'ok', 'broken', 'missing', 'pending_review', 'low_quality',
])
function toImageStatus(s: string): ImageStatus | undefined {
  return IMAGE_STATUS_SET.has(s) ? (s as ImageStatus) : undefined
}

// ── 子组件 ────────────────────────────────────────────────────────

function BrokenPosterCard({ row, onOpen }: { row: BrokenSampleRow; onOpen: (r: BrokenSampleRow) => void }) {
  // ADR-210 MEDIUM-1：brokenDomain 由 SQL regexp_replace 派生，empty_src 等非 http URL 不匹配时
  // PostgreSQL 返回原串（裸 URL / 空）。overlay 仅在派生出真实域名（含 '.'）时显示域名，
  // 否则降级到破损原因 eventType，最后兜底 posterStatus。
  const overlayText = row.brokenDomain && row.brokenDomain.includes('.')
    ? row.brokenDomain
    : (row.eventType ?? row.posterStatus)
  return (
    <button
      type="button"
      style={CARD_STYLE}
      data-broken-sample
      title={row.title}
      onClick={() => onOpen(row)}
      aria-label={`查看破损样本：${row.title}`}
    >
      <div style={PLACEHOLDER_STYLE} aria-hidden>✕</div>
      <div style={OVERLAY_STYLE} data-broken-overlay>
        {overlayText}
      </div>
    </button>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────

export interface BrokenSamplesGridProps {
  /** ADR-210：recent-broken-samples 端点结果（每行即破损样本，事件流口径） */
  readonly rows: readonly BrokenSampleRow[]
}

export function BrokenSamplesGrid({ rows }: BrokenSamplesGridProps) {
  // ADR-210：rows 已是事件流破损样本，无需 client 过滤；仅截断到 MAX_SAMPLES
  const broken = rows.slice(0, MAX_SAMPLES)
  const [selected, setSelected] = useState<BrokenSampleRow | null>(null)

  return (
    <div data-broken-samples-grid>
      <div style={HEADER_STYLE}>
        <span>近期破损样本</span>
        {broken.length > 0 && (
          <span style={COUNT_BADGE_STYLE} data-broken-count>
            {broken.length}
          </span>
        )}
      </div>
      {broken.length === 0 ? (
        <div style={EMPTY_STYLE}>暂无破损样本</div>
      ) : (
        <div style={GRID_STYLE} data-broken-grid>
          {broken.map((row) => (
            <BrokenPosterCard key={row.videoId} row={row} onOpen={setSelected} />
          ))}
        </div>
      )}

      <ImageLightbox
        open={selected !== null}
        onClose={() => setSelected(null)}
        src={selected?.posterUrl ?? null}
        alt={selected?.title}
        title={selected?.title}
        meta={
          selected
            ? {
                source: selected.posterSource ?? undefined,
                status: toImageStatus(selected.posterStatus),
                brokenDomain: selected.brokenDomain ?? undefined,
                occurrenceCount: selected.occurrenceCount,
              }
            : undefined
        }
        testId="broken-sample-lightbox"
      />
    </div>
  )
}

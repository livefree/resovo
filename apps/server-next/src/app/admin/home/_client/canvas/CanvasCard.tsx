'use client'

/**
 * CanvasCard.tsx — 同构画布卡片（CHG-HOME-CANVAS-A / 方案 §3/§5）
 *
 * 渲染 HomePreviewCard：source 四态（pinned/auto/fallback/empty）+ 风险态 flags
 * 警示（方案 §6 警告级，显著提醒不阻断）。两种形态：
 *   - wide（banner 区，16:9 横图）
 *   - poster（其余区块，2:3 竖图；缺图回退占位）
 * 本卡只读渲染；hover 操作（拖拽/替换/删除/固定）归 Phase 2 CHG-HOME-CARD-DND。
 */

import type { CSSProperties } from 'react'
import { ImageOff, Plus } from 'lucide-react'
import { Pill } from '@resovo/admin-ui'
import type { HomePreviewCard, HomePreviewCardFlag } from '@/lib/home-curation/types'

// ── flags 展示映射（警告级口径，方案 §6）─────────────────────────

const FLAG_LABEL: Record<HomePreviewCardFlag, string> = {
  missing_image: '缺图',
  missing_wide_image: '缺横版大图',
  pending: '待生效',
  expired: '已过期',
  disabled: '已隐藏',
  ref_broken: '引用失效',
  unplayable: '无可播源',
}

const FLAG_VARIANT: Record<HomePreviewCardFlag, 'warn' | 'danger' | 'neutral'> = {
  missing_image: 'warn',
  missing_wide_image: 'warn',
  pending: 'warn',
  expired: 'neutral',
  disabled: 'neutral',
  ref_broken: 'danger',
  unplayable: 'danger',
}

const SOURCE_LABEL: Record<HomePreviewCard['source'], string> = {
  pinned: '置顶',
  auto: '自动',
  fallback: '兜底',
  empty: '空位',
}

// ── 样式 ─────────────────────────────────────────────────────────

const WIDE_STYLE: CSSProperties = {
  position: 'relative',
  width: 240,
  aspectRatio: '16 / 9',
  borderRadius: 'var(--radius-md)',
  overflow: 'hidden',
  background: 'var(--bg-surface-sunken)',
  border: '1px solid var(--border-default)',
  flexShrink: 0,
}

const POSTER_STYLE: CSSProperties = {
  ...WIDE_STYLE,
  width: 108,
  aspectRatio: '2 / 3',
}

const IMG_STYLE: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
}

const PLACEHOLDER_STYLE: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--fg-subtle)',
}

const EMPTY_STYLE: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  color: 'var(--fg-muted)',
  fontSize: 'var(--font-size-2xs)',
  border: '1px dashed var(--border-default)',
  borderRadius: 'var(--radius-md)',
  boxSizing: 'border-box',
}

const TITLE_BAR_STYLE: CSSProperties = {
  position: 'absolute',
  insetInline: 0,
  bottom: 0,
  padding: '14px 8px 6px',
  background: 'linear-gradient(transparent, var(--overlay-scrim, rgba(0,0,0,0.65)))',
  color: 'var(--fg-on-media, #fff)',
  fontSize: 'var(--font-size-2xs)',
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const BADGES_STYLE: CSSProperties = {
  position: 'absolute',
  top: 6,
  left: 6,
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
  maxWidth: 'calc(100% - 12px)',
}

// ── Props ─────────────────────────────────────────────────────────

export interface CanvasCardProps {
  readonly card: HomePreviewCard
  /** banner 区 wide（16:9），其余 poster（2:3） */
  readonly shape: 'wide' | 'poster'
  /** 列表内序号（top10 rank 角标等用；0 起） */
  readonly index: number
}

// ── 组件 ─────────────────────────────────────────────────────────

export function CanvasCard({ card, shape, index }: CanvasCardProps) {
  const frame = shape === 'wide' ? WIDE_STYLE : POSTER_STYLE

  if (card.source === 'empty') {
    return (
      <div style={{ ...frame, background: 'transparent', border: 'none' }} data-testid={`canvas-card-empty-${index}`}>
        <div style={EMPTY_STYLE}>
          <Plus size={16} aria-hidden="true" />
          <span>空位</span>
        </div>
      </div>
    )
  }

  return (
    <div style={frame} data-testid={`canvas-card-${card.refId ?? card.videoId ?? index}`}>
      {card.imageUrl ? (
        // 运营配图为装饰性（标题条承载语义），alt 留空
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.imageUrl} alt="" aria-hidden="true" loading="lazy" style={IMG_STYLE} />
      ) : (
        <div style={PLACEHOLDER_STYLE} aria-hidden="true">
          <ImageOff size={20} />
        </div>
      )}

      <div style={BADGES_STYLE}>
        <Pill variant={card.source === 'pinned' ? 'accent' : 'info'} testId={`canvas-source-${index}`}>
          {SOURCE_LABEL[card.source]}
          {card.explain ? `·${card.explain.origin}` : ''}
        </Pill>
        {card.flags.map((flag) => (
          <Pill key={flag} variant={FLAG_VARIANT[flag]} testId={`canvas-flag-${flag}-${index}`}>
            {FLAG_LABEL[flag]}
          </Pill>
        ))}
      </div>

      {card.title && <div style={TITLE_BAR_STYLE} title={card.title}>{card.title}</div>}
    </div>
  )
}

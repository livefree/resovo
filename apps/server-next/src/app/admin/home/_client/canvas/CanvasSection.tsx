'use client'

/**
 * CanvasSection.tsx — 同构画布区块（CHG-HOME-CANVAS-A / 方案 §3/§4）
 *
 * 按前台区块形态渲染 HomePreviewSection：
 *   banner          → wide 卡横滑（HeroBanner 同构）
 *   type_shortcuts  → chips 行（CategoryShortcuts 同构）
 *   featured        → poster 网格（FeaturedRow 同构简化）
 *   top10           → poster 横滑 + rank 角标（TopTenRow 同构）
 *   hot_*           → poster 横滑（ShelfRow 同构）
 * 区块点击 → onSelect（Inspector 接线归 -B）。
 */

import type { CSSProperties } from 'react'
import { Pill } from '@resovo/admin-ui'
import type { HomePreviewSection } from '@/lib/home-curation/types'
import { CanvasCard } from './CanvasCard'

const SECTION_TITLE: Record<string, string> = {
  banner: 'Hero Banner',
  type_shortcuts: '分类快捷入口',
  featured: '精选推荐',
  top10: 'TOP 10',
  hot_movies: '热门电影',
  hot_series: '热播剧集',
  hot_anime: '热门动漫',
}

const MODE_LABEL: Record<string, string> = {
  manual_only: '纯人工',
  manual_plus_autofill: '人工+自动补位',
  suggest_only: '仅候选',
  full_auto: '全自动',
}

const SECTION_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '12px 14px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-surface)',
  cursor: 'pointer',
}

const HEAD_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const TITLE_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  fontWeight: 700,
  color: 'var(--fg-default)',
}

const META_STYLE: CSSProperties = {
  marginLeft: 'auto',
  fontSize: 'var(--font-size-2xs)',
  color: 'var(--fg-muted)',
}

const ROW_STYLE: CSSProperties = {
  display: 'flex',
  gap: 10,
  overflowX: 'auto',
  paddingBottom: 4,
}

const GRID_STYLE: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
}

const CHIP_STYLE: CSSProperties = {
  padding: '6px 14px',
  borderRadius: 'var(--radius-full, 999px)',
  border: '1px solid var(--border-default)',
  background: 'var(--bg-surface-elevated)',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-default)',
  whiteSpace: 'nowrap',
}

const RANK_WRAP_STYLE: CSSProperties = {
  position: 'relative',
  flexShrink: 0,
}

const RANK_BADGE_STYLE: CSSProperties = {
  position: 'absolute',
  top: -6,
  left: -6,
  zIndex: 1,
  width: 22,
  height: 22,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--accent-default)',
  color: 'var(--fg-on-accent, #fff)',
  fontSize: 'var(--font-size-2xs)',
  fontWeight: 700,
}

export interface CanvasSectionProps {
  readonly section: HomePreviewSection
  /** 区块点击（Inspector 选中，-B 接线；本卡仅高亮回调） */
  readonly onSelect?: (key: HomePreviewSection['key']) => void
  readonly selected?: boolean
}

export function CanvasSection({ section, onSelect, selected }: CanvasSectionProps) {
  const { key, settings, cards } = section
  const isBanner = key === 'banner'
  const isShortcuts = key === 'type_shortcuts'
  const isTop10 = key === 'top10'

  const style: CSSProperties = {
    ...SECTION_STYLE,
    ...(selected ? { borderColor: 'var(--accent-default)', boxShadow: '0 0 0 1px var(--accent-default)' } : {}),
  }

  return (
    <section
      style={style}
      onClick={() => onSelect?.(key)}
      aria-label={SECTION_TITLE[key]}
      data-testid={`canvas-section-${key}`}
    >
      <div style={HEAD_STYLE}>
        <span style={TITLE_STYLE}>{SECTION_TITLE[key] ?? key}</span>
        <Pill variant="neutral" testId={`canvas-mode-${key}`}>{MODE_LABEL[settings.autofillMode] ?? settings.autofillMode}</Pill>
        <span style={META_STYLE}>{cards.filter(c => c.source !== 'empty').length}/{settings.displayCount} 位</span>
      </div>

      {isShortcuts ? (
        <div style={ROW_STYLE} data-testid={`canvas-chips-${key}`}>
          {cards.map((card, i) =>
            card.source === 'empty'
              ? <span key={i} style={{ ...CHIP_STYLE, borderStyle: 'dashed', color: 'var(--fg-muted)' }}>+ 空位</span>
              : <span key={i} style={CHIP_STYLE}>{card.title ?? card.linkHint ?? '—'}</span>,
          )}
        </div>
      ) : (
        <div style={key === 'featured' ? GRID_STYLE : ROW_STYLE}>
          {cards.map((card, i) =>
            isTop10 && card.source !== 'empty' ? (
              <div key={i} style={RANK_WRAP_STYLE}>
                <span style={RANK_BADGE_STYLE} aria-hidden="true">{i + 1}</span>
                <CanvasCard card={card} shape="poster" index={i} />
              </div>
            ) : (
              <CanvasCard key={i} card={card} shape={isBanner ? 'wide' : 'poster'} index={i} />
            ),
          )}
        </div>
      )}
    </section>
  )
}

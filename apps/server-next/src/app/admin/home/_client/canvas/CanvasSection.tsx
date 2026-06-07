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
 * 区块点击 → onSelect（Inspector 联动）。
 *
 * CHG-HOME-CARD-DND-B：SortableContext per section（仅 pinned 且携真源行 id 的卡
 * 注册可拖；auto/fallback/empty 不注册）+ 区块容器 useDroppable（空区块跨区块落位）。
 * DndContext 与 onDragEnd 编排在 HomeCanvas。
 */

import type { CSSProperties, ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Pill } from '@resovo/admin-ui'
import type { HomePreviewCard, HomePreviewSection } from '@/lib/home-curation/types'
import { CanvasCard } from './CanvasCard'
import { SECTION_TITLE, VIDEO_SECTIONS } from './section-meta'

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
  // 拆 longhand：selected 态条件覆写 borderColor——与 `border` 简写混用会在
  // 取消选中重渲时触发 React「Removing a style property during rerender」警告
  // （verify-style-shorthand-conflict 仅查同对象字面量共存，跨常量 spread 为盲区）
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'var(--border-subtle)',
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

// ── 拖拽（CHG-HOME-CARD-DND-B）───────────────────────────────────

/** 可拖判定：pinned 且携真源行 id（auto/fallback 无 DB 行、empty 占位不参与拖拽） */
export function draggableCardId(card: HomePreviewCard): string | null {
  return card.source === 'pinned' && card.refId ? card.refId : null
}

/** sortable 包装（卡形态无关；拖拽中半透明 + grab 光标） */
function SortableCard({ id, children }: { readonly id: string; readonly children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
    opacity: isDragging ? 0.5 : undefined,
    cursor: 'grab',
    flexShrink: 0,
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} data-testid={`canvas-sortable-${id}`}>
      {children}
    </div>
  )
}

/** 有 sortable id 则包拖拽层，否则原样（hooks 不可条件调用 → 拆组件） */
function MaybeSortable({ card, children }: { readonly card: HomePreviewCard; readonly children: ReactNode }) {
  const id = draggableCardId(card)
  return id ? <SortableCard id={id}>{children}</SortableCard> : <>{children}</>
}

// ── Props ─────────────────────────────────────────────────────────

export interface CanvasSectionProps {
  readonly section: HomePreviewSection
  /** 区块点击（Inspector 选中联动） */
  readonly onSelect?: (key: HomePreviewSection['key']) => void
  readonly selected?: boolean
  /** empty 占位点击（添加入口，CHG-HOME-EMPTY-SLOTS / 方案 §5.2）；
   *  banner / 视频型区块上抛，type_shortcuts 维持纯展示（添加链路未立案） */
  readonly onEmptySlot?: (key: HomePreviewSection['key']) => void
}

export function CanvasSection({ section, onSelect, selected, onEmptySlot }: CanvasSectionProps) {
  const { key, settings, cards } = section
  const isBanner = key === 'banner'
  const isShortcuts = key === 'type_shortcuts'
  const isTop10 = key === 'top10'

  // 跨区块落位目标（空区块或落点非卡时由容器承接，HomeCanvas 按 `section:` 前缀识别）
  const { setNodeRef: setDropRef } = useDroppable({ id: `section:${key}` })
  const sortableIds = cards.flatMap((c) => {
    const id = draggableCardId(c)
    return id ? [id] : []
  })

  const style: CSSProperties = {
    ...SECTION_STYLE,
    ...(selected ? { borderColor: 'var(--accent-default)', boxShadow: '0 0 0 1px var(--accent-default)' } : {}),
  }

  // 方案 §5.2 空卡片：banner=添加横版 Banner / 视频型=添加视频 / 其余维持纯展示
  const emptyLabel = isBanner ? '添加横版 Banner' : VIDEO_SECTIONS.has(key) ? '添加视频' : undefined
  const handleEmptyClick = emptyLabel && onEmptySlot ? () => onEmptySlot(key) : undefined

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

      <SortableContext items={sortableIds} strategy={key === 'featured' ? rectSortingStrategy : horizontalListSortingStrategy}>
        {isShortcuts ? (
          <div ref={setDropRef} style={ROW_STYLE} data-testid={`canvas-chips-${key}`}>
            {cards.map((card, i) =>
              card.source === 'empty'
                ? <span key={i} style={{ ...CHIP_STYLE, borderStyle: 'dashed', color: 'var(--fg-muted)' }}>+ 空位</span>
                : (
                  <MaybeSortable key={card.refId ?? i} card={card}>
                    <span style={CHIP_STYLE}>{card.title ?? card.linkHint ?? '—'}</span>
                  </MaybeSortable>
                ),
            )}
          </div>
        ) : (
          <div ref={setDropRef} style={key === 'featured' ? GRID_STYLE : ROW_STYLE}>
            {cards.map((card, i) =>
              isTop10 && card.source !== 'empty' ? (
                <MaybeSortable key={card.refId ?? `auto-${i}`} card={card}>
                  <div style={RANK_WRAP_STYLE}>
                    <span style={RANK_BADGE_STYLE} aria-hidden="true">{i + 1}</span>
                    <CanvasCard card={card} shape="poster" index={i} />
                  </div>
                </MaybeSortable>
              ) : (
                <MaybeSortable key={card.refId ?? `auto-${i}`} card={card}>
                  <CanvasCard
                    card={card}
                    shape={isBanner ? 'wide' : 'poster'}
                    index={i}
                    emptyLabel={emptyLabel}
                    onEmptyClick={handleEmptyClick}
                  />
                </MaybeSortable>
              ),
            )}
          </div>
        )}
      </SortableContext>
    </section>
  )
}

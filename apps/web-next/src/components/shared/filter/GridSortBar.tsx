'use client'

/**
 * GridSortBar — 视频网格左上排序条（共享，SEQ-20260624-01 / HANDOFF-39）
 *
 * 排序按钮按 mode 取值：category=添加时间/人气/评分（SORT_OPTIONS，默认 latest）；
 * search=相关度/添加时间/人气/评分（SEARCH_SORT_OPTIONS，默认 relevance）。
 * URL `sort` + `order` 双参数驱动（与 FilterArea 同源 useSearchParams/useRouter）：
 *   - `sort`：点选项 set ?sort= + reset page；选默认排序删 param 走后端默认（与「全部」对称）。
 *   - `order`（desc|asc）：方向性排序（latest/hot/rating）支持降序/升序切换——
 *     点未激活项 → 激活并复位 desc（删 order）；点已激活方向性项 → 切换 desc↔asc
 *     （desc 删 param、asc 显式 ?order=asc）。relevance 非方向性、点击不切换方向。
 *   - 激活态：sort = get('sort') ?? defaultSort；order = get('order') ?? 'desc'。
 *   - 激活方向性项文字右侧渲染箭头：降序 ↓ / 升序 ↑（作当前方向标示）。
 * 右侧可选「计数」：total + totalLabelKey（本期仅总数，无 per-option 计数）。
 */

import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  SORT_OPTIONS, DEFAULT_SORT, SEARCH_SORT_OPTIONS, DEFAULT_SEARCH_SORT,
  DEFAULT_SORT_DIRECTION, isDirectionalSort,
} from '@resovo/types'
import type { SearchSortOption, SortDirection } from '@resovo/types'
import type { GridSortBarProps } from './types'

// 方向箭头字形（向下=降序 / 向上=升序）。纯视觉标示，aria-hidden；方向语义经 aria-label 传达。
const DIRECTION_ARROW: Record<SortDirection, string> = { desc: '↓', asc: '↑' }

// ── SortButton ────────────────────────────────────────────────────────────────

interface SortButtonProps {
  readonly value: SearchSortOption
  readonly label: string
  readonly isActive: boolean
  /** 激活且方向性时传入当前方向 → 渲染箭头标示；否则 null（不渲染箭头）。 */
  readonly direction: SortDirection | null
  /** 方向无障碍文案：{ desc, asc }（i18n filter.sortDir*）。 */
  readonly directionLabels: Record<SortDirection, string>
  readonly onClick: () => void
}

function SortButton({ value, label, isActive, direction, directionLabels, onClick }: SortButtonProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isActive}
      aria-label={direction ? `${label}，${directionLabels[direction]}` : undefined}
      data-testid={`sort-${value}`}
      data-direction={direction ?? undefined}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        padding: 'var(--space-1) var(--space-3)',
        borderRadius: 'var(--radius-pill)',
        fontSize: '13px',
        fontWeight: isActive ? 600 : 400,
        border: 'none',
        background: isActive ? 'var(--accent-muted)' : 'transparent',
        color: isActive ? 'var(--accent-default)' : 'var(--fg-muted)',
        cursor: 'pointer',
        transition: 'all 150ms ease',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      {direction && (
        <span aria-hidden="true" data-testid={`sort-arrow-${value}`} style={{ fontSize: '11px', lineHeight: 1 }}>
          {DIRECTION_ARROW[direction]}
        </span>
      )}
    </button>
  )
}

// ── GridSortBar ───────────────────────────────────────────────────────────────

export function GridSortBar({ total, totalLabelKey, mode = 'category' }: GridSortBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations()

  // search：4 项含「相关度」(relevance)，无 ?sort= 时默认高亮 relevance（= 后端搜索默认排序，前后端一致，且可点回）。
  // category：3 项，无 ?sort= 时默认高亮 latest（= 后端分类默认排序）。
  const options = mode === 'search' ? SEARCH_SORT_OPTIONS : SORT_OPTIONS
  const defaultSort: SearchSortOption = mode === 'search' ? DEFAULT_SEARCH_SORT : DEFAULT_SORT

  const activeSort: SearchSortOption =
    (searchParams.get('sort') as SearchSortOption | null) ?? defaultSort
  const activeOrder: SortDirection =
    searchParams.get('order') === 'asc' ? 'asc' : DEFAULT_SORT_DIRECTION

  const directionLabels: Record<SortDirection, string> = {
    desc: t('filter.sortDirDesc'),
    asc: t('filter.sortDirAsc'),
  }

  function selectSort(value: SearchSortOption) {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('page')

    if (value === activeSort && isDirectionalSort(value)) {
      // 点已激活的方向性项 → 切换方向（desc 删 param / asc 显式写）。sort param 维持现状。
      const nextOrder: SortDirection = activeOrder === 'desc' ? 'asc' : 'desc'
      if (nextOrder === DEFAULT_SORT_DIRECTION) next.delete('order')
      else next.set('order', nextOrder)
    } else {
      // 切到新排序：选默认排序删 sort 回后端默认（category=latest / search=relevance），否则显式写；
      // 方向一律复位为默认 desc（删 order）。
      if (value === defaultSort) next.delete('sort')
      else next.set('sort', value)
      next.delete('order')
    }
    router.push('?' + next.toString())
  }

  const showCount = total !== undefined && totalLabelKey !== undefined

  return (
    <div
      data-testid="grid-sort-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-2)',
      }}
    >
      <div
        role="radiogroup"
        aria-label={t('filter.sortLabel')}
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}
      >
        {options.map((value) => {
          const isActive = activeSort === value
          // 仅激活且方向性的项渲染方向箭头；relevance / 未激活项不渲染。
          const direction: SortDirection | null =
            isActive && isDirectionalSort(value) ? activeOrder : null
          return (
            <SortButton
              key={value}
              value={value}
              label={t(`filter.sort.${value}`)}
              isActive={isActive}
              direction={direction}
              directionLabels={directionLabels}
              onClick={() => selectSort(value)}
            />
          )
        })}
      </div>

      {showCount && (
        <span
          data-testid="grid-sort-count"
          style={{ fontSize: '13px', color: 'var(--fg-subtle)', whiteSpace: 'nowrap' }}
        >
          {t(totalLabelKey, { count: total })}
        </span>
      )}
    </div>
  )
}

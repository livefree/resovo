'use client'

/**
 * GridSortBar — 视频网格左上排序条（共享，SEQ-20260624-01 / HANDOFF-39）
 *
 * 排序按钮按 mode 取值：category=添加时间/人气/评分（SORT_OPTIONS，默认 latest）；
 * search=相关度/添加时间/人气/评分（SEARCH_SORT_OPTIONS，默认 relevance）。
 * URL `sort` 参数驱动（与 FilterArea 同源 useSearchParams/useRouter）：
 *   - 点选项 set ?sort= + reset page；选默认排序删 param 走后端默认（与「全部」对称）。
 *   - 激活态：searchParams.get('sort') ?? defaultSort（按 mode）。
 * 右侧可选「计数」：total + totalLabelKey（本期仅总数，无 per-option 计数）。
 */

import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { SORT_OPTIONS, DEFAULT_SORT, SEARCH_SORT_OPTIONS, DEFAULT_SEARCH_SORT } from '@resovo/types'
import type { SearchSortOption } from '@resovo/types'
import type { GridSortBarProps } from './types'

// ── SortButton ────────────────────────────────────────────────────────────────

interface SortButtonProps {
  readonly value: SearchSortOption
  readonly label: string
  readonly isActive: boolean
  readonly onClick: () => void
}

function SortButton({ value, label, isActive, onClick }: SortButtonProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isActive}
      data-testid={`sort-${value}`}
      onClick={onClick}
      style={{
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

  function selectSort(value: SearchSortOption) {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('page')
    // 选默认排序删 param 回后端默认（category=latest / search=relevance）；否则显式写 param。
    if (value === defaultSort) next.delete('sort')
    else next.set('sort', value)
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
        {options.map((value) => (
          <SortButton
            key={value}
            value={value}
            label={t(`filter.sort.${value}`)}
            isActive={activeSort === value}
            onClick={() => selectSort(value)}
          />
        ))}
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

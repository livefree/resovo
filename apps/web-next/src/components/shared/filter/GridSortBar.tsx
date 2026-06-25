'use client'

/**
 * GridSortBar — 视频网格左上排序条（共享，SEQ-20260624-01 / HANDOFF-39）
 *
 * 3 排序按钮：添加时间(latest) / 人气高低(hot) / 评分高低(rating)，消费 @resovo/types SORT_OPTIONS。
 * URL `sort` 参数驱动（与 FilterArea 同源 useSearchParams/useRouter）：
 *   - 点选项 set ?sort= + reset page；选 DEFAULT_SORT(latest) 删 param 走后端默认（与「全部」对称）。
 *   - 激活态：searchParams.get('sort') ?? DEFAULT_SORT。
 * 右侧可选「计数」：total + totalLabelKey（本期仅总数，无 per-option 计数）。
 */

import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { SORT_OPTIONS, DEFAULT_SORT } from '@resovo/types'
import type { SortOption } from '@resovo/types'
import type { GridSortBarProps } from './types'

// ── SortButton ────────────────────────────────────────────────────────────────

interface SortButtonProps {
  readonly value: SortOption
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

  // category：无 ?sort= 时高亮 DEFAULT_SORT(latest)，与后端分类默认排序一致。
  // search：无 ?sort= 时不高亮任何按钮（relevance 是搜索隐式默认、无对应按钮）—— 消除
  //         「UI 高亮 latest 但后端按 relevance 排」的前后端默认不一致（HANDOFF-40B 已知项）。
  const activeSort: SortOption | null =
    (searchParams.get('sort') as SortOption | null) ?? (mode === 'search' ? null : DEFAULT_SORT)

  function selectSort(value: SortOption) {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('page')
    // category 选 DEFAULT_SORT 删 param 回后端默认；search 无隐式 latest 默认，选任何排序均显式写 param。
    if (mode !== 'search' && value === DEFAULT_SORT) next.delete('sort')
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
        {SORT_OPTIONS.map((value) => (
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

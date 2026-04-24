'use client'

/**
 * FilterArea — HANDOFF-15 对齐 docs/frontend_design_spec_20260423.md §12.3
 *
 * 6 个筛选维度：type / country / lang（默认可见）+ year / rating_min / status（展开后可见）
 * 每个维度行内单选；点击选项更新 URL 参数并重置 page。
 *
 * Token 消费（spec §12.3）：
 *   面板 padding     → 8px 20px
 *   行 padding       → 10px 0
 *   维度标签宽       → 48px
 *   标签-选项 gap    → 16px
 *   选项间 gap       → 4px
 *   选项 padding     → 4px 12px
 */

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterDim = 'type' | 'country' | 'lang' | 'year' | 'rating_min' | 'status'

interface FilterOption {
  /** URL param value; '' means "All" (remove param) */
  value: string
  /** Display label */
  label: string
}

interface FilterRow {
  dim: FilterDim
  dimLabel: string
  options: FilterOption[]
}

// ── Filter config ─────────────────────────────────────────────────────────────

const BASIC_ROWS: FilterRow[] = [
  {
    dim: 'type',
    dimLabel: '分类',
    options: [
      { value: '',        label: '全部' },
      { value: 'movie',   label: '电影' },
      { value: 'series',  label: '剧集' },
      { value: 'anime',   label: '动漫' },
      { value: 'variety', label: '综艺' },
    ],
  },
  {
    dim: 'country',
    dimLabel: '地区',
    options: [
      { value: '',   label: '全部' },
      { value: 'CN', label: '大陆' },
      { value: 'US', label: '美国' },
      { value: 'JP', label: '日本' },
      { value: 'KR', label: '韩国' },
    ],
  },
  {
    dim: 'lang',
    dimLabel: '语言',
    options: [
      { value: '',   label: '全部' },
      { value: 'zh', label: '中文' },
      { value: 'en', label: '英文' },
      { value: 'ja', label: '日文' },
      { value: 'ko', label: '韩文' },
    ],
  },
]

const currentYear = new Date().getFullYear()
const YEAR_OPTIONS: FilterOption[] = [
  { value: '', label: '全部' },
  ...Array.from({ length: 6 }, (_, i) => ({
    value: String(currentYear - i),
    label: String(currentYear - i),
  })),
]

const EXPANDED_ROWS: FilterRow[] = [
  {
    dim: 'year',
    dimLabel: '年份',
    options: YEAR_OPTIONS,
  },
  {
    dim: 'rating_min',
    dimLabel: '评分',
    options: [
      { value: '',  label: '全部' },
      { value: '9', label: '9分以上' },
      { value: '8', label: '8分以上' },
      { value: '7', label: '7分以上' },
      { value: '6', label: '6分以上' },
    ],
  },
  {
    dim: 'status',
    dimLabel: '状态',
    options: [
      { value: '',          label: '全部' },
      { value: 'ongoing',   label: '连载中' },
      { value: 'completed', label: '已完结' },
    ],
  },
]

// ── FilterOptionButton ────────────────────────────────────────────────────────

interface FilterOptionButtonProps {
  dim: FilterDim
  value: string
  label: string
  isActive: boolean
  onClick: () => void
}

function FilterOptionButton({ dim, value, label, isActive, onClick }: FilterOptionButtonProps) {
  const testId = `filter-${dim}-${value === '' ? 'all' : value}`
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isActive}
      data-testid={testId}
      onClick={onClick}
      style={{
        padding: 'var(--space-1) var(--space-3)',
        borderRadius: 'var(--radius-pill)',
        fontSize: '13px',
        fontWeight: isActive ? 600 : 400,
        border: isActive ? '1px solid var(--accent-default)' : '1px solid transparent',
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

// ── FilterRowItem ─────────────────────────────────────────────────────────────

interface FilterRowItemProps {
  row: FilterRow
  activeValue: string
  onSelect: (dim: FilterDim, value: string) => void
}

function FilterRowItem({ row, activeValue, onSelect }: FilterRowItemProps) {
  return (
    <div
      role="radiogroup"
      aria-label={row.dimLabel}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: 'var(--space-2-5) 0',
        gap: 'var(--space-4)',
      }}
    >
      {/* 维度标签 */}
      <span
        style={{
          width: '48px', /* dim label 固定宽，无对应 space token */
          flexShrink: 0,
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--fg-muted)',
        }}
      >
        {row.dimLabel}
      </span>

      {/* 选项列 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
        {row.options.map((opt) => (
          <FilterOptionButton
            key={opt.value || 'all'}
            dim={row.dim}
            value={opt.value}
            label={opt.label}
            isActive={activeValue === opt.value}
            onClick={() => onSelect(row.dim, opt.value)}
          />
        ))}
      </div>
    </div>
  )
}

// ── FilterArea ────────────────────────────────────────────────────────────────

export function FilterArea() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [expanded, setExpanded] = useState(false)

  function getActiveValue(dim: FilterDim): string {
    return searchParams.get(dim) ?? ''
  }

  function handleSelect(dim: FilterDim, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('page') // reset pagination on filter change
    if (value === '') {
      params.delete(dim)
    } else {
      params.set(dim, value)
    }
    router.push('?' + params.toString())
  }

  return (
    <div
      data-testid="filter-area"
      style={{ padding: 'var(--space-2) var(--space-5)' /* spec §12: 8px 20px */ }}
    >
      {/* 基础 3 行 */}
      {BASIC_ROWS.map((row) => (
        <FilterRowItem
          key={row.dim}
          row={row}
          activeValue={getActiveValue(row.dim)}
          onSelect={handleSelect}
        />
      ))}

      {/* 展开后的 3 行 */}
      {expanded && EXPANDED_ROWS.map((row) => (
        <FilterRowItem
          key={row.dim}
          row={row}
          activeValue={getActiveValue(row.dim)}
          onSelect={handleSelect}
        />
      ))}

      {/* 展开/收起按钮 */}
      <div style={{ padding: 'var(--space-1-5) 0' }}>
        <button
          type="button"
          data-testid="filter-expand"
          onClick={() => setExpanded((v) => !v)}
          style={{
            fontSize: '13px',
            color: 'var(--accent-default)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 'var(--space-1) 0',
            fontWeight: 500,
          }}
        >
          {expanded ? '收起' : '更多筛选'} {expanded ? '↑' : '↓'}
        </button>
      </div>
    </div>
  )
}

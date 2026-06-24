'use client'

/**
 * FilterArea — 分类/搜索页统一筛选区（共享，SEQ-20260624-01 / HANDOFF-39）
 *
 * 消费 @resovo/types FILTER_TAXONOMY，5 维行内互斥单选，顺序固定：
 *   类型(type) → 题材(genre) → 地区(country) → 语言(lang) → 年份(year)
 * 每维点选项更新 URL 参数并重置 page；点「全部」或再点已选项取消该维度。
 *
 * type 维数据流（arch-reviewer Opus 定稿，HANDOFF-39）：
 *   - 选项值集合由消费方经 typeOptions 注入（不 import lib/categories.ts，保 valueSource='category' 意图）。
 *   - category 模式：激活态读 activeType（pathname 段由包装器解析）；选择经 onTypeChange 回调（页面跳路由）。
 *   - search 模式：激活态/选择走 ?type= URL param，组件内部自管。
 * 其余 4 维（genre/country/lang/year）恒走 URL param。
 *
 * Token 消费（spec §12.3）：面板 8px 20px / 行 10px 0 / 维度标签 48px / 标签-选项 gap 16px /
 *   选项 gap 4px / 选项 padding 4px 12px。
 */

import { useRouter, useSearchParams, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  FILTER_TAXONOMY,
  VIDEO_GENRES,
  AUDIO_LANGUAGE_CANONICALS,
  CURATED_FILTER_COUNTRIES,
  YEAR_FILTER_SPAN,
  formatCountryName,
} from '@resovo/types'
import type { VideoType, FilterDimension, FilterDimensionConfig } from '@resovo/types'
import type { FilterAreaProps } from './types'

// ── 选项模型 ───────────────────────────────────────────────────────────────────

interface FilterOption {
  /** URL/回调值；'' = 「全部」（移除该维度） */
  readonly value: string
  /** 显示文案 */
  readonly label: string
}

const currentYear = new Date().getFullYear()
const YEAR_VALUES: readonly number[] = Array.from(
  { length: YEAR_FILTER_SPAN },
  (_, i) => currentYear - i,
)

// ── FilterOptionButton ────────────────────────────────────────────────────────

interface FilterOptionButtonProps {
  readonly dim: FilterDimension
  readonly value: string
  readonly label: string
  readonly isActive: boolean
  readonly onClick: () => void
}

function FilterOptionButton({ dim, value, label, isActive, onClick }: FilterOptionButtonProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isActive}
      data-testid={`filter-${dim}-${value === '' ? 'all' : value}`}
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
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  )
}

// ── FilterRowItem ─────────────────────────────────────────────────────────────

interface FilterRowItemProps {
  readonly dim: FilterDimension
  readonly dimLabel: string
  readonly options: readonly FilterOption[]
  readonly activeValue: string
  readonly onSelect: (value: string) => void
}

function FilterRowItem({ dim, dimLabel, options, activeValue, onSelect }: FilterRowItemProps) {
  return (
    <div
      role="radiogroup"
      aria-label={dimLabel}
      data-testid={`filter-${dim}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: 'var(--space-2-5) 0',
        gap: 'var(--space-4)',
      }}
    >
      <span
        style={{
          width: '48px', /* dim label 固定宽，无对应 space token */
          flexShrink: 0,
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--fg-muted)',
        }}
      >
        {dimLabel}
      </span>

      {/* 选项列：行过长走横向溢出滚动（每行一维度，spec §12.3） */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'nowrap',
          gap: 'var(--space-1)',
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {options.map((opt) => (
          <FilterOptionButton
            key={opt.value || 'all'}
            dim={dim}
            value={opt.value}
            label={opt.label}
            isActive={activeValue === opt.value}
            onClick={() => onSelect(opt.value)}
          />
        ))}
      </div>
    </div>
  )
}

// ── FilterArea ────────────────────────────────────────────────────────────────

export function FilterArea({
  mode,
  typeOptions,
  activeType = null,
  onTypeChange,
  hiddenDimensions = [],
}: FilterAreaProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const params = useParams()
  const t = useTranslations()

  const locale = typeof params.locale === 'string' ? params.locale : 'en'
  const allLabel = t('filter.allOption')

  // 按维度 valueSource 派生选项集合（消费方零 switch(dim)；taxonomy 单源驱动）
  function buildOptions(cfg: FilterDimensionConfig): FilterOption[] {
    const all: FilterOption = { value: '', label: allLabel }
    switch (cfg.valueSource) {
      case 'category':
        return [all, ...typeOptions.map((v) => ({ value: v, label: t(`videoType.${v}`) }))]
      case 'enum-genre':
        return [all, ...VIDEO_GENRES.map((g) => ({ value: g, label: t(`filter.genre.${g}`) }))]
      case 'enum-lang':
        return [all, ...AUDIO_LANGUAGE_CANONICALS.map((l) => ({ value: l, label: t(`filter.lang.${l}`) }))]
      case 'curated':
        return [all, ...CURATED_FILTER_COUNTRIES.map((c) => ({ value: c, label: formatCountryName(c, locale) }))]
      case 'computed-year':
        return [all, ...YEAR_VALUES.map((y) => ({ value: String(y), label: String(y) }))]
    }
  }

  // 维度激活值：type 维按 mode 分流，其余维读同名 URL param
  function getActiveValue(dim: FilterDimension): string {
    if (dim === 'type' && mode === 'category') return activeType ?? ''
    return searchParams.get(dim) ?? ''
  }

  // URL-param 驱动维度的选择（互斥单选 + reset page + 再点取消）
  function writeUrlParam(param: string, value: string) {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('page')
    const current = next.get(param) ?? ''
    if (value === '' || value === current) next.delete(param)
    else next.set(param, value)
    router.push('?' + next.toString())
  }

  function handleSelect(dim: FilterDimension, value: string) {
    if (dim === 'type' && mode === 'category') {
      // category 模式：选择经回调由页面跳路由（URL 映射知识留页面）
      onTypeChange?.(value === '' ? null : (value as VideoType))
      return
    }
    writeUrlParam(dim, value)
  }

  const visibleConfigs = FILTER_TAXONOMY.filter((cfg) => !hiddenDimensions.includes(cfg.dim))

  return (
    <div
      data-testid="filter-area"
      style={{ padding: 'var(--space-2) var(--space-5)' /* spec §12: 8px 20px */ }}
    >
      {visibleConfigs.map((cfg) => (
        <FilterRowItem
          key={cfg.dim}
          dim={cfg.dim}
          dimLabel={t(cfg.dimLabelKey)}
          options={buildOptions(cfg)}
          activeValue={getActiveValue(cfg.dim)}
          onSelect={(value) => handleSelect(cfg.dim, value)}
        />
      ))}
    </div>
  )
}

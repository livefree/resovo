'use client'

import { useCallback } from 'react'
import type { CSSProperties } from 'react'
import type {
  TableQuerySnapshot,
  FilterValue,
  FilterChipProps,
  TableQueryPatch,
} from '@resovo/admin-ui'
import type { VideoListFilter, CrawlerSite } from '@/lib/videos'
import type { VideoType, VisibilityStatus, ReviewStatus } from '@resovo/types'
import { getVideoTypeOptions } from '@resovo/admin-ui'

// ── filter option constants ───────────────────────────────────────

/**
 * 本地 const 派生自 admin-ui SSOT；显式 label 为 string
 * （helpers 类型 ReactNode 兼容 i18n / 此处不传 t，fallback 实际就是 string；
 * CSV 导出 / filter chip 等场景需 string，避免每个调用点 cast）
 */
export const VIDEO_TYPE_OPTIONS: ReadonlyArray<{ value: VideoType; label: string }> =
  getVideoTypeOptions().map((o) => ({ value: o.value, label: String(o.label) }))

export const VIDEO_STATUS_OPTIONS: ReadonlyArray<{ value: 'published' | 'pending' | 'all'; label: string }> = [
  { value: 'published', label: '已上架' },
  { value: 'pending', label: '待上架' },
  { value: 'all', label: '全部' },
]

export const VISIBILITY_OPTIONS: ReadonlyArray<{ value: VisibilityStatus; label: string }> = [
  { value: 'public', label: '公开' },
  { value: 'internal', label: '内部' },
  { value: 'hidden', label: '隐藏' },
]

export const REVIEW_STATUS_OPTIONS: ReadonlyArray<{ value: ReviewStatus; label: string }> = [
  { value: 'pending_review', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已拒绝' },
]

// ── snapshot → API filter mapping ────────────────────────────────

function getEnumFirst(filters: ReadonlyMap<string, FilterValue>, key: string): string | undefined {
  const v = filters.get(key)
  return v?.kind === 'enum' ? v.value[0] : undefined
}

function getTextValue(filters: ReadonlyMap<string, FilterValue>, key: string): string | undefined {
  const v = filters.get(key)
  return v?.kind === 'text' && v.value ? v.value : undefined
}

// AMD2-PATCH-1（2026-05-24）：sort 白名单守卫（防 saved views/URL 反序列化非法 sortField → 422）
// AMD2-PATCH-2（2026-05-24）：白名单扩 5 字段同步后端 SORT_FIELDS 扩展（apps/api/src/routes/admin/videos.ts:90）
// 兑现 ADR-150 AMD2 D-150-AMD2-1 "所有有数据的列默认可排序" / 不再用前端 enableSorting:false 反范式
const VIDEO_SORT_FIELD_WHITELIST = [
  'created_at', 'updated_at', 'title', 'year', 'type',
  'source_health', 'visibility', 'review_status', 'douban_status', 'meta_score',
] as const
type VideoSortField = (typeof VIDEO_SORT_FIELD_WHITELIST)[number]
function isVideoSortField(s: string | undefined): s is VideoSortField {
  return s !== undefined && (VIDEO_SORT_FIELD_WHITELIST as readonly string[]).includes(s)
}

export function buildVideoFilter(snapshot: TableQuerySnapshot): VideoListFilter {
  const { filters, sort, pagination } = snapshot
  // AMD2-PATCH-1：sort.field 白名单守卫（与 CrawlerRunsView sub 2 EXTEND 一致范式）
  const sortField = isVideoSortField(sort.field) ? sort.field : undefined
  return {
    q: getTextValue(filters, 'q'),
    type: getEnumFirst(filters, 'type') as VideoType | undefined,
    status: getEnumFirst(filters, 'status') as VideoListFilter['status'],
    visibilityStatus: getEnumFirst(filters, 'visibilityStatus') as VisibilityStatus | undefined,
    reviewStatus: getEnumFirst(filters, 'reviewStatus') as ReviewStatus | undefined,
    site: getEnumFirst(filters, 'site'),
    sortField,
    sortDir: sortField ? sort.direction : undefined,
    page: pagination.page,
    limit: pagination.pageSize,
  }
}

// ── filter chip display helpers ──────────────────────────────────

const FILTER_LABELS: Readonly<Record<string, string>> = {
  q: '搜索', type: '类型', status: '上架状态',
  visibilityStatus: '可见性', reviewStatus: '审核状态', site: '站点',
}

function getFilterDisplayValue(key: string, value: FilterValue): string {
  if (value.kind === 'text') return value.value
  if (value.kind !== 'enum') return ''
  const v = value.value[0]
  if (!v) return ''
  if (key === 'type') return VIDEO_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v
  if (key === 'status') return VIDEO_STATUS_OPTIONS.find((o) => o.value === v)?.label ?? v
  if (key === 'visibilityStatus') return VISIBILITY_OPTIONS.find((o) => o.value === v)?.label ?? v
  if (key === 'reviewStatus') return REVIEW_STATUS_OPTIONS.find((o) => o.value === v)?.label ?? v
  return v
}

export function buildFilterChips(
  snapshot: TableQuerySnapshot,
  onClear: (key: string) => void,
): readonly FilterChipProps[] {
  const chips: FilterChipProps[] = []
  for (const [key, value] of snapshot.filters) {
    const displayValue = getFilterDisplayValue(key, value)
    if (!displayValue) continue
    chips.push({
      id: key,
      label: FILTER_LABELS[key] ?? key,
      value: displayValue,
      onClear: () => onClear(key),
    })
  }
  return chips
}

// ── VideoFilterBar component ─────────────────────────────────────

export interface VideoFilterBarProps {
  readonly snapshot: TableQuerySnapshot
  readonly sites: readonly CrawlerSite[]
  readonly onPatch: (next: TableQueryPatch) => void
}

const INPUT_STYLE: CSSProperties = {
  padding: '4px 10px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-surface-row)',
  color: 'var(--fg-default)',
  fontSize: 'var(--font-size-sm)',
  // outline 由 InteractionStyles §5 focus-visible 兜底（CHG-UX-06）
  minWidth: '180px',
}

const SELECT_STYLE: CSSProperties = {
  ...INPUT_STYLE,
  minWidth: '120px',
  cursor: 'pointer',
}

const WRAP_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  flexWrap: 'wrap',
}

// sub C（2026-05-24）：VideoFilterBar 简化 6 → 2 控件
//   - 删 q text input（→ title 列 ⋯ popover text filter / filterFieldName='q'）
//   - 删 type / visibilityStatus / reviewStatus 3 enum select（→ 对应列 ⋯ popover）
//   - 保留 status + site 2 enum select（外置 / 与 visibility+review 维度有重叠 / 无对应列承载）
//   - debounceRef + handleSearch 一并删（DataTableAutoFilter "应用"按钮一次性 commit / 无 debounce）
export function VideoFilterBar({ snapshot, sites, onPatch }: VideoFilterBarProps) {
  const setFilter = useCallback((key: string, value: string) => {
    const next = new Map(snapshot.filters)
    if (value) {
      next.set(key, { kind: 'enum', value: [value] } as const)
    } else {
      next.delete(key)
    }
    onPatch({ filters: next })
  }, [snapshot.filters, onPatch])

  const getEnum = (key: string): string => {
    const v = snapshot.filters.get(key)
    return v?.kind === 'enum' ? (v.value[0] ?? '') : ''
  }

  return (
    <div data-video-filter-bar style={WRAP_STYLE}>
      <select value={getEnum('status')} onChange={(e) => setFilter('status', e.target.value)} data-testid="filter-status" data-interactive="trigger" style={SELECT_STYLE} aria-label="上架状态">
        <option value="">全部状态</option>
        {VIDEO_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {sites.length > 0 && (
        <select value={getEnum('site')} onChange={(e) => setFilter('site', e.target.value)} data-testid="filter-site" data-interactive="trigger" style={SELECT_STYLE} aria-label="来源站点">
          <option value="">全部站点</option>
          {sites.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
        </select>
      )}
    </div>
  )
}

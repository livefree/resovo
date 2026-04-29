'use client'

import { useRef, useCallback } from 'react'
import type { CSSProperties } from 'react'
import type {
  TableQuerySnapshot,
  FilterValue,
  FilterChipProps,
  TableQueryPatch,
} from '@resovo/admin-ui'
import type { VideoListFilter, CrawlerSite } from '@/lib/videos'
import type { VideoType, VisibilityStatus, ReviewStatus } from '@resovo/types'

// ── filter option constants ───────────────────────────────────────

export const VIDEO_TYPE_OPTIONS: ReadonlyArray<{ value: VideoType; label: string }> = [
  { value: 'movie', label: '电影' },
  { value: 'series', label: '剧集' },
  { value: 'anime', label: '动漫' },
  { value: 'variety', label: '综艺' },
  { value: 'documentary', label: '纪录片' },
  { value: 'short', label: '短片' },
  { value: 'sports', label: '体育' },
  { value: 'music', label: '音乐' },
  { value: 'news', label: '新闻' },
  { value: 'kids', label: '少儿' },
  { value: 'other', label: '其他' },
]

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

export function buildVideoFilter(snapshot: TableQuerySnapshot): VideoListFilter {
  const { filters, sort, pagination } = snapshot
  return {
    q: getTextValue(filters, 'q'),
    type: getEnumFirst(filters, 'type') as VideoType | undefined,
    status: getEnumFirst(filters, 'status') as VideoListFilter['status'],
    visibilityStatus: getEnumFirst(filters, 'visibilityStatus') as VisibilityStatus | undefined,
    reviewStatus: getEnumFirst(filters, 'reviewStatus') as ReviewStatus | undefined,
    site: getEnumFirst(filters, 'site'),
    sortField: sort.field as VideoListFilter['sortField'],
    sortDir: sort.direction,
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
  background: 'var(--bg-surface-raised)',
  color: 'var(--fg-default)',
  fontSize: 'var(--font-size-sm)',
  outline: 'none',
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

export function VideoFilterBar({ snapshot, sites, onPatch }: VideoFilterBarProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const snapshotRef = useRef(snapshot)
  snapshotRef.current = snapshot

  const setFilter = useCallback((key: string, value: string) => {
    const next = new Map(snapshotRef.current.filters)
    if (value) {
      if (key === 'q') next.set(key, { kind: 'text', value } as const)
      else next.set(key, { kind: 'enum', value: [value] } as const)
    } else {
      next.delete(key)
    }
    onPatch({ filters: next })
  }, [onPatch])

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setFilter('q', val), 300)
  }, [setFilter])

  const getEnum = (key: string): string => {
    const v = snapshot.filters.get(key)
    return v?.kind === 'enum' ? (v.value[0] ?? '') : ''
  }

  const qValue = snapshot.filters.get('q')
  const qText = qValue?.kind === 'text' ? qValue.value : ''

  return (
    <div data-video-filter-bar style={WRAP_STYLE}>
      <input
        type="search"
        placeholder="搜索标题…"
        defaultValue={qText}
        onChange={handleSearch}
        data-testid="filter-q"
        style={INPUT_STYLE}
        aria-label="搜索视频"
      />
      <select value={getEnum('type')} onChange={(e) => setFilter('type', e.target.value)} data-testid="filter-type" style={SELECT_STYLE} aria-label="类型">
        <option value="">全部类型</option>
        {VIDEO_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <select value={getEnum('status')} onChange={(e) => setFilter('status', e.target.value)} data-testid="filter-status" style={SELECT_STYLE} aria-label="上架状态">
        <option value="">全部状态</option>
        {VIDEO_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <select value={getEnum('visibilityStatus')} onChange={(e) => setFilter('visibilityStatus', e.target.value)} data-testid="filter-visibility" style={SELECT_STYLE} aria-label="可见性">
        <option value="">全部可见性</option>
        {VISIBILITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <select value={getEnum('reviewStatus')} onChange={(e) => setFilter('reviewStatus', e.target.value)} data-testid="filter-review-status" style={SELECT_STYLE} aria-label="审核状态">
        <option value="">全部审核状态</option>
        {REVIEW_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {sites.length > 0 && (
        <select value={getEnum('site')} onChange={(e) => setFilter('site', e.target.value)} data-testid="filter-site" style={SELECT_STYLE} aria-label="来源站点">
          <option value="">全部站点</option>
          {sites.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
        </select>
      )}
    </div>
  )
}

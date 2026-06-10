'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type {
  TableQuerySnapshot,
  FilterValue,
  TableQueryPatch,
} from '@resovo/admin-ui'
import type { VideoListFilter } from '@/lib/videos'
import type { VideoType, VideoStatus, VisibilityStatus, ReviewStatus, DoubanStatus, BangumiStatus } from '@resovo/types'
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

// ── 页面级快捷筛选（B 方案 / 设计 §2.6③）─────────────────────────
// 派生/布尔条件，不适合列筛选；点击切换·可组合·选中高亮·全部清空（PageHeader 子标题渲染）。
// state 用独立 React Set（不入 snapshot.filters / 避开 bool URL 往返 kind 推断歧义），
// 经 buildVideoFilter 第二参数合流到 VideoListFilter 派生 boolean（仅 true 发送）。
export const VIDEO_QUICK_FILTERS = [
  { key: 'pendingReview', label: '待审' },
  { key: 'metaIncomplete', label: '元数据缺失' },
  { key: 'episodeMismatch', label: '集数不一致' },
] as const
export type VideoQuickFilterKey = (typeof VIDEO_QUICK_FILTERS)[number]['key']

// ── snapshot → API filter mapping ────────────────────────────────

function getEnumFirst(filters: ReadonlyMap<string, FilterValue>, key: string): string | undefined {
  const v = filters.get(key)
  return v?.kind === 'enum' ? v.value[0] : undefined
}

function getEnumArray(filters: ReadonlyMap<string, FilterValue>, key: string): readonly string[] | undefined {
  const v = filters.get(key)
  return v?.kind === 'enum' && v.value.length > 0 ? v.value : undefined
}

function getRange(filters: ReadonlyMap<string, FilterValue>, key: string): { min?: number; max?: number } | undefined {
  const v = filters.get(key)
  return v?.kind === 'range' ? { min: v.min, max: v.max } : undefined
}

function getTextValue(filters: ReadonlyMap<string, FilterValue>, key: string): string | undefined {
  const v = filters.get(key)
  return v?.kind === 'text' && v.value ? v.value : undefined
}

// AMD2-PATCH-1（2026-05-24）：sort 白名单守卫（防 saved views/URL 反序列化非法 sortField → 422）
// AMD2-PATCH-2（2026-05-24）：白名单扩 5 字段同步后端 SORT_FIELDS 扩展（apps/api/src/routes/admin/videos.ts:90）
// CHG-VSR-4-A：+episode_count 同步后端 SORT_FIELDS（CHG-VSR-2 ADR-150 AMENDMENT 3）
// 兑现 ADR-150 AMD2 D-150-AMD2-1 "所有有数据的列默认可排序" / 不再用前端 enableSorting:false 反范式
const VIDEO_SORT_FIELD_WHITELIST = [
  'created_at', 'updated_at', 'title', 'year', 'type',
  'source_health', 'visibility', 'review_status', 'douban_status', 'meta_score', 'episode_count',
  // SRCHEALTH-P1-1-B（B1）：探测/试播聚合排序，同步后端 SORT_FIELDS（SRCHEALTH-P1-1-A）
  'source_check_status', 'render_check_status',
] as const
type VideoSortField = (typeof VIDEO_SORT_FIELD_WHITELIST)[number]
function isVideoSortField(s: string | undefined): s is VideoSortField {
  return s !== undefined && (VIDEO_SORT_FIELD_WHITELIST as readonly string[]).includes(s)
}

// CHG-VSR-4-A（设计 §2.2/§2.5）：复合显示列 id → 后端 sortField 映射。
// DataTable 排序以 column.id 作 sort.field（无独立 sortField 契约，沿用 CHG-VSR-5-A sources 页先例）；
// 复合列 id 语义化（release/episodes/meta/status），排序到原子后端字段。
// 直通列（title/type/updated_at/source_health/created_at/year/...）id 即后端字段，?? 兜底原值。
const COMPOSITE_SORT_MAP: Readonly<Record<string, VideoSortField>> = {
  release: 'year',
  episodes: 'episode_count',
  meta: 'meta_score',
  status: 'review_status',
  // SRCHEALTH-P1-1-B：探测/播放双信号复合列，排序取探测维度主信号
  probe: 'source_check_status',
}

export function buildVideoFilter(
  snapshot: TableQuerySnapshot,
  quickFilters?: ReadonlySet<VideoQuickFilterKey>,
): VideoListFilter {
  const { filters, sort, pagination } = snapshot
  // AMD2-PATCH-1：sort.field 白名单守卫（与 CrawlerRunsView sub 2 EXTEND 一致范式）
  // CHG-VSR-4-A：先经复合列映射，再白名单守卫（映射缺失 → 兜底原 id 直通）
  const mappedField = sort.field ? (COMPOSITE_SORT_MAP[sort.field] ?? sort.field) : undefined
  const sortField = isVideoSortField(mappedField) ? mappedField : undefined
  // CHG-VSR-4-B（设计 §2.6②）：原子可筛选列经列头菜单 → snapshot.filters；映射到 ADR-150 AMD3 入参
  const yearRange = getRange(filters, 'year')
  const metaRange = getRange(filters, 'metaScore')
  const isPub = getEnumFirst(filters, 'isPublished')
  return {
    q: getTextValue(filters, 'q'),
    type: getEnumFirst(filters, 'type') as VideoType | undefined,
    status: getEnumFirst(filters, 'status') as VideoListFilter['status'],
    visibilityStatus: getEnumFirst(filters, 'visibilityStatus') as VisibilityStatus | undefined,
    reviewStatus: getEnumFirst(filters, 'reviewStatus') as ReviewStatus | undefined,
    site: getEnumFirst(filters, 'site'),
    // ── CHG-VSR-4-B 原子列筛选（range → min/max；enum 多选 → 数组；isPublished 单值 → bool）──
    yearMin: yearRange?.min,
    yearMax: yearRange?.max,
    country: getEnumArray(filters, 'country'),
    catalogStatus: getEnumArray(filters, 'catalogStatus') as readonly VideoStatus[] | undefined,
    isPublished: isPub === 'published' ? true : isPub === 'draft' ? false : undefined,
    doubanStatus: getEnumArray(filters, 'doubanStatus') as readonly DoubanStatus[] | undefined,
    bangumiStatus: getEnumArray(filters, 'bangumiStatus') as readonly BangumiStatus[] | undefined,
    metaScoreMin: metaRange?.min,
    metaScoreMax: metaRange?.max,
    // ── CHG-VSR-4-B 页面级快捷筛选（B 方案 / 派生 boolean，仅 true 发送，api 层 === true 才追加谓词）──
    pendingReview: quickFilters?.has('pendingReview') || undefined,
    metaIncomplete: quickFilters?.has('metaIncomplete') || undefined,
    episodeMismatch: quickFilters?.has('episodeMismatch') || undefined,
    sortField,
    sortDir: sortField ? sort.direction : undefined,
    page: pagination.page,
    limit: pagination.pageSize,
  }
}

// ── VideoFilterBar component（CHG-VSR-4-B / 设计 §1.1 + §2.6①）────
// 表格头部左侧唯一筛选入口 = q 搜索框（后端 ILIKE 多列 OR：title / title_en / title_original / short_id）。
// 旧 status/site 下拉 + FilterChipBar 退场（§1.1：头部仅搜索 + 列设置；列筛选走列头菜单；
// 已选过滤激活态在列头指示符体现，不出现已选过滤 chip 条）。

export interface VideoFilterBarProps {
  readonly snapshot: TableQuerySnapshot
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
  minWidth: '260px',
}

const SEARCH_DEBOUNCE_MS = 300

function currentQ(filters: ReadonlyMap<string, FilterValue>): string {
  const v = filters.get('q')
  return v?.kind === 'text' ? v.value : ''
}

export function VideoFilterBar({ snapshot, onPatch }: VideoFilterBarProps) {
  const committedQ = currentQ(snapshot.filters)
  const [draft, setDraft] = useState(committedQ)
  // filtersRef 保最新 filters，debounce commit 时 read-modify-write 不丢并发列筛选（patch.filters 全替换语义）
  const filtersRef = useRef(snapshot.filters)
  filtersRef.current = snapshot.filters
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 外部 q 变化（列头菜单清除 / URL 反序列化 / 全部清空）同步回输入框
  useEffect(() => { setDraft(committedQ) }, [committedQ])
  // 卸载清理 pending timer（防 setState-after-unmount）
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const commit = useCallback((value: string) => {
    const next = new Map(filtersRef.current)
    const trimmed = value.trim()
    if (trimmed) next.set('q', { kind: 'text', value: trimmed })
    else next.delete('q')
    onPatch({ filters: next })
  }, [onPatch])

  const onChange = useCallback((value: string) => {
    setDraft(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => commit(value), SEARCH_DEBOUNCE_MS)
  }, [commit])

  return (
    <input
      type="search"
      value={draft}
      onChange={(e) => onChange(e.target.value)}
      placeholder="标题 / 英文名 / 原名 / 短ID"
      aria-label="搜索视频"
      data-testid="videos-search-input"
      data-interactive="input"
      style={INPUT_STYLE}
    />
  )
}

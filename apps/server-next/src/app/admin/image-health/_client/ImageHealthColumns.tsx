import type { TableColumn, DistinctOption } from '@resovo/admin-ui'
import { Thumb } from '@resovo/admin-ui'
import type { MissingVideoRow, BrokenDomainRow } from '@/lib/image-health/api'
import { IMAGE_HEALTH_DOMAIN_DISTINCT } from './imageHealthFilters'

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return '—'
  const min = Math.floor(ms / 60000)
  if (min < 60) return `${min}m 前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h 前`
  const day = Math.floor(hr / 24)
  return `${day}d 前`
}

// IMGH-P2-3B：服务端筛选 enum 静态选项（消费 1D；brokenDomain 走 distinctFetcher 不在此列）
const POSTER_STATUS_OPTIONS: readonly DistinctOption[] = [
  { value: 'missing', label: '缺失' },
  { value: 'broken', label: '破损' },
  { value: 'pending_review', label: '待复核' },
]
const POSTER_SOURCE_OPTIONS: readonly DistinctOption[] = [
  { value: 'manual', label: 'manual' },
  { value: 'tmdb', label: 'tmdb' },
  { value: 'bangumi', label: 'bangumi' },
  { value: 'douban', label: 'douban' },
  { value: 'crawler', label: 'crawler' },
]
// broken_image_events.event_type CHECK 8 值（与 IMAGE_EVENT_TYPES / 1D 后端枚举一致）
const EVENT_TYPE_OPTIONS: readonly DistinctOption[] = [
  { value: 'client_load_error' },
  { value: 'empty_src' },
  { value: 'fetch_404' },
  { value: 'fetch_5xx' },
  { value: 'timeout' },
  { value: 'decode_fail' },
  { value: 'dimension_too_small' },
  { value: 'aspect_mismatch' },
]

const THUMB_FALLBACK_STYLE = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  color: 'var(--fg-muted)',
  fontSize: '16px',
} as const

export function buildMissingVideoColumns(): readonly TableColumn<MissingVideoRow>[] {
  return [
    {
      id: 'title',
      header: '视频标题',
      accessor: (r) => r.title,
      minWidth: 240,
      enableSorting: true,
      defaultVisible: true,
      pinned: true,
      // IMGH-P2-3B：title 文本筛选桥接 1D search（ILIKE title/short_id）
      filterable: true, filterFieldName: 'search', filterKind: 'text',
      cell: ({ row }) => (
        <span style={{ display: 'inline-flex', flexDirection: 'column', gap: '2px' }}>
          <span data-video-title>{row.title}</span>
          <code style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>
            {row.videoId.slice(0, 8)}…
          </code>
        </span>
      ),
    },
    // IMGH-P2-3B：缩略列（Thumb；缺失走 fallback 占位，破损/待复核直显 posterUrl —— broken-img 即运维信号）
    {
      id: 'thumb',
      kind: 'media',
      header: '封面',
      accessor: (r) => r.posterUrl ?? '',
      width: 64,
      defaultVisible: true,
      cell: ({ row }) => (
        <Thumb
          src={row.posterStatus === 'missing' ? undefined : (row.posterUrl ?? undefined)}
          size="poster-sm"
          fallback={<span style={THUMB_FALLBACK_STYLE} aria-hidden>⊘</span>}
          testId={`missing-thumb-${row.videoId}`}
        />
      ),
    },
    {
      id: 'posterStatus',
      header: '海报状态',
      accessor: (r) => r.posterStatus,
      width: 130,
      enableSorting: true,
      defaultVisible: true,
      // IMGH-P2-3B：服务端筛选（enum 单 facet，消费 1D posterStatus）
      filterable: true, filterFieldName: 'posterStatus', filterKind: 'enum', filterOptions: POSTER_STATUS_OPTIONS,
      cell: ({ row }) => {
        const badge: Record<string, { label: string; bg: string; color: string }> = {
          missing:        { label: '缺失',     bg: 'var(--state-warning-bg)',  color: 'var(--state-warning-fg)' },
          broken:         { label: '破损',     bg: 'var(--state-error-bg)',    color: 'var(--state-danger-fg)' },
          pending_review: { label: '待复核',   bg: 'var(--state-info-bg)',     color: 'var(--state-info-fg)' },
        }
        const cfg = badge[row.posterStatus] ?? { label: row.posterStatus, bg: 'var(--bg-surface-sunken)', color: 'var(--fg-muted)' }
        return (
          <span
            style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: 'var(--radius-pill, 12px)',
              fontSize: 'var(--font-size-xs)',
              background: cfg.bg,
              color: cfg.color,
            }}
            data-poster-status={row.posterStatus}
          >
            {cfg.label}
          </span>
        )
      },
    },
    // CHG-SN-6-RETRO-3-B / ultrareview P2-7：列扩展（运维定位）
    // EP-3-D（2026-05-24）+ ADR-150 阶段 5 EP-4 follow-up（2026-05-25）：sort 全栈打通
    //   - 保留 kind: 'computed'（filter 业务无意义 / 矩阵 popover filter 段禁用）
    //   - 4 列显式 enableSorting: true（LATERAL JOIN evt.* 字段直接可 ORDER BY / 无需 CTE 重写）
    //   - 前端 column.id camelCase → 后端 sortField snake_case 桥接（ImageHealthClient load() switch）
    {
      id: 'posterSource',
      kind: 'computed',
      enableSorting: true, // ADR-150 阶段 5 EP-4 follow-up sort 全栈（'posterSource' → 'poster_source'）
      header: '海报来源',
      accessor: (r) => r.posterSource ?? '—',
      width: 110,
      defaultVisible: true,
      // IMGH-P2-3B：服务端筛选（enum 单 facet，消费 1D posterSource）
      filterable: true, filterFieldName: 'posterSource', filterKind: 'enum', filterOptions: POSTER_SOURCE_OPTIONS,
      cell: ({ row }) => (
        <code style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }} data-poster-source>
          {row.posterSource ?? '—'}
        </code>
      ),
    },
    // IMGH-P2-3B：事件类型列 + enum 筛选（消费 1D eventType / DTO eventType；后端无该字段排序白名单故不排序）
    {
      id: 'eventType',
      kind: 'computed',
      header: '事件类型',
      accessor: (r) => r.eventType ?? '',
      width: 140,
      defaultVisible: true,
      filterable: true, filterFieldName: 'eventType', filterKind: 'enum', filterOptions: EVENT_TYPE_OPTIONS,
      cell: ({ row }) => (
        <code style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }} data-event-type>
          {row.eventType ?? '—'}
        </code>
      ),
    },
    {
      id: 'brokenDomain',
      kind: 'computed',
      enableSorting: true, // ADR-150 阶段 5 EP-4 follow-up sort 全栈（'brokenDomain' → 'broken_domain' / evt.url 排序近似域名）
      header: '破损域名',
      accessor: (r) => r.brokenDomain ?? '',
      // CHG-DT-RESIZE-ROLLOUT：补 width（原仅 minWidth）→ 全表仅 title 留无宽作主列，规避开 resize 后 title+brokenDomain 双塌 minWidth
      width: 220, minWidth: 200,
      defaultVisible: true,
      // IMGH-P2-3B：服务端筛选（无 filterOptions → 触发 distinctFetcher，哨兵 table 复用 GET /broken-domains）
      filterable: true, filterFieldName: 'brokenDomain', filterKind: 'enum', filterDistinctTable: IMAGE_HEALTH_DOMAIN_DISTINCT,
      cell: ({ row }) => (
        <code style={{ fontSize: 'var(--font-size-xs)' }} data-broken-domain>
          {row.brokenDomain ?? <span style={{ color: 'var(--fg-muted)' }}>—</span>}
        </code>
      ),
    },
    {
      id: 'occurrenceCount',
      kind: 'computed',
      enableSorting: true, // ADR-150 阶段 5 EP-4 follow-up sort 全栈（'occurrenceCount' → 'occurrence_count'）
      header: '破损次数',
      accessor: (r) => r.occurrenceCount,
      width: 100,
      defaultVisible: true,
      cell: ({ row }) => (
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            color: row.occurrenceCount > 0 ? 'var(--state-danger-fg)' : 'var(--fg-muted)',
            fontWeight: row.occurrenceCount > 10 ? 600 : 400,
          }}
          data-occurrence-count
        >
          {row.occurrenceCount > 0 ? row.occurrenceCount.toLocaleString() : '—'}
        </span>
      ),
    },
    {
      id: 'lastSeenBrokenAt',
      kind: 'computed',
      enableSorting: true, // ADR-150 阶段 5 EP-4 follow-up sort 全栈（'lastSeenBrokenAt' → 'last_seen_broken_at'）
      header: '最近破损',
      accessor: (r) => r.lastSeenBrokenAt ?? '',
      width: 130,
      defaultVisible: true,
      cell: ({ row }) => (
        <span
          style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}
          title={row.lastSeenBrokenAt ?? undefined}
          data-last-seen-broken
        >
          {formatRelativeTime(row.lastSeenBrokenAt)}
        </span>
      ),
    },
    // IMGH-P2-3B：跨源候选数列（消费 1D candidateCount/hasHighConfidenceCandidate 聚合，不逐行请求避 N+1）
    {
      id: 'candidateCount',
      kind: 'computed',
      header: '跨源候选',
      accessor: (r) => r.candidateCount,
      width: 110,
      defaultVisible: true,
      cell: ({ row }) => {
        if (row.candidateCount === 0) {
          return <span style={{ color: 'var(--fg-muted)' }} data-candidate-count="0">—</span>
        }
        const high = row.hasHighConfidenceCandidate
        return (
          <span
            style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-default)' }}
            title={high ? '含高置信候选' : '候选待确认'}
            data-candidate-count={row.candidateCount}
            data-high-confidence={high ? 'true' : 'false'}
          >
            {high ? '🟢' : '🟡'} {row.candidateCount}
          </span>
        )
      },
    },
  ]
}

// IMGH-P1-4：TOP 破损域名行内「切此域」入口配置
export interface BrokenDomainColumnsOptions {
  /** 点击行内「切此域」→ 打开 SwitchDomainModal 并预填该域名为源域 */
  readonly onSwitchDomain: (domain: string) => void
}

const SWITCH_BTN_STYLE = {
  border: '1px solid var(--state-warning-border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--state-warning-bg)',
  color: 'var(--state-warning-fg)',
  fontSize: 'var(--font-size-xs)',
  padding: '2px 8px',
  cursor: 'pointer',
} as const

export function buildBrokenDomainColumns(
  options: BrokenDomainColumnsOptions,
): readonly TableColumn<BrokenDomainRow>[] {
  return [
    {
      id: 'domain',
      header: '域名',
      accessor: (r) => r.domain,
      minWidth: 280,
      defaultVisible: true,
      pinned: true,
      cell: ({ row }) => (
        <code style={{ fontSize: 'var(--font-size-sm)' }} data-broken-domain>
          {row.domain}
        </code>
      ),
    },
    {
      id: 'eventCount',
      header: '破损事件总数',
      accessor: (r) => r.eventCount,
      width: 160,
      defaultVisible: true,
      cell: ({ row }) => <span data-event-count>{row.eventCount.toLocaleString()}</span>,
    },
    {
      id: 'affectedVideos',
      header: '影响视频数',
      accessor: (r) => r.affectedVideos,
      width: 160,
      defaultVisible: true,
      cell: ({ row }) => <span data-affected-videos>{row.affectedVideos.toLocaleString()}</span>,
    },
    {
      id: 'actions',
      kind: 'computed',
      header: '操作',
      accessor: () => '',
      width: 110,
      defaultVisible: true,
      cell: ({ row }) => (
        <button
          type="button"
          style={SWITCH_BTN_STYLE}
          onClick={() => options.onSwitchDomain(row.domain)}
          data-switch-this-domain={row.domain}
          aria-label={`切换 fallback 域：${row.domain}`}
        >
          切此域
        </button>
      ),
    },
  ]
}

import type { TableColumn } from '@resovo/admin-ui'
import type { MissingVideoRow, BrokenDomainRow } from '@/lib/image-health/api'

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
      cell: ({ row }) => (
        <span style={{ display: 'inline-flex', flexDirection: 'column', gap: '2px' }}>
          <span data-video-title>{row.title}</span>
          <code style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>
            {row.videoId.slice(0, 8)}…
          </code>
        </span>
      ),
    },
    {
      id: 'posterStatus',
      header: '海报状态',
      accessor: (r) => r.posterStatus,
      width: 130,
      enableSorting: true,
      defaultVisible: true,
      cell: ({ row }) => {
        const badge: Record<string, { label: string; bg: string; color: string }> = {
          missing:        { label: '缺失',     bg: 'var(--state-warning-bg)',  color: 'var(--state-warning-fg)' },
          broken:         { label: '破损',     bg: 'var(--state-danger-bg)',   color: 'var(--state-danger-fg)' },
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
    // EP-3-D（2026-05-24）：子查询派生字段 / 后端 SORT_FIELDS 不含 / 业务真实禁用
    //   kind: 'computed' → AMD2 默认 filterable+enableSorting false / 不进矩阵 popover / 不显 ⋯ trigger
    //   后续 follow-up：CTE 重写 listMissingVideos SQL 让子查询字段可 ORDER BY → 启用 sort
    {
      id: 'posterSource',
      kind: 'computed',
      header: '海报来源',
      accessor: (r) => r.posterSource ?? '—',
      width: 110,
      defaultVisible: true,
      cell: ({ row }) => (
        <code style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }} data-poster-source>
          {row.posterSource ?? '—'}
        </code>
      ),
    },
    {
      id: 'brokenDomain',
      kind: 'computed',
      header: '破损域名',
      accessor: (r) => r.brokenDomain ?? '',
      minWidth: 200,
      defaultVisible: true,
      cell: ({ row }) => (
        <code style={{ fontSize: 'var(--font-size-xs)' }} data-broken-domain>
          {row.brokenDomain ?? <span style={{ color: 'var(--fg-muted)' }}>—</span>}
        </code>
      ),
    },
    {
      id: 'occurrenceCount',
      kind: 'computed',
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
  ]
}

export function buildBrokenDomainColumns(): readonly TableColumn<BrokenDomainRow>[] {
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
  ]
}

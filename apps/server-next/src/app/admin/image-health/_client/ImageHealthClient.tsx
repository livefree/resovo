'use client'

/**
 * ImageHealthClient.tsx — `/admin/image-health` 图片健康视图（M-SN-6 / CHG-SN-6-02）
 *
 * 范围：消费 4 既有端点（apps/api/src/routes/admin/image-health.ts / IMG-05 / allowlist 豁免）
 *   - getImageHealthStats     → KPI 卡片（视频总数 / poster 覆盖率 / backdrop 覆盖率 / 近 7 日新增破损）
 *   - getTopBrokenDomains     → TOP 破损域名表
 *   - listMissingVideos       → 缺图视频分页列表（DataTable）
 *   - triggerImageBackfill    → 手动触发 backfill（toast 反馈）
 *
 * 共享原语（≥ 80% 占比硬清单，quality-gates §7 第 2 项）：
 *   DataTable / PageHeader / AdminCard / AdminButton / EmptyState / ErrorState / LoadingState
 *
 * 设计模式：Mode A 整页滚动（ADR-103 AMENDMENT 2026-05-14 默认）
 */

import { useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react'
import {
  DataTable,
  AdminCard,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  AdminButton,
  useToast,
  type TableColumn,
  type TableSortState,
} from '@resovo/admin-ui'
import {
  getImageHealthStats,
  getTopBrokenDomains,
  listMissingVideos,
  triggerImageBackfill,
  type ImageHealthStats,
  type BrokenDomainRow,
  type MissingVideoRow,
} from '@/lib/image-health/api'

// ── 常量 ──────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 20

const PAGE_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--section-gap)',
  padding: 'var(--page-padding-y) var(--page-padding-x) 0',
}

const KPI_GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '12px',
}

const KPI_LABEL_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  marginBottom: '8px',
}

const KPI_VALUE_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xl, 20px)',
  fontWeight: 600,
  color: 'var(--fg-default)',
}

const KPI_SUB_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  marginTop: '4px',
}

const SECTION_GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: 'var(--section-gap)',
}

// ── KPI Card ─────────────────────────────────────────────────────

interface KpiCardProps {
  readonly label: string
  readonly value: string | number
  readonly sub?: string
  readonly 'data-testid'?: string
}

function KpiCard({ label, value, sub, 'data-testid': testId }: KpiCardProps) {
  return (
    <AdminCard surface="plain" padding="md" data-testid={testId}>
      <div style={KPI_LABEL_STYLE}>{label}</div>
      <div style={KPI_VALUE_STYLE}>{value}</div>
      {sub ? <div style={KPI_SUB_STYLE}>{sub}</div> : null}
    </AdminCard>
  )
}

// ── 列定义 ────────────────────────────────────────────────────────

function buildMissingVideoColumns(): readonly TableColumn<MissingVideoRow>[] {
  return [
    {
      id: 'title',
      header: '视频标题',
      accessor: (r) => r.title,
      minWidth: 280,
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
      width: 160,
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
  ]
}

function buildBrokenDomainColumns(): readonly TableColumn<BrokenDomainRow>[] {
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

// ── 主组件 ────────────────────────────────────────────────────────

export function ImageHealthClient() {
  const toast = useToast()

  // ── KPI / 破损域名 / 缺图列表 三类状态 ──
  const [stats, setStats] = useState<ImageHealthStats | null>(null)
  const [statsError, setStatsError] = useState<Error | null>(null)
  const [domains, setDomains] = useState<readonly BrokenDomainRow[]>([])
  const [domainsError, setDomainsError] = useState<Error | null>(null)
  const [missingRows, setMissingRows] = useState<readonly MissingVideoRow[]>([])
  const [missingTotal, setMissingTotal] = useState(0)
  const [missingError, setMissingError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const [backfillPending, setBackfillPending] = useState(false)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [sort, setSort] = useState<TableSortState>({ field: 'created_at', direction: 'desc' })
  const [retryKey, setRetryKey] = useState(0)

  // ── 数据加载（KPI + 域名 + 缺图列表 并行） ──
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setStatsError(null); setDomainsError(null); setMissingError(null)

    Promise.allSettled([
      getImageHealthStats(),
      getTopBrokenDomains(20),
      listMissingVideos({
        page,
        limit: pageSize,
        sortField: (sort.field === 'title' || sort.field === 'poster_status') ? sort.field : 'created_at',
        sortDir: sort.direction,
      }),
    ]).then(([statsRes, domainsRes, missingRes]) => {
      if (cancelled) return
      if (statsRes.status === 'fulfilled') setStats(statsRes.value)
      else                                  setStatsError(statsRes.reason instanceof Error ? statsRes.reason : new Error('stats 加载失败'))

      if (domainsRes.status === 'fulfilled') setDomains(domainsRes.value)
      else                                    setDomainsError(domainsRes.reason instanceof Error ? domainsRes.reason : new Error('域名加载失败'))

      if (missingRes.status === 'fulfilled') {
        setMissingRows(missingRes.value.data)
        setMissingTotal(missingRes.value.total)
      } else {
        setMissingError(missingRes.reason instanceof Error ? missingRes.reason : new Error('缺图视频加载失败'))
      }
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [page, pageSize, sort, retryKey])

  const refresh = useCallback(() => setRetryKey((k) => k + 1), [])

  const handleBackfill = useCallback(async () => {
    setBackfillPending(true)
    try {
      const result = await triggerImageBackfill()
      toast.push({
        title: 'Backfill 已入队',
        description: result.message,
        level: 'success',
      })
    } catch (err: unknown) {
      toast.push({
        title: 'Backfill 触发失败',
        description: err instanceof Error ? err.message : '请稍后重试',
        level: 'danger',
      })
    } finally {
      setBackfillPending(false)
    }
  }, [toast])

  const missingColumns = useMemo(() => buildMissingVideoColumns(), [])
  const domainColumns = useMemo(() => buildBrokenDomainColumns(), [])

  const missingQuery = useMemo(
    () => ({
      pagination: { page, pageSize },
      sort,
      filters: new Map(),
      columns: new Map(),
      selection: { selectedKeys: new Set<string>(), mode: 'page' as const },
    }),
    [page, pageSize, sort],
  )

  const domainsQuery = useMemo(
    () => ({
      pagination: { page: 1, pageSize: 20 },
      sort: { field: undefined, direction: 'desc' as const },
      filters: new Map(),
      columns: new Map(),
      selection: { selectedKeys: new Set<string>(), mode: 'page' as const },
    }),
    [],
  )

  return (
    <div data-image-health-client style={PAGE_STYLE}>
      <PageHeader
        title="图片健康"
        subtitle="poster / backdrop 覆盖率 · 破损域名 TOP · 缺图视频治理"
        actions={
          <span style={{ display: 'inline-flex', gap: '8px' }}>
            <AdminButton
              variant="primary"
              size="sm"
              loading={backfillPending}
              onClick={() => void handleBackfill()}
              data-testid="image-health-backfill"
            >
              触发 Backfill
            </AdminButton>
            <AdminButton
              variant="default"
              size="sm"
              onClick={refresh}
              data-testid="image-health-refresh"
            >
              刷新
            </AdminButton>
          </span>
        }
        data-testid="image-health-page-header"
      />

      {/* ── KPI 仪表盘 ── */}
      <div data-testid="image-health-kpi-grid">
        {loading && !stats
          ? <LoadingState variant="skeleton" />
          : statsError
            ? <ErrorState error={statsError} title="统计加载失败" onRetry={refresh} />
            : stats ? (
                <div style={KPI_GRID_STYLE}>
                  <KpiCard
                    label="视频总数（已发布）"
                    value={stats.totalVideos.toLocaleString()}
                    data-testid="kpi-total-videos"
                  />
                  <KpiCard
                    label="Poster 覆盖率"
                    value={`${(stats.posterCoverage * 100).toFixed(1)}%`}
                    sub={`${stats.posterOkCount.toLocaleString()} / ${stats.totalVideos.toLocaleString()}`}
                    data-testid="kpi-poster-coverage"
                  />
                  <KpiCard
                    label="Backdrop 覆盖率"
                    value={`${(stats.backdropCoverage * 100).toFixed(1)}%`}
                    sub={`${stats.backdropOkCount.toLocaleString()} / ${stats.totalVideos.toLocaleString()}`}
                    data-testid="kpi-backdrop-coverage"
                  />
                  <KpiCard
                    label="近 7 日新增破损"
                    value={stats.brokenLast7Days.toLocaleString()}
                    sub="未解决的事件视频去重计数"
                    data-testid="kpi-broken-7d"
                  />
                </div>
              ) : null
        }
      </div>

      {/* ── 破损域名 TOP + 缺图视频列表 ── */}
      <div style={SECTION_GRID_STYLE}>
        <AdminCard
          surface="plain"
          padding="md"
          header={{
            title: 'TOP 破损域名',
            subtitle: 'CDN 故障定位（按事件总数倒序，前 20）',
          }}
          data-testid="image-health-domains-card"
        >
          {domainsError ? (
            <ErrorState error={domainsError} title="域名加载失败" onRetry={refresh} />
          ) : (
            <DataTable<BrokenDomainRow>
              rows={domains}
              columns={domainColumns}
              rowKey={(r) => r.domain}
              mode="client"
              query={domainsQuery}
              onQueryChange={() => { /* client mode 内置 */ }}
              loading={loading && domains.length === 0}
              emptyState={<EmptyState title="暂无破损域名" description="所有 CDN 域名健康" />}
              data-testid="image-health-domains-table"
              pagination={{ hidden: true }}
            />
          )}
        </AdminCard>

        <AdminCard
          surface="plain"
          padding="md"
          header={{
            title: '缺图视频治理',
            subtitle: `${missingTotal} 条 · poster_status ∈ {missing, broken, pending_review}`,
          }}
          data-testid="image-health-missing-card"
        >
          {missingError ? (
            <ErrorState error={missingError} title="加载失败" onRetry={refresh} />
          ) : (
            <DataTable<MissingVideoRow>
              rows={missingRows}
              columns={missingColumns}
              rowKey={(r) => r.videoId}
              mode="server"
              query={missingQuery}
              onQueryChange={(patch) => {
                if (patch.pagination) {
                  if (patch.pagination.page !== undefined) setPage(patch.pagination.page)
                  if (patch.pagination.pageSize !== undefined) {
                    setPageSize(patch.pagination.pageSize)
                    setPage(1)
                  }
                }
                if (patch.sort) setSort(patch.sort)
              }}
              totalRows={missingTotal}
              loading={loading && missingRows.length === 0}
              emptyState={<EmptyState title="无缺图视频" description="所有发布视频海报状态健康" />}
              data-testid="image-health-missing-table"
              enableHeaderMenu
              pagination={{ pageSizeOptions: [10, 20, 50, 100] }}
            />
          )}
        </AdminCard>
      </div>
    </div>
  )
}

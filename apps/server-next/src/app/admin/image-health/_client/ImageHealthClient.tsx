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
  type ColumnPreference,
  type TableSortState,
} from '@resovo/admin-ui'
import { SwitchDomainModal } from './SwitchDomainModal'
import { BrokenSamplesGrid } from './BrokenSamplesGrid'
import {
  getImageHealthStats,
  getTopBrokenDomains,
  listMissingVideos,
  triggerImageBackfill,
  triggerImageRescan,
  switchImageFallbackDomain,
  type ImageHealthStats,
  type BrokenDomainRow,
  type MissingVideoRow,
  type SwitchDomainResult,
} from '@/lib/image-health/api'
import { KpiCard } from './ImageHealthKpiCard'
import { buildMissingVideoColumns, buildBrokenDomainColumns } from './ImageHealthColumns'

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

const SECTION_SPLIT_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 'var(--section-gap)',
  alignItems: 'start',
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

  const [rescanPending, setRescanPending] = useState(false)
  const [switchDomainOpen, setSwitchDomainOpen] = useState(false)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [sort, setSort] = useState<TableSortState>({ field: 'created_at', direction: 'desc' })
  const [retryKey, setRetryKey] = useState(0)
  const [missingColumnPrefs, setMissingColumnPrefs] = useState<ReadonlyMap<string, ColumnPreference>>(new Map())
  const [domainsColumnPrefs, setDomainsColumnPrefs] = useState<ReadonlyMap<string, ColumnPreference>>(new Map())

  // ── 数据加载（KPI + 域名 + 缺图列表 并行） ──
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setStatsError(null); setDomainsError(null); setMissingError(null)

    Promise.allSettled([
      getImageHealthStats(),
      getTopBrokenDomains(20),
      // ADR-150 阶段 5 EP-4 follow-up（2026-05-25）：sort 白名单守卫 + column.id → sortField 桥接
      // column.id camelCase（'posterSource'）→ sortField snake_case（'poster_source'）映射
      listMissingVideos({
        page,
        limit: pageSize,
        sortField: (() => {
          switch (sort.field) {
            case 'title':              return 'title'
            case 'posterStatus':       return 'poster_status'
            case 'posterSource':       return 'poster_source'
            case 'brokenDomain':       return 'broken_domain'
            case 'occurrenceCount':    return 'occurrence_count'
            case 'lastSeenBrokenAt':   return 'last_seen_broken_at'
            case 'created_at':         return 'created_at'
            default:                   return 'created_at'
          }
        })(),
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

  const handleRescan = useCallback(async () => {
    setRescanPending(true)
    try {
      const result = await triggerImageRescan('broken_only')
      toast.push({
        title: '重扫已触发',
        description: `已重置 ${result.updatedCount} 条封面，backfill 任务已入队`,
        level: 'success',
      })
      refresh()
    } catch (err: unknown) {
      toast.push({
        title: '重扫触发失败',
        description: err instanceof Error ? err.message : '请稍后重试',
        level: 'danger',
      })
    } finally {
      setRescanPending(false)
    }
  }, [toast, refresh])

  const handleSwitchDomainPreview = useCallback(async (fromDomain: string, toDomain: string) => {
    return switchImageFallbackDomain(fromDomain, toDomain, true)
  }, [])

  const handleSwitchDomainConfirm = useCallback(async (fromDomain: string, toDomain: string) => {
    await switchImageFallbackDomain(fromDomain, toDomain, false)
    setSwitchDomainOpen(false)
    toast.push({
      title: '域名切换完成',
      description: `已将 ${fromDomain} 替换为 ${toDomain}`,
      level: 'success',
    })
    refresh()
  }, [toast, refresh])

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
      columns: missingColumnPrefs,
      selection: { selectedKeys: new Set<string>(), mode: 'page' as const },
    }),
    [page, pageSize, sort, missingColumnPrefs],
  )

  const domainsQuery = useMemo(
    () => ({
      pagination: { page: 1, pageSize: 20 },
      sort: { field: undefined, direction: 'desc' as const },
      filters: new Map(),
      columns: domainsColumnPrefs,
      selection: { selectedKeys: new Set<string>(), mode: 'page' as const },
    }),
    [domainsColumnPrefs],
  )

  return (
    <>
    <SwitchDomainModal
      open={switchDomainOpen}
      onClose={() => setSwitchDomainOpen(false)}
      onPreview={handleSwitchDomainPreview}
      onConfirm={handleSwitchDomainConfirm}
    />
    <div data-image-health-client style={PAGE_STYLE}>
      <PageHeader
        title="图片健康"
        titleVisuallyHidden
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
              loading={rescanPending}
              onClick={() => void handleRescan()}
              data-testid="image-health-rescan"
            >
              重扫所有封面
            </AdminButton>
            <AdminButton
              variant="default"
              size="sm"
              onClick={() => setSwitchDomainOpen(true)}
              data-testid="image-health-switch-domain"
            >
              批量切 fallback 域
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

      {/* ── 主体 1fr/1fr：TOP 破损域名 + 破损样本 grid ── */}
      <div style={SECTION_SPLIT_STYLE}>
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
              onQueryChange={(patch) => { if (patch.columns) setDomainsColumnPrefs(patch.columns) }}
              loading={loading && domains.length === 0}
              emptyState={<EmptyState title="暂无破损域名" description="所有 CDN 域名健康" />}
              data-testid="image-health-domains-table"
              enableColumnResizing
              pagination={{ hidden: true }}
            />
          )}
        </AdminCard>

        <AdminCard
          surface="plain"
          padding="md"
          header={{
            title: '破损样本',
            subtitle: '2:3 比例缩略 · 实时反映最新破损封面',
          }}
          data-testid="image-health-broken-samples-card"
        >
          {missingError ? (
            <ErrorState error={missingError} title="加载失败" onRetry={refresh} />
          ) : loading && missingRows.length === 0 ? (
            <LoadingState variant="skeleton" />
          ) : (
            <BrokenSamplesGrid rows={missingRows} />
          )}
        </AdminCard>
      </div>

      {/* ── 缺图视频治理（全宽 DataTable）── */}
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
              if (patch.columns) setMissingColumnPrefs(patch.columns)
            }}
            totalRows={missingTotal}
            loading={loading && missingRows.length === 0}
            emptyState={<EmptyState title="无缺图视频" description="所有发布视频海报状态健康" />}
            data-testid="image-health-missing-table"
            enableHeaderMenu
            enableColumnResizing
            pagination={{ pageSizeOptions: [10, 20, 50, 100] }}
          />
        )}
      </AdminCard>
    </div>
    </>
  )
}

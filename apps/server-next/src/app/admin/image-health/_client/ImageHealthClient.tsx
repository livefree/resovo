'use client'

/**
 * ImageHealthClient.tsx — `/admin/image-health` 图片健康视图
 *
 * IMGH-P1-2（SEQ-20260619-01）：从「只读监控」升级为「概览 + 治理 双 Tab」工作台。
 *   - Tab A 健康概览：KPI（共享 KpiCard）+ 7 日破损趋势（共享 Spark）+ TOP 破损域 + 破损样本 Grid
 *   - Tab B 图片治理：缺图视频 DataTable（保留现分页/排序；选中批量 / 复杂筛选 / 候选列留 P2）
 *   - 全局破坏性 action（重扫 / 切 fallback 域 / backfill / 刷新）留 PageHeader（跨 Tab）
 *   - Tab 状态走 `?tab=` query（仿 external-resources/ExternalResourcesClient 范式）
 *
 * 消费既有 6 端点（apps/api/src/routes/admin/image-health.ts / IMG-05）：
 *   getImageHealthStats（含 brokenTrend）/ getTopBrokenDomains / listMissingVideos
 *   / triggerImageBackfill / triggerImageRescan / switchImageFallbackDomain
 *
 * 共享原语（≥ 80% 占比硬清单，quality-gates §7 第 2 项）：
 *   Segment / KpiCard / Spark / DataTable / PageHeader / AdminCard
 *   / EmptyState / ErrorState / LoadingState
 *
 * 设计模式：Mode A 整页滚动（ADR-103 AMENDMENT 2026-05-14 默认）
 */

import { useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  DataTable,
  AdminCard,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  AdminButton,
  Segment,
  useToast,
  type ColumnPreference,
  type TableSortState,
  type TableSelectionState,
  type FilterValue,
} from '@resovo/admin-ui'
import { SwitchDomainModal } from './SwitchDomainModal'
import { ImageHealthProblemBoard } from './ImageHealthProblemBoard'
import { ImageHealthKpiCards } from './ImageHealthKpiCards'
import { ImageGovernanceDrawer } from './ImageGovernanceDrawer'
import { ImageHealthBulkActions } from './ImageHealthBulkActions'
import { buildMissingFilters, imageHealthDistinctFetcher } from './imageHealthFilters'
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
} from '@/lib/image-health/api'
import { buildMissingVideoColumns, buildBrokenDomainColumns } from './ImageHealthColumns'

// ── 常量 ──────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 20

type TabId = 'overview' | 'governance'
const DEFAULT_TAB: TabId = 'overview'
const TABS: ReadonlyArray<{ readonly id: TabId; readonly label: string }> = [
  { id: 'overview', label: '健康概览' },
  { id: 'governance', label: '图片治理' },
]

const PAGE_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--section-gap)',
  padding: 'var(--page-padding-y) var(--page-padding-x) 0',
}

// ── 主组件 ────────────────────────────────────────────────────────

export function ImageHealthClient() {
  const toast = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()

  const rawTab = searchParams.get('tab')
  const activeTab: TabId = TABS.some((t) => t.id === rawTab) ? (rawTab as TabId) : DEFAULT_TAB

  const switchTab = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next === DEFAULT_TAB) params.delete('tab')
      else params.set('tab', next)
      router.push(`/admin/image-health${params.size > 0 ? `?${params}` : ''}`)
    },
    [router, searchParams],
  )

  // ── KPI / 破损域名 / 缺图列表 三类状态 ──
  const [stats, setStats] = useState<ImageHealthStats | null>(null)
  const [statsError, setStatsError] = useState<Error | null>(null)
  const [domains, setDomains] = useState<readonly BrokenDomainRow[]>([])
  const [domainsError, setDomainsError] = useState<Error | null>(null)
  const [missingRows, setMissingRows] = useState<readonly MissingVideoRow[]>([])
  const [missingTotal, setMissingTotal] = useState(0)
  const [missingError, setMissingError] = useState<Error | null>(null)
  // ADR-211：概览（stats/domains）与治理表（missing）加载态拆分；问题图片板自管理数据
  // （ImageHealthProblemBoard 内部 fetch problem-images，与概览/治理表均解耦）
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [missingLoading, setMissingLoading] = useState(true)
  const [backfillPending, setBackfillPending] = useState(false)

  const [rescanPending, setRescanPending] = useState(false)
  const [switchDomainOpen, setSwitchDomainOpen] = useState(false)
  const [switchDomainInitialFrom, setSwitchDomainInitialFrom] = useState<string | undefined>(undefined)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [sort, setSort] = useState<TableSortState>({ field: 'created_at', direction: 'desc' })
  const [retryKey, setRetryKey] = useState(0)
  const [missingColumnPrefs, setMissingColumnPrefs] = useState<ReadonlyMap<string, ColumnPreference>>(new Map())
  const [domainsColumnPrefs, setDomainsColumnPrefs] = useState<ReadonlyMap<string, ColumnPreference>>(new Map())

  // IMGH-P2-3A：图片治理抽屉（行点击打开）+ 成功行 flash
  const [drawerRow, setDrawerRow] = useState<MissingVideoRow | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [flashKeys, setFlashKeys] = useState<ReadonlySet<string>>(new Set())

  // IMGH-P2-3B：服务端筛选（消费 1D）+ 行选区（批量重扫 / 候选队列）
  const [filters, setFilters] = useState<ReadonlyMap<string, FilterValue>>(new Map())
  const [selection, setSelection] = useState<TableSelectionState>({ selectedKeys: new Set(), mode: 'page' })

  // ── 概览数据加载（KPI + 域名 + 破损样本，仅依赖 retryKey，不随治理表分页重载） ──
  // ADR-210 MEDIUM-2：与治理表解耦——破损样本/KPI/域名同源事件流，与 Tab B 分页交互无关。
  useEffect(() => {
    let cancelled = false
    setOverviewLoading(true)
    setStatsError(null); setDomainsError(null)

    Promise.allSettled([
      getImageHealthStats(),
      getTopBrokenDomains(20),
    ]).then(([statsRes, domainsRes]) => {
      if (cancelled) return
      if (statsRes.status === 'fulfilled') setStats(statsRes.value)
      else                                  setStatsError(statsRes.reason instanceof Error ? statsRes.reason : new Error('stats 加载失败'))

      if (domainsRes.status === 'fulfilled') setDomains(domainsRes.value)
      else                                    setDomainsError(domainsRes.reason instanceof Error ? domainsRes.reason : new Error('域名加载失败'))
    }).finally(() => {
      if (!cancelled) setOverviewLoading(false)
    })

    return () => { cancelled = true }
  }, [retryKey])

  // ── 治理表加载（缺图列表，随分页/排序/筛选/retryKey 重载） ──
  useEffect(() => {
    let cancelled = false
    setMissingLoading(true)
    setMissingError(null)

    listMissingVideos({
      page,
      limit: pageSize,
      // ADR-150 阶段 5 EP-4 follow-up（2026-05-25）：sort 白名单守卫 + column.id → sortField 桥接
      // column.id camelCase（'posterSource'）→ sortField snake_case（'poster_source'）映射
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
      // IMGH-P2-3B：DataTable filters Map → 1D 服务端筛选入参（分页 total 一致由后端共享 FROM 保证）
      ...buildMissingFilters(filters),
    }).then((res) => {
      if (cancelled) return
      setMissingRows(res.data)
      setMissingTotal(res.total)
    }).catch((err: unknown) => {
      if (cancelled) return
      setMissingError(err instanceof Error ? err : new Error('缺图视频加载失败'))
    }).finally(() => {
      if (!cancelled) setMissingLoading(false)
    })

    return () => { cancelled = true }
  }, [page, pageSize, sort, retryKey, filters])

  const refresh = useCallback(() => setRetryKey((k) => k + 1), [])

  // IMGH-P2-3A：行点击打开治理抽屉
  const handleRowClick = useCallback((r: MissingVideoRow) => {
    setDrawerRow(r)
    setDrawerOpen(true)
  }, [])

  // 抽屉内 apply/resolve/手填 成功 → 行 flash + 重载
  const handleGovernanceMutated = useCallback((videoId: string) => {
    setFlashKeys(new Set([videoId]))
    refresh()
  }, [refresh])

  // flash 一次性：动画时长后清除（避免常驻高亮）
  useEffect(() => {
    if (flashKeys.size === 0) return
    const t = setTimeout(() => setFlashKeys(new Set()), 1500)
    return () => clearTimeout(t)
  }, [flashKeys])

  // IMGH-P2-3B：批量重扫成功 → flash 受影响行 + 清空选区 + 刷新
  const handleBulkResolved = useCallback((videoIds: readonly string[]) => {
    setFlashKeys(new Set(videoIds))
    setSelection({ selectedKeys: new Set(), mode: 'page' })
    refresh()
  }, [refresh])

  // IMGH-P2-3B：打开候选队列 → 打开首个选中行的治理抽屉（逐个补图入口；选区保留）
  const handleOpenQueue = useCallback((videoIds: readonly string[]) => {
    const idSet = new Set(videoIds)
    const first = missingRows.find((r) => idSet.has(r.videoId))
    if (first) {
      setDrawerRow(first)
      setDrawerOpen(true)
    }
  }, [missingRows])

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

  // IMGH-P1-4：行内「切此域」→ 预填源域 + 打开 Modal
  const handleSwitchThisDomain = useCallback((domain: string) => {
    setSwitchDomainInitialFrom(domain)
    setSwitchDomainOpen(true)
  }, [])

  const missingColumns = useMemo(() => buildMissingVideoColumns(), [])
  const domainColumns = useMemo(
    () => buildBrokenDomainColumns({ onSwitchDomain: handleSwitchThisDomain }),
    [handleSwitchThisDomain],
  )

  const missingQuery = useMemo(
    () => ({
      pagination: { page, pageSize },
      sort,
      filters,
      columns: missingColumnPrefs,
      selection,
    }),
    [page, pageSize, sort, filters, missingColumnPrefs, selection],
  )

  // IMGH-P2-3B：批量操作条（仅选区非空时渲染；DataTable.bulkActions 直传）
  const bulkActionsNode = selection.selectedKeys.size > 0
    ? (
      <ImageHealthBulkActions
        selectedKeys={selection.selectedKeys}
        onResolved={handleBulkResolved}
        onOpenQueue={handleOpenQueue}
      />
    )
    : undefined

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
      initialFromDomain={switchDomainInitialFrom}
    />
    <ImageGovernanceDrawer
      open={drawerOpen}
      row={drawerRow}
      onClose={() => setDrawerOpen(false)}
      onMutated={handleGovernanceMutated}
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
              onClick={() => { setSwitchDomainInitialFrom(undefined); setSwitchDomainOpen(true) }}
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

      <Segment
        items={TABS.map((t) => ({ value: t.id, label: t.label }))}
        value={activeTab}
        onChange={switchTab}
        size="md"
        aria-label="图片健康 tab"
        data-testid="image-health-tab-segment"
      />

      {/* ── Tab A 健康概览 ── */}
      {activeTab === 'overview' && (
        <section role="tabpanel" data-image-health-tabpanel="overview">
          {/* KPI 仪表盘（高密度：图片正常视频 / 4 类覆盖率 / 近 7 日破损） */}
          <div data-testid="image-health-kpi-grid">
            {overviewLoading && !stats
              ? <LoadingState variant="skeleton" />
              : statsError
                ? <ErrorState error={statsError} title="统计加载失败" onRetry={refresh} />
                : stats ? <ImageHealthKpiCards stats={stats} /> : null
            }
          </div>

          {/* ADR-211：问题图片可视化治理板（全宽，自管理 problem-images 数据源） */}
          <ImageHealthProblemBoard />

          {/* TOP 破损域名（下移全宽，CDN 故障定位） */}
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
                loading={overviewLoading && domains.length === 0}
                emptyState={<EmptyState title="暂无破损域名" description="所有 CDN 域名健康" />}
                data-testid="image-health-domains-table"
                enableColumnResizing
                pagination={{ hidden: true }}
              />
            )}
          </AdminCard>
        </section>
      )}

      {/* ── Tab B 图片治理 ── */}
      {activeTab === 'governance' && (
        <section role="tabpanel" data-image-health-tabpanel="governance">
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
                  // IMGH-P2-3B：筛选变更回 page 1（避免落在越界页）；选区走专用 onSelectionChange 通道
                  if (patch.filters) { setFilters(patch.filters); setPage(1) }
                }}
                totalRows={missingTotal}
                loading={missingLoading && missingRows.length === 0}
                emptyState={<EmptyState title="无缺图视频" description="所有发布视频海报状态健康" />}
                data-testid="image-health-missing-table"
                enableHeaderMenu
                enableColumnResizing
                // IMGH-P2-3B：缩略列 Thumb poster-md（48×72）需 poster 行高（80px），否则默认 40px 裁切封面
                density="poster"
                onRowClick={handleRowClick}
                flashRowKeys={flashKeys}
                selection={selection}
                onSelectionChange={setSelection}
                distinctFetcher={imageHealthDistinctFetcher}
                bulkActions={bulkActionsNode}
                pagination={{ pageSizeOptions: [10, 20, 50, 100] }}
              />
            )}
          </AdminCard>
        </section>
      )}
    </div>
    </>
  )
}

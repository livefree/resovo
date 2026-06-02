'use client'

/**
 * SourcesClient.tsx — `/admin/sources` 播放线路管理主组件
 *
 * CHG-VSR-5-A（2026-06-02 / 设计 §3.1/§3.2）：结构重构——
 *   - 删四 Tab（segment：按分组/仅失效/用户纠错/孤岛源）+ 主体「线路矩阵 / 全局别名表」Tab + 内嵌别名面板。
 *   - 列重构为 §3.2 集合（覆盖/探测/试播/质量/问题/站点/最近检测，见 SourceColumns）。
 *   - 刷新改自动 refetch（删手动刷新按钮，保留 retryKey 供 ErrorState）。
 *   - 保留 KPI 4 卡（display only，5-B 重建为 5 张可点击快捷筛选）+ PageHeader「线路别名管理 →」跳转。
 * 端点：apps/api/src/routes/admin/sources-matrix.ts（ADR-117）
 *
 * CHG-VSR-PRE-1：列定义抽到 ./SourceColumns。
 */

import { useState, useEffect, useCallback, useMemo, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeader,
  AdminButton,
  AdminCard,
  KpiCard,
  ErrorState,
  DataTable,
  DataTableSearchInput,
  type TableSortState,
  type FilterValue,
} from '@resovo/admin-ui'
import type { VideoGroupRow, VideoGroupStats, VideoGroupListParams, SourceQuickFilter } from '@/lib/sources/types'
import { listVideoGroups, getVideoGroupStats, fetchDistinct } from '@/lib/sources/api'
import { SourceLinesExpand } from './SourceLinesExpand'
import { buildColumns } from './SourceColumns'

// ── 常量 ─────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 20

// CHG-VSR-5-B / §3.5：5 KPI 卡 = 可点击快捷筛选（B 方案）。'all'=清空（不入 quickFilters）；其余切换 quickFilter（探测②/质量）。
type ActiveQuickFilter = Exclude<SourceQuickFilter, 'all'>
const QUICK_FILTER_CARDS: readonly {
  readonly key: ActiveQuickFilter
  readonly label: string
  readonly statKey: 'abnormal' | 'needsSource' | 'pendingProbe' | 'lowQuality'
  readonly variant: 'is-danger' | 'is-warn' | undefined
}[] = [
  { key: 'has_abnormal',  label: '含异常源', statKey: 'abnormal',     variant: 'is-danger' },
  { key: 'needs_source',  label: '待补源',   statKey: 'needsSource',  variant: 'is-danger' },
  { key: 'pending_probe', label: '待探测',   statKey: 'pendingProbe', variant: 'is-warn' },
  { key: 'low_quality',   label: '低质量',   statKey: 'lowQuality',   variant: 'is-warn' },
]

// §3.4：列 id → API sortField 白名单（video / coverage→activeSources / quality / last_checked→lastChecked）
const SORT_FIELD_BY_COLUMN: Record<string, NonNullable<VideoGroupListParams['sortField']>> = {
  video: 'video',
  coverage: 'activeSources',
  quality: 'quality',
  lastChecked: 'lastChecked',
}

// ── 样式 ─────────────────────────────────────────────────────────

const PAGE_STYLE: CSSProperties = {
  // CHG-SN-5-13-PATCH-2：删 height:100% / minHeight:0；让 AdminShell main `overflow: auto` 整页滚动
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--section-gap)',
  padding: 'var(--page-padding-y) var(--page-padding-x)',
}

const KPI_GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, 1fr)', // CHG-VSR-5-B：5 卡（全部 + 4 快捷筛选）
  gap: '12px',
}

// ── 主组件 ────────────────────────────────────────────────────────

export function SourcesClient() {
  const router = useRouter()
  // ADR-149 EP-4: 接入 DataTableSearchInput 原语（IME + debounce 内置） → 删 searchInput 中间 state
  const [keyword, setKeyword] = useState<string | undefined>()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  // §3.4：默认排序 = 最近检测降序（运维视角关注最近检测；列头显 desc 指示符 / Codex review FIX）
  const [sort, setSort] = useState<TableSortState>({ field: 'lastChecked', direction: 'desc' })
  // HOTFIX-PATCH-2A §2-EXT（2026-05-25）：filtersMap 统一管理（D-150-4 桥接 / column.filterFieldName 即 key）
  const [filtersMap, setFiltersMap] = useState<ReadonlyMap<string, FilterValue>>(new Map())
  const probeStatusFilter = useMemo<readonly string[]>(() => {
    const v = filtersMap.get('probeStatus')
    return v?.kind === 'enum' ? (v.value as readonly string[]) : []
  }, [filtersMap])
  const renderStatusFilter = useMemo<readonly string[]>(() => {
    const v = filtersMap.get('renderStatus')
    return v?.kind === 'enum' ? (v.value as readonly string[]) : []
  }, [filtersMap])
  // CHG-VSR-5-A：最近检测列 date-range filter（filtersMap key 'lastChecked' → lastCheckedFrom/To / 取代旧 updatedAt）
  const lastCheckedRange = useMemo<{ from?: string; to?: string }>(() => {
    const v = filtersMap.get('lastChecked')
    if (v?.kind === 'date-range') return { from: v.from, to: v.to }
    return {}
  }, [filtersMap])
  // HOTFIX-PATCH-2B（2026-05-25）：siteKey enum filter 派生（distinct 端点 / filterFieldName='site_key' = filtersMap key）
  const siteKeyFilter = useMemo<readonly string[]>(() => {
    const v = filtersMap.get('site_key')
    return v?.kind === 'enum' ? (v.value as readonly string[]) : []
  }, [filtersMap])
  // CHG-VSR-5-B：质量列「低质量」boolean 派生（单选 enum 含 'low' → lowQuality / 与 KPI 低质量卡 OR 合流，后端 D-5 单谓词）
  const lowQualityColumnFilter = useMemo<boolean>(() => {
    const v = filtersMap.get('lowQuality')
    return v?.kind === 'enum' && (v.value as readonly string[]).includes('low')
  }, [filtersMap])
  // CHG-VSR-5-B / §3.5：KPI 卡快捷筛选状态（可组合 AND / 'all' 清空 / pressed 选中态）
  const [quickFilters, setQuickFilters] = useState<ReadonlySet<ActiveQuickFilter>>(new Set())
  // EP-4.5-HOTFIX-3 / 问题 1+3：列偏好 state（矩阵 popover 可见性 toggle / 列级 ⋯ 隐藏此列触发）
  const [columnPrefs, setColumnPrefs] = useState<ReadonlyMap<string, { readonly visible: boolean; readonly width?: number }>>(new Map())

  const [stats, setStats] = useState<VideoGroupStats | null>(null)
  const [rows, setRows] = useState<readonly VideoGroupRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | undefined>()
  const [retryKey, setRetryKey] = useState(0)

  const [selectedKeys, setSelectedKeys] = useState<ReadonlySet<string>>(new Set())
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(new Set())

  // KPI stats（独立请求，只加载一次）
  useEffect(() => {
    getVideoGroupStats().then(setStats).catch(() => null)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(undefined)
    // §3.4：列 id → API sortField 白名单守卫（未命中 → 默认 last_checked desc 由后端兜底）
    const apiSortField = sort.field ? SORT_FIELD_BY_COLUMN[sort.field] : undefined
    listVideoGroups({
      page, limit: pageSize, keyword,
      ...(apiSortField ? { sortField: apiSortField, sortDir: sort.direction } : {}),
      // HOTFIX-PATCH-2A §2-EXT（2026-05-25）：filter spread 透传 enum + date-range
      ...(probeStatusFilter.length > 0 ? { probeStatus: probeStatusFilter } : {}),
      ...(renderStatusFilter.length > 0 ? { renderStatus: renderStatusFilter } : {}),
      // CHG-VSR-5-A：最近检测 date-range（lastCheckedFrom/To）取代旧 updatedAt
      ...(lastCheckedRange.from ? { lastCheckedFrom: lastCheckedRange.from } : {}),
      ...(lastCheckedRange.to ? { lastCheckedTo: lastCheckedRange.to } : {}),
      // HOTFIX-PATCH-2B（2026-05-25）：siteKey 数组透传（distinct 端点 multi-select enum）
      ...(siteKeyFilter.length > 0 ? { siteKey: siteKeyFilter } : {}),
      // CHG-VSR-5-B：KPI 卡快捷筛选（quickFilters）+ 质量列低质量 boolean（lowQuality / 与 quickFilters 'low_quality' 后端 OR 合流）
      ...(quickFilters.size > 0 ? { quickFilters: [...quickFilters] } : {}),
      ...(lowQualityColumnFilter ? { lowQuality: true } : {}),
    })
      .then((res) => {
        if (cancelled) return
        setRows(res.data as VideoGroupRow[])
        setTotal(res.total)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e : new Error('加载失败'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [page, pageSize, keyword, sort, filtersMap, quickFilters, retryKey])

  const refresh = useCallback(() => setRetryKey((k) => k + 1), [])

  function handleRowClick(row: VideoGroupRow) {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(row.videoId)) next.delete(row.videoId)
      else next.add(row.videoId)
      return next
    })
  }

  // CHG-VSR-5-B / §3.5：KPI 卡快捷筛选——切换单个 quickFilter（可组合 AND），重置页码
  function toggleQuickFilter(key: ActiveQuickFilter) {
    setQuickFilters((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    setPage(1)
  }
  // 「全部」卡 = 清空全部快捷筛选
  function clearQuickFilters() {
    if (quickFilters.size === 0) return
    setQuickFilters(new Set())
    setPage(1)
  }

  const columns = useMemo(() => buildColumns(expandedKeys), [expandedKeys])

  const query = useMemo(() => ({
    pagination: { page, pageSize },
    sort,
    // HOTFIX-PATCH-2A §2-EXT：filtersMap 注入 DataTable.query.filters（matrix popover + DataTableAutoFilter 消费）
    filters: filtersMap,
    // EP-4.5-HOTFIX-3 / 问题 1+3：columns 用 state（让矩阵 popover toggle / 列级 ⋯ 隐藏此列真生效）
    columns: columnPrefs,
    selection: { selectedKeys, mode: 'page' as const },
  }), [page, pageSize, sort, filtersMap, columnPrefs, selectedKeys])

  const toolbarSearch = (
    <DataTableSearchInput
      placeholder="搜索视频名称…"
      value={keyword ?? ''}
      onChange={(next) => {
        setKeyword(next.trim() || undefined)
        setPage(1)
      }}
      size="sm"
      aria-label="搜索视频"
      data-testid="sources-search-input"
    />
  )

  const bulkActions = selectedKeys.size > 0 ? (
    <AdminButton size="sm" variant="secondary">批量验证</AdminButton>
  ) : null

  return (
    <div style={PAGE_STYLE}>
      {/* 顶栏 + 别名管理跳转（CHG-SN-9-LINES-VIEW-UNIFY） */}
      <PageHeader
        title="播放线路"
        actions={
          <AdminButton
            size="sm"
            variant="primary"
            data-testid="sources-line-aliases-link"
            onClick={() => router.push('/admin/source-line-aliases')}
          >
            线路别名管理
          </AdminButton>
        }
      />

      {/* KPI 卡 = 可点击快捷筛选（B 方案 / §3.5）：全部(清空) + 4 quickFilter，pressed 选中态、可组合 AND */}
      <div style={KPI_GRID_STYLE}>
        <KpiCard
          label="全部"
          value={stats?.total ?? '—'}
          dataSource={stats ? 'live' : undefined}
          onClick={clearQuickFilters}
          pressed={quickFilters.size === 0}
          testId="sources-kpi-all"
        />
        {QUICK_FILTER_CARDS.map((c) => (
          <KpiCard
            key={c.key}
            label={c.label}
            variant={c.variant}
            value={stats?.[c.statKey] ?? '—'}
            dataSource={stats ? 'live' : undefined}
            onClick={() => toggleQuickFilter(c.key)}
            pressed={quickFilters.has(c.key)}
            testId={`sources-kpi-${c.key}`}
          />
        ))}
      </div>

      {/* 线路表格（自然高度；main 整页滚动）*/}
      <AdminCard style={{ display: 'flex', flexDirection: 'column' }}>
        {error
          ? <div style={{ padding: '16px' }}><ErrorState error={error} onRetry={refresh} /></div>
          : (
              <DataTable<VideoGroupRow>
                rows={rows}
                columns={columns}
                rowKey={(r) => r.videoId}
                mode="server"
                enableColumnResizing
                query={query}
                onQueryChange={(patch) => {
                  if (patch.pagination) {
                    if (patch.pagination.page !== undefined) setPage(patch.pagination.page)
                    if (patch.pagination.pageSize !== undefined) {
                      setPageSize(patch.pagination.pageSize)
                      setPage(1)
                    }
                  }
                  if (patch.sort) setSort(patch.sort)
                  if (patch.selection) setSelectedKeys(patch.selection.selectedKeys)
                  // EP-4.5-HOTFIX-3 / 问题 1+3：消费 columns patch
                  if (patch.columns) setColumnPrefs(patch.columns)
                  // HOTFIX-PATCH-2A §2-EXT：消费 filters patch（matrix popover + DataTableAutoFilter onChange）
                  if (patch.filters) {
                    setFiltersMap(patch.filters)
                    setPage(1)
                  }
                }}
                totalRows={total}
                loading={loading}
                emptyState={
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--fg-muted)' }}>
                    {keyword ? `未找到包含「${keyword}」的视频` : '暂无播放线路数据'}
                  </div>
                }
                selection={{ selectedKeys, mode: 'page' }}
                onSelectionChange={(s) => setSelectedKeys(s.selectedKeys)}
                onRowClick={handleRowClick}
                expandedKeys={expandedKeys}
                renderExpandedRow={(row) => <SourceLinesExpand videoId={row.videoId} />}
                toolbar={{
                  search: toolbarSearch,
                  hideFilterChips: true,
                }}
                bulkActions={bulkActions}
                pagination={{ pageSizeOptions: [20, 50, 100] }}
                density="poster"
                // HOTFIX-PATCH-2B（2026-05-25）：distinctFetcher 注入（siteKey 列 distinct 调用）
                distinctFetcher={fetchDistinct}
              />
            )
        }
      </AdminCard>
    </div>
  )
}

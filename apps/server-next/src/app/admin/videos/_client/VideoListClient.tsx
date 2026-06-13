'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import type { CSSProperties } from 'react'
import {
  DataTable, PageHeader,
  EmptyState, ErrorState, LoadingState, useTableQuery,
  type TableQueryPatch, type TableSelectionState,
} from '@resovo/admin-ui'
import { useTableRouterAdapter } from '@/lib/table-router-adapter'
import { VIDEO_COLUMN_DESCRIPTORS } from '@/lib/videos/columns'
import { listVideos, fetchDistinct } from '@/lib/videos/api'
import { downloadCsv, type CsvColumn } from '@/lib/csv-export'
import type { VideoAdminRow, VideoListFilter } from '@/lib/videos'
import type { TabKey } from './_videoEdit/types'
import {
  buildVideoFilter, VideoFilterBar,
  VIDEO_TYPE_OPTIONS, VISIBILITY_OPTIONS, REVIEW_STATUS_OPTIONS,
  VIDEO_QUICK_FILTERS, type VideoQuickFilterKey,
} from './VideoFilterFields'
import { buildVideoColumns } from './VideoColumns'
import { BatchActionsRow, buildBatchActions } from './VideoBatchActions'
import { buildMergeHref } from '@/lib/merge/entry'
import { buildHomeAddHref } from '@/lib/home-modules/entry'
import { VideoEditDrawer } from './VideoEditDrawer'

// ── main component ────────────────────────────────────────────────

const PAGE_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
  // CHG-UX2-03 接入 admin-layout/spacing.ts token
  gap: 'var(--section-gap)',
  padding: 'var(--page-padding-y) var(--page-padding-x) 0',
}

// reference §5.3 视频库 page__head：共享 PageHeader 承载（MODUX-P1-1-A，规约 T-1/T-3）
const HEAD_BTN_STYLE: CSSProperties = {
  height: '28px',
  padding: '0 var(--button-padding-x)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-default)',
  fontFamily: 'inherit',
  fontSize: 'var(--font-size-xs)',
  cursor: 'pointer',
}
const HEAD_BTN_PRIMARY_STYLE: CSSProperties = {
  ...HEAD_BTN_STYLE,
  background: 'var(--accent-default)',
  color: 'var(--fg-on-accent)',
  border: '1px solid var(--accent-default)',
  fontWeight: 500,
}
// disabled 态：opacity 0.5 + cursor:not-allowed，明确表达"暂不可用"语义
const HEAD_BTN_DISABLED_OVERLAY: CSSProperties = {
  opacity: 0.5,
  cursor: 'not-allowed',
}

// ── 快捷筛选(B) 子标题样式（设计 §2.1/§2.6③；外层 margin/字号由 PageHeader subtitle 槽提供）─
const SUBHEAD_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '8px',
}
const SUBHEAD_COUNT_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}
const QUICK_CHIP_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  height: '22px',
  padding: '0 10px',
  border: '1px solid var(--border-default)',
  borderRadius: '999px',
  background: 'var(--bg-surface)',
  color: 'var(--fg-muted)',
  fontFamily: 'inherit',
  fontSize: 'var(--font-size-xs)',
  lineHeight: 1,
  cursor: 'pointer',
}
// pressed 态复用 PRE-3 KpiCard token（--admin-accent-soft/-border 已确认存在）
// 用完整 border shorthand 覆盖（勿用 borderColor）：与 QUICK_CHIP_STYLE.border shorthand 混用会触发
// React rerender 警告「Removing a style property during rerender (borderColor) when border is set」
const QUICK_CHIP_PRESSED_STYLE: CSSProperties = {
  background: 'var(--admin-accent-soft)',
  border: '1px solid var(--admin-accent-border)',
  color: 'var(--accent-default)',
  fontWeight: 600,
}
const QUICK_COUNT_STYLE: CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  opacity: 0.85,
}

// CHG-VSR-4-B（Q1=A）：快捷筛选统计计数 = 各派生条件 limit=1 count 查询（读 total）。
// 全局口径（不随当前 search/列筛选变化，对齐设计 §2.1「695 条 · 待审 12 …」）。
const QUICK_COUNT_FILTERS: Record<VideoQuickFilterKey, VideoListFilter> = {
  pendingReview: { pendingReview: true, page: 1, limit: 1 },
  metaIncomplete: { metaIncomplete: true, page: 1, limit: 1 },
  episodeMismatch: { episodeMismatch: true, page: 1, limit: 1 },
}

export function VideoListClient() {
  const router = useTableRouterAdapter()
  const isAdmin = false // CHG-SN-3-12 将从 session/context 注入
  const { snapshot, patch } = useTableQuery({
    // CHG-VSR-4-A：tableId bump 'admin-videos'→'admin-videos-v2' 失效回访用户旧列布局
    tableId: 'admin-videos-v2',
    router,
    defaults: {
      pagination: { page: 1, pageSize: 20 },
      // CHG-VSR-4-A（设计 §2.5）：默认「最近信息变更」视角 updated_at desc
      sort: { field: 'updated_at', direction: 'desc' },
    },
    urlNamespace: 'v',
    columns: VIDEO_COLUMN_DESCRIPTORS,
  })

  const [rows, setRows] = useState<VideoAdminRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | undefined>()
  const [retryKey, setRetryKey] = useState(0)
  const [selection, setSelection] = useState<TableSelectionState>({ selectedKeys: new Set(), mode: 'page' })
  // CHG-SN-8-FUP-VIDEO-MANUAL-ADD-EP-B / ADR-145：Drawer 双模式
  // 'closed' = 关闭 / null = 创建模式 / string = 编辑模式（videoId）
  const [drawerTarget, setDrawerTarget] = useState<'closed' | null | string>('closed')
  // CHG-VSR-4-B（Q2=A）：行操作深链 tab（图片/外部元数据/查看播放线路）；缺省 basic
  const [editTab, setEditTab] = useState<TabKey | undefined>(undefined)
  const editVideoId = drawerTarget === 'closed' ? null : drawerTarget
  const drawerOpen = drawerTarget !== 'closed'

  // CHG-VSR-4-B（设计 §2.6③）：页面级快捷筛选(B)——独立 React Set（不入 snapshot.filters）
  const [quickFilters, setQuickFilters] = useState<ReadonlySet<VideoQuickFilterKey>>(new Set())
  const [quickCounts, setQuickCounts] = useState<Record<VideoQuickFilterKey, number> | null>(null)

  // CHG-DESIGN-08 8B：flash row（reference §6.1 + DataTable.flashRowKeys）
  const [flashRowKeys, setFlashRowKeys] = useState<ReadonlySet<string>>(new Set())
  const flashRow = useCallback((id: string) => {
    setFlashRowKeys((prev) => new Set(prev).add(id))
    setTimeout(() => {
      setFlashRowKeys((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 1500)
  }, [])

  const handleRowUpdate = useCallback((id: string, patch2: Partial<VideoAdminRow>) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, ...patch2 } : r))
    // 视觉确认乐观更新；失败回滚时再 flash 一次提示用户（rollback 也调 onRowUpdate）
    flashRow(id)
  }, [flashRow])

  // CHG-VSR-4-B：行操作可携带目标 tab（图片→images / 外部元数据→external / 查看播放线路→lines）
  const handleEditRequest = useCallback((id: string, tab?: TabKey) => {
    setEditTab(tab)
    setDrawerTarget(id)
  }, [])

  const clearSelection = useCallback(
    () => setSelection({ selectedKeys: new Set(), mode: 'page' }),
    [],
  )

  const handleBatchComplete = useCallback(() => {
    clearSelection()
    setRetryKey((k) => k + 1)
  }, [clearSelection])

  // sub C（2026-05-24）：注入 3 options（ADR-150 D-150-1 enum 列 filterOptions 静态注入）
  const columns = useMemo(
    () => buildVideoColumns(
      isAdmin,
      handleRowUpdate,
      handleEditRequest,
      VIDEO_TYPE_OPTIONS,
      VISIBILITY_OPTIONS,
      REVIEW_STATUS_OPTIONS,
    ),
    [isAdmin, handleRowUpdate, handleEditRequest],
  )

  // 列表拉取：snapshot 列筛选/排序/分页 + 页面级快捷筛选合流
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(undefined)
    listVideos(buildVideoFilter(snapshot, quickFilters))
      .then((result) => {
        if (cancelled) return
        setRows(result.data)
        setTotal(result.total)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [snapshot, retryKey, quickFilters])

  // CHG-VSR-4-B（Q1=A）：快捷筛选统计计数（3 个 limit=1 count 查询，挂载 + 批量操作后刷新）
  useEffect(() => {
    let cancelled = false
    Promise.all(
      VIDEO_QUICK_FILTERS.map((qf) =>
        listVideos(QUICK_COUNT_FILTERS[qf.key]).then((r) => [qf.key, r.total] as const),
      ),
    )
      .then((entries) => {
        if (!cancelled) setQuickCounts(Object.fromEntries(entries) as Record<VideoQuickFilterKey, number>)
      })
      .catch(() => { if (!cancelled) setQuickCounts(null) /* 计数加载失败 → 不显示数字（筛选仍可用） */ })
    return () => { cancelled = true }
  }, [retryKey])

  const handlePatch = useCallback((next: TableQueryPatch) => patch(next), [patch])

  // 快捷筛选切换：可组合（AND）；切换时回 page 1（仅当前非首页才 patch，减少冗余 refetch）
  const resetToFirstPage = useCallback(() => {
    if (snapshot.pagination.page !== 1) {
      patch({ pagination: { page: 1, pageSize: snapshot.pagination.pageSize } })
    }
  }, [patch, snapshot.pagination.page, snapshot.pagination.pageSize])

  const toggleQuick = useCallback((key: VideoQuickFilterKey) => {
    setQuickFilters((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    resetToFirstPage()
  }, [resetToFirstPage])

  const clearQuick = useCallback(() => {
    setQuickFilters(new Set())
    resetToFirstPage()
  }, [resetToFirstPage])

  // CHG-DESIGN-02 Step 7B：批量操作 ReactNode（DataTable.bulkActions 直传）
  // CHG-VIR-13-A2：合并所选 → 新窗口打开 merge 工作台（对齐 moderation-batch window.open 行为，保留列表上下文）
  const batchActions = useMemo(
    () => buildBatchActions(selection.selectedKeys, {
      onMergeSelected: (ids) => {
        window.open(
          buildMergeHref({ kind: 'batch-merge', ids, from: 'videos-batch' }),
          '_blank',
          'noopener,noreferrer',
        )
      },
      // CHG-HOME-UX-08：加入首页运营 → 新窗深链确认面板（保留列表上下文）
      onAddToHome: (ids) => {
        window.open(
          buildHomeAddHref({ ids, from: 'videos-batch' }),
          '_blank',
          'noopener,noreferrer',
        )
      },
    }),
    [selection.selectedKeys],
  )
  const bulkActionsNode = selection.selectedKeys.size > 0
    ? <BatchActionsRow actions={batchActions} onActionResolved={handleBatchComplete} />
    : undefined

  // 导出 CSV（设计 §1.1/§7-8：固定在 PageHeader，不进表格头部）
  const handleExportCsv = useCallback(() => {
    if (rows.length === 0) return
    const csvColumns: readonly CsvColumn<VideoAdminRow>[] = [
      { header: 'id',            accessor: (r) => r.id },
      { header: 'short_id',      accessor: (r) => r.short_id },
      { header: 'title',         accessor: (r) => r.title },
      { header: 'title_en',      accessor: (r) => r.title_en },
      { header: 'type',          accessor: (r) => r.type },
      { header: 'year',          accessor: (r) => r.year },
      { header: 'is_published',  accessor: (r) => r.is_published },
      { header: 'review_status', accessor: (r) => r.review_status ?? null },
      { header: 'source_count',  accessor: (r) => r.source_count },
      { header: 'created_at',    accessor: (r) => r.created_at },
    ]
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    downloadCsv(rows, csvColumns, `videos-${ts}.csv`)
  }, [rows])

  return (
    <div data-video-list-client style={PAGE_STYLE}>
      {/* reference §5.3 视频库 page__head — 共享 PageHeader（CHG-DESIGN-08 8A / MODUX-P1-1-A，规约 T-1/T-3） */}
      <PageHeader
        title="视频库"
        titleVisuallyHidden
        subtitle={
          /* 快捷筛选(B)：{total} 条 · 全部 · 待审 N · 元数据缺失 N · 集数不一致 N（§2.1/§2.6③） */
          <div style={SUBHEAD_STYLE} data-page-head-sub>
            <span style={SUBHEAD_COUNT_STYLE}>{total} 条视频</span>
            <button
              type="button"
              data-quick-filter="all"
              aria-pressed={quickFilters.size === 0}
              onClick={clearQuick}
              style={quickFilters.size === 0 ? { ...QUICK_CHIP_STYLE, ...QUICK_CHIP_PRESSED_STYLE } : QUICK_CHIP_STYLE}
            >
              全部
            </button>
            {VIDEO_QUICK_FILTERS.map((qf) => {
              const pressed = quickFilters.has(qf.key)
              const count = quickCounts?.[qf.key]
              return (
                <button
                  key={qf.key}
                  type="button"
                  data-quick-filter={qf.key}
                  aria-pressed={pressed}
                  onClick={() => toggleQuick(qf.key)}
                  style={pressed ? { ...QUICK_CHIP_STYLE, ...QUICK_CHIP_PRESSED_STYLE } : QUICK_CHIP_STYLE}
                >
                  {qf.label}
                  {count != null && <span style={QUICK_COUNT_STYLE}>{count}</span>}
                </button>
              )
            })}
          </div>
        }
        actions={
          <>
            {/* 导出 CSV：当前页行集导出（rows 空时 disabled） */}
            <button
              type="button"
              style={rows.length === 0 ? { ...HEAD_BTN_STYLE, ...HEAD_BTN_DISABLED_OVERLAY } : HEAD_BTN_STYLE}
              data-page-action="export-csv"
              data-testid="videos-export-csv"
              disabled={rows.length === 0}
              onClick={handleExportCsv}
            >
              导出 CSV
            </button>
            <button
              type="button"
              style={HEAD_BTN_PRIMARY_STYLE}
              data-page-action="add-video"
              onClick={() => { setEditTab(undefined); setDrawerTarget(null) }}
              title="打开 VideoEditDrawer 创建模式 + POST /admin/videos（ADR-145）"
            >
              手动添加视频
            </button>
          </>
        }
      />
      {loading && rows.length === 0
        ? <LoadingState variant="skeleton" />
        : error
          ? <ErrorState error={error} title="加载失败" onRetry={() => setRetryKey((k) => k + 1)} />
          : (
            <DataTable<VideoAdminRow>
              rows={rows}
              columns={columns}
              rowKey={(row) => row.id}
              mode="server"
              query={snapshot}
              onQueryChange={handlePatch}
              totalRows={total}
              loading={loading}
              selection={selection}
              onSelectionChange={setSelection}
              emptyState={<EmptyState title="暂无视频" description="调整筛选条件后重试" />}
              data-testid="video-list-table"
              enableHeaderMenu
              // DTR-E：通用表格列宽可调验收消费方（列已声明 enableResizing / SEQ-20260531-01）
              enableColumnResizing
              // CHG-VSR-4-B：country 列 distinct（media_catalog.country）
              distinctFetcher={fetchDistinct}
              density="poster"
              flashRowKeys={flashRowKeys}
              // 设计 §1.1：表格头部仅 左搜索 + 右列设置；无筛选下拉行 / 已选过滤 chip 条 / 视图保存
              toolbar={{
                search: <VideoFilterBar snapshot={snapshot} onPatch={handlePatch} />,
                hideFilterChips: true,
              }}
              bulkActions={bulkActionsNode}
              pagination={{ pageSizeOptions: [10, 20, 50] }}
            />
          )
      }
      <VideoEditDrawer
        open={drawerOpen}
        videoId={editVideoId}
        initialTab={editTab}
        onClose={() => setDrawerTarget('closed')}
        onSaved={() => { setDrawerTarget('closed'); setRetryKey((k) => k + 1) }}
      />
    </div>
  )
}

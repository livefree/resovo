'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import type { CSSProperties } from 'react'
import {
  DataTable, FilterChipBar,
  EmptyState, ErrorState, LoadingState, useTableQuery,
  AdminButton,
  type TableQueryPatch, type TableSelectionState, type TableView, type ViewScope,
} from '@resovo/admin-ui'
import { useTableRouterAdapter } from '@/lib/table-router-adapter'
import { VIDEO_COLUMN_DESCRIPTORS } from '@/lib/videos/columns'
import { listVideos } from '@/lib/videos/api'
import { downloadCsv, type CsvColumn } from '@/lib/csv-export'
import { listCrawlerSites } from '@/lib/crawler/api'
import type { VideoAdminRow, CrawlerSite } from '@/lib/videos'
import {
  loadPersonalViews, loadTeamViews, appendPersonalView, makePersonalView,
  DEFAULT_VIEWS,
} from '@/lib/videos/saved-views'
import { buildVideoFilter, buildFilterChips, VideoFilterBar, VIDEO_TYPE_OPTIONS, VISIBILITY_OPTIONS, REVIEW_STATUS_OPTIONS } from './VideoFilterFields'
import { buildVideoColumns } from './VideoColumns'
import { BatchActionsRow, buildBatchActions } from './VideoBatchActions'
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

// reference §5.3 视频库 page__head：title「视频库」+ sub「N 条视频 · ...」+ actions
const HEAD_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '16px',
  flexShrink: 0,
}
const HEAD_TITLE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: 'var(--font-size-lg)',
  fontWeight: 700,
  color: 'var(--fg-default)',
  lineHeight: 1.3,
}
const HEAD_SUB_STYLE: CSSProperties = {
  margin: '4px 0 0',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}
const HEAD_ACTIONS_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexShrink: 0,
}
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
// disabled 态：opacity 0.5 + cursor:not-allowed，明确表达"暂不可用"语义（与 CHG-DESIGN-05 fix#1
// 防 inert 范式一致 — 按钮可见但 disabled，配 title 提示原因，不构成"看似能点但点击无反馈"）
const HEAD_BTN_DISABLED_OVERLAY: CSSProperties = {
  opacity: 0.5,
  cursor: 'not-allowed',
}

export function VideoListClient() {
  const router = useTableRouterAdapter()
  const isAdmin = false // CHG-SN-3-12 将从 session/context 注入
  const { snapshot, patch } = useTableQuery({
    tableId: 'admin-videos',
    router,
    defaults: {
      pagination: { page: 1, pageSize: 20 },
      sort: { field: 'created_at', direction: 'desc' },
    },
    urlNamespace: 'v',
    columns: VIDEO_COLUMN_DESCRIPTORS,
  })

  const [rows, setRows] = useState<VideoAdminRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | undefined>()
  const [retryKey, setRetryKey] = useState(0)
  const [sites, setSites] = useState<readonly CrawlerSite[]>([])
  const [selection, setSelection] = useState<TableSelectionState>({ selectedKeys: new Set(), mode: 'page' })
  // CHG-SN-8-FUP-VIDEO-MANUAL-ADD-EP-B / ADR-145：Drawer 双模式
  // 'closed' = 关闭 / null = 创建模式 / string = 编辑模式（videoId）
  const [drawerTarget, setDrawerTarget] = useState<'closed' | null | string>('closed')
  const editVideoId = drawerTarget === 'closed' ? null : drawerTarget
  const drawerOpen = drawerTarget !== 'closed'
  const setEditVideoId = (id: string | null) => setDrawerTarget(id === null ? 'closed' : id)

  // CHG-DESIGN-08 8B：saved views（personal localStorage / team mock 暂空）
  // 4 默认 views（reference §5.3「我的待审/本周/封面失效/团队新增上架」）留 follow-up
  // VIDEO-DEFAULT-VIEWS-PRESET（query 形态需业务调研后预置）
  const [personalViews, setPersonalViews] = useState<readonly TableView[]>([])
  const [teamViews] = useState<readonly TableView[]>(loadTeamViews())
  const [activeViewId, setActiveViewId] = useState<string | undefined>(undefined)

  // SSR-safe：首次 mount 后加载 localStorage（loadPersonalViews 内有 typeof localStorage 守卫）
  useEffect(() => { setPersonalViews(loadPersonalViews()) }, [])

  // CHG-DESIGN-08 8B：flash row（reference §6.1 + DataTable.flashRowKeys）
  // publish/unpublish 等 row 写操作完成后调 flashRow(id) → 1.5s 视觉确认 → 自动清除
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

  const handleEditRequest = useCallback((id: string) => {
    setEditVideoId(id)
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

  useEffect(() => {
    listCrawlerSites().then(setSites).catch(() => {/* site 加载失败时下拉为空 */})
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(undefined)
    listVideos(buildVideoFilter(snapshot))
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
  }, [snapshot, retryKey])

  const clearFilter = useCallback((key: string) => {
    const next = new Map(snapshot.filters)
    next.delete(key)
    patch({ filters: next })
  }, [snapshot.filters, patch])

  const chips = buildFilterChips(snapshot, clearFilter)

  const handlePatch = useCallback((next: TableQueryPatch) => patch(next), [patch])

  // CHG-DESIGN-02 Step 7B：批量操作 ReactNode（DataTable.bulkActions 直传）
  // 仅在 selection 非空时构建（DataTable bulk bar 自身也按 selection 渲染门控）
  const batchActions = useMemo(
    () => buildBatchActions(selection.selectedKeys),
    [selection.selectedKeys],
  )
  const bulkActionsNode = selection.selectedKeys.size > 0
    ? <BatchActionsRow actions={batchActions} onActionResolved={handleBatchComplete} />
    : undefined

  // CHG-DESIGN-02 Step 7B：业务 filter chips（key 命名空间为 q/type/status/...，
  // 与 column.id 不一致）保留外置 FilterChipBar 走 toolbar.trailing；DataTable
  // 内置 filter chips 显式关闭（hideFilterChips: true）避免重复渲染空集
  // CHG-SN-6-24：与 export 按钮共存（Fragment 组合）
  const handleExportCsv = useCallback(() => {
    if (rows.length === 0) return
    const columns: readonly CsvColumn<VideoAdminRow>[] = [
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
    downloadCsv(rows, columns, `videos-${ts}.csv`)
  }, [rows])

  const exportButton = (
    <AdminButton
      variant="ghost"
      size="sm"
      onClick={handleExportCsv}
      disabled={rows.length === 0}
      data-testid="videos-export-csv"
    >
      导出 CSV
    </AdminButton>
  )

  const trailingNode = chips.length > 0
    ? (
        <span style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
          <FilterChipBar items={chips} onClearAll={() => patch({ filters: new Map() })} />
          {exportButton}
        </span>
      )
    : exportButton

  // ── CHG-DESIGN-08 8B saved views handlers ─────────────────────
  // viewsConfig 切换：activeId 同步到 query state（不含 selection — view scope 与选区无关）
  // 查找列表必须含 DEFAULT_VIEWS（CHG-DESIGN-08 8B fix#2 防 regression：上轮漏掉默认
  // views 致点击后 find() 返 undefined → patch 不调 → 用户看到 view 选中但 query 不变）
  // columns 字段语义守门（fix#3）：useTableQuery applyPatch.columns 是**完全替换**语义，
  // 不是 merge。空 Map 会清空用户已设的列偏好；只有 view 显式声明列可见性时才 patch。
  const handleViewChange = useCallback((id: string | null) => {
    setActiveViewId(id ?? undefined)
    if (!id) return
    const all = [...DEFAULT_VIEWS, ...personalViews, ...teamViews]
    const view = all.find((v) => v.id === id)
    if (!view) return
    // columns 仅在非空时 patch（保留用户当前列可见性偏好；reference §5.3 默认 views 视图意图
    // 是改 filter / sort 不动列；如未来某 view 真的需要操作列可见性，直接传完整 columns Map
    // 包含所有列状态，不能只传差异化）
    const next: TableQueryPatch = view.query.columns.size > 0
      ? {
          pagination: view.query.pagination,
          sort: view.query.sort,
          filters: view.query.filters,
          columns: view.query.columns,
        }
      : {
          pagination: view.query.pagination,
          sort: view.query.sort,
          filters: view.query.filters,
        }
    patch(next)
  }, [personalViews, teamViews, patch])

  // viewsConfig 保存：当前 query snapshot → 新 view（personal localStorage 持久化；
  // team scope 暂返空 — VIDEO-TEAM-VIEWS-API follow-up）。label 由 prompt 取（最简实装；
  // 后续可改 modal）。
  const handleViewSave = useCallback((scope: ViewScope) => {
    if (scope === 'team') {
      // VIDEO-TEAM-VIEWS-API follow-up：M-SN-4+ 接入 POST /admin/views/team
      // eslint-disable-next-line no-console
      console.warn('[VideoListClient] team scope save 暂未接入真端点（follow-up VIDEO-TEAM-VIEWS-API）')
      return
    }
    if (typeof window === 'undefined') return
    const label = window.prompt('为当前视图命名：')?.trim()
    if (!label) return
    const view = makePersonalView(label, {
      pagination: snapshot.pagination,
      sort: snapshot.sort,
      filters: snapshot.filters,
      columns: snapshot.columns,
    })
    setPersonalViews((prev) => appendPersonalView(prev, view))
    setActiveViewId(view.id)
  }, [snapshot])

  // viewsItems 合并顺序：默认 4 views 放最前（用户高频使用 + reference §5.3 标杆）→
  // 个人 saved views → 团队 views（M-SN-4+ 真端点接入后填充）
  const viewsItems = useMemo(
    () => [...DEFAULT_VIEWS, ...personalViews, ...teamViews],
    [personalViews, teamViews],
  )

  return (
    <div data-video-list-client style={PAGE_STYLE}>
      {/* reference §5.3 视频库 page__head（CHG-DESIGN-08 8A） */}
      <header style={HEAD_STYLE} data-page-head>
        <div>
          <h1 style={HEAD_TITLE_STYLE}>视频库</h1>
          <p style={HEAD_SUB_STYLE} data-page-head-sub>
            {total} 条视频 · 表头集成 · 视图保存 · 乐观更新
          </p>
        </div>
        <div style={HEAD_ACTIONS_STYLE} data-page-head-actions>
          {/* CHG-DESIGN-08 8A 第一阶段 + Codex stop-time fix：actions 暂未实装 →
              disabled + title 提示，明确表达"暂不可用"，避免 inert（visible 但 onClick 无反馈）。
              follow-up：VIDEO-EXPORT-CSV（导出 CSV blob 下载）/ VIDEO-MANUAL-ADD（新视频路由）*/}
          <button
            type="button"
            style={{ ...HEAD_BTN_STYLE, ...HEAD_BTN_DISABLED_OVERLAY }}
            data-page-action="export-csv"
            disabled
            title="功能开发中（follow-up VIDEO-EXPORT-CSV）"
          >
            导出 CSV
          </button>
          <button
            type="button"
            style={HEAD_BTN_PRIMARY_STYLE}
            data-page-action="add-video"
            onClick={() => setDrawerTarget(null)}
            title="打开 VideoEditDrawer 创建模式 + POST /admin/videos（ADR-145）"
          >
            手动添加视频
          </button>
        </div>
      </header>
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
              density="poster"
              flashRowKeys={flashRowKeys}
              toolbar={{
                search: <VideoFilterBar snapshot={snapshot} sites={sites} onPatch={handlePatch} />,
                trailing: trailingNode,
                hideFilterChips: true,
                viewsConfig: {
                  items: viewsItems,
                  activeId: activeViewId,
                  onChange: handleViewChange,
                  onSave: handleViewSave,
                },
              }}
              bulkActions={bulkActionsNode}
              pagination={{ pageSizeOptions: [10, 20, 50] }}
            />
          )
      }
      <VideoEditDrawer
        open={drawerOpen}
        videoId={editVideoId}
        onClose={() => setDrawerTarget('closed')}
        onSaved={() => { setDrawerTarget('closed'); setRetryKey((k) => k + 1) }}
      />
    </div>
  )
}

'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import type { CSSProperties } from 'react'
import {
  DataTable, FilterChipBar,
  EmptyState, ErrorState, LoadingState, useTableQuery,
  Pill, VisChip, Thumb, DualSignal,
  type TableColumn, type TableQueryPatch, type TableSelectionState,
} from '@resovo/admin-ui'
import { useTableRouterAdapter } from '@/lib/table-router-adapter'
import { VIDEO_COLUMN_DESCRIPTORS } from '@/lib/videos/columns'
import { listVideos, batchPublish, batchUnpublish, reviewVideo } from '@/lib/videos/api'
import { listCrawlerSites } from '@/lib/crawler/api'
import type { VideoAdminRow, CrawlerSite, VideoType } from '@/lib/videos'
import { buildVideoFilter, buildFilterChips, VideoFilterBar } from './VideoFilterFields'
import { VideoRowActions } from './VideoRowActions'
import { VideoEditDrawer } from './VideoEditDrawer'

// ── batch actions ─────────────────────────────────────────────────
//
// Step 7B：从外置 SelectionActionBar 切到 DataTable.bulkActions ReactNode 直传。
// 保留 SelectionAction 类型 + confirm 流（pendingConfirm 状态机），inline 渲染 4 个
// 批量按钮，不抽 admin-ui（多消费方需求出现时再考虑沉淀，CHG-DESIGN-12 评估）。

const BATCH_PUBLISH_LIMIT = 100
const BATCH_DANGER_LIMIT = 50

interface BatchAction {
  readonly key: string
  readonly label: string
  readonly variant?: 'danger'
  readonly disabled: boolean
  readonly confirm?: { readonly title: string; readonly description?: string }
  readonly onConfirm: () => Promise<unknown>
}

function buildBatchActions(
  selectedKeys: ReadonlySet<string>,
): readonly BatchAction[] {
  const ids = Array.from(selectedKeys)
  const count = ids.length
  return [
    {
      key: 'batch-publish',
      label: '批量公开',
      disabled: count === 0 || count > BATCH_PUBLISH_LIMIT,
      onConfirm: () => batchPublish(ids),
    },
    {
      key: 'batch-unpublish',
      label: '批量隐藏',
      variant: 'danger',
      disabled: count === 0 || count > BATCH_DANGER_LIMIT,
      confirm: { title: `确认隐藏 ${count} 条视频？`, description: '已上架视频将同步下架' },
      onConfirm: () => batchUnpublish(ids),
    },
    {
      key: 'batch-approve',
      label: '批量通过审核',
      disabled: count === 0 || count > BATCH_DANGER_LIMIT,
      onConfirm: () => Promise.all(ids.map((id) => reviewVideo(id, 'approve'))),
    },
    {
      key: 'batch-reject',
      label: '批量拒绝审核',
      variant: 'danger',
      disabled: count === 0 || count > BATCH_DANGER_LIMIT,
      confirm: { title: `确认拒绝 ${count} 条视频审核？` },
      onConfirm: () => Promise.all(ids.map((id) => reviewVideo(id, 'reject'))),
    },
  ]
}

const BATCH_BTN_BASE_STYLE: CSSProperties = {
  height: 'var(--row-h-compact, 24px)',
  padding: '0 12px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-default)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-default)',
  fontSize: '12px',
  cursor: 'pointer',
  font: 'inherit',
}
const BATCH_BTN_DANGER_STYLE: CSSProperties = {
  ...BATCH_BTN_BASE_STYLE,
  borderColor: 'var(--state-error-border)',
  color: 'var(--state-error-fg)',
}
const BATCH_CONFIRM_WRAP_STYLE: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '8px',
  padding: '4px 10px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface-elevated)',
  border: '1px solid var(--border-strong)',
  fontSize: '12px',
}

interface BatchActionsRowProps {
  readonly actions: readonly BatchAction[]
  readonly onActionResolved: () => void
}

function BatchActionsRow({ actions, onActionResolved }: BatchActionsRowProps) {
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null)
  const handleClick = (action: BatchAction) => {
    if (action.disabled) return
    if (action.confirm) {
      setPendingConfirm(action.key)
      return
    }
    void action.onConfirm().then(onActionResolved)
  }
  const handleConfirmOk = (action: BatchAction) => {
    setPendingConfirm(null)
    void action.onConfirm().then(onActionResolved)
  }
  return (
    <>
      {actions.map((action) => {
        if (pendingConfirm === action.key && action.confirm) {
          return (
            <span key={action.key} style={BATCH_CONFIRM_WRAP_STYLE} data-confirm-prompt={action.key}>
              <span>{action.confirm.title}</span>
              <button
                type="button"
                style={{ ...BATCH_BTN_BASE_STYLE, borderColor: 'var(--accent-default)', color: 'var(--admin-accent-on-soft)' }}
                onClick={() => handleConfirmOk(action)}
              >确认</button>
              <button
                type="button"
                style={{ ...BATCH_BTN_BASE_STYLE, color: 'var(--fg-muted)' }}
                onClick={() => setPendingConfirm(null)}
              >取消</button>
            </span>
          )
        }
        return (
          <button
            key={action.key}
            type="button"
            style={action.variant === 'danger' ? BATCH_BTN_DANGER_STYLE : BATCH_BTN_BASE_STYLE}
            disabled={action.disabled}
            onClick={() => handleClick(action)}
            data-action-key={action.key}
          >
            {action.label}
          </button>
        )
      })}
    </>
  )
}

// ── column definitions（reference §6.1 视频库标杆 10 列）─────────────

// 类型中文映射（CHG-DESIGN-08 8A 内联到 columns 层；原 VideoTypeChip 已由 Pill 取代）
const TYPE_LABELS: Record<VideoType, string> = {
  movie: '电影',
  series: '剧集',
  anime: '动漫',
  variety: '综艺',
  documentary: '纪录片',
  short: '短片',
  sports: '体育',
  music: '音乐',
  news: '新闻',
  kids: '少儿',
  other: '其他',
}

// 标题列 cell 样式（thumb 与 title 分列，title 仅含标题 + meta）
const TITLE_CELL_STYLE: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0,
}
const TITLE_TEXT_STYLE: CSSProperties = {
  fontSize: '12px', fontWeight: 600, color: 'var(--fg-default)',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}
const TITLE_META_STYLE: CSSProperties = {
  fontSize: '11px', color: 'var(--fg-muted)',
  // mono 字体用浏览器默认 stack（design-tokens 暂未定义 --font-mono；reference.md §6.1 仅
  // 描述 .tbl-meta.mono 视觉，未规定 token；保留扩展位由 STATS-EXTEND-VIDEOS follow-up 决定）
  fontFamily: 'ui-monospace, "SF Mono", Consolas, monospace',
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
}

// 源活跃 cell 样式（reference §6.1 sources 列：dot + 数字 + 活跃/一般/稀少 文案）
const SOURCES_CELL_STYLE: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px',
}
const SOURCES_DOT_STYLE: CSSProperties = {
  width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
}
const SOURCES_NUM_STYLE: CSSProperties = {
  fontSize: '12px', fontWeight: 600, color: 'var(--fg-default)',
}
const SOURCES_LABEL_STYLE: CSSProperties = {
  fontSize: '10px', color: 'var(--fg-muted)',
}

function sourcesDotColor(active: number): string {
  if (active > 10) return 'var(--state-success-fg)'
  if (active > 3) return 'var(--state-warning-fg)'
  return 'var(--state-error-fg)'
}

function sourcesLabel(active: number): string {
  if (active > 10) return '活跃'
  if (active > 3) return '一般'
  return '稀少'
}

// 图片健康 P0 pill：poster 或 backdrop 任一 broken → P0 失效（danger）；都 ok → P0 活跃（ok）
function imageHealthVariant(row: VideoAdminRow): 'ok' | 'danger' {
  const broken =
    row.poster_status === 'broken' || row.poster_status === 'fallback' ||
    row.backdrop_status === 'broken' || row.backdrop_status === 'fallback'
  return broken ? 'danger' : 'ok'
}

// review pill：approved=ok / pending_review=warn / rejected=danger
function reviewPillVariant(status: VideoAdminRow['review_status']): 'ok' | 'warn' | 'danger' | 'neutral' {
  switch (status) {
    case 'approved': return 'ok'
    case 'pending_review': return 'warn'
    case 'rejected': return 'danger'
    default: return 'neutral'
  }
}

function reviewPillLabel(status: VideoAdminRow['review_status']): string {
  switch (status) {
    case 'approved': return '已通过'
    case 'pending_review': return '待审'
    case 'rejected': return '已拒'
    default: return '—'
  }
}

function buildVideoColumns(
  isAdmin: boolean,
  onRowUpdate: (id: string, patch: Partial<VideoAdminRow>) => void,
  onEditRequest: (id: string) => void,
): readonly TableColumn<VideoAdminRow>[] {
  return [
    // ── thumb 列：reference §6.1 32×48 竖版 poster ──
    {
      id: 'cover', header: '封面', accessor: (r) => r.cover_url,
      width: 60, minWidth: 56, enableResizing: false, defaultVisible: true,
      cell: ({ row }) => <Thumb src={row.cover_url} size="poster-sm" />,
    },
    // ── title 列：标题 + meta（shortId · year）──
    {
      id: 'title', header: '标题', accessor: (r) => r.title,
      width: 320, minWidth: 220, enableResizing: true, enableSorting: true, defaultVisible: true, pinned: true,
      cell: ({ row }) => (
        <div style={TITLE_CELL_STYLE}>
          <span style={TITLE_TEXT_STYLE}>{row.title}</span>
          <span style={TITLE_META_STYLE}>{row.short_id} · {row.year ?? '—'}</span>
        </div>
      ),
    },
    // ── type 列：Pill neutral + 中文映射（reference §6.1 中性映射）──
    {
      id: 'type', header: '类型', accessor: (r) => r.type,
      width: 90, minWidth: 80, enableResizing: true, enableSorting: true, defaultVisible: true,
      cell: ({ row }) => (
        <Pill variant="neutral">{TYPE_LABELS[row.type] ?? row.type}</Pill>
      ),
    },
    // ── year 列（默认隐藏；title 列 meta 已显示 year）──
    {
      id: 'year', header: '年份', accessor: (r) => r.year ?? '',
      width: 100, minWidth: 80, enableResizing: true, enableSorting: true, defaultVisible: false,
    },
    // ── sources 列：reference §6.1 dot + 数字 + 活跃/一般/稀少 文案 ──
    {
      id: 'source_health', header: '源活跃', accessor: (r) => r.active_source_count ?? r.source_count,
      width: 100, minWidth: 90, enableResizing: true, defaultVisible: true,
      cell: ({ row }) => {
        const active = parseInt(row.active_source_count ?? row.source_count ?? '0', 10)
        return (
          <span style={SOURCES_CELL_STYLE} data-testid="source-health">
            <span aria-hidden="true" style={{ ...SOURCES_DOT_STYLE, background: sourcesDotColor(active) }} />
            <strong style={SOURCES_NUM_STYLE}>{active}</strong>
            <span style={SOURCES_LABEL_STYLE}>{sourcesLabel(active)}</span>
          </span>
        )
      },
    },
    // ── probe 列：reference §6.1 DualSignal 探测/播放双信号 ──
    // 后端暂未提供 probe / render 字段；先传 'unknown' / 'unknown' 占位（STATS-EXTEND-VIDEOS follow-up）
    {
      id: 'probe', header: '探测/播放', accessor: () => 'probe-render',
      width: 140, minWidth: 120, enableResizing: true, defaultVisible: true,
      cell: () => <DualSignal probe="unknown" render="unknown" />,
    },
    // ── image 列：reference §6.1 P0 失效|活跃 Pill ──
    {
      id: 'image_health', header: '图片', accessor: (r) => `${r.poster_status ?? '-'}/${r.backdrop_status ?? '-'}`,
      width: 100, minWidth: 90, enableResizing: true, defaultVisible: true,
      cell: ({ row }) => {
        const variant = imageHealthVariant(row)
        return (
          <Pill variant={variant} testId="image-health">
            P0 {variant === 'ok' ? '活跃' : '失效'}
          </Pill>
        )
      },
    },
    // ── visibility 列：reference §6.1 VisChip（visibility + review 复合）──
    {
      id: 'visibility', header: '可见性', accessor: (r) => r.visibility_status ?? '',
      width: 120, minWidth: 110, enableResizing: true, defaultVisible: true,
      cell: ({ row }) => (row.visibility_status && row.review_status)
        ? <VisChip visibility={row.visibility_status} review={row.review_status} />
        : null,
    },
    // ── review 列：reference §6.1 单 review pill（不复用 VisChip，因 visibility 列已承担复合状态）──
    {
      id: 'review_status', header: '审核', accessor: (r) => r.review_status ?? '',
      width: 90, minWidth: 80, enableResizing: true, defaultVisible: true,
      cell: ({ row }) => row.review_status
        ? <Pill variant={reviewPillVariant(row.review_status)}>{reviewPillLabel(row.review_status)}</Pill>
        : null,
    },
    {
      id: 'douban_status', header: '豆瓣状态', accessor: (r) => r.douban_status ?? '',
      width: 180, minWidth: 160, enableResizing: true, defaultVisible: false,
    },
    {
      id: 'meta_score', header: '元数据完整度', accessor: (r) => r.meta_score ?? '',
      width: 160, minWidth: 140, enableResizing: true, defaultVisible: false,
    },
    {
      id: 'created_at', header: '创建时间', accessor: (r) => r.created_at,
      width: 160, minWidth: 140, enableResizing: true, enableSorting: true, defaultVisible: false,
    },
    {
      id: 'updated_at', header: '更新时间', accessor: (r) => r.updated_at ?? '',
      width: 160, minWidth: 140, enableResizing: true, enableSorting: true, defaultVisible: false,
    },
    // ── actions 列：reference §6.1 170 宽 ──
    // 8A 第一阶段保留 VideoRowActions（AdminDropdown 形态）；inline xs btn ×5 重构留 8A 第二阶段
    {
      id: 'actions', header: '操作', accessor: () => null,
      width: 170, minWidth: 148, enableResizing: false, defaultVisible: true,
      cell: ({ row }) => (
        <VideoRowActions
          row={row}
          isAdmin={isAdmin}
          onRowUpdate={onRowUpdate}
          onEditRequest={onEditRequest}
        />
      ),
    },
  ]
}

// ── main component ────────────────────────────────────────────────

const PAGE_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
  gap: '12px',
  padding: '20px 24px 0',
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
  fontSize: '18px',
  fontWeight: 700,
  color: 'var(--fg-default)',
  lineHeight: 1.3,
}
const HEAD_SUB_STYLE: CSSProperties = {
  margin: '4px 0 0',
  fontSize: '12px',
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
  padding: '0 12px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-default)',
  font: 'inherit',
  fontSize: '12px',
  cursor: 'pointer',
}
const HEAD_BTN_PRIMARY_STYLE: CSSProperties = {
  ...HEAD_BTN_STYLE,
  background: 'var(--accent-default)',
  color: 'var(--fg-on-accent)',
  border: '1px solid var(--accent-default)',
  fontWeight: 500,
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
  const [editVideoId, setEditVideoId] = useState<string | null>(null)

  const handleRowUpdate = useCallback((id: string, patch2: Partial<VideoAdminRow>) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, ...patch2 } : r))
  }, [])

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

  const columns = useMemo(
    () => buildVideoColumns(isAdmin, handleRowUpdate, handleEditRequest),
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
  const trailingNode = chips.length > 0
    ? <FilterChipBar items={chips} onClearAll={() => patch({ filters: new Map() })} />
    : undefined

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
          <button type="button" style={HEAD_BTN_STYLE} data-page-action="export-csv">
            导出 CSV
          </button>
          <button type="button" style={HEAD_BTN_PRIMARY_STYLE} data-page-action="add-video">
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
              toolbar={{
                search: <VideoFilterBar snapshot={snapshot} sites={sites} onPatch={handlePatch} />,
                trailing: trailingNode,
                hideFilterChips: true,
              }}
              bulkActions={bulkActionsNode}
              pagination={{ pageSizeOptions: [10, 20, 50] }}
            />
          )
      }
      <VideoEditDrawer
        open={editVideoId !== null}
        videoId={editVideoId}
        onClose={() => setEditVideoId(null)}
        onSaved={() => { setEditVideoId(null); setRetryKey((k) => k + 1) }}
      />
    </div>
  )
}

'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import type { CSSProperties } from 'react'
import {
  DataTable, FilterChipBar,
  EmptyState, ErrorState, LoadingState, useTableQuery,
  Pill, VisChip, Thumb, DualSignal, AdminButton,
  type TableColumn, type TableQueryPatch, type TableSelectionState, type TableView, type ViewScope,
} from '@resovo/admin-ui'
import { useTableRouterAdapter } from '@/lib/table-router-adapter'
import { VIDEO_COLUMN_DESCRIPTORS } from '@/lib/videos/columns'
import { listVideos, batchPublish, batchUnpublish, reviewVideo } from '@/lib/videos/api'
import { downloadCsv, type CsvColumn } from '@/lib/csv-export'
import { listCrawlerSites } from '@/lib/crawler/api'
import type { VideoAdminRow, CrawlerSite, VideoType } from '@/lib/videos'
import {
  loadPersonalViews, loadTeamViews, appendPersonalView, makePersonalView,
  DEFAULT_VIEWS,
} from '@/lib/videos/saved-views'
import { buildVideoFilter, buildFilterChips, VideoFilterBar, VIDEO_TYPE_OPTIONS, VISIBILITY_OPTIONS, REVIEW_STATUS_OPTIONS } from './VideoFilterFields'
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
  padding: '0 var(--button-padding-x)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-default)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-default)',
  fontSize: 'var(--font-size-xs)',
  cursor: 'pointer',
  fontFamily: 'inherit',
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
  fontSize: 'var(--font-size-xs)',
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
  fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--fg-default)',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}
const TITLE_META_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)',
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
  fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--fg-default)',
}
const SOURCES_LABEL_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-2xs)', color: 'var(--fg-muted)',
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

// sub C（2026-05-24）：ADR-150 D-150-1 双轨 — 4 列加 filterable
//   title (text/q) / type (enum) / visibility (enum/visibilityStatus) / review_status (enum/reviewStatus)
//   options 由消费方注入（VIDEO_TYPE_OPTIONS / VISIBILITY_OPTIONS / REVIEW_STATUS_OPTIONS）
function buildVideoColumns(
  isAdmin: boolean,
  onRowUpdate: (id: string, patch: Partial<VideoAdminRow>) => void,
  onEditRequest: (id: string) => void,
  typeOptions: readonly { value: string; label?: string }[] = [],
  visibilityOptions: readonly { value: string; label?: string }[] = [],
  reviewOptions: readonly { value: string; label?: string }[] = [],
): readonly TableColumn<VideoAdminRow>[] {
  return [
    // ── thumb 列：CHG-UX2-03 升级 poster-sm 32×48 → poster-md 48×72（解决"视频库列表过小"）──
    // CHG-UX2-03d：cover width = Thumb 48 + cell padding 24 = 72，贴合 cell content；
    // 不再用 wrapper div（CHG-UX2-03c 的 wrapper 让 Thumb 成为 flex item，破坏 flex-shrink:0）
    {
      id: 'cover', kind: 'media', header: '封面', accessor: (r) => r.cover_url,
      width: 72, minWidth: 64, enableResizing: false, defaultVisible: true,
      cell: ({ row }) => <Thumb src={row.cover_url} size="poster-md" />,
    },
    // ── title 列：标题 + meta（shortId · year）──
    // CHG-UX2-03 改弹性：删 width 保留 minWidth → buildGridTemplate 走 minmax(220px, 1fr) 撑满，
    // 消除右侧空白 + 消除横向溢出（frame "圆角右直角"根因连锁修复）
    // sub C：text filter / filterFieldName='q'（D-150-4 业务 key 桥接 / 后端搜 title）
    {
      id: 'title', header: '标题', accessor: (r) => r.title,
      minWidth: 220, enableResizing: true, enableSorting: true, defaultVisible: true, pinned: true,
      filterable: true, filterFieldName: 'q', filterKind: 'text',
      cell: ({ row }) => (
        <div style={TITLE_CELL_STYLE}>
          <span style={TITLE_TEXT_STYLE}>{row.title}</span>
          <span style={TITLE_META_STYLE}>{row.short_id} · {row.year ?? '—'}</span>
        </div>
      ),
    },
    // ── type 列：Pill neutral + 中文映射（reference §6.1 中性映射）──
    // sub C：enum filter / filterFieldName='type'
    {
      id: 'type', header: '类型', accessor: (r) => r.type,
      width: 90, minWidth: 80, enableResizing: true, enableSorting: true, defaultVisible: true,
      filterable: true, filterFieldName: 'type', filterKind: 'enum', filterOptions: typeOptions,
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
    // CHG-UX2-03b 收窄 100 → 90（消除横滚 → frame 圆角完整）
    // AMD2-PATCH-2：后端 SORT_FIELDS 扩展 'source_health' → ORDER BY active_source_count
    // 撤回 PATCH-1 错误"enableSorting: false"反范式（违反 AMD2 D-150-AMD2-1 默认全开）
    {
      id: 'source_health', header: '源活跃', accessor: (r) => r.active_source_count ?? r.source_count,
      width: 90, minWidth: 80, enableResizing: true, defaultVisible: true,
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
    // CHG-UX2-03b 收窄 140 → 110（消除横滚）
    // AMD2-PATCH-2：保留 enableSorting: false — 后端 schema 真无 probe / render 字段（placeholder
    //   accessor 返回固定字符串 / 排序无意义）/ 待 STATS-EXTEND-VIDEOS 补字段后启用
    {
      id: 'probe', header: '探测/播放', accessor: () => 'probe-render',
      width: 110, minWidth: 100, enableResizing: true, enableSorting: false, defaultVisible: true,
      cell: () => <DualSignal probe="unknown" render="unknown" />,
    },
    // ── image 列：reference §6.1 P0 失效|活跃 Pill ──
    // CHG-UX2-03b 默认隐藏（消除横滚 → 用户可手动开）
    // AMD2-PATCH-2：保留 enableSorting: false — image_health 是 poster_status + backdrop_status
    //   复合派生（accessor 拼字符串）/ 后端无对应复合 SQL 排序字段 / 拆分排序 UX 不清晰
    //   后续补 image_health enum 字段（如 'ok' / 'partial' / 'broken'）后端 ORDER BY 后启用
    {
      id: 'image_health', header: '图片', accessor: (r) => `${r.poster_status ?? '-'}/${r.backdrop_status ?? '-'}`,
      width: 100, minWidth: 90, enableResizing: true, enableSorting: false, defaultVisible: false,
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
    // sub C：enum filter / filterFieldName='visibilityStatus'（D-150-4 业务 key 桥接 column.id ≠ filterFieldName）
    // AMD2-PATCH-2：后端 SORT_FIELDS 扩展 'visibility' → ORDER BY v.visibility_status
    {
      id: 'visibility', header: '可见性', accessor: (r) => r.visibility_status ?? '',
      width: 120, minWidth: 110, enableResizing: true, defaultVisible: true,
      filterable: true, filterFieldName: 'visibilityStatus', filterKind: 'enum', filterOptions: visibilityOptions,
      cell: ({ row }) => (row.visibility_status && row.review_status)
        ? <VisChip visibility={row.visibility_status} review={row.review_status} />
        : null,
    },
    // ── review 列：reference §6.1 单 review pill（不复用 VisChip，因 visibility 列已承担复合状态）──
    // sub C：enum filter / filterFieldName='reviewStatus'（D-150-4 业务 key 桥接）
    // AMD2-PATCH-2：后端 SORT_FIELDS 扩展 'review_status' → ORDER BY v.review_status
    {
      id: 'review_status', header: '审核', accessor: (r) => r.review_status ?? '',
      width: 90, minWidth: 80, enableResizing: true, defaultVisible: true,
      filterable: true, filterFieldName: 'reviewStatus', filterKind: 'enum', filterOptions: reviewOptions,
      cell: ({ row }) => row.review_status
        ? <Pill variant={reviewPillVariant(row.review_status)}>{reviewPillLabel(row.review_status)}</Pill>
        : null,
    },
    // AMD2-PATCH-2：后端 SORT_FIELDS 扩展 'douban_status' → ORDER BY v.douban_status
    {
      id: 'douban_status', header: '豆瓣状态', accessor: (r) => r.douban_status ?? '',
      width: 180, minWidth: 160, enableResizing: true, defaultVisible: false,
    },
    // AMD2-PATCH-2：后端 SORT_FIELDS 扩展 'meta_score' → ORDER BY v.meta_score
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
    // ── actions 列：reference §6.1 ──
    // 8A 第一阶段保留 VideoRowActions（AdminDropdown 形态）；inline xs btn ×5 重构留 8A 第二阶段
    // CHG-UX2-03b 收窄 170 → 150（消除横滚）
    {
      id: 'actions', kind: 'action', header: '操作', accessor: () => null,
      width: 150, minWidth: 130, enableResizing: false, defaultVisible: true,
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

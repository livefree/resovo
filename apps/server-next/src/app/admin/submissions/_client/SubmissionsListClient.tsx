'use client'

/**
 * SubmissionsListClient.tsx — `/admin/submissions` 用户投稿审核视图主组件
 * （M-SN-5 / SEQ-20260512-02 / CHG-SN-5-01）
 *
 * 范围：列表 + 视频类型/来源站点筛选 + 行级 通过/拒绝 + 批量 通过/拒绝。
 * 端点：apps/api/src/routes/admin/content.ts:183-256（5 个现成端点，零新端点）。
 *
 * 6 通用原语首次业务消费（PRE-03 系列下沉后第一张视图卡，M-SN-5.5 audit Y5 缓解）：
 *   - PageHeader（page__head 统一壳）
 *   - AdminButton（操作按钮 + 批量按钮）
 *   - AdminInput（拒绝理由文本框 — 在 SubmissionRejectPopover）
 *   - AdminSelect（videoType + siteKey 双下拉）
 *   - Popover（拒绝原因弹层 — 在 SubmissionRejectPopover）
 *   - AdminCard 暂未消费（无典型 dashboard 卡场景；后续 SubmissionDetailDrawer 可消费）
 *
 * 硬约束（SEQ-20260512-02 关键约束 + M-SN-5.5 audit）：
 *   - 零 admin-ui 通用组件 props 反向扩展（仅 className/style 兜底）
 *   - 零本地新建 admin-ui 通用组件
 *   - DataTable 一体化（不复用 ModernDataTable / 外置 PaginationV2 / 外置 SelectionActionBar 三件套）
 */

import { useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react'
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  AdminButton,
  AdminSelect,
  useToast,
  type AdminSelectOption,
  type TableSelectionState,
  type TableSortState,
} from '@resovo/admin-ui'
import {
  listSubmissions,
  approveSubmission,
  rejectSubmission,
  batchApproveSubmissions,
  batchRejectSubmissions,
} from '@/lib/submissions/api'
import type { SubmissionRow } from '@/lib/submissions/types'
import { listCrawlerSites } from '@/lib/crawler/api'
import type { CrawlerSite } from '@/lib/videos/types'
import { SubmissionRejectPopover } from './SubmissionRejectPopover'
import { buildSubmissionColumns } from './columns'

// ── 常量 ──────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 20
const BATCH_LIMIT = 100

const VIDEO_TYPE_OPTIONS: readonly AdminSelectOption[] = [
  { value: 'movie', label: '电影' },
  { value: 'series', label: '剧集' },
  { value: 'anime', label: '动漫' },
  { value: 'variety', label: '综艺' },
  { value: 'documentary', label: '纪录片' },
  { value: 'short', label: '短片' },
  { value: 'sports', label: '体育' },
  { value: 'music', label: '音乐' },
  { value: 'other', label: '其他' },
]

// ── 批量操作行（DataTable.bulkActions 直传） ───────────────────────

const BATCH_BAR_STYLE: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '8px',
  fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)',
}

interface BulkActionsProps {
  readonly selectedKeys: ReadonlySet<string>
  readonly pending: boolean
  readonly onBatchApprove: () => void
  readonly onBatchReject: (reason: string | undefined) => void
}

function BulkActions({ selectedKeys, pending, onBatchApprove, onBatchReject }: BulkActionsProps) {
  const ids = Array.from(selectedKeys)
  const count = ids.length
  const overLimit = count > BATCH_LIMIT
  return (
    <span style={BATCH_BAR_STYLE} data-testid="submission-bulk-bar">
      <span>已选 {count} 条</span>
      <AdminButton
        variant="primary"
        size="sm"
        loading={pending}
        disabled={count === 0 || overLimit}
        onClick={onBatchApprove}
        data-testid="submission-batch-approve"
      >
        批量通过
      </AdminButton>
      <SubmissionRejectPopover
        pending={pending}
        onConfirm={onBatchReject}
        data-testid="submission-batch-reject-popover"
        trigger={
          <AdminButton
            variant="danger"
            size="sm"
            disabled={count === 0 || overLimit}
            data-testid="submission-batch-reject"
          >
            批量拒绝…
          </AdminButton>
        }
      />
      {overLimit ? (
        <span style={{ color: 'var(--state-error-fg)' }} data-testid="submission-bulk-over-limit">
          超过批量上限 {BATCH_LIMIT}
        </span>
      ) : null}
    </span>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────

const PAGE_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
  gap: 'var(--section-gap)',
  padding: 'var(--page-padding-y) var(--page-padding-x) 0',
}

const TOOLBAR_LEFT_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap',
}

export function SubmissionsListClient() {
  const [rows, setRows] = useState<readonly SubmissionRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [sort, setSort] = useState<TableSortState>({ field: 'created_at', direction: 'desc' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | undefined>()
  const [retryKey, setRetryKey] = useState(0)
  const [videoType, setVideoType] = useState<string | null>(null)
  const [siteKey, setSiteKey] = useState<string | null>(null)
  const [sites, setSites] = useState<readonly CrawlerSite[]>([])
  const [selection, setSelection] = useState<TableSelectionState>({ selectedKeys: new Set(), mode: 'page' })
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [batchPending, setBatchPending] = useState(false)
  const toast = useToast()

  // 加载站点列表
  useEffect(() => {
    listCrawlerSites()
      .then((rows) => {
        const sorted = [...rows].sort((a, b) =>
          (a.name ?? '').localeCompare(b.name ?? '', 'zh-CN', { sensitivity: 'base' })
        )
        setSites(sorted)
      })
      .catch(() => { /* 站点加载失败 → 下拉为空 */ })
  }, [])

  // 加载投稿列表
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(undefined)
    listSubmissions({
      page,
      limit: pageSize,
      sortField: sort.field,
      sortDir: sort.direction,
      videoType: videoType ?? undefined,
      siteKey: siteKey ?? undefined,
    })
      .then((res) => {
        if (cancelled) return
        setRows(res.data)
        setTotal(res.total)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [page, pageSize, sort, videoType, siteKey, retryKey])

  const clearSelection = useCallback(
    () => setSelection({ selectedKeys: new Set(), mode: 'page' }),
    [],
  )

  const refresh = useCallback(() => {
    clearSelection()
    setRetryKey((k) => k + 1)
  }, [clearSelection])

  // Y-MID-4 修复（中期审计 2026-05-12 CHG-SN-5-07-PATCH）：4 处异步操作补 catch + useToast
  // 复用 SubtitlesListClient (-02) / UsersListClient (-03) 同款 Toast 错误反馈模式
  const handleApprove = useCallback(async (id: string) => {
    setPendingId(id)
    try {
      await approveSubmission(id)
      refresh()
    } catch (err: unknown) {
      toast.push({
        title: '通过失败',
        description: err instanceof Error ? err.message : '操作失败，请稍后重试',
        level: 'danger',
      })
    } finally {
      setPendingId(null)
    }
  }, [refresh, toast])

  const handleReject = useCallback(async (id: string, reason: string | undefined) => {
    setPendingId(id)
    try {
      await rejectSubmission(id, reason)
      refresh()
    } catch (err: unknown) {
      toast.push({
        title: '拒绝失败',
        description: err instanceof Error ? err.message : '操作失败，请稍后重试',
        level: 'danger',
      })
    } finally {
      setPendingId(null)
    }
  }, [refresh, toast])

  const handleBatchApprove = useCallback(async () => {
    if (selection.selectedKeys.size === 0) return
    setBatchPending(true)
    try {
      await batchApproveSubmissions(Array.from(selection.selectedKeys))
      refresh()
    } catch (err: unknown) {
      toast.push({
        title: '批量通过失败',
        description: err instanceof Error ? err.message : '操作失败，请稍后重试',
        level: 'danger',
      })
    } finally {
      setBatchPending(false)
    }
  }, [selection.selectedKeys, refresh, toast])

  const handleBatchReject = useCallback(async (reason: string | undefined) => {
    if (selection.selectedKeys.size === 0) return
    setBatchPending(true)
    try {
      await batchRejectSubmissions(Array.from(selection.selectedKeys), reason)
      refresh()
    } catch (err: unknown) {
      toast.push({
        title: '批量拒绝失败',
        description: err instanceof Error ? err.message : '操作失败，请稍后重试',
        level: 'danger',
      })
    } finally {
      setBatchPending(false)
    }
  }, [selection.selectedKeys, refresh, toast])

  const columns = useMemo(
    () => buildSubmissionColumns({
      onApprove: (id) => void handleApprove(id),
      onReject: (id, r) => void handleReject(id, r),
      pendingId,
    }),
    [handleApprove, handleReject, pendingId],
  )

  const siteOptions = useMemo<readonly AdminSelectOption[]>(
    () => sites.map((s) => ({ value: s.key, label: s.name || s.key })),
    [sites],
  )

  const toolbarSearch = (
    <span style={TOOLBAR_LEFT_STYLE} data-testid="submission-toolbar-filters">
      <AdminSelect
        options={VIDEO_TYPE_OPTIONS}
        value={videoType}
        onChange={(next) => { setVideoType(next); setPage(1) }}
        placeholder="全部类型"
        size="sm"
        data-testid="submission-filter-type"
        aria-label="按视频类型筛选"
      />
      <AdminSelect
        options={siteOptions}
        value={siteKey}
        onChange={(next) => { setSiteKey(next); setPage(1) }}
        placeholder="全部来源"
        size="sm"
        searchable
        disabled={siteOptions.length === 0}
        data-testid="submission-filter-site"
        aria-label="按来源站点筛选"
      />
      {(videoType || siteKey) ? (
        <AdminButton
          variant="ghost"
          size="sm"
          onClick={() => { setVideoType(null); setSiteKey(null); setPage(1) }}
          data-testid="submission-filter-clear"
        >
          清空筛选
        </AdminButton>
      ) : null}
    </span>
  )

  const bulkActionsNode = selection.selectedKeys.size > 0
    ? (
        <BulkActions
          selectedKeys={selection.selectedKeys}
          pending={batchPending}
          onBatchApprove={() => void handleBatchApprove()}
          onBatchReject={(r) => void handleBatchReject(r)}
        />
      )
    : undefined

  const query = useMemo(
    () => ({
      pagination: { page, pageSize },
      sort,
      filters: new Map(),
      columns: new Map(),
      selection,
    }),
    [page, pageSize, sort, selection],
  )

  return (
    <div data-submissions-list-client style={PAGE_STYLE}>
      <PageHeader
        title="用户投稿"
        subtitle={`${total} 条待审 · 通过 / 拒绝 / 批量审核`}
        actions={
          <AdminButton
            variant="default"
            size="sm"
            onClick={refresh}
            data-testid="submission-refresh"
          >
            刷新
          </AdminButton>
        }
        data-testid="submissions-page-header"
      />
      {loading && rows.length === 0
        ? <LoadingState variant="skeleton" />
        : error
          ? <ErrorState error={error} title="加载失败" onRetry={refresh} />
          : (
              <DataTable<SubmissionRow>
                rows={rows}
                columns={columns}
                rowKey={(r) => r.id}
                mode="server"
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
                }}
                totalRows={total}
                loading={loading}
                selection={selection}
                onSelectionChange={setSelection}
                emptyState={<EmptyState title="暂无待审投稿" description="调整筛选条件后重试" />}
                data-testid="submission-table"
                enableHeaderMenu
                toolbar={{
                  search: toolbarSearch,
                  hideFilterChips: true,
                }}
                bulkActions={bulkActionsNode}
                pagination={{ pageSizeOptions: [10, 20, 50] }}
              />
            )
      }
    </div>
  )
}

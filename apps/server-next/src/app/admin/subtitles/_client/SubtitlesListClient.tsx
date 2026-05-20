'use client'

/**
 * SubtitlesListClient.tsx — `/admin/subtitles` 字幕审核队列视图主组件
 * （M-SN-5 / SEQ-20260512-02 / CHG-SN-5-02）
 *
 * 范围：列表 + 行级 通过/拒绝 + Toast 错误反馈。
 * 端点：apps/api/src/routes/admin/content.ts:269-308（3 个现成端点，零新端点）。
 *
 * 6 通用原语消费（4/6 件，满足"至少 3 件"门槛）：
 *   - PageHeader（page__head 统一壳）
 *   - AdminButton（刷新 + 行级通过/拒绝触发器）
 *   - AdminInput（拒绝理由文本框 — 在 SubtitleRejectPopover）
 *   - Popover（拒绝原因弹层 — 在 SubtitleRejectPopover）
 *   - AdminSelect / AdminCard — 跳过（API 无语言/格式过滤端点；无 dashboard 卡场景）
 *
 * DEBT-ADMIN-UI-TOAST-MISSING 缓解：approve/reject catch 均调用 useToast().push()。
 *
 * 硬约束（SEQ-20260512-02 关键约束）：
 *   - 零 admin-ui 通用组件 props 反向扩展（仅 className/style 兜底）
 *   - 零本地新建 admin-ui 通用组件
 *   - DataTable 一体化（不复用 ModernDataTable / 外置 PaginationV2 / 外置 SelectionActionBar）
 */

import { useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react'
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  AdminButton,
  KpiCard,
  useToast,
  type TableSortState,
} from '@resovo/admin-ui'
import {
  listSubtitles,
  approveSubtitle,
  rejectSubtitle,
  fetchSubtitleStats,
} from '@/lib/subtitles/api'
import type { SubtitleRow, SubtitleStats } from '@/lib/subtitles/types'
import { buildSubtitleColumns } from './columns'

// ── 常量 ──────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 20

const KPI_ROW_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '12px',
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

export function SubtitlesListClient() {
  const toast = useToast()
  const [rows, setRows] = useState<readonly SubtitleRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [sort, setSort] = useState<TableSortState>({ field: 'created_at', direction: 'desc' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | undefined>()
  const [retryKey, setRetryKey] = useState(0)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [stats, setStats] = useState<SubtitleStats | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchSubtitleStats()
      .then((s) => { if (!cancelled) setStats(s) })
      .catch(() => { /* stats 加载失败不阻断主列表 */ })
    return () => { cancelled = true }
  }, [retryKey])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(undefined)
    listSubtitles({
      page,
      limit: pageSize,
      sortField: sort.field,
      sortDir: sort.direction,
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
  }, [page, pageSize, sort, retryKey])

  const refresh = useCallback(() => {
    setRetryKey((k) => k + 1)
  }, [])

  const handleApprove = useCallback(async (id: string) => {
    setPendingId(id)
    try {
      await approveSubtitle(id)
      refresh()
    } catch (err: unknown) {
      toast.push({
        title: '审核失败',
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
      await rejectSubtitle(id, reason)
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

  const columns = useMemo(
    () => buildSubtitleColumns({
      onApprove: (id) => void handleApprove(id),
      onReject: (id, r) => void handleReject(id, r),
      pendingId,
    }),
    [handleApprove, handleReject, pendingId],
  )

  const query = useMemo(
    () => ({
      pagination: { page, pageSize },
      sort,
      filters: new Map(),
      columns: new Map(),
      selection: { selectedKeys: new Set<string>(), mode: 'page' as const },
    }),
    [page, pageSize, sort],
  )

  return (
    <div data-subtitles-list-client style={PAGE_STYLE}>
      <PageHeader
        title="字幕审核"
        subtitle={`${total} 条待审 · 通过 / 拒绝`}
        actions={
          <AdminButton
            variant="default"
            size="sm"
            onClick={refresh}
            data-testid="subtitle-refresh"
          >
            刷新
          </AdminButton>
        }
        data-testid="subtitles-page-header"
      />
      <div style={KPI_ROW_STYLE} data-testid="subtitle-kpi-row">
        <KpiCard
          label="待审核"
          value={stats ? stats.pendingCount.toLocaleString('en-US') : '—'}
          variant="is-warn"
          dataSource={stats ? 'live' : undefined}
          testId="subtitle-kpi-pending"
        />
        <KpiCard
          label="今日新增并通过"
          value={stats ? stats.approvedTodayCount.toLocaleString('en-US') : '—'}
          variant="is-ok"
          dataSource={stats ? 'live' : undefined}
          testId="subtitle-kpi-approved-today"
        />
        <KpiCard
          label="今日已拒绝"
          value={stats ? stats.rejectedTodayCount.toLocaleString('en-US') : '—'}
          variant="is-danger"
          dataSource={stats ? 'live' : undefined}
          testId="subtitle-kpi-rejected-today"
        />
        <KpiCard
          label="累计通过"
          value={stats ? stats.totalVerifiedCount.toLocaleString('en-US') : '—'}
          variant="default"
          dataSource={stats ? 'live' : undefined}
          testId="subtitle-kpi-total-verified"
        />
      </div>
      {loading && rows.length === 0
        ? <LoadingState variant="skeleton" />
        : error
          ? <ErrorState error={error} title="加载失败" onRetry={refresh} />
          : (
              <DataTable<SubtitleRow>
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
                emptyState={<EmptyState title="暂无待审字幕" description="所有字幕已完成审核" />}
                data-testid="subtitle-table"
                enableHeaderMenu
                toolbar={{ hideFilterChips: true }}
                pagination={{ pageSizeOptions: [10, 20, 50] }}
              />
            )
      }
    </div>
  )
}

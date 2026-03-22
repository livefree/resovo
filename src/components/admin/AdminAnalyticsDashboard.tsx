/**
 * AdminAnalyticsDashboard.tsx — 数据看板组件
 * ADMIN-05: 显示运营统计数据
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import { apiClient } from '@/lib/api-client'
import { AdminToolbar } from '@/components/admin/shared/toolbar/AdminToolbar'
import { AdminTableFrame } from '@/components/admin/shared/table/AdminTableFrame'
import { AdminTableState } from '@/components/admin/shared/feedback/AdminTableState'
import { useAdminTableColumns, type AdminColumnMeta } from '@/components/admin/shared/table/useAdminTableColumns'
import { useAdminTableSort } from '@/components/admin/shared/table/useAdminTableSort'
import type { AnalyticsData } from '@/api/routes/admin/analytics'
import type { AdminTableState as SharedAdminTableState } from '@/components/admin/shared/table/useAdminTableState'

type CrawlerTaskRow = AnalyticsData['crawlerTasks']['recent'][number]
type CrawlerTaskColumnId = 'type' | 'status' | 'created_at' | 'finished_at'

const CRAWLER_TASK_COLUMNS: AdminColumnMeta[] = [
  { id: 'type', visible: true, width: 220, minWidth: 160, maxWidth: 360, resizable: true },
  { id: 'status', visible: true, width: 130, minWidth: 110, maxWidth: 220, resizable: true },
  { id: 'created_at', visible: true, width: 190, minWidth: 150, maxWidth: 280, resizable: true },
  { id: 'finished_at', visible: true, width: 190, minWidth: 150, maxWidth: 280, resizable: true },
]

const CRAWLER_TASK_DEFAULT_STATE: Omit<SharedAdminTableState, 'columns'> = {
  sort: { field: 'created_at', dir: 'desc' },
}

const CRAWLER_TASK_LABELS: Record<CrawlerTaskColumnId, string> = {
  type: '资源站',
  status: '状态',
  created_at: '开始时间',
  finished_at: '结束时间',
}

const CRAWLER_TASK_SORTABLE: Record<CrawlerTaskColumnId, boolean> = {
  type: true,
  status: true,
  created_at: true,
  finished_at: true,
}

function toComparableValue(row: CrawlerTaskRow, field: string): string | number {
  switch (field) {
    case 'type':
      return row.type.toLowerCase()
    case 'status':
      return row.status
    case 'created_at':
      return new Date(row.created_at).getTime()
    case 'finished_at':
      return row.finished_at ? new Date(row.finished_at).getTime() : 0
    default:
      return ''
  }
}

// ── StatCard ──────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  sub,
  accent,
}: {
  title: string
  value: string | number
  sub?: string
  accent?: boolean
}) {
  return (
    <div
      className="rounded-lg border border-[var(--border)] bg-[var(--bg2)] p-5"
      data-testid="analytics-stat-card"
    >
      <p className="mb-1 text-xs text-[var(--muted)] uppercase tracking-wider">{title}</p>
      <p className={`text-3xl font-bold ${accent ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-[var(--muted)]">{sub}</p>}
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────

export function AdminAnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showColumnsPanel, setShowColumnsPanel] = useState(false)

  const columnsState = useAdminTableColumns({
    route: '/admin/analytics',
    tableId: 'analytics-crawler-task-table',
    columns: CRAWLER_TASK_COLUMNS,
    defaultState: CRAWLER_TASK_DEFAULT_STATE,
  })

  const sortState = useAdminTableSort({
    tableState: columnsState,
    columnsById: columnsState.columnsById,
    defaultSort: CRAWLER_TASK_DEFAULT_STATE.sort,
    sortable: CRAWLER_TASK_SORTABLE,
  })

  const visibleColumnIds = useMemo(
    () =>
      columnsState.columns
        .filter((column) => column.visible)
        .map((column) => column.id as CrawlerTaskColumnId),
    [columnsState.columns],
  )

  useEffect(() => {
    apiClient
      .get<{ data: AnalyticsData }>('/admin/analytics')
      .then((res) => setData(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  const sortedCrawlerTasks = useMemo(() => {
    const source = data?.crawlerTasks.recent ?? []
    if (!sortState.sort) return source
    const next = [...source]
    next.sort((a, b) => {
      const va = toComparableValue(a, sortState.sort?.field ?? '')
      const vb = toComparableValue(b, sortState.sort?.field ?? '')
      if (va === vb) return 0
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortState.sort?.dir === 'asc' ? va - vb : vb - va
      }
      const sa = String(va)
      const sb = String(vb)
      return sortState.sort?.dir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa)
    })
    return next
  }, [data?.crawlerTasks.recent, sortState.sort])

  if (loading) {
    return <p className="text-[var(--muted)]">加载中…</p>
  }

  if (error || !data) {
    return <p className="text-red-400">{error ?? '加载失败'}</p>
  }

  const failRatePct = (data.sources.failRate * 100).toFixed(1)

  function renderSortIndicator(columnId: CrawlerTaskColumnId): string {
    if (!sortState.isSortedBy(columnId)) return ''
    return sortState.sort?.dir === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div data-testid="analytics-dashboard" className="space-y-8">
      {/* ── 视频统计 ────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          视频
        </h2>
        <div className="grid grid-cols-3 gap-4" data-testid="analytics-videos">
          <StatCard title="视频总数" value={data.videos.total} />
          <StatCard title="已上架" value={data.videos.published} accent />
          <StatCard title="待审/下架" value={data.videos.pending} />
        </div>
      </section>

      {/* ── 播放源统计 ───────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          播放源
        </h2>
        <div className="grid grid-cols-3 gap-4" data-testid="analytics-sources">
          <StatCard title="播放源总数" value={data.sources.total} />
          <StatCard title="有效" value={data.sources.active} accent />
          <StatCard
            title="失效率"
            value={`${failRatePct}%`}
            sub={`失效 ${data.sources.inactive} 条`}
          />
        </div>
      </section>

      {/* ── 用户统计 ────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          用户
        </h2>
        <div className="grid grid-cols-3 gap-4" data-testid="analytics-users">
          <StatCard title="注册用户总数" value={data.users.total} />
          <StatCard title="今日新增" value={data.users.todayNew} accent />
          <StatCard title="已封禁" value={data.users.banned} />
        </div>
      </section>

      {/* ── 待处理队列 ──────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          待处理事项
        </h2>
        <div className="grid grid-cols-2 gap-4" data-testid="analytics-queues">
          <StatCard
            title="待审投稿"
            value={data.queues.submissions}
            sub={data.queues.submissions > 0 ? '需要处理' : '全部处理完毕'}
            accent={data.queues.submissions > 0}
          />
          <StatCard
            title="待审字幕"
            value={data.queues.subtitles}
            sub={data.queues.subtitles > 0 ? '需要处理' : '全部处理完毕'}
            accent={data.queues.subtitles > 0}
          />
        </div>
      </section>

      {/* ── 爬虫状态快照 ────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          爬虫最近任务
        </h2>
        <AdminToolbar
          className="mb-2 gap-3"
          actions={(
            <button
              type="button"
              className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--text)]"
              onClick={() => setShowColumnsPanel((prev) => !prev)}
              data-testid="analytics-task-columns-toggle"
            >
              列设置
            </button>
          )}
        />
        {showColumnsPanel && (
          <div className="mb-2 rounded border border-[var(--border)] bg-[var(--bg2)] p-2" data-testid="analytics-task-columns-panel">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs text-[var(--muted)]">显示列</span>
              <button
                type="button"
                className="text-xs text-[var(--muted)] hover:text-[var(--text)]"
                onClick={() => columnsState.resetColumnsMeta()}
                data-testid="analytics-task-columns-reset"
              >
                重置
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {columnsState.columns.map((column) => (
                <label key={column.id} className="flex items-center gap-2 text-xs text-[var(--text)]">
                  <input
                    type="checkbox"
                    checked={column.visible}
                    onChange={() => columnsState.toggleColumnVisibility(column.id)}
                    className="accent-[var(--accent)]"
                    data-testid={`analytics-task-column-toggle-${column.id}`}
                  />
                  {CRAWLER_TASK_LABELS[column.id as CrawlerTaskColumnId]}
                </label>
              ))}
            </div>
          </div>
        )}
        <div data-testid="analytics-crawler-tasks">
          <AdminTableFrame minWidth={760}>
          <thead className="bg-[var(--bg2)] text-[var(--muted)]">
            <tr>
              {visibleColumnIds.map((columnId) => {
                const meta = columnsState.columnsById[columnId]
                return (
                  <th key={columnId} className="relative px-4 py-3 text-left" style={{ width: `${meta.width}px` }}>
                    <button
                      type="button"
                      className="text-left text-sm hover:text-[var(--text)]"
                      onClick={() => sortState.toggleSort(columnId)}
                      data-testid={`analytics-task-sort-${columnId}`}
                    >
                      {CRAWLER_TASK_LABELS[columnId]}
                      {renderSortIndicator(columnId)}
                    </button>
                    {meta.resizable && (
                      <button
                        type="button"
                        aria-label={`${CRAWLER_TASK_LABELS[columnId]}列宽拖拽`}
                        data-testid={`analytics-task-resize-${columnId}`}
                        onMouseDown={(event) => columnsState.startResize(columnId, event.clientX)}
                        className="absolute right-0 top-0 h-full w-2 cursor-col-resize before:absolute before:right-0 before:top-0 before:h-full before:w-px before:bg-[var(--border)] hover:bg-[var(--bg3)]/40"
                      />
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--subtle)]">
            <AdminTableState
              isLoading={false}
              isEmpty={sortedCrawlerTasks.length === 0}
              colSpan={visibleColumnIds.length}
              emptyText="暂无爬虫任务记录"
            />
            {sortedCrawlerTasks.map((task) => (
              <tr
                key={task.id}
                className="h-[56px] bg-[var(--bg)] hover:bg-[var(--bg2)]"
                data-testid={`analytics-task-row-${task.id}`}
              >
                {visibleColumnIds.includes('type') && (
                  <td className="px-4 py-3 align-middle text-[var(--text)]">
                    <span className="inline-block max-w-[220px] truncate" title={task.type}>
                      {task.type}
                    </span>
                  </td>
                )}
                {visibleColumnIds.includes('status') && (
                  <td className="px-4 py-3 align-middle">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        task.status === 'done'
                          ? 'bg-green-900/30 text-green-400'
                          : task.status === 'failed'
                            ? 'bg-red-900/30 text-red-400'
                            : task.status === 'running'
                              ? 'bg-blue-900/30 text-blue-400'
                              : 'bg-yellow-900/30 text-yellow-400'
                      }`}
                    >
                      {task.status}
                    </span>
                  </td>
                )}
                {visibleColumnIds.includes('created_at') && (
                  <td className="px-4 py-3 align-middle text-xs text-[var(--muted)]">
                    {new Date(task.created_at).toLocaleString()}
                  </td>
                )}
                {visibleColumnIds.includes('finished_at') && (
                  <td className="px-4 py-3 align-middle text-xs text-[var(--muted)]">
                    {task.finished_at ? new Date(task.finished_at).toLocaleString() : '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          </AdminTableFrame>
        </div>
      </section>
    </div>
  )
}

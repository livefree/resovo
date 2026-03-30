/**
 * AdminAnalyticsDashboard.tsx — 数据看板组件
 * ADMIN-05: 显示运营统计数据
 * CHG-265: 爬虫任务 mini 表格从 AdminTableFrame → ModernDataTable；⚙ 列设置覆盖层
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import { apiClient } from '@/lib/api-client'
import { ModernDataTable } from '@/components/admin/shared/modern-table/ModernDataTable'
import { useTableSettings } from '@/components/admin/shared/modern-table/settings'
import { TableBadgeCell, TableDateCell, TableTextCell } from '@/components/admin/shared/modern-table/cells'
import type { TableColumn, TableSortState } from '@/components/admin/shared/modern-table/types'
import type { AnalyticsData } from '@/api/routes/admin/analytics'
import { ContentQualityTable } from '@/components/admin/dashboard/ContentQualityTable'

type CrawlerTaskRow = AnalyticsData['crawlerTasks']['recent'][number]
type CrawlerTaskColumnId = 'type' | 'status' | 'created_at' | 'finished_at'

const CRAWLER_TASK_LABELS: Record<CrawlerTaskColumnId, string> = {
  type: '资源站',
  status: '状态',
  created_at: '开始时间',
  finished_at: '结束时间',
}

const ANALYTICS_SETTINGS_COLUMNS = (Object.keys(CRAWLER_TASK_LABELS) as CrawlerTaskColumnId[]).map((id) => ({
  id,
  label: CRAWLER_TASK_LABELS[id],
  defaultVisible: true,
  defaultSortable: true,
}))

const STATUS_TONE: Record<string, 'success' | 'danger' | 'info' | 'warning'> = {
  done: 'success',
  failed: 'danger',
  running: 'info',
}

function toComparableValue(row: CrawlerTaskRow, field: string): string | number {
  switch (field) {
    case 'type': return row.type.toLowerCase()
    case 'status': return row.status
    case 'created_at': return new Date(row.created_at).getTime()
    case 'finished_at': return row.finished_at ? new Date(row.finished_at).getTime() : 0
    default: return ''
  }
}

function buildColumns(): TableColumn<CrawlerTaskRow>[] {
  return [
    {
      id: 'type', header: CRAWLER_TASK_LABELS.type,
      width: 220, minWidth: 160,
      accessor: (r) => r.type, enableResizing: true, enableSorting: true,
      cell: ({ row }) => <TableTextCell value={row.type} />,
    },
    {
      id: 'status', header: CRAWLER_TASK_LABELS.status,
      width: 130, minWidth: 110,
      accessor: (r) => r.status, enableResizing: true, enableSorting: true,
      cell: ({ row }) => (
        <TableBadgeCell label={row.status} tone={STATUS_TONE[row.status] ?? 'warning'} />
      ),
    },
    {
      id: 'created_at', header: CRAWLER_TASK_LABELS.created_at,
      width: 190, minWidth: 150,
      accessor: (r) => r.created_at, enableResizing: true, enableSorting: true,
      cell: ({ row }) => <TableDateCell value={row.created_at} className="text-xs" />,
    },
    {
      id: 'finished_at', header: CRAWLER_TASK_LABELS.finished_at,
      width: 190, minWidth: 150,
      accessor: (r) => r.finished_at ?? '', enableResizing: true, enableSorting: true,
      cell: ({ row }) => <TableDateCell value={row.finished_at} fallback="—" className="text-xs" />,
    },
  ]
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
  const [sort, setSort] = useState<TableSortState>({ field: 'created_at', direction: 'desc' })

  const tableSettings = useTableSettings({
    tableId: 'analytics-crawler-task-table',
    columns: ANALYTICS_SETTINGS_COLUMNS,
  })

  useEffect(() => {
    apiClient
      .get<{ data: AnalyticsData }>('/admin/analytics')
      .then((res) => setData(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  const sortedCrawlerTasks = useMemo(() => {
    const source = data?.crawlerTasks.recent ?? []
    const next = [...source]
    next.sort((a, b) => {
      const va = toComparableValue(a, sort.field)
      const vb = toComparableValue(b, sort.field)
      if (va === vb) return 0
      if (typeof va === 'number' && typeof vb === 'number') {
        return sort.direction === 'asc' ? va - vb : vb - va
      }
      const sa = String(va)
      const sb = String(vb)
      return sort.direction === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa)
    })
    return next
  }, [data?.crawlerTasks.recent, sort])

  const allTableColumns = useMemo(() => buildColumns(), [])

  const tableColumns = useMemo(
    () => tableSettings.applyToColumns(allTableColumns),
    [tableSettings, allTableColumns],
  )

  if (loading) {
    return <p className="text-[var(--muted)]">加载中…</p>
  }

  if (error || !data) {
    return <p className="text-red-400">{error ?? '加载失败'}</p>
  }

  const failRatePct = (data.sources.failRate * 100).toFixed(1)

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
        <div data-testid="analytics-crawler-tasks">
          <ModernDataTable
            columns={tableColumns}
            rows={sortedCrawlerTasks}
            loading={false}
            emptyText="暂无爬虫任务记录"
            getRowId={(r) => r.id}
            scrollTestId="analytics-crawler-table-scroll"
            sort={sort}
            onSortChange={setSort}
            onColumnWidthChange={tableSettings.updateWidth}
            settingsSlot={{
              settingsColumns: tableSettings.orderedSettings,
              onSettingsChange: tableSettings.updateSetting,
              onSettingsReset: tableSettings.reset,
            }}
          />
        </div>
      </section>

      {/* 内容质量统计（ADMIN-06）*/}
      <section className="space-y-3" data-testid="content-quality-section">
        <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
          内容质量（按来源站点）
        </h2>
        <ContentQualityTable />
      </section>
    </div>
  )
}

/**
 * useCrawlerTaskTableColumns.tsx — 爬虫任务记录表格列定义（CHG-318）
 */

'use client'

import { useMemo } from 'react'
import type { TableColumn } from '@/components/admin/shared/modern-table/types'

// ── 类型 ─────────────────────────────────────────────────────────

export interface CrawlerTaskRow {
  id: string
  type: string
  status: 'pending' | 'running' | 'paused' | 'done' | 'failed' | 'cancelled' | 'timeout'
  triggerType: 'single' | 'batch' | 'all' | 'schedule' | null
  runId?: string | null
  run_id?: string | null
  sourceSite?: string
  source_url: string | null
  result?: { error?: string; [key: string]: unknown } | null
  scheduledAt?: string | null
  finishedAt?: string | null
  startedAt?: string | null
  error: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
}

export type CrawlerTaskColumnId =
  | 'runId'
  | 'type'
  | 'site'
  | 'triggerType'
  | 'status'
  | 'startedAt'
  | 'finishedAt'
  | 'error'
  | 'actions'

export const CRAWLER_TASK_COLUMN_LABELS: Record<CrawlerTaskColumnId, string> = {
  runId:       'Run ID',
  type:        '类型',
  site:        '站点',
  triggerType: '触发来源',
  status:      '状态',
  startedAt:   '开始时间',
  finishedAt:  '结束时间',
  error:       '错误信息',
  actions:     '操作',
}

// ── 小组件（仅供列渲染使用）─────────────────────────────────────

function StatusBadge({ status }: { status: CrawlerTaskRow['status'] }) {
  const colorMap: Record<CrawlerTaskRow['status'], string> = {
    pending:   'bg-yellow-900/30 text-yellow-400',
    running:   'bg-blue-900/30 text-blue-400',
    paused:    'bg-zinc-700/40 text-zinc-300',
    done:      'bg-green-900/30 text-green-400',
    failed:    'bg-red-900/30 text-red-400',
    cancelled: 'bg-zinc-700/40 text-zinc-300',
    timeout:   'bg-orange-900/30 text-orange-400',
  }
  const labelMap: Record<CrawlerTaskRow['status'], string> = {
    pending:   '等待中',
    running:   '运行中',
    paused:    '已暂停',
    done:      '已完成',
    failed:    '失败',
    cancelled: '已取消',
    timeout:   '超时',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${colorMap[status]}`}>
      {labelMap[status]}
    </span>
  )
}

function TriggerBadge({ triggerType }: { triggerType: CrawlerTaskRow['triggerType'] }) {
  const labelMap: Record<Exclude<CrawlerTaskRow['triggerType'], null>, string> = {
    single:   '单站',
    batch:    '批量',
    all:      '全站',
    schedule: '定时',
  }
  if (!triggerType) return <span className="text-xs text-[var(--muted)]">—</span>
  return (
    <span className="rounded-full bg-[var(--bg3)] px-2 py-0.5 text-xs text-[var(--muted)]">
      {labelMap[triggerType]}
    </span>
  )
}

// ── 辅助函数 ──────────────────────────────────────────────────────

export function getRunId(task: CrawlerTaskRow): string | null {
  return task.runId ?? task.run_id ?? null
}

export function getSiteKey(task: CrawlerTaskRow): string {
  return task.sourceSite ?? task.source_url ?? '—'
}

export function getErrorMessage(task: CrawlerTaskRow): string {
  const resultError = typeof task.result?.error === 'string' ? task.result.error : null
  return task.error ?? resultError ?? '—'
}

export function parseTime(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString() : '—'
}

// ── hook ─────────────────────────────────────────────────────────

interface UseCrawlerTaskTableColumnsOptions {
  onRunIdClick: (runId: string) => void
  onViewLogs: (taskId: string) => void
  onViewDetail?: (taskId: string) => void
}

export function useCrawlerTaskTableColumns({
  onRunIdClick,
  onViewLogs,
  onViewDetail,
}: UseCrawlerTaskTableColumnsOptions): TableColumn<CrawlerTaskRow>[] {
  return useMemo<TableColumn<CrawlerTaskRow>[]>(
    () => [
      {
        id: 'runId',
        header: CRAWLER_TASK_COLUMN_LABELS.runId,
        accessor: (row) => getRunId(row),
        width: 120, minWidth: 100, enableResizing: true, enableSorting: true,
        columnMenu: { canSort: true, canHide: true },
        cell: ({ row }) => {
          const runId = getRunId(row)
          if (!runId) return <span className="text-xs text-[var(--muted)]">—</span>
          return (
            <button
              type="button"
              className="rounded bg-[var(--bg3)] px-2 py-1 text-left text-xs text-[var(--muted)] hover:text-[var(--text)]"
              onClick={() => onRunIdClick(runId)}
              data-testid={`admin-crawler-runid-pill-${row.id}`}
            >
              {runId.slice(0, 8)}
            </button>
          )
        },
      },
      {
        id: 'type',
        header: CRAWLER_TASK_COLUMN_LABELS.type,
        accessor: (row) => row.type,
        width: 120, minWidth: 96, enableResizing: true, enableSorting: true,
        columnMenu: { canSort: true, canHide: true },
        cell: ({ row }) => <span className="text-[var(--text)]">{row.type}</span>,
      },
      {
        id: 'site',
        header: CRAWLER_TASK_COLUMN_LABELS.site,
        accessor: getSiteKey,
        width: 220, minWidth: 150, enableResizing: true, enableSorting: true,
        columnMenu: { canSort: true, canHide: true },
        cell: ({ row }) => (
          <span className="block max-w-xs truncate text-xs text-[var(--muted)]">
            {getSiteKey(row)}
          </span>
        ),
      },
      {
        id: 'triggerType',
        header: CRAWLER_TASK_COLUMN_LABELS.triggerType,
        accessor: (row) => row.triggerType,
        width: 120, minWidth: 96, enableResizing: true, enableSorting: true,
        columnMenu: { canSort: true, canHide: true },
        cell: ({ row }) => <TriggerBadge triggerType={row.triggerType} />,
      },
      {
        id: 'status',
        header: CRAWLER_TASK_COLUMN_LABELS.status,
        accessor: (row) => row.status,
        width: 110, minWidth: 90, enableResizing: true, enableSorting: true,
        columnMenu: { canSort: true, canHide: true },
        cell: ({ row }) => <StatusBadge status={row.status} />,
      },
      {
        id: 'startedAt',
        header: CRAWLER_TASK_COLUMN_LABELS.startedAt,
        accessor: (row) => row.startedAt ?? row.started_at ?? row.scheduledAt,
        width: 180, minWidth: 140, enableResizing: true, enableSorting: true,
        columnMenu: { canSort: true, canHide: true },
        cell: ({ row }) => (
          <span className="text-xs text-[var(--muted)]">
            {parseTime(row.startedAt ?? row.started_at ?? row.scheduledAt)}
          </span>
        ),
      },
      {
        id: 'finishedAt',
        header: CRAWLER_TASK_COLUMN_LABELS.finishedAt,
        accessor: (row) => row.finishedAt ?? row.finished_at,
        width: 180, minWidth: 140, enableResizing: true, enableSorting: true,
        columnMenu: { canSort: true, canHide: true },
        cell: ({ row }) => (
          <span className="text-xs text-[var(--muted)]">
            {parseTime(row.finishedAt ?? row.finished_at)}
          </span>
        ),
      },
      {
        id: 'error',
        header: CRAWLER_TASK_COLUMN_LABELS.error,
        accessor: getErrorMessage,
        width: 260, minWidth: 180, enableResizing: true, enableSorting: true,
        columnMenu: { canSort: true, canHide: true },
        cell: ({ row }) => (
          <span className="block max-w-xs truncate text-xs text-red-400">
            {getErrorMessage(row)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: CRAWLER_TASK_COLUMN_LABELS.actions,
        accessor: (row) => row.id,
        width: 180, minWidth: 140, enableResizing: false, enableSorting: false,
        cell: ({ row }) => (
          <div className="flex gap-1">
            {onViewDetail && (
              <button
                type="button"
                onClick={() => onViewDetail(row.id)}
                className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--bg2)]"
                data-testid={`admin-crawler-task-detail-${row.id}`}
              >
                详情
              </button>
            )}
            <button
              type="button"
              onClick={() => onViewLogs(row.id)}
              className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--bg2)]"
              data-testid={`admin-crawler-task-logs-${row.id}`}
            >
              查看日志
            </button>
          </div>
        ),
      },
    ],
    [onRunIdClick, onViewLogs, onViewDetail],
  )
}

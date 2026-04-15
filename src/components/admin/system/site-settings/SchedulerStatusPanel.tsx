/**
 * SchedulerStatusPanel.tsx — 维护调度器状态展示
 * CHG-408: GET /admin/system/scheduler-status 可视化
 */

'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'

interface SchedulerInfo {
  name: string
  enabled: boolean
  intervalMs: number
}

interface SchedulerStatusResponse {
  enabled: boolean
  schedulers: SchedulerInfo[]
}

function formatInterval(ms: number): string {
  if (ms >= 3600_000) return `${ms / 3600_000}h`
  if (ms >= 60_000)   return `${ms / 60_000}min`
  return `${ms / 1000}s`
}

const DISPLAY_NAMES: Record<string, string> = {
  'auto-publish-staging':     '自动发布暂存',
  'verify-published-sources': '已上架源验证',
  'verify-staging-sources':   '暂存源验证',
  'reconcile-search-index':   '搜索索引对账',
}

export function SchedulerStatusPanel() {
  const [status, setStatus] = useState<SchedulerStatusResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiClient
      .get<{ data: SchedulerStatusResponse }>('/admin/system/scheduler-status')
      .then((res) => setStatus(res.data))
      .catch(() => setError('调度器状态加载失败'))
  }, [])

  if (error) {
    return <p className="text-xs text-red-400" data-testid="scheduler-status-error">{error}</p>
  }

  if (!status) {
    return <p className="text-xs text-[var(--muted)] animate-pulse" data-testid="scheduler-status-loading">加载中…</p>
  }

  return (
    <div className="space-y-2" data-testid="scheduler-status-panel">
      {!status.enabled && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300" data-testid="scheduler-disabled-warning">
          调度器已禁用（MAINTENANCE_SCHEDULER_ENABLED=false），所有定时任务不会自动运行。
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {status.schedulers.map((s) => (
          <div
            key={s.name}
            className="flex items-center justify-between rounded border border-[var(--border)] bg-[var(--bg3)] px-3 py-2"
            data-testid={`scheduler-item-${s.name}`}
          >
            <div>
              <p className="text-xs font-medium text-[var(--text)]">{DISPLAY_NAMES[s.name] ?? s.name}</p>
              <p className="text-[10px] text-[var(--muted)]">每 {formatInterval(s.intervalMs)} 触发一次</p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                s.enabled
                  ? 'bg-green-500/15 text-green-400'
                  : 'bg-[var(--bg2)] text-[var(--muted)]'
              }`}
            >
              {s.enabled ? '运行中' : '已停止'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

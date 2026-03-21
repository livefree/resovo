interface CrawlerRunSummary {
  id: string
  triggerType: 'single' | 'batch' | 'all' | 'schedule'
  mode: 'incremental' | 'full'
  status: 'queued' | 'running' | 'paused' | 'success' | 'partial_failed' | 'failed' | 'cancelled'
  controlStatus: 'active' | 'pausing' | 'paused' | 'cancelling' | 'cancelled'
  summary: Record<string, unknown> | null
  createdAt: string
}

interface CrawlerRunPanelProps {
  title: string
  emptyText: string
  runs: CrawlerRunSummary[]
  onCancel: (runId: string) => void
  onPause: (runId: string) => void
  onResume: (runId: string) => void
  enableControls?: boolean
}

function labelForTrigger(triggerType: CrawlerRunSummary['triggerType']): string {
  if (triggerType === 'single') return '单站'
  if (triggerType === 'batch') return '批量'
  if (triggerType === 'all') return '全站'
  return '定时'
}

function labelForStatus(status: CrawlerRunSummary['status']): string {
  if (status === 'queued') return '排队中'
  if (status === 'running') return '运行中'
  if (status === 'paused') return '已暂停'
  if (status === 'success') return '成功'
  if (status === 'partial_failed') return '部分失败'
  if (status === 'cancelled') return '已取消'
  return '失败'
}

function labelForControlStatus(controlStatus: CrawlerRunSummary['controlStatus']): string {
  if (controlStatus === 'active') return '活跃'
  if (controlStatus === 'pausing') return '暂停中'
  if (controlStatus === 'paused') return '已暂停'
  if (controlStatus === 'cancelling') return '中止中'
  return '已取消'
}

function formatRunDuration(createdAt: string): string {
  const start = new Date(createdAt).getTime()
  if (!Number.isFinite(start)) return '—'
  const elapsedMs = Math.max(Date.now() - start, 0)
  const totalSec = Math.floor(elapsedMs / 1000)
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

function buildTaskLink(runId: string, status?: 'failed' | 'cancelled'): string {
  const params = new URLSearchParams()
  params.set('tab', 'tasks')
  params.set('runId', runId)
  if (status) params.set('taskStatus', status)
  return `?${params.toString()}`
}

export function CrawlerRunPanel({
  title,
  emptyText,
  runs,
  onCancel,
  onPause,
  onResume,
  enableControls = true,
}: CrawlerRunPanelProps) {
  return (
    <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--bg2)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text)]">{title}</h3>
        <p className="text-xs text-[var(--muted)]">监控数据局部轮询更新，不触发整页刷新</p>
      </div>
      {!runs.length ? (
        <p className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--muted)]">{emptyText}</p>
      ) : null}
      <div className="space-y-2">
        {runs.map((run, index) => {
          const runId = typeof run.id === 'string' ? run.id : 'unknown'
          const summary = run.summary ?? {}
          const total = typeof summary.total === 'number' ? summary.total : 0
          const done = typeof summary.done === 'number' ? summary.done : 0
          const failed = typeof summary.failed === 'number' ? summary.failed : 0
          const cancelled = typeof summary.cancelled === 'number' ? summary.cancelled : 0
          const running = typeof summary.running === 'number' ? summary.running : 0
          return (
            <div key={`${runId}-${index}`} className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 text-[var(--text)]">
                  <span className="mr-2 font-semibold">{labelForTrigger(run.triggerType)}</span>
                  <span className="mr-2">{run.mode === 'full' ? '全量' : '增量'}</span>
                  <span className="text-[var(--muted)]">#{runId.slice(0, 8)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={buildTaskLink(runId)}
                    className="rounded border border-[var(--border)] px-2 py-0.5 text-[var(--muted)] hover:text-[var(--text)]"
                  >
                    查看任务
                  </a>
                  {run.status === 'failed' || run.status === 'partial_failed' || run.status === 'cancelled' ? (
                    <a
                      href={buildTaskLink(runId, run.status === 'cancelled' ? 'cancelled' : 'failed')}
                      className="rounded border border-[var(--border)] px-2 py-0.5 text-[var(--muted)] hover:text-[var(--text)]"
                    >
                      查看日志
                    </a>
                  ) : null}
                  {enableControls && run.controlStatus === 'active' && (run.status === 'queued' || run.status === 'running') ? (
                    <button
                      type="button"
                      className="rounded border border-amber-400/60 px-2 py-0.5 text-amber-300 hover:bg-amber-500/10"
                      onClick={() => onPause(runId)}
                    >
                      暂停
                    </button>
                  ) : null}
                  {enableControls && (run.controlStatus === 'paused' || run.controlStatus === 'pausing' || run.status === 'paused') ? (
                    <button
                      type="button"
                      className="rounded border border-green-400/60 px-2 py-0.5 text-green-300 hover:bg-green-500/10"
                      onClick={() => onResume(runId)}
                    >
                      恢复
                    </button>
                  ) : null}
                  <span className="rounded bg-[var(--bg3)] px-2 py-0.5 text-[var(--text)]">{labelForStatus(run.status)}</span>
                  {enableControls && (run.status === 'queued' || run.status === 'running') && run.controlStatus !== 'cancelling' ? (
                    <button
                      type="button"
                      className="rounded border border-red-400/60 px-2 py-0.5 text-red-300 hover:bg-red-500/10"
                      onClick={() => onCancel(runId)}
                    >
                      中止
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="mt-1 text-[var(--muted)]">
                进度：总 {total} / 运行中 {running} / 完成 {done} / 失败 {failed} / 取消 {cancelled}
              </div>
              <div className="mt-1 text-[var(--muted)]">
                控制状态：{labelForControlStatus(run.controlStatus)}
              </div>
              <div className="mt-1 text-[var(--muted)]">
                已运行时长：{formatRunDuration(run.createdAt)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

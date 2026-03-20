interface CrawlerRunSummary {
  id: string
  triggerType: 'single' | 'batch' | 'all' | 'schedule'
  mode: 'incremental' | 'full'
  status: 'queued' | 'running' | 'success' | 'partial_failed' | 'failed' | 'cancelled'
  controlStatus: 'active' | 'pausing' | 'paused' | 'cancelling' | 'cancelled'
  summary: Record<string, unknown> | null
  createdAt: string
}

interface CrawlerRunPanelProps {
  runs: CrawlerRunSummary[]
  onCancel: (runId: string) => void
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
  if (status === 'success') return '成功'
  if (status === 'partial_failed') return '部分失败'
  if (status === 'cancelled') return '已取消'
  return '失败'
}

export function CrawlerRunPanel({ runs, onCancel }: CrawlerRunPanelProps) {
  if (!runs.length) return null

  return (
    <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--bg2)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text)]">采集批次状态（最近）</h3>
        <p className="text-xs text-[var(--muted)]">支持手动中止，避免长时间无响应占用</p>
      </div>
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
                  <span className="rounded bg-[var(--bg3)] px-2 py-0.5 text-[var(--text)]">{labelForStatus(run.status)}</span>
                  {(run.status === 'queued' || run.status === 'running') && run.controlStatus !== 'cancelling' ? (
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
            </div>
          )
        })}
      </div>
    </div>
  )
}

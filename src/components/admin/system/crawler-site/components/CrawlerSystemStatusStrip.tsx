interface CrawlerSystemStatus {
  schedulerEnabled: boolean
  freezeEnabled: boolean
  orphanTaskCount: number
}

interface CrawlerSystemStatusStripProps {
  data: CrawlerSystemStatus | null
  stopAllPending?: boolean
  freezeSwitchPending?: boolean
  onStopAll?: () => void
  onSetFreezeEnabled?: (enabled: boolean) => void
}

function pillClass(ok: boolean): string {
  return ok
    ? 'border-green-400/30 bg-green-500/10 text-green-300'
    : 'border-red-400/30 bg-red-500/10 text-red-300'
}

export function CrawlerSystemStatusStrip({
  data,
  stopAllPending = false,
  freezeSwitchPending = false,
  onStopAll,
  onSetFreezeEnabled,
}: CrawlerSystemStatusStripProps) {
  const schedulerEnabled = data?.schedulerEnabled === true
  const freezeEnabled = data?.freezeEnabled === true
  const orphanTaskCount = data?.orphanTaskCount ?? 0

  return (
    <section
      className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--bg2)] px-3 py-2"
      data-testid="crawler-system-status-strip"
    >
      <div className="mb-2 text-xs text-[var(--muted)]">系统状态</div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className={`rounded border px-2 py-1 ${pillClass(schedulerEnabled)}`}>
          scheduler：{schedulerEnabled ? '开启' : '关闭'}
        </span>
        <span className={`rounded border px-2 py-1 ${pillClass(!freezeEnabled)}`}>
          freeze：{freezeEnabled ? '已开启（冻结）' : '关闭'}
        </span>
        <span
          className={`rounded border px-2 py-1 ${
            orphanTaskCount > 0
              ? 'border-amber-400/30 bg-amber-500/10 text-amber-200'
              : 'border-green-400/30 bg-green-500/10 text-green-300'
          }`}
        >
          orphan task：{orphanTaskCount}
        </span>
        <button
          type="button"
          disabled={freezeSwitchPending}
          onClick={() => onSetFreezeEnabled?.(!freezeEnabled)}
          className="rounded border border-[var(--border)] px-2 py-1 text-[var(--text)] hover:bg-[var(--bg3)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {freezeSwitchPending ? '处理中…' : freezeEnabled ? '关闭冻结' : '开启冻结'}
        </button>
        <button
          type="button"
          disabled={stopAllPending}
          onClick={() => onStopAll?.()}
          className="rounded border border-red-400/60 px-2 py-1 text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {stopAllPending ? '执行中…' : 'stop-all'}
        </button>
      </div>
    </section>
  )
}

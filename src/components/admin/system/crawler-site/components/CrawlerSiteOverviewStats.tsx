interface CrawlerOverview {
  siteTotal: number
  connected: number
  running: number
  paused: number
  failed: number
  todayVideos: number
  todayDurationMs: number
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('zh-CN').format(n)
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '0m'
  const totalSec = Math.floor(ms / 1000)
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

interface CrawlerSiteOverviewStatsProps {
  data: CrawlerOverview | null
}

export function CrawlerSiteOverviewStats({ data }: CrawlerSiteOverviewStatsProps) {
  const items = [
    { label: '站点总数', value: data ? formatNumber(data.siteTotal) : '—' },
    { label: '连接成功', value: data ? formatNumber(data.connected) : '—' },
    { label: '运行中', value: data ? formatNumber(data.running) : '—' },
    { label: '已暂停', value: data ? formatNumber(data.paused) : '—' },
    { label: '失败', value: data ? formatNumber(data.failed) : '—' },
    { label: '今日采集视频数', value: data ? formatNumber(data.todayVideos) : '—' },
    { label: '采集时长', value: data ? formatDuration(data.todayDurationMs) : '—' },
  ]

  return (
    <section
      className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg2)] p-3 md:grid-cols-3 xl:grid-cols-6"
      data-testid="crawler-overview-stats"
    >
      {items.map((item) => (
        <div key={item.label} className="rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
          <div className="text-[11px] text-[var(--muted)]">{item.label}</div>
          <div className="mt-1 text-lg font-semibold text-[var(--text)]">{item.value}</div>
        </div>
      ))}
    </section>
  )
}

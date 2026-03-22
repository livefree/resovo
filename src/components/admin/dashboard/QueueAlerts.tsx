/**
 * QueueAlerts.tsx — 待处理队列橙色警示横幅
 * CHG-25: submissions > 0 或 subtitles > 0 时显示提醒
 */

import Link from 'next/link'
import type { AnalyticsData } from '@/api/routes/admin/analytics'

interface QueueAlertsProps {
  queues: AnalyticsData['queues']
}

export function QueueAlerts({ queues }: QueueAlertsProps) {
  const hasSubmissions = queues.submissions > 0
  const hasSubtitles = queues.subtitles > 0

  if (!hasSubmissions && !hasSubtitles) {
    return null
  }

  return (
    <div
      className="mb-6 rounded-lg border border-orange-500/40 bg-orange-500/10 px-4 py-3"
      data-testid="queue-alerts"
      role="alert"
    >
      <p className="mb-2 text-sm font-semibold text-orange-400">待处理事项提醒</p>
      <ul className="space-y-1 text-sm text-orange-300">
        {hasSubmissions && (
          <li data-testid="queue-alert-submissions">
            <span>待审投稿 </span>
            <span className="font-bold">{queues.submissions}</span>
            <span> 条 — </span>
            <Link
              href="/admin/submissions"
              className="underline hover:text-orange-200"
              data-testid="queue-alert-submissions-link"
            >
              前往审核
            </Link>
          </li>
        )}
        {hasSubtitles && (
          <li data-testid="queue-alert-subtitles">
            <span>待审字幕 </span>
            <span className="font-bold">{queues.subtitles}</span>
            <span> 条 — </span>
            <Link
              href="/admin/subtitles"
              className="underline hover:text-orange-200"
              data-testid="queue-alert-subtitles-link"
            >
              前往审核
            </Link>
          </li>
        )}
      </ul>
    </div>
  )
}

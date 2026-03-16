/**
 * AnalyticsService.ts — 数据统计业务逻辑
 * CHG-19: 封装 admin/analytics.ts 的统计逻辑
 */

import type { Pool } from 'pg'
import { listTasks } from '@/api/db/queries/crawlerTasks'
import {
  getVideoStats,
  getSourceStats,
  getUserStats,
  getPendingSubmissionCount,
  getPendingSubtitleCount,
} from '@/api/db/queries/analytics'
import type { AnalyticsData } from '@/api/routes/admin/analytics'

export class AnalyticsService {
  constructor(private db: Pool) {}

  async getDashboard(): Promise<AnalyticsData> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayIso = today.toISOString()

    const [
      videoStats,
      sourceStats,
      userStats,
      submissionCount,
      subtitleCount,
      recentTasks,
    ] = await Promise.all([
      getVideoStats(this.db),
      getSourceStats(this.db),
      getUserStats(this.db, todayIso),
      getPendingSubmissionCount(this.db),
      getPendingSubtitleCount(this.db),
      listTasks(this.db, { limit: 10, offset: 0 }),
    ])

    return {
      videos: videoStats,
      sources: {
        ...sourceStats,
        failRate: sourceStats.total > 0 ? sourceStats.inactive / sourceStats.total : 0,
      },
      users: userStats,
      queues: {
        submissions: submissionCount,
        subtitles: subtitleCount,
      },
      crawlerTasks: {
        recent: recentTasks.rows.map((t) => ({
          id: t.id,
          type: t.sourceSite,
          status: t.status,
          created_at: t.scheduledAt,
          finished_at: t.finishedAt ?? null,
        })),
      },
    }
  }
}

/**
 * BackgroundEventService.ts — admin Shell 后台事件铃铛聚合服务（ADR-152）
 * CW1-E-EP step 3
 *
 * 源聚合（Promise.all 并发；NTLG-P2-c-C-1 起 finished crawler_run 派生 D **移除**——crawler 完成并入
 *   notifications 主 list〔NotificationService.GENERAL_LANE_SOURCE_KINDS += crawler / D-196-5①黄线1〕，
 *   防 general+background 双源重复）：
 *   A. autoCrawlNext — computeNextTrigger 内存计算（已实装 CW1-A）
 *   B. scheduler timer nextRunAt — getSchedulerStatus intervalMs 推算（CW1-E-EP step 2）
 *   C. active crawler_runs — listRuns status=['queued','running','paused'] 谓词下推（保留：active 映射任务面板 TaskItem）
 *   E. audit_log 高危白名单 — crawler.freeze（Y-152-3 与 NotificationBell 真互斥；非 crawler run 派生，保留）
 *
 * 分层约束（ADR-152 §8）：
 *   ✅ Service 不含 SQL（调 queries/helpers）
 *   ✅ 不越层调用 Route
 *   ✅ 软降级：bull 不可用 → degraded=true（未使用 bull / N1-152-4 follow-up）
 */

import type { Pool } from 'pg'
import type {
  AdminBackgroundEvent,
  AdminBackgroundEventUpcoming,
  AdminBackgroundEventActive,
  AdminBackgroundEventFinished,
} from '@resovo/types'
import { listRuns } from '@/api/db/queries/crawlerRuns'
import * as systemSettingsQueries from '@/api/db/queries/systemSettings'
import { computeNextTrigger } from '@/api/lib/crawler-scheduling'
import { getSchedulerStatus } from '@/api/workers/maintenanceScheduler'

/** HIGH_RISK_AUDIT_WHITELIST — Y-152-3：与 8 类通知白名单（notification-audit-emit NOTIFICATION_ACTION_TYPES）真互斥（仅 crawler.freeze） */
const HIGH_RISK_AUDIT_WHITELIST: readonly string[] = ['crawler.freeze'] as const

/** 高危审计 title 模板 */
const HIGH_RISK_TITLE_MAP: ReadonlyMap<string, string> = new Map([
  ['crawler.freeze', '全局采集冻结切换'],
])

/** 高危审计 href 映射 */
const HIGH_RISK_HREF_MAP: ReadonlyMap<string, string> = new Map([
  ['crawler.freeze', '/admin/crawler'],
])

interface AuditHighRiskRow {
  id: string
  action_type: string
  target_id: string | null
  created_at: Date
  actor_id: string | null
}

export interface ListBackgroundEventsParams {
  limit: number
  windowHours: number
}

export interface ListBackgroundEventsResult {
  events: AdminBackgroundEvent[]
  total: number
  generatedAt: string
  degraded?: boolean
}

export class BackgroundEventService {
  constructor(private readonly db: Pool) {}

  async list(params: ListBackgroundEventsParams): Promise<ListBackgroundEventsResult> {
    const { limit, windowHours } = params
    const generatedAt = new Date().toISOString()

    // 并发查询 active(C) + audit(E) 两 DB 源 + 内存计算两源（A/B）；
    // finished crawler_run 派生（D）已移除（NTLG-P2-c-C-1，crawler 并入 notifications 主 list）
    const [activeResult, auditResult, autoConfig] = await Promise.all([
      // C — active crawler_runs（谓词下推 / idx_crawler_runs_status）
      listRuns(this.db, {
        status: ['queued', 'running', 'paused'],
        sortField: 'createdAt',
        sortDirection: 'desc',
        limit: 10,
      }),
      // E — audit_log 高危白名单
      this.db.query<AuditHighRiskRow>(
        `SELECT id::text, action_type, target_id, created_at, actor_id::text
           FROM admin_audit_log
          WHERE action_type = ANY($1::text[])
            AND created_at >= NOW() - ($2 || ' hours')::interval
          ORDER BY created_at DESC
          LIMIT $3`,
        [HIGH_RISK_AUDIT_WHITELIST, windowHours, Math.floor(limit / 4)],
      ),
      // A — autoCrawlNext 配置（内存计算）
      systemSettingsQueries.getAutoCrawlConfig(this.db),
    ])

    // A — autoCrawlNext
    const autoCrawlNext = computeNextTrigger(autoConfig)
    const upcomingEvents: AdminBackgroundEventUpcoming[] = []
    if (autoCrawlNext !== null) {
      upcomingEvents.push({
        lane: 'upcoming',
        id: 'auto_crawl:next',
        kind: 'auto_crawl',
        status: 'scheduled',
        level: 'info',
        title: '下次自动采集',
        scheduledAt: autoCrawlNext,
        href: '/admin/crawler',
      })
    }

    // B — scheduler timer nextRunAt（intervalMs 推算，24h 内才返回）
    const now = Date.now()
    const within24hMs = 24 * 3600_000
    const schedulerStatuses = getSchedulerStatus()
    for (const s of schedulerStatuses) {
      if (!s.enabled) continue
      if (!s.nextRunAt) continue
      let nextMs: number
      try {
        nextMs = Date.parse(s.nextRunAt)
      } catch {
        continue
      }
      if (!Number.isFinite(nextMs)) continue
      if (nextMs - now > within24hMs) continue
      upcomingEvents.push({
        lane: 'upcoming',
        id: `scheduler_timer:${s.name}`,
        kind: 'scheduler_timer',
        status: 'scheduled',
        level: 'info',
        title: `定时任务：${s.name}`,
        scheduledAt: s.nextRunAt,
      })
    }
    // upcoming 按 scheduledAt asc（最早的先显示）
    upcomingEvents.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))

    // C — active crawler_runs
    const activeEvents: AdminBackgroundEventActive[] = activeResult.rows.map((run) => ({
      lane: 'active' as const,
      id: `crawler_run:${run.id}`,
      kind: 'crawler_run' as const,
      status: run.status as 'queued' | 'running' | 'paused',
      level: 'info' as const,
      title: buildRunTitle(run.crawlMode, run.triggerType),
      startedAt: run.startedAt ?? run.createdAt,
      runId: run.id,
      href: `/admin/crawler/runs/${run.id}`,
    }))

    // E — audit_log 高危（finished lane 唯一来源；finished crawler_run 派生 D 已移除 / NTLG-P2-c-C-1）
    const finishedEvents: AdminBackgroundEventFinished[] = auditResult.rows
      .map((row): AdminBackgroundEventFinished => ({
        lane: 'finished' as const,
        id: `audit:${row.id}`,
        kind: 'audit_high_risk' as const,
        status: 'high_risk_audit' as const,
        level: 'warn' as const,
        title: HIGH_RISK_TITLE_MAP.get(row.action_type) ?? row.action_type,
        finishedAt: row.created_at.toISOString(),
        actorId: row.actor_id ?? undefined,
        href: HIGH_RISK_HREF_MAP.get(row.action_type),
      }))
      .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))

    // 最终排序：upcoming asc scheduledAt → active asc startedAt → finished desc finishedAt
    const events: AdminBackgroundEvent[] = [
      ...upcomingEvents,
      ...activeEvents,
      ...finishedEvents,
    ]

    return {
      events,
      total: events.length,
      generatedAt,
    }
  }
}

// active lane（C）title 文案；finished crawler_run 派生（D）+ buildRunDigest summary 摘要
// 已随 NTLG-P2-c-C-1 移除（crawler 完成 digest 改由 emit→notifications 主 list 承载，TaskResultDigest 口径）。
function buildRunTitle(crawlMode: string, triggerType: string): string {
  const modeLabel = crawlMode === 'keyword' ? '关键词采集' : crawlMode === 'source-refetch' ? '补源采集' : '批量采集'
  const triggerLabel = triggerType === 'schedule' ? '定时' : triggerType === 'all' ? '全站' : triggerType === 'single' ? '单站' : '批量'
  return `${triggerLabel}${modeLabel}`
}

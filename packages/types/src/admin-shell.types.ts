/**
 * admin-shell.types.ts — admin Shell 通知与任务面板 API 类型
 *
 * ADR-147 admin shell notification hub MVP / CHG-SN-8-FUP-SHELL-NOTIFICATIONS-EP-A
 *
 * 与 packages/admin-ui/src/shell/types.ts NotificationItem / TaskItem 结构对齐；
 * 后端 API 引用本文件以避免 api 包反向依赖 admin-ui（UI 包不应被 API 引用）。
 * N1-147-5：admin-ui 后续可改 re-export from types 统一真源（本卡范围外）。
 */

/** 通知抽屉单项（admin-ui SSOT 镜像） */
export interface AdminNotificationItem {
  readonly id: string
  readonly title: string
  readonly body?: string
  readonly level: 'info' | 'warn' | 'danger'
  /** ISO 8601 时间戳 */
  readonly createdAt: string
  readonly read: boolean
  readonly href?: string
  /** ADR-155 D-155-2 / EP-2：双源镜像与 packages/admin-ui/shell/types.ts NotificationItem 严格同步。
   *  category: 'general'（默认 / /admin/notifications）/ 'background'（background-events 合并） */
  readonly category?: 'general' | 'background'
}

/** 后台任务抽屉单项（admin-ui SSOT 镜像） */
export interface AdminTaskItem {
  readonly id: string
  readonly title: string
  readonly status: 'pending' | 'running' | 'success' | 'failed'
  /** 0-100，仅 running 显示 progress bar */
  readonly progress?: number
  /** ISO 8601 起始时间 */
  readonly startedAt: string
  /** ISO 8601 结束时间（status=success/failed 时提供） */
  readonly finishedAt?: string
  /** 失败原因（status=failed 时提供） */
  readonly errorMessage?: string
  /** ADR-155 D-155-2 / EP-2：双源镜像与 packages/admin-ui/shell/types.ts TaskItem 严格同步。
   *  source: 'general'（默认 / /admin/system/jobs）/ 'crawler' / 'maintenance'（扩展位） */
  readonly source?: 'crawler' | 'maintenance' | 'general'
}

/**
 * 统一任务控制端点（POST /admin/tasks/:id/{cancel,retry}）的分派目标（ADR-191 / NTLG-P0-3）。
 * :id 按 TaskAggregator 方案分派：裸 UUID=crawler run / `bull-{queue}-{jobId}`=bull job。
 * 响应在 data.target 标注真实目标类型，便于 P2 task_runs re-point。
 */
export interface AdminTaskControlTarget {
  readonly kind: 'crawler_run' | 'bull_job'
  /** 原始请求 :id（聚合 id 原样回显） */
  readonly id: string
  /** bull_job 时的队列名 */
  readonly queue?: 'crawler' | 'maintenance'
  /** crawler run retry 时新建的 run id */
  readonly retryRunId?: string
}

/** POST /admin/tasks/:id/cancel 响应（ADR-191） */
export interface AdminTaskCancelResponse {
  readonly data: {
    readonly target: AdminTaskControlTarget
    /** 动作是否实际生效（幂等 no-op 时为 false） */
    readonly cancelled: boolean
  }
}

/** POST /admin/tasks/:id/retry 响应（ADR-191） */
export interface AdminTaskRetryResponse {
  readonly data: {
    readonly target: AdminTaskControlTarget
    readonly retried: boolean
  }
}

/** GET /admin/notifications 响应信封（ADR-147 §4） */
export interface AdminNotificationListResponse {
  data: AdminNotificationItem[]
  meta: {
    total: number
    limit: number
    since: string
  }
}

/** bull queue 计数概览（ADR-147 §D-147-6） */
export interface AdminQueueCounts {
  crawler: { waiting: number; active: number }
  maintenance: { waiting: number; active: number }
}

/** GET /admin/system/jobs 响应信封（ADR-147 §4） */
export interface AdminJobsListResponse {
  data: AdminTaskItem[]
  meta: {
    total: number
    limit: number
    since: string
    queueCounts: AdminQueueCounts
    /** Redis 不可用降级时为 true（仅返回 CrawlerRun 数据） */
    degraded?: boolean
  }
}

// ── BackgroundEvent discriminated union（ADR-152 / CW1-E-EP step 6）──────────────────

/**
 * upcoming lane：定时自动采集 / scheduler timer 未来触发时间
 * D-152-1 Y-152-2 修订：discriminated union by lane
 */
export interface AdminBackgroundEventUpcoming {
  readonly lane: 'upcoming'
  readonly id: string
  readonly kind: 'auto_crawl' | 'scheduler_timer'
  readonly status: 'scheduled'
  readonly level: 'info'
  readonly title: string
  readonly description?: string
  /** upcoming 强制必填（ISO 8601） */
  readonly scheduledAt: string
  readonly href?: string
}

/**
 * active lane：采集批次进行中
 * D-152-1 Y-152-2 修订
 */
export interface AdminBackgroundEventActive {
  readonly lane: 'active'
  readonly id: string
  readonly kind: 'crawler_run'
  readonly status: 'queued' | 'running' | 'paused'
  readonly level: 'info'
  readonly title: string
  readonly description?: string
  /** active 强制必填（ISO 8601） */
  readonly startedAt: string
  /** active.crawler_run 必填（href 跳转用） */
  readonly runId: string
  readonly href: string
}

/**
 * finished lane：近期完成/失败的批次 + 高危审计事件
 * D-152-1 Y-152-2 修订
 */
export interface AdminBackgroundEventFinished {
  readonly lane: 'finished'
  readonly id: string
  readonly kind: 'crawler_run' | 'audit_high_risk'
  readonly status: 'success' | 'failed' | 'partial_failed' | 'cancelled' | 'timeout' | 'high_risk_audit'
  readonly level: 'info' | 'warn' | 'danger'
  readonly title: string
  readonly description?: string
  /** crawler_run 必填；audit_high_risk 不填 */
  readonly startedAt?: string
  /** finished 强制必填（audit_high_risk 取 created_at） */
  readonly finishedAt: string
  /** crawler_run 必填 */
  readonly runId?: string
  /** audit_high_risk 可选 */
  readonly actorId?: string
  readonly href?: string
}

/** ADR-152 BackgroundEvent discriminated union（3 lane） */
export type AdminBackgroundEvent =
  | AdminBackgroundEventUpcoming
  | AdminBackgroundEventActive
  | AdminBackgroundEventFinished

/** GET /admin/system/background-events 响应信封（ADR-152 §端点契约） */
export interface AdminBackgroundEventsResponse {
  data: AdminBackgroundEvent[]
  meta: {
    total: number
    limit: number
    windowHours: number
    generatedAt: string
    /** bull 不可用降级时为 true */
    degraded?: boolean
  }
}

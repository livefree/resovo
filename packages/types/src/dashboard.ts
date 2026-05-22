/**
 * dashboard.ts — Dashboard 数据层 API 共享类型（ADR-127 §D-127-5）
 *
 * 消费方：
 *   - 后端 apps/api/src/routes/admin/dashboard.ts（生产方）
 *   - 前端 apps/server-next/src/lib/dashboard/api.ts（消费方）
 *   - dashboard-data.ts（派生 DashboardStats 使用 DashboardWorkflowSegment + DashboardKpiSnapshot）
 *
 * UI 专有字段（color / dataSource / sparkData 等）不在此定义，由消费方扩展。
 */

/** 4 张 KPI 卡片的数据快照（value 已格式化为显示字符串） */
export interface DashboardKpiSnapshot {
  readonly key: 'videoTotal' | 'pendingStaging' | 'sourceReachableRate' | 'inactiveSources'
  /** 格式化后的显示值，如 "695"、"484 / 23"、"98.7%"、"1,939" */
  readonly value: string
  /** 带方向符号的 delta 文案，如 "↑ +47 今日" */
  readonly deltaText: string
  readonly deltaDirection: 'up' | 'down' | 'flat'
  readonly variant: 'default' | 'is-warn' | 'is-danger' | 'is-ok'
}

/** WorkflowCard 4 段进度（API 级别，无 UI 颜色）*/
export interface DashboardWorkflowSegment {
  readonly key: 'collected' | 'pendingReview' | 'staging' | 'published'
  readonly current: number
  readonly total: number
}

/** spark 历史数据点（date = YYYY-MM-DD，value = 该天的快照数值） */
export interface DashboardSparkPoint {
  readonly date: string
  readonly value: number
}

/** 采集任务量时间线数据点（analytics 折线图用） */
export interface DashboardTimelinePoint {
  readonly date: string
  readonly count: number
}

/** 源类型分布（analytics 进度条列表用） */
export interface DashboardSourceTypeStat {
  readonly type: string
  readonly count: number
  /** 百分比 0-100，保留 1 位小数 */
  readonly pct: number
}

/** 爬虫最近任务简述（analytics 表格用，7 列） */
export interface DashboardCrawlerRunBrief {
  readonly id: string
  readonly site: string
  readonly status: 'ok' | 'warn' | 'danger'
  readonly statusLabel: string
  readonly startedAt: string | null
  readonly finishedAt: string | null
  readonly videosUpserted: number
  readonly sourcesUpserted: number
  readonly durationSeconds: number | null
}

/** analytics 端点整体 payload */
export interface DashboardAnalyticsPayload {
  readonly kpis: readonly DashboardKpiSnapshot[]
  readonly collectTimeline: readonly DashboardTimelinePoint[]
  readonly sourceTypeDistribution: readonly DashboardSourceTypeStat[]
  readonly recentTasks: readonly DashboardCrawlerRunBrief[]
}

/** overview 端点整体 payload */
export interface DashboardOverviewPayload {
  readonly kpis: readonly DashboardKpiSnapshot[]
  readonly workflow: readonly DashboardWorkflowSegment[]
  readonly generatedAt: string
}

// ── ADR-141: dashboard activities 真端点（GET /admin/dashboard/activities）────

/**
 * dashboard activities 端点返回行（ADR-141 §6 Response 结构）。
 *
 * 字段集：从 admin_audit_log 派生 + LEFT JOIN users 取 actor username。
 * 不含 beforeJsonb / afterJsonb / payloadSummary / requestId / ipHash
 * （与 ADR-118 listAdminAuditLog 完整审计视图差异）。
 *
 * actionType 中文 label 映射由前端 i18n 承担（ADR-141 D-141-2 方案 B）。
 */
export interface DashboardActivityRow {
  /** admin_audit_log.id（bigserial 转 string，避免 JS 大数精度） */
  readonly id: string
  readonly actorId: string
  /** LEFT JOIN users.username；actor 删除兜底 null（虽 FK ON DELETE RESTRICT 实际不会发生） */
  readonly actorUsername: string | null
  /** AdminAuditActionType 原值；前端 i18n 映射中文 label */
  readonly actionType: string
  /** AdminAuditTargetKind */
  readonly targetKind: string
  /** batch action 时为 null */
  readonly targetId: string | null
  /** ISO 8601 */
  readonly createdAt: string
}

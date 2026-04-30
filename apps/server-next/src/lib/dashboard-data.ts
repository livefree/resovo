/**
 * dashboard-data.ts — Dashboard 5 类卡片数据形态 + mock + live/mock 混合派生（CHG-DESIGN-07 7C 步骤 2）
 *
 * 真源（按优先级）：
 *   1. `docs/designs/backend_design_v2.1/reference.md` §5.1.1 / §5.1.2 5 类卡片 mock 蓝图
 *   2. `apps/server-next/src/lib/videos/api.ts` ModerationStats（已对齐后端真实契约 7C 步骤 1）
 *   3. CHG-DESIGN-07 任务卡数据源策略：live 字段从 ModerationStats 派生；缺字段 fallback mock
 *
 * 反 CHG-SN-3-08 假绿模式（reference.md §5.1.4 教训直接落地）：
 *   - 接口字段缺失 → fallback mock 数据 + 标 `data-source="mock"` + 标记 follow-up
 *   - **绝不**让接口成功后渲染破折号 `'—'`
 *
 * 数据所有权：
 *   - live：从 `getModerationStats()` 真端点派生（当前仅 KPI「待审/暂存」+ WorkflowCard「待审」段）
 *   - mock：deterministic 数据，集中本文件；M-SN-4+ 接入真端点（STATS-EXTEND-DASHBOARD follow-up）
 *
 * 与 packages/admin-ui Cell 共享组件契约（CHG-DESIGN-07 7B）：
 *   - KpiCard.dataSource: 'mock' | 'live' | undefined → 控制 `data-source` attribute
 *   - KpiCard.value: ReactNode（允许 "484 / 23" 复合）
 *   - Spark.data: readonly number[]（0/1/N 路径）
 */

import type { ReactNode } from 'react'
import type { ModerationStats } from './videos/api'

// ── 数据形态（DashboardStats）────────────────────────────────────

/** KPI 单卡数据形态（4 张 KPI 共用） */
export interface DashboardKpi {
  readonly key: 'videoTotal' | 'pendingStaging' | 'sourceReachableRate' | 'inactiveSources'
  readonly label: string
  readonly value: ReactNode
  readonly deltaText: string
  readonly deltaDirection: 'up' | 'down' | 'flat'
  readonly variant: 'default' | 'is-warn' | 'is-danger' | 'is-ok'
  readonly sparkData: readonly number[]
  readonly sparkColor: string
  readonly dataSource: 'mock' | 'live'
}

/** WorkflowCard 单段进度 */
export interface DashboardWorkflowSegment {
  readonly key: 'collected' | 'pendingReview' | 'staging' | 'published'
  readonly label: string
  readonly current: number
  readonly total: number
  readonly color: string
  readonly dataSource: 'mock' | 'live'
}

/** AttentionCard 异常项严重度 */
export type AttentionSeverity = 'warn' | 'danger' | 'info'

/** AttentionCard 单条异常 */
export interface DashboardAttentionItem {
  readonly id: string
  readonly severity: AttentionSeverity
  readonly title: string
  readonly meta: string
}

/** RecentActivityCard 单条活动 */
export interface DashboardActivityItem {
  readonly id: string
  readonly severity: AttentionSeverity
  readonly who: string
  readonly what: string
  readonly when: string
}

/** SiteHealthCard 单站健康度 */
export interface DashboardSiteHealth {
  readonly key: string
  readonly name: string
  readonly score: number
  readonly type: string
  readonly format: string
  readonly lastSeen: string
  readonly sparkData: readonly number[]
  readonly online: boolean
}

/** Dashboard 整体数据形态（5 类卡片汇总） */
export interface DashboardStats {
  readonly kpis: readonly [DashboardKpi, DashboardKpi, DashboardKpi, DashboardKpi]
  readonly workflow: readonly [
    DashboardWorkflowSegment,
    DashboardWorkflowSegment,
    DashboardWorkflowSegment,
    DashboardWorkflowSegment,
  ]
  readonly attentions: readonly DashboardAttentionItem[]
  readonly activities: readonly DashboardActivityItem[]
  readonly sites: readonly DashboardSiteHealth[]
  /** Page head 副标题：基于 todayReviewedCount + interceptRate 派生（live 字段时） */
  readonly headSub: string
}

// ── deterministic mock 数据（reference §5.1.2 直接照搬数值） ────────

const MOCK_KPIS_BASE = {
  videoTotal: {
    label: '视频总量',
    sparkData: [620, 638, 651, 662, 670, 680, 695] as const,
    sparkColor: 'var(--accent-default)',
  },
  pendingStaging: {
    label: '待审 / 暂存',
    sparkData: [430, 450, 462, 470, 478, 480, 484] as const,
    sparkColor: 'var(--state-warning-fg)',
  },
  sourceReachableRate: {
    label: '源可达率',
    sparkData: [98.4, 98.5, 98.6, 98.5, 98.7, 98.6, 98.7] as const,
    sparkColor: 'var(--state-success-fg)',
  },
  inactiveSources: {
    label: '失效源',
    sparkData: [2050, 2030, 2010, 1990, 1980, 1967, 1939] as const,
    sparkColor: 'var(--state-error-fg)',
  },
} as const

const MOCK_ATTENTIONS: readonly DashboardAttentionItem[] = [
  { id: 'a-1', severity: 'danger', title: '4 个采集站点连续失败', meta: '影响 ~120 待入库视频 · 1 小时前' },
  { id: 'a-2', severity: 'warn', title: 'img3.doubanio.com 404 集中爆发', meta: '过去 24 小时 78 张封面失败' },
  { id: 'a-3', severity: 'warn', title: '6 个候选合并待人工确认', meta: '相似度 ≥ 0.92 · 自动判定阻塞' },
  { id: 'a-4', severity: 'info', title: 'Banner 过期：春节合集', meta: '上线日 2026-02-14 · 今日下线' },
]

const MOCK_ACTIVITIES: readonly DashboardActivityItem[] = [
  { id: 'r-1', severity: 'info', who: 'Yan', what: '审核通过 12 条', when: '5 分钟前' },
  { id: 'r-2', severity: 'warn', who: 'Mira', what: '驳回 2 条（封面缺失）', when: '12 分钟前' },
  { id: 'r-3', severity: 'info', who: '系统', what: '采集任务 #1287 完成（8 条入库）', when: '23 分钟前' },
  { id: 'r-4', severity: 'danger', who: '系统', what: '采集任务 #1289 失败（超时）', when: '47 分钟前' },
  { id: 'r-5', severity: 'info', who: 'Yan', what: '上架 5 条', when: '1 小时前' },
  { id: 'r-6', severity: 'info', who: 'Mira', what: '修复 14 张失效封面', when: '2 小时前' },
]

const MOCK_SITES: readonly DashboardSiteHealth[] = [
  { key: 's-1', name: 'iyf.tv', score: 92, type: '聚合', format: 'm3u8', lastSeen: '2 分钟前', sparkData: [88, 90, 91, 92, 93, 92, 92], online: true },
  { key: 's-2', name: 'agedm.org', score: 86, type: '动漫', format: 'mp4', lastSeen: '7 分钟前', sparkData: [80, 82, 85, 86, 87, 86, 86], online: true },
  { key: 's-3', name: 'mxdm5.com', score: 78, type: '电影', format: 'm3u8', lastSeen: '15 分钟前', sparkData: [82, 80, 78, 76, 78, 79, 78], online: true },
  { key: 's-4', name: 'btnull.org', score: 64, type: '剧集', format: 'm3u8', lastSeen: '1 小时前', sparkData: [70, 68, 66, 64, 62, 64, 64], online: true },
  { key: 's-5', name: 'mokit.tv', score: 52, type: '聚合', format: 'mp4', lastSeen: '3 小时前', sparkData: [60, 58, 55, 53, 52, 51, 52], online: true },
  { key: 's-6', name: 'voflix.cc', score: 38, type: '短剧', format: 'm3u8', lastSeen: '8 小时前', sparkData: [50, 48, 44, 42, 40, 39, 38], online: false },
  { key: 's-7', name: 'oldfilm.org', score: 24, type: '老电影', format: 'mp4', lastSeen: '1 天前', sparkData: [40, 35, 30, 28, 26, 25, 24], online: false },
  { key: 's-8', name: 'rokuten.tv', score: 12, type: '日韩', format: 'mp4', lastSeen: '3 天前', sparkData: [25, 20, 18, 15, 14, 13, 12], online: false },
]

const MOCK_STAGING_COUNT = 23

// ── 派生 helper（live + mock 混合） ─────────────────────────────

/**
 * 从 ModerationStats（live，可能 null / 部分字段缺失）派生 DashboardStats（5 类卡片完整数据）
 *
 * live 路径：仅 ModerationStats.pendingCount 直接驱动 KPI「待审/暂存」+ WorkflowCard「待审」段；
 *           todayReviewedCount + interceptRate 用于 page head 副标题文案
 * mock 路径：其他字段（视频总量 / 源可达率 / 失效源 / 已上架 / 采集入库 / 暂存 / 5 类卡片其他形态）全部走 mock
 *
 * fallback 规则（reference §5.1.4 教训）：
 *   - moderationStats === null → 全卡 dataSource='mock'
 *   - moderationStats.pendingCount 缺失（!== number）→ KPI/Workflow live 字段降级为 mock
 *
 * **绝不**渲染破折号 `'—'`：所有 KpiCard.value 始终是 string / number 或非 null ReactNode。
 */
export function buildDashboardStats(moderationStats: ModerationStats | null): DashboardStats {
  const pendingLive = moderationStats && typeof moderationStats.pendingCount === 'number'
    ? moderationStats.pendingCount
    : null

  const todayReviewed = moderationStats && typeof moderationStats.todayReviewedCount === 'number'
    ? moderationStats.todayReviewedCount
    : null

  const interceptRate = moderationStats && typeof moderationStats.interceptRate === 'number'
    ? moderationStats.interceptRate
    : null

  // KPI: 待审/暂存（live pendingCount + mock staging）
  const pendingForKpi = pendingLive ?? 484
  const pendingDataSource: 'mock' | 'live' = pendingLive !== null ? 'live' : 'mock'
  const pendingDelta = pendingLive !== null && todayReviewed !== null
    ? `今日已审 ${todayReviewed}`
    : '较昨日 +18'

  const kpis: DashboardStats['kpis'] = [
    {
      key: 'videoTotal',
      label: MOCK_KPIS_BASE.videoTotal.label,
      value: '695',
      deltaText: '↑ +47 今日',
      deltaDirection: 'up',
      variant: 'default',
      sparkData: MOCK_KPIS_BASE.videoTotal.sparkData,
      sparkColor: MOCK_KPIS_BASE.videoTotal.sparkColor,
      dataSource: 'mock',
    },
    {
      key: 'pendingStaging',
      label: MOCK_KPIS_BASE.pendingStaging.label,
      value: `${pendingForKpi} / ${MOCK_STAGING_COUNT}`,
      deltaText: pendingDelta,
      deltaDirection: 'flat',
      variant: 'is-warn',
      sparkData: MOCK_KPIS_BASE.pendingStaging.sparkData,
      sparkColor: MOCK_KPIS_BASE.pendingStaging.sparkColor,
      dataSource: pendingDataSource,
    },
    {
      key: 'sourceReachableRate',
      label: MOCK_KPIS_BASE.sourceReachableRate.label,
      value: '98.7%',
      deltaText: '↑ 0.3pt 7d',
      deltaDirection: 'up',
      variant: 'is-ok',
      sparkData: MOCK_KPIS_BASE.sourceReachableRate.sparkData,
      sparkColor: MOCK_KPIS_BASE.sourceReachableRate.sparkColor,
      dataSource: 'mock',
    },
    {
      key: 'inactiveSources',
      label: MOCK_KPIS_BASE.inactiveSources.label,
      value: '1,939',
      deltaText: '↓ -28 较昨日',
      deltaDirection: 'down',
      variant: 'is-danger',
      sparkData: MOCK_KPIS_BASE.inactiveSources.sparkData,
      sparkColor: MOCK_KPIS_BASE.inactiveSources.sparkColor,
      dataSource: 'mock',
    },
  ]

  // WorkflowCard 4 段
  const workflow: DashboardStats['workflow'] = [
    { key: 'collected', label: '采集入库', current: 142, total: 200, color: 'var(--accent-default)', dataSource: 'mock' },
    {
      key: 'pendingReview',
      label: '待审核',
      current: pendingForKpi,
      total: 600,
      color: 'var(--state-warning-fg)',
      dataSource: pendingDataSource,
    },
    { key: 'staging', label: '暂存待发布', current: MOCK_STAGING_COUNT, total: 50, color: 'var(--state-info-fg)', dataSource: 'mock' },
    { key: 'published', label: '已上架', current: 188, total: 200, color: 'var(--state-success-fg)', dataSource: 'mock' },
  ]

  // page head 副标题：live 字段时显示真数据，否则 mock 文案
  const headSub = todayReviewed !== null
    ? `今日已审 ${todayReviewed} 条${interceptRate !== null ? ` · 拦截率 ${(interceptRate * 100).toFixed(1)}%` : ''}`
    : '最近采集 2 分钟前 · 484 条待审堆积'

  return {
    kpis,
    workflow,
    attentions: MOCK_ATTENTIONS,
    activities: MOCK_ACTIVITIES,
    sites: MOCK_SITES,
    headSub,
  }
}

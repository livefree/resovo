/**
 * admin-search.types.ts — 后台全局搜索（GET /admin/search）统一结果 DTO 契约
 *
 * 端点真源：ADR-200 §端点契约（GET /admin/search）
 * 关联 ADR：ADR-110（ApiResponse 信封 { data }）/ ADR-103a §4.1.6（CommandPalette 远程结果承载）/
 *          ADR-004（videos 复用 ES）/ ADR-149（过滤下沉服务端）
 *
 * 设计要点（ADR-200，arch-reviewer Opus 裁决 M-3）：
 *   - discriminated union（kind 判别式）+ 每 kind typed payload，**不退化成 subtitle+badges string 袋子**
 *   - reason / kind 为闭合 union（不留 string 兜底，对齐 ADR-103a §4.1.1）
 *   - DTO 真源在 @resovo/types（API SSOT），admin-ui 正向 import 复用、不复制类型体
 *   - 分组/排序/精确命中置顶为服务端职责；前端只做 DTO→CommandGroup 展示映射
 *   - **枚举字段一律引用既有 SSOT union（不退化成 string）**（Codex 复审 + ADR-103a §4.1.1）
 */
import type { VideoType, VideoStatus, ReviewStatus, VisibilityStatus } from './video.types'
import type { UserRole } from './user.types'
import type { UserSubmissionStatus } from './admin-moderation.types'
import type { AdminTaskItem } from './admin-shell.types'

/** 顶栏全局搜索覆盖实体（P1: video/source/user/task；P1.5: submission） */
export type AdminSearchKind = 'video' | 'source' | 'user' | 'task' | 'submission'

/** 命中原因（闭合 union；服务端排序/置顶依据） */
export type AdminSearchReason =
  | 'exact-id'
  | 'exact-short-id'
  | 'title-prefix'
  | 'title-match'
  | 'field-match'
  | 'fuzzy'

/** 公共字段（所有 kind 共有） */
interface AdminSearchResultBase {
  readonly id: string
  readonly title: string
  /** admin 路由相对跳转目标（CommandItem.href 来源） */
  readonly href: string
  /** 组内排序分（ES _score / ILIKE 启发）；**仅组内可比，跨 kind 不可比**（ADR-200 score 语义） */
  readonly score: number
  readonly reason: AdminSearchReason
  /** ES highlight 透传（<em> 标记）；ILIKE 类 kind 为 undefined，前端按 query 客户端兜底（ADR-200 highlight 分 kind） */
  readonly highlight?: string
}

export interface AdminSearchVideoPayload {
  readonly shortId: string
  readonly type: VideoType
  readonly year: number | null
  readonly status: VideoStatus
  readonly reviewStatus: ReviewStatus
  readonly visibilityStatus: VisibilityStatus
}
export interface AdminSearchVideoResult extends AdminSearchResultBase {
  readonly kind: 'video'
  readonly payload: AdminSearchVideoPayload
}

export interface AdminSearchSourcePayload {
  readonly sourceName: string
  readonly siteDisplayName: string | null
  readonly videoId: string
  readonly videoTitle: string
  readonly sourceUrl: string
}
export interface AdminSearchSourceResult extends AdminSearchResultBase {
  readonly kind: 'source'
  readonly payload: AdminSearchSourcePayload
}

export interface AdminSearchUserPayload {
  readonly username: string
  readonly email: string
  readonly role: UserRole
}
export interface AdminSearchUserResult extends AdminSearchResultBase {
  readonly kind: 'user'
  readonly payload: AdminSearchUserPayload
}

export interface AdminSearchTaskPayload {
  /** admin 面向任务状态（与 AdminTaskItem.status SSOT 一致，由 TaskRunStatus 经 TaskAggregator 映射） */
  readonly status: AdminTaskItem['status']
  /** 最近运行时间 ISO（无则 null） */
  readonly lastRunAt: string | null
}
export interface AdminSearchTaskResult extends AdminSearchResultBase {
  readonly kind: 'task'
  readonly payload: AdminSearchTaskPayload
}

export interface AdminSearchSubmissionPayload {
  readonly status: UserSubmissionStatus
  readonly submittedBy: string | null
  /** 投稿时间 ISO */
  readonly createdAt: string
}
export interface AdminSearchSubmissionResult extends AdminSearchResultBase {
  readonly kind: 'submission'
  readonly payload: AdminSearchSubmissionPayload
}

export type AdminSearchResult =
  | AdminSearchVideoResult
  | AdminSearchSourceResult
  | AdminSearchUserResult
  | AdminSearchTaskResult
  | AdminSearchSubmissionResult

/** 结果分组（按 kind）——服务端分组 + 组内 top-N + 精确命中置顶 */
export interface AdminSearchGroup {
  readonly kind: AdminSearchKind
  readonly items: readonly AdminSearchResult[]
  /** 该 kind searcher 失败的局部降级标记（fan-out Promise.allSettled；ADR-200 D-200-4） */
  readonly degraded?: boolean
}

/**
 * GET /admin/search 响应 data（ADR-110 信封 `{ data }` 内层）。
 * groups 已按固定 kind 优先级排序（video > source > user > task > submission），跨 kind 不按 score 混排。
 */
export interface AdminSearchResponseData {
  readonly query: string
  readonly groups: readonly AdminSearchGroup[]
}

/** GET /admin/search query 参数 */
export interface AdminSearchQueryParams {
  readonly q: string
  readonly limit?: number
}

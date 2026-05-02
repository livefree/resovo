/**
 * admin-moderation.types.ts — M-SN-4 审核台 / 暂存 / 拒绝 + 共享 cell 类型
 *
 * 真源：docs/designs/backend_design_v2.1/M-SN-4-moderation-console-plan.md v1.4
 * 任务卡：CHG-SN-4-03 / SEQ-20260501-01
 * 关联 ADR：ADR-106（admin-ui 下沉）/ ADR-109（admin_audit_log）
 *
 * 消费方（plan §8.1 跨 4 处）：
 *   - apps/api（routes / queries / services 层）
 *   - apps/server-next（lib / SWR fetcher / 业务页 props）
 *   - apps/worker（feedback-driven-recheck）
 *   - packages/admin-ui（cell 共享组件 BarSignal / DualSignal Props）
 *
 * 不允许 apps 内重复定义；新字段必须先改本文件。
 */

// ── 复用 video.types 既有枚举 ────────────────────────────────────────────────
//
// ReviewStatus / VisibilityStatus / SourceCheckStatus / VideoType / VideoQuality 已在
// packages/types/src/video.types.ts 定义，本文件不重复声明，消费方通过 packages/types
// index 入口共享。

import type {
  ReviewStatus,
  VisibilityStatus,
  SourceCheckStatus,
  VideoType,
  VideoQuality,    // 既有 video_sources.quality CHECK 5 值（4K/1080P/720P/480P/360P）
  DoubanStatus,    // 既有 032_videos_pipeline_status_fields.sql CHECK 4 值
} from './video.types'

// ── 共享 cell 类型 ────────────────────────────────────────────────────────────

/**
 * DualSignal / BarSignal 单路状态值（DB 持久值）。
 * **严格对齐** Migration 054 video_sources.probe_status / render_status CHECK 约束的 4 值；
 * 用于 API 入参 / 出参 / DB 投影类型。前端 UI 可能需要"未加载"占位，使用 DualSignalDisplayState。
 */
export type DualSignalState = 'pending' | 'ok' | 'partial' | 'dead'

/**
 * DualSignal / BarSignal **前端展示态**：DB 4 值 + UI 占位 'unknown'（未加载 / 接口失败兜底）。
 * 后端不接受 'unknown' 作为输入，仅前端组件 Props 类型可用。
 */
export type DualSignalDisplayState = DualSignalState | 'unknown'

// ── review_labels（Migration 056）─────────────────────────────────────────────

export type ReviewLabelAppliesTo = 'reject' | 'approve' | 'any'

export interface ReviewLabel {
  readonly id: string
  readonly labelKey: string
  readonly label: string
  readonly appliesTo: ReviewLabelAppliesTo
  readonly displayOrder: number
  readonly isActive: boolean
  readonly createdAt: string  // ISO 8601
}

// ── source_health_events（037 既有表 + 058 扩展）──────────────────────────────
//
// 037 既有字段：id / video_id / origin / old_status / new_status / triggered_by / created_at
// 058 扩展（plan v1.4 §2.7）：source_id / error_detail / http_code / latency_ms
// origin 列在 037 为无 CHECK 约束的 TEXT，注释列举三种值；plan §4 worker 新增多种来源不需要 DB
// 迁移即可写入。下方 union 包含**现存持久值 + plan 新增值**全集，禁止 apps 内重复定义。

/**
 * 037 既有 origin 值（已持久数据）。
 */
export type SourceHealthEventOriginLegacy =
  | 'island_detected'
  | 'auto_refetch_success'
  | 'auto_refetch_failed'

/**
 * plan §4 worker 新增 origin 值（M-SN-4 启用后开始持久化）。
 */
export type SourceHealthEventOriginWorker =
  | 'scheduled_probe'
  | 'render_check'
  | 'manual_recheck'
  | 'feedback_driven'
  | 'circuit_breaker'

export type SourceHealthEventOrigin =
  | SourceHealthEventOriginLegacy
  | SourceHealthEventOriginWorker

/**
 * source_health_events 行类型（037 + 058 扩展全集）。
 * 字段命名按 DB 列 snake → camel 映射；可选性严格对齐 NOT NULL / NULL。
 */
export interface SourceHealthEvent {
  readonly id: string
  readonly videoId: string                              // 037：NOT NULL
  readonly sourceId: string | null                      // 058：可空（存量 NULL）
  readonly origin: SourceHealthEventOrigin              // 037：NOT NULL，无 CHECK，按 union 解释
  readonly oldStatus: string | null                     // 037：NULL 允许
  readonly newStatus: string | null                     // 037：NULL 允许
  readonly triggeredBy: string | null                   // 037：NULL 允许
  readonly errorDetail: string | null                   // 058：NULL 允许
  readonly httpCode: number | null                      // 058：NULL 允许
  readonly latencyMs: number | null                     // 058：NULL 允许
  readonly createdAt: string
}

// ── admin_audit_log（Migration 052 — M-SN-4 序列首位）────────────────────────

/**
 * audit log action_type 完整枚举。
 * 写入位点真源：plan v1.4 §3.0.5 表。新增前必须先改 plan + 本枚举。
 */
export type AdminAuditActionType =
  | 'video.approve'
  | 'video.reject_labeled'
  | 'video.staff_note'
  | 'video.visibility_patch'
  | 'video.reopen'
  | 'video.refetch_sources'
  | 'video_source.toggle'
  | 'video_source.disable_dead_batch'
  | 'staging.revert'
  | 'staging.publish'
  | 'staging.batch_publish'

export type AdminAuditTargetKind =
  | 'video'
  | 'video_source'
  | 'staging'
  | 'review_label'
  | 'crawler_site'
  | 'system'

export interface AdminAuditLog {
  readonly id: string  // bigserial → string（避免 JS 大数精度）
  readonly actorId: string
  readonly actionType: AdminAuditActionType
  readonly targetKind: AdminAuditTargetKind
  readonly targetId: string | null
  readonly beforeJsonb: Readonly<Record<string, unknown>> | null
  readonly afterJsonb: Readonly<Record<string, unknown>> | null
  readonly requestId: string | null
  readonly ipHash: string | null
  readonly createdAt: string
}

// ── 审核台队列行（pending-queue 端点）─────────────────────────────────────────
//
// 字段命名严格对齐 videos 表列名（snake_case → camelCase）：
//   001_init_tables.sql videos：id / title / type / category / rating / year /
//     country / cover_url / episode_count / is_published / created_at / updated_at
//   016_review_visibility.sql：review_status / visibility_status
//   032_videos_pipeline_status_fields.sql：douban_status / source_check_status / meta_score
//   051_add_videos_trending_tag.sql：trending_tag
//   055_videos_moderation_fields.sql（M-SN-4 plan v1.4 §2.4）：staff_note / review_label_key
//   060_videos_review_source.sql（M-SN-4 plan v1.4 §2.9）：review_source
// probe / render 为视频级聚合（plan §4.3 由 worker 写回 source_check_status；
//   probe / render 字段是端点 join 后投影 video_sources 取最差状态，非视频表持久列）
// badges / needsManualReview 是端点投影计算字段（不直接对应单列）

/**
 * 060_videos_review_source.sql 新增 review_source CHECK 3 值 DEFAULT 'manual'。
 * DoubanStatus 已在 video.types 定义，从顶部 import 复用。
 */
export type ReviewSource = 'auto' | 'manual' | 'crawler'

export interface VideoQueueRow {
  readonly id: string
  readonly title: string
  readonly type: VideoType
  readonly year: number | null
  readonly country: string | null
  readonly episodeCount: number               // DB: episode_count INT NOT NULL DEFAULT 1
  readonly coverUrl: string | null            // DB: cover_url TEXT NULL
  readonly rating: number | null              // DB: rating FLOAT NULL（0–10）
  readonly category: string | null            // DB: category TEXT NULL
  readonly isPublished: boolean               // DB: is_published BOOLEAN NOT NULL DEFAULT false（001 init）
  readonly visibilityStatus: VisibilityStatus // 016：CHECK 3 值 DEFAULT 'internal'
  readonly reviewStatus: ReviewStatus         // 016：CHECK 3 值 DEFAULT 'pending_review'
  readonly reviewReason: string | null        // 016：review_reason TEXT NULL
  readonly reviewedBy: string | null          // 016：reviewed_by UUID NULL
  readonly reviewedAt: string | null          // 016：reviewed_at TIMESTAMPTZ NULL
  readonly probe: DualSignalState             // 端点投影：JOIN video_sources 取最差 probe_status
  readonly render: DualSignalState            // 端点投影：JOIN video_sources 取最差 render_status
  readonly sourceCheckStatus: SourceCheckStatus // 032：CHECK + DEFAULT
  readonly metaScore: number                  // 032：meta_score SMALLINT NOT NULL DEFAULT 0 (0–100)
  readonly needsManualReview: boolean         // 016：needs_manual_review BOOLEAN NOT NULL DEFAULT false
  readonly badges: readonly string[]          // 端点投影计算字段（不直接对应单列）
  readonly staffNote: string | null           // 055 新增：videos.staff_note
  readonly reviewLabelKey: string | null      // 055 新增：videos.review_label_key
  readonly doubanStatus: DoubanStatus         // 032 既有：CHECK 4 值
  readonly reviewSource: ReviewSource         // 060 新增：videos.review_source TEXT NOT NULL DEFAULT 'manual'（v1.4 强化为 NOT NULL；schema 强制非空，types 同步收紧）
  readonly trendingTag: string | null         // 051 既有：trending_tag CHECK ('hot'/'weekly_top'/'editors_pick'/'exclusive') NULL
  readonly createdAt: string                  // DB: created_at TIMESTAMPTZ NOT NULL
  readonly updatedAt: string                  // DB: updated_at TIMESTAMPTZ NOT NULL
}

export interface PendingQueueResponse {
  readonly data: readonly VideoQueueRow[]
  readonly nextCursor: string | null
  readonly total: number
  readonly todayStats: {
    readonly reviewed: number
    readonly approveRate: number | null
  }
}

// ── 线路面板（GET /admin/videos/:id/sources）──────────────────────────────────
//
// 字段命名严格对齐 video_sources 表 + 059 新增 + crawler_sites JOIN：
//   001_init_tables.sql video_sources：id / video_id / episode_number / source_url /
//     source_name / quality(5 值) / type(hls/mp4/dash) / is_active / submitted_by /
//     last_checked / created_at
//   046_video_sources_source_site_key.sql：source_site_key
//   054_video_sources_signal_columns.sql（M-SN-4 plan v1.4 §2.3）：probe_status /
//     render_status / latency_ms / last_probed_at / last_rendered_at
//   059_video_sources_resolution_detection.sql（M-SN-4 plan v1.4 §2.8）：quality_detected /
//     quality_source / resolution_width / resolution_height / detected_at
//   057_crawler_sites_user_label.sql：crawler_sites.user_label
//
// quality（既有 5 值 CHECK）与 quality_detected（新增 7 值 CHECK）是两个独立列，前端
// 展示按 fallback 链 quality_detected ?? quality 取值（plan v1.4 §2.8 应用层映射规则）。

/**
 * 059 新增 quality_detected CHECK 7 值（含 2K / 240P）；前端高精度展示用。
 */
export type ResolutionTier = '4K' | '2K' | '1080P' | '720P' | '480P' | '360P' | '240P'

/**
 * video_sources.type CHECK 3 值（既有 001 init）。
 */
export type VideoSourceType = 'hls' | 'mp4' | 'dash'

/**
 * 059 新增 quality_source CHECK 4 值。
 */
export type QualitySource = 'crawler' | 'manifest_parse' | 'player_feedback' | 'admin_review'

export interface VideoSourceLine {
  readonly id: string
  readonly videoId: string                          // DB: video_id NOT NULL
  readonly episodeNumber: number | null             // DB: episode_number INT NULL
  readonly sourceUrl: string                        // DB: source_url TEXT NOT NULL
  readonly sourceName: string                       // DB: source_name TEXT NOT NULL DEFAULT '线路1'
  readonly sourceSiteKey: string | null             // DB: 046 新增 source_site_key
  readonly userLabel: string | null                 // JOIN crawler_sites.user_label（057 新增）
  readonly displayName: string | null               // JOIN crawler_sites.display_name fallback
  readonly type: VideoSourceType                    // DB: type CHECK 3 值
  readonly quality: VideoQuality | null             // DB: quality CHECK 5 值（既有 4K/1080P/720P/480P/360P）
  readonly isActive: boolean                        // DB: is_active BOOLEAN NOT NULL
  readonly probeStatus: DualSignalState             // 054 新增 CHECK 4 值
  readonly renderStatus: DualSignalState            // 054 新增 CHECK 4 值
  readonly latencyMs: number | null                 // 054 新增
  readonly lastProbedAt: string | null              // 054 新增
  readonly lastRenderedAt: string | null            // 054 新增
  readonly qualityDetected: ResolutionTier | null   // 059 新增 CHECK 7 值
  readonly qualitySource: QualitySource              // 059 新增 NOT NULL DEFAULT 'crawler' CHECK 4 值（v1.4 强化为 NOT NULL；schema 强制非空，types 同步收紧）
  readonly resolutionWidth: number | null           // 059 新增
  readonly resolutionHeight: number | null          // 059 新增
  readonly detectedAt: string | null                // 059 新增
  readonly lastChecked: string | null               // DB: last_checked TIMESTAMPTZ NULL
  readonly submittedBy: string | null               // DB: submitted_by UUID NULL
  readonly createdAt: string                        // DB: created_at TIMESTAMPTZ NOT NULL
}

// ── 暂存就绪检查（GET /admin/staging）─────────────────────────────────────────

export interface StagingReadinessCheck {
  readonly key: 'review_status' | 'lines_min' | 'cover' | 'douban' | 'signal'
  readonly label: string
  readonly value: string
  readonly ok: boolean
}

export interface StagingRow extends VideoQueueRow {
  readonly readiness: readonly StagingReadinessCheck[]
  readonly readinessOk: boolean
  readonly qualityHighest: ResolutionTier | null
}

// ── 端点 query / body 共享类型 ────────────────────────────────────────────────

export interface PendingQueueQuery {
  readonly cursor?: string
  readonly limit?: number
  readonly type?: string
  readonly sourceCheckStatus?: SourceCheckStatus
  readonly doubanStatus?: VideoQueueRow['doubanStatus']
  readonly hasStaffNote?: boolean
  readonly needsManualReview?: boolean
}

export interface RejectLabeledBody {
  readonly labelKey: string
  readonly reason?: string
}

export interface StaffNoteBody {
  readonly note: string | null
}

export interface SourcePatchBody {
  readonly isActive?: boolean
}

// ── 前台 player_feedback（apps/api /api/v1/feedback/playback；ADR-108）────────

export interface PlaybackFeedbackBody {
  readonly videoId: string
  readonly sourceId: string
  readonly success: boolean
  readonly resolutionWidth?: number
  readonly resolutionHeight?: number
  readonly bufferingCount?: number
  readonly errorCode?: string
}

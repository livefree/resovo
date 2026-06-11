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
  EnrichmentSummary, // ADR-170 / META-12-A AMENDMENT：审核台 VideoQueueRow 富集摘要
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

/**
 * CHG-360 / ADR-159 D-159-7：聚合 state 派生 helper — 跨前后端复用纯函数
 *
 * 规则（D-159-4）：
 *   total === 0          → 'pending'（占位 / 显示 "—" 灰色）
 *   ok === total > 0     → 'ok'      （全可用 / 绿色）
 *   ok === 0 && total > 0 → 'all_dead'（全失效 / 红色）
 *   其他 0 < ok < total  → 'partial' （黄色 / 显示 "X/Y"）
 */
export function deriveAggregateState(ok: number, total: number): DualSignalAggregate['state'] {
  if (total === 0) return 'pending'
  if (ok === total) return 'ok'
  if (ok === 0) return 'all_dead'
  return 'partial'
}

/**
 * CHG-360 / ADR-159：双轨信号 X/Y 聚合类型 — 用于「线路（多 episode）」/「视频（多线路）」聚合显示
 *
 * **使用场景**：仅用于多元素聚合（line: probe 多 episode；video: 多线路）；
 * 单 source 必须用 `DualSignalDisplayState` + `SignalChip`（X/Y 对 total=1 是类型污染）。
 *
 * 字段语义：
 * - total：聚合分母（Y）— 线路视图：episode 数 / 视频视图：DISTINCT (siteKey, sourceName) 线路数
 * - ok：聚合分子（X）— probe='ok' 或 render='ok' 的元素数（line 维度按 episode / video 维度按线路）
 * - state：派生展示状态，**严格复用 SourceCheckStatus 4 值**（与 videos.source_check_status 持久列同源 / arch-reviewer R1+A 决策）
 *
 * 与 DualSignalDisplayState（单值）双形态并存：单源 / 单值消费方仍用 string；聚合消费方用本对象 + DualSignalCount 组件渲染。
 */
export interface DualSignalAggregate {
  readonly total: number
  readonly ok: number
  /** 'pending' (total=0 或全 pending) | 'ok' (全 ok) | 'partial' (部分 ok) | 'all_dead' (全 dead) — 与 SourceCheckStatus 同源 */
  readonly state: 'pending' | 'ok' | 'partial' | 'all_dead'
}

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
 * 'manual_route_reprobe'：106 / SRCHEALTH-P2-4-A 运营线路级重探信号（不复用 feedback_driven，
 * 区分真实用户反馈与运营操作；API 侧 reprobeRoute 批量入队，worker 定向消费见 P2-4-B）。
 * 'admin_playback'：109 / ADR-198 admin 审核台真实播放反馈。成功直更 render/probe（不入此队列）；
 * 失败不直接置 dead（D-198-2 红线），改记本 origin + processed_at=NULL 作定向 recheck 信号，
 * 复用 feedback-driven-recheck worker 定向消费（D-198-8）。origin 列无 CHECK → 零列迁移。
 */
export type SourceHealthEventOriginWorker =
  | 'scheduled_probe'
  | 'render_check'
  | 'manual_recheck'
  | 'feedback_driven'
  | 'circuit_breaker'
  | 'manual_route_reprobe'
  | 'admin_playback'

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
  | 'home_module.create'
  | 'home_module.update'
  | 'home_module.delete'
  | 'home_module.reorder'
  | 'home_module.publish_toggle'
  | 'video.merge'
  | 'video.unmerge'
  | 'video.split'
  | 'source_line_alias.upsert'
  // CHG-SN-6-RETRO-3-A：v1 写端点 audit 补齐（ultrareview P0-3 / R-MID-1 系统化第 6 次）
  | 'system.cache_clear'         // DELETE /admin/cache/:type
  | 'system.settings_update'     // POST /admin/system/settings
  | 'system.config_update'       // POST /admin/system/config
  | 'system.sources_import'      // POST /admin/import/sources
  // CHG-SN-6-14：CrawlerSite v1 写端点 audit 补齐（R-MID-1 系统化第 8 次）
  | 'crawler_site.create'        // POST /admin/crawler/sites
  | 'crawler_site.update'        // PATCH /admin/crawler/sites/:key
  | 'crawler_site.delete'        // DELETE /admin/crawler/sites/:key
  | 'crawler_site.batch'         // POST /admin/crawler/sites/batch
  // CHG-SN-6-16-A：CrawlerRun 行操作 audit 补齐（R-MID-1 系统化第 9 次）
  | 'crawler_run.cancel'         // POST /admin/crawler/runs/:id/cancel
  | 'crawler_run.pause'          // POST /admin/crawler/runs/:id/pause
  | 'crawler_run.resume'         // POST /admin/crawler/runs/:id/resume

  // NTLG-P0-3 / ADR-191：统一任务控制端点（bull job / crawler run retry，crawler_run cancel 仍复用上面）
  | 'task.cancel'                // POST /admin/tasks/:id/cancel（bull job 取消）
  | 'task.retry'                 // POST /admin/tasks/:id/retry（bull job / crawler run 重试）

  // CHG-SN-6-20-A：全局采集冻结开关 audit 补齐（R-MID-1 系统化第 10 次）
  | 'crawler.freeze'             // POST /admin/crawler/freeze

  // CHG-SN-6-25-RETRO：autoCrawlConfig + stop-all audit 补齐（R-MID-1 系统化第 11 次）
  | 'crawler.auto_config'        // POST /admin/crawler/auto-config
  | 'crawler.stop_all'           // POST /admin/crawler/stop-all

  // CHG-SN-6-26-RETRO：reindex + runs 统一入口 audit 补齐（R-MID-1 系统化第 12 次）
  | 'crawler.reindex'            // POST /admin/crawler/reindex
  | 'crawler.run_create'         // POST /admin/crawler/runs
  // CHG-SN-7-REDO-01-E2 / ADR-117 AMENDMENT 2 2026-05-19：sources 域行级 3 mutations 合并 actionType
  | 'sources.route_action'       // POST/DELETE /admin/sources/routes/by-site/:siteKey/:sourceName[/test|/reprobe]
  // CHG-SN-7-REDO-01-F / ADR-123 2026-05-19：站点分类映射 PUT 全量替换 audit
  | 'crawler_site.category_mapping_update' // PUT /admin/crawler/sites/:key/category-mapping
  // CHG-SN-7-REDO-02-A / ADR-124 2026-05-19：用户投稿 4 路径合并 actionType
  | 'user_submission.action'               // POST /admin/user-submissions/:id/{process,reject} + batch-{process,reject}

  // CHG-SN-7-MISC-IMAGE-1 / ADR-135：图片健康 rescan + domain 切换 audit
  | 'image_health.rescan'         // POST /admin/image-health/rescan
  | 'image_health.switch_domain'  // POST /admin/image-health/switch-fallback-domain

  // CHG-SN-8-FUP-USERS-ROLE-INV-EP / ADR-139：admin 修改用户角色 audit（含 session invalidate 触发）
  | 'user.role_change'            // PATCH /admin/users/:id/role

  // CHG-SN-8-FUP-USERS-EDIT-EP / ADR-140：admin 改邮箱 + 编辑资料 audit
  | 'user.email_change'           // PATCH /admin/users/:id/email
  | 'user.profile_update'         // PATCH /admin/users/:id/profile

  // CHG-SN-8-FUP-AUDIT-ROLLBACK-EP / ADR-138：admin 通用回滚 audit（形成 audit-of-audit 追溯链）
  | 'system.audit_rollback'       // POST /admin/audit/logs/:id/rollback

  // CHG-SN-8-FUP-USERS-BAN-AUDIT：admin 封禁 / 解封用户 audit（R-MID-1 第 20 次系统化）
  | 'user.ban'                    // PATCH /admin/users/:id/ban
  | 'user.unban'                  // PATCH /admin/users/:id/unban

  // CHG-SN-8-FUP-PRESET-TEAM-EP-A / ADR-144：FilterPreset CRUD 审计（R-MID-1 第 21-23 次系统化）
  | 'filter_preset.create'        // POST /admin/filter-presets
  | 'filter_preset.update'        // PATCH /admin/filter-presets/:id
  | 'filter_preset.delete'        // DELETE /admin/filter-presets/:id

  // CHG-SN-8-FUP-VIDEO-MANUAL-ADD-EP-A / ADR-145：admin 手动添加视频（R-MID-1 第 24 次系统化）
  | 'video.manual_add'            // POST /admin/videos（targetKind 复用 'video'）

  // CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A / ADR-146：webhook 投递最终失败（R-MID-1 第 25 次系统化）
  | 'system.webhook_send_failed'  // WebhookDispatcher 4 次重试后最终失败（targetKind 复用 'system'）

  // CHG-SN-9-CW1-B-EP / ADR-151：task 级 cancel + batch cancel audit（R-MID-1 第 26 次系统化）
  | 'crawler_task.cancel'         // POST /admin/crawler/tasks/:id/cancel
  | 'crawler_task.batch_cancel'   // POST /admin/crawler/tasks/batch-cancel（targetKind 复用 'system'）

  // CHG-351-A / ADR-158：单源 inline probe + render-check 合并 actionType（R-MID-1 第 27 次系统化 / targetKind 复用 'video_source'）
  | 'video_source.inline_action'  // POST /admin/sources/:id/{probe,render-check}（afterJsonb.action 区分 'probe' / 'render_check'）

  // CHG-357 / ADR-158 AMENDMENT 2：视频级 batch probe + render-check 合并 actionType（R-MID-1 第 28 次 / targetKind 'video'）
  | 'video_source.batch_inline_action'  // POST /admin/videos/:videoId/sources/{batch-probe,batch-render-check}（afterJsonb.action 区分）

  // CHG-368-B-A2b / ADR-164 D-164-7：线路别名退役 + 优先级更新（R-MID-1 第 29-30 次系统化 / targetKind 复用 'source_line_alias'）
  | 'source_line_alias.retire'           // POST /admin/source-line-aliases/:siteKey/:sourceName/retire
  | 'source_line_alias.priority_update'  // PUT  /admin/source-line-aliases/:siteKey/:sourceName/priority

  // CHG-VIR-9-B / ADR-178 D-178-6：identity 候选人工拒绝（targetKind 'identity_candidate' / targetId=candidateId）
  | 'identity_candidate.reject'          // POST /admin/identity-candidates/:id/reject

  // CHG-VIR-13-C1 / ADR-179 D-179-5：rejected 候选人工复活（targetKind 复用 'identity_candidate' / targetId=原 candidateId）
  | 'identity_candidate.revive'          // POST /admin/identity-candidates/:id/revive

  // CHG-HOME-PREVIEW-API-A / ADR-182 D-182-5：Home Curation 区块操作 4 项
  // （targetKind 'home_section' / targetId = home_section_settings.id，seed 7 行恒存在）
  | 'home_section.settings_update'    // PATCH /admin/home/sections/:section/settings
  | 'home_section.apply_autofill'     // POST  /admin/home/sections/:section/apply-autofill（Phase 3 实装）
  | 'home_section.reorder'            // POST  /admin/home/sections/:section/reorder（Phase 2 实装；afterJsonb 必含 sectionKey+真源标识+ids，D-182-4.6）
  | 'home_section.refresh_candidates' // POST  /admin/home/sections/:section/refresh-candidates（Phase 3 实装）

  // CHG-HOME-DRAFT-PUBLISH-A / ADR-185 D-185-3.5：整页发布治理 2 项
  // （targetKind 'home_page' / targetId = home_publish_versions.id；afterJsonb 轻量摘要 D-185-4.1。
  // 与 ADR-138 行级 audit rollback 显式区分——版本回滚操作对象 = 配置三表整页，
  // 两 actionType 必须入 UNSUPPORTED_ACTION_TYPES（D-185-3.4，CHG-HOME-AUDIT-ROLLBACK 卡守卫））
  | 'home_page.publish'   // POST /admin/home/publish
  | 'home_page.rollback'  // POST /admin/home/versions/:versionNo/rollback（卡 26 实装）

export type AdminAuditTargetKind =
  | 'video'
  | 'video_source'
  | 'staging'
  | 'review_label'
  | 'crawler_site'
  | 'system'
  | 'home_module'
  | 'source_line_alias'
  | 'source_route'  // CHG-SN-7-REDO-01-E2 / ADR-117 AMENDMENT 2：sources 行级操作目标
  | 'user_submission'  // CHG-SN-7-REDO-02-A / ADR-124：用户投稿 4 类统一表
  | 'image_health'  // CHG-SN-7-MISC-IMAGE-1 / ADR-135：图片健康操作目标
  | 'user'  // CHG-SN-8-FUP-USERS-ROLE-INV-EP / ADR-139：admin 操作用户实体（role_change 等）
  | 'filter_preset'  // CHG-SN-8-FUP-PRESET-TEAM-EP-A / ADR-144：FilterPreset CRUD 目标（migration 072 CHECK 12→13）
  | 'crawler_task'   // CHG-SN-9-CW1-B-EP / ADR-151：task 级 cancel 目标（单点 / batch 用 'system'）
  | 'identity_candidate'  // CHG-VIR-9-B / ADR-178 D-178-6：identity 候选 reject 目标（migration 088 CHECK 14→15）
  | 'home_section'  // CHG-HOME-PREVIEW-API-A / ADR-182 D-182-5：Home Curation 区块操作目标（migration 095 CHECK 15→16；targetId = home_section_settings.id）
  | 'home_page'  // CHG-HOME-DRAFT-PUBLISH-A / ADR-185 D-185-3.5：整页发布/回滚目标（migration 097 CHECK 16→17；targetId = home_publish_versions.id）

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
  // ADR-160 D-160-7：admin preview URL 映射依赖 slug + shortId；与 Video.slug / Video.shortId 同源
  readonly slug: string | null
  readonly shortId: string
  readonly title: string
  readonly type: VideoType
  readonly year: number | null
  readonly country: string | null
  readonly episodeCount: number               // DB: episode_count INT NOT NULL DEFAULT 1（三层集数语义第 1 层 / 爬虫推算 / ADR-163 §3 D-163-2）
  /**
   * 三层集数语义第 2 层：作品总集数（外部 metadata 真源 / NULL=未取到或电影类型）
   * DB: videos.total_episodes INT NULL（Migration 078 / ADR-163 / CHG-367-B-A）
   * 写入路径：MetadataEnrichService 自动 enrich + DoubanService manual confirm（CHG-367-B-B）
   */
  readonly totalEpisodes: number | null
  /**
   * 三层集数语义第 3 层：当前已播集数（外部 metadata 真源 / NULL=未取到 / 连载中持续更新）
   * DB: videos.current_episodes INT NULL（Migration 078 / ADR-163 / CHG-367-B-A）
   */
  readonly currentEpisodes: number | null
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
  /**
   * CHG-360 / ADR-159：line-level X/Y 聚合（按 DISTINCT siteKey/sourceName 线路计数）
   *
   * **双字段并行策略**（arch-reviewer J2/R5）：与 probe / render 单值字段共存
   * - ModListRow / 新消费方：用 probeAggregate / renderAggregate + DualSignalCount 显示 "X/Y" + 黄色 partial
   * - DecisionCard.decideTone() / 其他单值消费方：继续用 probe / render（向后兼容 / 待 FOLLOWUP 卡逐个迁移后 deprecate）
   */
  readonly probeAggregate: DualSignalAggregate
  readonly renderAggregate: DualSignalAggregate
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
  // META-12-A / ADR-170 AMENDMENT：富集摘要派生投影（审核台徽标消费 / EnrichmentBadge）。
  // 由 listPendingQueue mapper 经 buildEnrichmentSummary 注入；additive 可选（旧路径/未注入时缺省）。
  readonly enrichmentSummary?: EnrichmentSummary
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
  readonly updatedAt: string                        // 061 新增：admin 写路径乐观锁版本字段（CHG-SN-5-PRE-01-C / DEBT-SN-4-05-A）
  readonly fbScore: number | null                   // 105 新增：EMA 平滑播放成功率 [0,1]；NULL=无样本（SRCHEALTH-P2-2）
  readonly fbSampleWeight: number | null            // 105 新增：EMA 有效样本权重；P3-2 消费须 COALESCE NULL→0（PG LEAST 忽略 NULL 陷阱）
  readonly lastFeedbackAt: string | null            // 105 新增：最近反馈时间（半衰 decay 基准）
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

// ── 富集状态枚举（MODUX-P3-1-A / item 3）────────────────────────────────────
//
// 审核台待审队列「富集完整度」过滤维度。**从 raw 字段/provenance 派生**，不按 UI
// EnrichmentSummary 反推（后者已默认填充 'pending'/0，会丢失"从未富集"信号）。
//
// 派生语义（raw 字段：videos.meta_quality->>'enriched_at' / videos.douban_status /
//   media_catalog.bangumi_subject_id / media_catalog.douban_id·tmdb_id·imdb_id）：
//   - complete：富集已运行且主源已匹配
//       enriched_at IS NOT NULL AND (douban_status='matched' OR bangumi_subject_id IS NOT NULL)
//   - missing：无任何富集痕迹
//       enriched_at IS NULL AND douban_id/tmdb_id/imdb_id/bangumi_subject_id 全 NULL
//   - partial：其余（有部分富集证据但主源未确认 / 主源匹配但无富集时间戳）
//   三态互斥穷尽。SQL 实现见 MODUX-P3-1-B（listPendingQueue WHERE）；同步 architecture.md。
export const ENRICHMENT_STATUSES = ['missing', 'partial', 'complete'] as const
export type EnrichmentStatus = typeof ENRICHMENT_STATUSES[number]

// ── 端点 query / body 共享类型 ────────────────────────────────────────────────

export interface PendingQueueQuery {
  readonly cursor?: string
  readonly limit?: number
  readonly type?: string
  readonly sourceCheckStatus?: SourceCheckStatus
  readonly doubanStatus?: VideoQueueRow['doubanStatus']
  readonly hasStaffNote?: boolean
  readonly needsManualReview?: boolean
  // MODUX-P3-1-A：年代 + 富集状态过滤（加性可选；DB 实现 = P3-1-B）
  /** 精确年份（mc.year = year）*/
  readonly year?: number
  /** 年代起始年（mc.year ∈ [decade, decade+10)，如 2020 → 2020s）*/
  readonly decade?: number
  readonly enrichmentStatus?: EnrichmentStatus
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
  /** 乐观锁；提供时 server 比对 video_sources.updated_at（CHG-SN-5-PRE-01-C / DEBT-SN-4-05-A）。 */
  readonly expectedUpdatedAt?: string
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

// ── ADR-124 / CHG-SN-7-REDO-02：user_submissions 4 类用户投稿 ──────

/**
 * spec §5.13 4 类 Segment 中的 3 类 type（"已处理"是 status=processed/rejected
 * 的查询视图，非 type 字段）。
 *   - bad_source：失效源举报（必填 source_id / 用户报告已有 source 失效）
 *   - wish_list：求片（video_id 可 NULL / 用户请求未入库视频）
 *   - metadata_correction：元数据纠错（必填 video_id / 用户报告视频元数据错误）
 */
export type UserSubmissionType = 'bad_source' | 'wish_list' | 'metadata_correction'

/** 状态机：pending（初始）→ processed（已处理）/ rejected（已拒绝）；CHECK 守卫 processed_at 同步 */
export type UserSubmissionStatus = 'pending' | 'processed' | 'rejected'

/**
 * 列表行（GET /admin/user-submissions）。
 * 字段命名 camelCase 与 ADR-117 既有 row 1 VideoGroupRow 同风格。
 *
 * metadata shape 按 type 不同（ADR-124 §Schema 设计末尾 zod 锁定）：
 *   - bad_source: { source_id, source_url?, last_played_at? }
 *   - wish_list: { title_zh?, year?, douban_id?, type? }
 *   - metadata_correction: { video_id, field, suggested_value }
 *
 * service 层 runtime 用 zod 校验 metadata 字段 shape；类型层保持 Record 兼容。
 */
export interface UserSubmissionRow {
  readonly id: string
  readonly type: UserSubmissionType
  readonly status: UserSubmissionStatus
  readonly videoId: string | null
  readonly sourceId: string | null
  readonly submittedBy: string
  readonly submittedByName: string | null     // JOIN users.username
  readonly quote: string                       // 1-2000 字符
  readonly metadata: Readonly<Record<string, unknown>> | null
  readonly videoTitle: string | null           // JOIN videos.title（求片可 NULL）
  readonly videoPosterUrl: string | null       // JOIN videos.poster_url（求片可 NULL）
  readonly sourceName: string | null           // JOIN video_sources.source_name（求片+纠错可 NULL）
  readonly sourceSiteKey: string | null        // JOIN video_sources.source_site_key
  readonly createdAt: string
  readonly processedAt: string | null
  readonly processedBy: string | null
  readonly processedReason: string | null
}

/**
 * GET /admin/user-submissions 响应信封（含 meta.badges 聚合 4 计数）。
 * badges 用于 4 Segment 头部数量徽章（spec §5.13 + screens-3.jsx:424-427）。
 */
export interface UserSubmissionListResp {
  readonly data: ReadonlyArray<UserSubmissionRow>
  readonly meta: {
    readonly total: number
    readonly page: number
    readonly limit: number
    readonly badges: {
      readonly bad_source: number               // status=pending AND type=bad_source
      readonly wish_list: number                // status=pending AND type=wish_list
      readonly metadata_correction: number      // status=pending AND type=metadata_correction
      readonly processed: number                // status IN (processed, rejected) 全量
    }
  }
}

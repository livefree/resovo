/**
 * video-merge.types.ts — video 合并/拆分业务类型（ADR-105 / CHG-SN-5-09/-10）
 */

import type { VideoType, ReviewStatus, VisibilityStatus } from './video.types'
import type { GroupIdentityScore } from './identity-evidence.types'

/** 候选组中单个 video 摘要 */
export interface VideoSummaryForMerge {
  readonly id: string
  readonly title: string
  readonly titleNormalized: string
  readonly year: number | null
  readonly type: VideoType
  readonly createdAt: string
  /** 该 video 的 source 数量 */
  readonly sourceCount: number
  /** 该 video 的去重 source_site_key 集合 */
  readonly sourceSiteKeys: readonly string[]
  // ── ADR-105 AMENDMENT 2026-06-04 D-105-7（CHG-VIR-13-B1）：对比矩阵数据契约 +7 optional ──
  // 全部 optional 纯增量（R-105-T4 旧消费方零破坏；不参与任何 filter/sort/分页/计数）
  /** 审核状态（VisChip 徽标 / 状态降级警示数据源） */
  readonly reviewStatus?: ReviewStatus
  /** 可见性状态 */
  readonly visibilityStatus?: VisibilityStatus
  /** 作品层 catalog id（migration 029 后 NOT NULL） */
  readonly catalogId?: string
  /** catalog 展示标题（mc.title） */
  readonly catalogTitle?: string
  /** 集数范围（video_sources MIN/MAX episode_number；无源时 min/max 均 null） */
  readonly episodeRange?: { readonly min: number | null; readonly max: number | null }
  /** 已确认外部 ID（video_external_refs 仅 is_primary + manual_confirmed/auto_matched；每 provider 至多 1 条 / Y-105-T1） */
  readonly externalIds?: readonly { readonly provider: string; readonly externalId: string }[]
  /** 封面（真源 = media_catalog.cover_url / Y-105-T2；缺失 null 由前端 FallbackCover 链兜底） */
  readonly coverUrl?: string | null
}

/**
 * 合并候选组（按 title_normalized + year + type 三元组聚合，HAVING COUNT > 1）
 *
 * score = source_overlap_ratio ∈ [0, 1]：
 *   共享 source_site_key（出现在 ≥2 个 video 中的 key）数 / 组内总 unique key 数
 *   ADR-105 §4 评分函数 v1（基线）
 */
export interface CandidateGroup {
  readonly groupKey: string           // `${titleNormalized}|${year ?? ''}|${type}` 唯一标识
  readonly titleNormalized: string
  readonly year: number | null
  readonly type: VideoType
  readonly videos: readonly VideoSummaryForMerge[]
  /** source_overlap_ratio ∈ [0, 1]（legacyScore / ADR-105 v1 排序口径） */
  readonly score: number
  /** 推荐合并目标：source 最多的 video，同等时取最早 createdAt */
  readonly recommendedTargetVideoId: string
  /**
   * ADR-105a D-105a-6/9/15：多证据身份评分（与 legacyScore=`score` 字段分离 / 红线 R3）。
   * Phase 2a（CHG-VIR-7）新增展示字段，**不参与排序/计数/分页**（D-105a-15 黄线 b1）；
   * optional 兼容旧消费方 + 评分异常时可省略而不破坏候选行返回。
   */
  readonly identity?: GroupIdentityScore
  /**
   * CHG-VIR-9-C：identity_candidate.id（source=identity 时填充 / legacy 来源不填）。
   * UI confirm（merge 透传 candidateId / ADR-178 D-178-3）与 reject 操作锚点；
   * 纯增量 optional，沿 9-A SimilarVideoItem.candidateId 同款模式向后兼容。
   * CHG-VIR-9-D：折叠后 N>2 group 含多 pair 时不填（改用 candidateIds），N=2 单 pair 时保留填充。
   */
  readonly candidateId?: string
  /**
   * CHG-VIR-9-D / D-105a-18：折叠后该连通分量内全部 pending pair 的 identity_candidate.id
   * （source=identity 时填充）。merge 整组 confirm 时透传给 MergeParams.candidateIds。
   */
  readonly candidateIds?: readonly string[]
}

export interface ListCandidatesParams {
  readonly type?: VideoType
  readonly minScore: number
  readonly limit: number
  readonly page: number
  /**
   * ADR-150 阶段 5 EP-4 follow-up（2026-05-25）：Merge 候选表 sort 全栈打通
   * Service 层 sort 范式（score 是 Service 派生 / DB 无该字段）/ 跨页不严格稳定（pre-existing 设计局限）
   * ADR-105a AMENDMENT 2026-06-05 D-105a-19（CHG-VIR-16-TBL）：白名单扩 identityScore
   * （identity 路径缺省 identityScore DESC；identity 路径不支持 score〔legacyScore〕排序，忽略走缺省）
   */
  readonly sortField?: 'score' | 'videoCount' | 'year' | 'titleNormalized' | 'identityScore'
  readonly sortDir?: 'asc' | 'desc'
  /**
   * CHG-VIR-9-A：候选来源。`legacy`（默认）=实时 group-by（ADR-105 v1）；
   * `identity`=读 identity_candidate（多证据候选，空表自动降级 legacy）。
   */
  readonly source?: 'identity' | 'legacy'
  /**
   * ADR-105a AMENDMENT 2026-06-05 D-105a-19（CHG-VIR-16-TBL）：组级筛选 + 标题搜索。
   * 相似度区间（组分 = min over pair identity_score，0..1）/ 候选数区间（折叠后成员数 ≥2）/
   * q = 组任一成员标题双口径 contains（title lower-case 为主 + normalizeMergeKey(q)/title_normalized 辅召回）。
   * identity 路径全量折叠后组级精确；legacy 降级路径页内近似（已登记，与 minScore 同源同阶）。
   */
  readonly identityScoreMin?: number
  readonly identityScoreMax?: number
  readonly videoCountMin?: number
  readonly videoCountMax?: number
  readonly q?: string
}

export interface ListCandidatesResult {
  readonly data: readonly CandidateGroup[]
  readonly total: number
  readonly page: number
  readonly limit: number
  /** 回显实际使用来源（identity 空表降级时为 legacy / CHG-VIR-9-A）。 */
  readonly source?: 'identity' | 'legacy'
  /**
   * ADR-105a AMENDMENT 2026-06-05 D-105a-19：identity 路径 pending pair 超 cap（2000）截断时 true
   * （仅最高分前 cap 对参与折叠 + 闭包补全；UI 警示条消费）。非截断态与 legacy 路径不填。
   */
  readonly truncated?: boolean
}

// ── CHG-SN-5-10：mutation 端点类型 ───────────────────────────────────

// ── ADR-105 AMENDMENT 2026-06-04 D-105-9/10（CHG-VIR-13-D1）：操作内状态设置 ──

/**
 * merge/split 操作内状态设置（D-105-9）。两维全 optional：缺省维度取 current 值
 * （归一化后 (current, desired) 二元组 → action 覆盖矩阵推导，矩阵 = 实施真源
 * `VideoMergesService.status-helpers.ts`；无合法单步路径 → 422 / BEGIN 前）。
 */
export interface VideoStatusSetting {
  readonly reviewStatus?: ReviewStatus
  readonly visibilityStatus?: VisibilityStatus
}

/**
 * post-COMMIT 状态写入结果（D-105-10 非原子边界可观测 / R-105-T3）：
 * applied = 状态机成功；failed = transition 失败（merge/split 本身**不回滚**，
 * UI 提示「操作成功，状态未变更，请在审核台手动调整」）；skipped = current == desired no-op。
 */
export type StatusTransitionOutcome = 'applied' | 'failed' | 'skipped'

export interface MergeParams {
  readonly sourceVideoIds: string[]
  readonly targetVideoId: string
  readonly reason?: string
  /**
   * D-105-9（CHG-VIR-13-D1）：合并后对 target 的状态设置。缺省零行为变更（R-105-T1）；
   * 提供时 BEGIN 前矩阵校验（非法组合 422），COMMIT 后经 transitionVideoState 应用
   * （唯一状态通道 R-105-T2），实际将 apply 时事务内 snapshot 写 targetStatusBefore（D-105-11）。
   */
  readonly targetStatus?: VideoStatusSetting
  /**
   * CHG-VIR-9-B / ADR-178 D-178-3：关联 identity_candidate（confirmed→merge 单事务 / R8）。
   * 提供时事务前校验 candidate pending + pair⊆合并集合，事务内挂 decision(confirmed)+candidate confirmed；
   * 缺省时 merge 行为逐值不变（主路径零变更）。
   * @deprecated CHG-VIR-9-D：新消费方用 candidateIds（数组）；单数保留向后兼容，二者互斥。
   */
  readonly candidateId?: string
  /**
   * CHG-VIR-9-D / D-105a-18：折叠组 confirm——该连通分量全部 pending pair 的 candidate id。
   * 事务内循环挂 K 个 decision(confirmed) 同一 audit_id；与 candidateId（单数）互斥。
   * cap = C(11,2) = 55（merge 集合上限 11 视频的完全图 pair 数 / Codex review FIX）。
   */
  readonly candidateIds?: readonly string[]
}

export interface MergeResult {
  readonly auditId: string
  // ADR-105 §端点契约 row 2：返回合并后 target 完整摘要（含 sourceCount/sourceSiteKeys 反映新状态）
  readonly targetVideo: VideoSummaryForMerge
  /** D-105-10：仅请求携带 targetStatus 时出现（R-105-T1 缺省响应逐值不变）。 */
  readonly statusTransition?: StatusTransitionOutcome
  /** D-105-16（CHG-MERGE-DEDUP-EP）：实际去重条数（重复 (episode_number, source_url) 软删取并集；>0 时透出 / R-105-D4 纯增量）。 */
  readonly dedupedCount?: number
}

export interface UnmergeParams {
  readonly auditId: string
  readonly actorId: string
  readonly reason?: string
}

export interface UnmergeResult {
  readonly restoredVideoIds: string[]
  /**
   * D-105-11：仅 merge audit 的 snapshot 含 targetStatusBefore 时出现（存量 audit 无该
   * 字段 → 不动且省略，旧行为逐值一致）。还原同走 (current, before) 矩阵：合并后状态
   * 被人工改至无单步回路时 failed（非原子声明，人工兜底）。
   */
  readonly statusTransition?: StatusTransitionOutcome
}

export interface SplitGroup {
  readonly sourceIds: string[]
  /**
   * 拆到新建 video 的元数据。ADR-105 AMENDMENT 2026-06-03（D-105-2）起与
   * `targetVideoId` **恰一互斥**（旧请求体全组 newVideoMeta 完全兼容）。
   */
  readonly newVideoMeta?: {
    readonly title: string
    readonly year?: number
    readonly type: VideoType
    /**
     * D-105-9（CHG-VIR-13-D1）：新建 video 的状态设置。current 恒 pending_review|internal
     * （insertNewVideo DB DEFAULT / migration 016），矩阵退化为 pending 行。
     * 拆到已有 targetVideoId 组结构上不可携带（newVideoMeta xor targetVideoId / R-105-T5）。
     */
    readonly status?: VideoStatusSetting
  }
  /**
   * 拆到已有 video（D-105-2）：仅转入 sources，不改已有 video 任何元数据（D-105-5 / R-105-S3）。
   * 约束：≠ 被拆 videoId / 组间互不重复 / 存在且未软删 / 冲突预检（D-105-3）。
   */
  readonly targetVideoId?: string
}

// ADR-105 §端点契约 row 4 Body 仅 { groups }，无 reason；保持类型与协议一致
export interface SplitParams {
  readonly videoId: string
  readonly groups: readonly SplitGroup[]
}

export interface SplitResult {
  readonly auditId: string
  /** 本次 split **新建**的 video ids（拆到已有 video 的组不在内 / D-105-4 created_target_video_ids 同源） */
  readonly newVideoIds: string[]
  /**
   * D-105-10：仅至少一组携带 newVideoMeta.status 时出现；数组仅含携带 status 的新建 video
   * （未携带组无 transition 意图，不产 skipped 条目）。
   */
  readonly statusTransition?: readonly { readonly videoId: string; readonly result: StatusTransitionOutcome }[]
  /** D-105-16（CHG-MERGE-DEDUP-EP）：拆到已有 video 转入去重条数（>0 时透出）。 */
  readonly dedupedCount?: number
}

// ── ADR-105 AMENDMENT 2026-06-03（CHG-VIR-11 / Phase 4 拆分证据化）─────────
// GET /admin/videos/:id/split-suggestions 响应契约（D-105-1）。
// sourceSiteKey/sourceName 为非空 string（R-105-S9：与 LineMatrixRow 真源同口径，
// 线路键 = (COALESCE(source_site_key, videos.site_key), source_name) 与 getVideoMatrix 逐字一致）。

/** 拆分建议分组维度（确定性单维，优先级 core_title_key > season > release_marker > edition） */
export type SplitSuggestionDimension = 'core_title_key' | 'season' | 'release_marker' | 'edition'

/** 单条线路（= getVideoMatrix 的 (siteKey, sourceName) 行，line 粒度不丢） */
export interface SplitSuggestionLine {
  /** COALESCE(source_site_key, videos.site_key) 后非空（'' 兜底与 LineMatrixRow 同口径） */
  readonly sourceSiteKey: string
  /** video_sources.source_name NOT NULL */
  readonly sourceName: string
  /** 该线路全部 video_sources.id */
  readonly sourceIds: readonly string[]
  readonly episodeRange: { readonly min: number | null; readonly max: number | null }
  /** 所属 site 观测 top-K 展示（observed_count 降序） */
  readonly observedTitles: readonly { readonly rawTitle: string; readonly observedCount: number }[]
}

export interface SplitSuggestionGroup {
  /** 确定性：`${dimension}:${facetValue}` */
  readonly groupKey: string
  /** 维度值（season → '2'；core_title_key → key 本身） */
  readonly facetValue: string
  readonly lines: readonly SplitSuggestionLine[]
  /** 预填 newVideoMeta（year 不预填 / D-105-1；title = dominant raw_title，可含源站噪声 Y-105-S4） */
  readonly suggestedMeta: { readonly title: string; readonly type: VideoType }
}

/** video 级拆分信号（不参与线路归组） */
export type SplitSignal =
  | { readonly kind: 'external_id_conflict'; readonly providers: readonly string[] }
  | { readonly kind: 'episode_overlap'; readonly lineKeys: readonly string[] }
  /** site 内多标题盲区提示（同 site 线路必然同组，site 内多作品须人工核查 / 第 2 轮 advisory-strong） */
  | { readonly kind: 'intra_site_multi_title'; readonly siteKey: string }
  | {
      readonly kind: 'multi_core_title' | 'multi_season' | 'multi_release_marker' | 'multi_edition'
      readonly values: readonly string[]
    }

export interface SplitSuggestionsResult {
  readonly videoId: string
  /** groups.length >= 2 */
  readonly suggestible: boolean
  readonly dimension: SplitSuggestionDimension | null
  readonly signals: readonly SplitSignal[]
  readonly groups: readonly SplitSuggestionGroup[]
  /** 无观测 / 维度 facet 缺失的线路（留运营手动，禁止猜测归组 / R-105-S2） */
  readonly unassignedLines: readonly SplitSuggestionLine[]
}

/** video_merge_audit 行（Service 层内部用） */
export interface VideoMergeAuditRow {
  readonly id: string
  readonly action: 'merge' | 'split'
  readonly sourceVideoIds: string[]
  readonly targetVideoIds: string[]
  readonly snapshotJsonb: Record<string, unknown>
  readonly performedBy: string
  readonly reason: string | null
  readonly performedAt: string
  readonly revertedAt: string | null
  readonly revertedBy: string | null
  readonly revertedReason: string | null
}

// ── CHG-SN-6-AUDIT-TIMELINE (RETRO 4/7) — GET /admin/video-merges/audit ─────────

/** audit timeline row（GET 端点返回；ADR-105 AMENDMENT 2026-05-14）*/
export interface MergeAuditRow {
  readonly id: string
  readonly action: 'merge' | 'split'
  readonly sourceVideoIds: readonly string[]
  readonly targetVideoIds: readonly string[]
  readonly performedBy: string
  readonly performedByUsername: string | null  // LEFT JOIN users.username
  readonly reason: string | null
  readonly performedAt: string
  readonly revertedAt: string | null
  readonly revertedBy: string | null
  readonly revertedReason: string | null
  // ── ADR-105 AMENDMENT 2026-06-04 D-105-8（CHG-VIR-13-C2）：+4 optional ──
  // 全部 optional 纯增量（R-105-T4 旧消费方零破坏；列表数量/排序/分页/计数逐值不变）
  /** 关联 identity_decisions.actor_type 透出（同 audit 多 decision 恒同 actor 取任一）；无关联 decision → 'human' */
  readonly actorType?: 'human' | 'system'
  /** 经 idx_identity_decision_audit 批量反查（页内单 SQL ANY 零 N+1 / Y-105-T3） */
  readonly relatedCandidateIds?: readonly string[]
  readonly relatedDecisionIds?: readonly string[]
  /** source 标题取 snapshot_jsonb.videos[].title（软删唯一可靠源，缺失兜底「(已删除视频)」）；target 实时 JOIN */
  readonly videoTitlesSnapshot?: readonly { readonly videoId: string; readonly title: string }[]
}

export interface ListAuditParams {
  readonly action?: 'merge' | 'split'
  readonly videoId?: string
  readonly limit: number
  readonly page: number
}

export interface ListAuditResult {
  readonly data: readonly MergeAuditRow[]
  readonly total: number
  readonly page: number
  readonly limit: number
}

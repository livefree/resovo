/**
 * HomeCurationService.ts — Home Curation 聚合层（ADR-182 D-182-1）
 *
 * 分层：Route → 本 Service → home-section-settings / home-autofill-snapshots /
 * home-modules / home-banners queries。端点 #1–#7 全量承载（ADR-182 7 端点）。
 * zod schemas → home-curation.schemas.ts；preview 聚合 → home-curation.preview.ts
 * （+卡片纯函数 home-curation.preview-cards.ts；file-size-budget 500 行硬限拆分）。
 */

import type { z } from 'zod'
import type { Pool } from 'pg'
import {
  HOME_SECTION_KEYS,
  type AutofillCandidatesResult,
  type HomeModule,
  type HomePreview,
  type HomeSectionKey,
  type HomeSectionSettings,
  type HomeSectionSummary,
} from '@resovo/types'
import {
  listHomeSectionSettings,
  findHomeSectionSettings,
  updateHomeSectionSettings,
  countPinnedBySection,
} from '@/api/db/queries/home-section-settings'
import {
  findLatestHomeAutofillSnapshot,
  listLatestSnapshotSummaries,
} from '@/api/db/queries/home-autofill-snapshots'
import { findBannerById, updateBannerSortOrders } from '@/api/db/queries/home-banners'
import {
  listAdminHomeModules,
  findHomeModuleById,
  reorderHomeModules,
  insertPinnedHomeModulesBatch,
} from '@/api/db/queries/home-modules'
import { listVideoCardsByIds } from '@/api/db/queries/videos.status'
import { homeAutofillQueue } from '@/api/lib/queue'
import { AuditLogService } from '@/api/services/AuditLogService'
import { AppError } from '@/api/lib/errors'
import {
  SectionParamSchema,
  UpdateSectionSettingsSchema,
  ReorderSectionSchema,
  PreviewQuerySchema,
  CandidatesQuerySchema,
  ApplyAutofillSchema,
} from '@/api/services/home-curation.schemas'
import { buildHomePreview } from '@/api/services/home-curation.preview'

// route 层既有消费入口保持单点（本文件 re-export schemas）
export {
  SectionParamSchema,
  UpdateSectionSettingsSchema,
  ReorderSectionSchema,
  PreviewQuerySchema,
  CandidatesQuerySchema,
  ApplyAutofillSchema,
}

// ── Service ───────────────────────────────────────────────────────

export class HomeCurationService {
  private readonly auditSvc: AuditLogService

  constructor(private readonly db: Pool) {
    this.auditSvc = new AuditLogService(db)
  }

  /**
   * 端点 #2：7 区块 settings 全量 + 状态摘要（D-182-4 #2）。
   * 快照摘要与端点 #4 snapshotAt 同语义同源（null 一致表示未生成）。
   * 输出按 HOME_SECTION_KEYS 枚举序（前台渲染顺序），非 DB 字典序。
   */
  async listSectionSummaries(): Promise<HomeSectionSummary[]> {
    const [settingsRows, pinnedCounts, snapshotSummaries] = await Promise.all([
      listHomeSectionSettings(this.db),
      countPinnedBySection(this.db),
      listLatestSnapshotSummaries(this.db),
    ])
    const bySection = new Map(settingsRows.map((s) => [s.section, s]))

    const summaries: HomeSectionSummary[] = []
    for (const key of HOME_SECTION_KEYS) {
      const settings = bySection.get(key)
      // seed 7 行恒存在（migration 095）；缺行 = 迁移漂移，跳过并由消费端按缺失处理
      if (!settings) continue
      const snapshot = snapshotSummaries[key]
      summaries.push({
        settings,
        pinnedCount: pinnedCounts[key] ?? 0,
        lastSnapshotAt: snapshot?.generatedAt ?? null,
        candidateCount: snapshot?.candidateCount ?? null,
        // D-182-6.2：type_shortcuts 前台静态 ALL_CATEGORIES 暂未消费此配置
        frontendWired: key !== 'type_shortcuts',
      })
    }
    return summaries
  }

  /**
   * 端点 #4：读取候选快照（只读消费，D-182-4.4 / ADR-183 D-183-2）。
   * 快照未生成 → 200 空数组 + snapshotAt/policyVersion null（非 404——section 存在即合法）。
   * include_filtered=false 时剔除 filtered 条目；=true 时附 gaps（D-183-7.3 additive）。
   * 不透出跨区块占用状态（D-183-6：占用结果以 preview 端点 #1 聚合权威为准）。
   * @returns null = section settings 行缺失（迁移漂移兜底 404）
   */
  async listAutofillCandidates(
    section: HomeSectionKey,
    query: z.infer<typeof CandidatesQuerySchema>,
  ): Promise<AutofillCandidatesResult | null> {
    const settings = await findHomeSectionSettings(this.db, section)
    if (!settings) return null

    const snapshot = await findLatestHomeAutofillSnapshot(this.db, section)
    if (!snapshot) {
      return { candidates: [], snapshotAt: null, policyVersion: null }
    }

    // appliedAt 派生（CHG-HOME-AUTOFILL-APPLY）：快照不可变不回写——由当前 slot
    // pinned 行 content_ref_id 匹配派生（值 = 行 created_at）。banner 真源非
    // home_modules（D-181-1），跳过派生。
    const appliedAtByVideoId = section === 'banner'
      ? new Map<string, string>()
      : await this.loadAppliedAtMap(section)

    const candidates = (query.include_filtered
      ? snapshot.candidates
      : snapshot.candidates.filter((c) => !c.filtered)
    ).slice(0, query.limit).map((c) => {
      const appliedAt = appliedAtByVideoId.get(c.videoId)
      return appliedAt ? { ...c, appliedAt } : c
    })

    return {
      candidates,
      snapshotAt: snapshot.generatedAt,
      policyVersion: snapshot.policyVersion,
      ...(query.include_filtered ? { gaps: snapshot.gaps } : {}),
    }
  }

  /** 当前 slot pinned video 行 → videoId → created_at（appliedAt 派生源） */
  private async loadAppliedAtMap(section: HomeSectionKey): Promise<Map<string, string>> {
    const { rows } = await listAdminHomeModules(this.db, { slot: section, page: 1, limit: 500 })
    return new Map(
      rows.filter((m) => m.contentRefType === 'video').map((m) => [m.contentRefId, m.createdAt]),
    )
  }

  /**
   * 端点 #5：候选转 pinned（D-182-4.5）。
   * 应用前逐候选**重校验**可见性/可播放性（方案 §12，快照可能已过时）；任一候选
   * 失效 → 整体 409 STATE_CONFLICT 携失效 candidateIds（全有或全无，零写入）；
   * 同 video 已 pinned 同属状态冲突（重复应用）。写入走单事务批量插入
   * （insertPinnedHomeModulesBatch，reorder 同款 BEGIN/COMMIT 范式）。
   * banner section 不直接写 home_banners 亦不写冻结 banner slot（D-181-1）→ 422
   * 指引编辑器（候选预填 UI 归 AUTOFILL-UI 候补卡）。
   * audit `home_section.apply_autofill`（afterJsonb：moduleIds + 候选来源 + policyVersion）。
   *
   * @throws AppError VALIDATION_ERROR 422 — banner section / pinnedLimit 超限
   * @throws AppError STATE_CONFLICT 409 — 候选缺失/失效/已应用（message 携 ids）
   * @returns null = section settings 行缺失（迁移漂移兜底 404）
   */
  async applyAutofill(
    section: HomeSectionKey,
    params: z.infer<typeof ApplyAutofillSchema>,
    actorId: string,
    requestId?: string,
  ): Promise<{ applied: number; modules: HomeModule[] } | null> {
    const settings = await findHomeSectionSettings(this.db, section)
    if (!settings) return null

    if (section === 'banner') {
      // D-182-4.5：Hero 内容创建统一经 banner 编辑器人工确认，自动链路不得静默写入
      throw new AppError(
        'VALIDATION_ERROR',
        'banner 候选不可直接应用——请经 Banner 编辑器人工确认创建（D-181-1 真源约束）',
        422,
      )
    }

    const snapshot = await findLatestHomeAutofillSnapshot(this.db, section)
    if (!snapshot) {
      throw new AppError(
        'STATE_CONFLICT',
        `候选快照未生成，无可应用候选：${params.candidateIds.join(', ')}`,
        409,
      )
    }

    // 定位候选（快照轮换后旧 id 失效 → 409）
    const byId = new Map(snapshot.candidates.map((c) => [c.id, c]))
    const missing = params.candidateIds.filter((id) => !byId.has(id))
    if (missing.length > 0) {
      throw new AppError(
        'STATE_CONFLICT',
        `候选不存在或快照已轮换：${missing.join(', ')}`,
        409,
      )
    }
    const picked = params.candidateIds.map((id) => byId.get(id)!)

    // 重校验①：可见性（listVideoCardsByIds 仅返回 published+public+未删行）+ 可播性
    const cards = await listVideoCardsByIds(this.db, picked.map((c) => c.videoId))
    const cardById = new Map(cards.map((v) => [v.id, v]))
    const invalid = picked.filter((c) => {
      const card = cardById.get(c.videoId)
      return !card || card.sourceCount === 0
    })
    if (invalid.length > 0) {
      throw new AppError(
        'STATE_CONFLICT',
        `候选已失效（不可见或无可播源）：${invalid.map((c) => c.id).join(', ')}`,
        409,
      )
    }

    // 重校验②：同 slot 已 pinned 同 video = 重复应用（状态冲突）
    const appliedMap = await this.loadAppliedAtMap(section)
    const duplicated = picked.filter((c) => appliedMap.has(c.videoId))
    if (duplicated.length > 0) {
      throw new AppError(
        'STATE_CONFLICT',
        `候选已应用为 pinned：${duplicated.map((c) => c.id).join(', ')}`,
        409,
      )
    }

    // pinnedLimit 超限防护（D-182-3 语义，实施级推演：apply 不得突破 pinned 头部上限）
    if (settings.pinnedLimit != null && appliedMap.size + picked.length > settings.pinnedLimit) {
      throw new AppError(
        'VALIDATION_ERROR',
        `应用后 pinned 数（${appliedMap.size + picked.length}）超过区块上限 ${settings.pinnedLimit}`,
        422,
      )
    }

    // 全有或全无：单事务批量插入（slot = section，SLOT-EXTEND 已落地 hot_*）
    const modules = await insertPinnedHomeModulesBatch(
      this.db,
      section as HomeModule['slot'],
      picked.map((c) => c.videoId),
    )

    this.auditSvc.write({
      actorId,
      actionType: 'home_section.apply_autofill',
      targetKind: 'home_section',
      targetId: settings.id, // D-182-5.3：锚定 settings 行 id
      beforeJsonb: null,
      // D-182-4.5 载荷：创建的 module ids + 候选来源 + policyVersion
      afterJsonb: {
        sectionKey: section,
        moduleIds: modules.map((m) => m.id),
        candidateIds: params.candidateIds,
        origins: [...new Set(picked.map((c) => c.origin))],
        policyVersion: snapshot.policyVersion,
      },
      requestId: requestId ?? null,
    })

    return { applied: modules.length, modules }
  }

  /**
   * 端点 #3：更新区块设置 + audit `home_section.settings_update`（before/after 全行快照）。
   * @returns null = section settings 行缺失（迁移漂移兜底 404）
   */
  async updateSettings(
    section: HomeSectionKey,
    input: z.infer<typeof UpdateSectionSettingsSchema>,
    actorId: string,
    requestId?: string,
  ): Promise<HomeSectionSettings | null> {
    const before = await findHomeSectionSettings(this.db, section)
    if (!before) return null

    const after = await updateHomeSectionSettings(this.db, section, {
      autofillMode: input.autofillMode as HomeSectionSettings['autofillMode'] | undefined,
      refreshIntervalMinutes: input.refreshIntervalMinutes,
      displayCount: input.displayCount,
      allowDuplicates: input.allowDuplicates,
      pinnedLimit: input.pinnedLimit,
      settings: input.settings,
    })
    if (!after) return null

    this.auditSvc.write({
      actorId,
      actionType: 'home_section.settings_update',
      targetKind: 'home_section',
      targetId: before.id, // D-182-5.3：锚定 settings 行 id（section key 非 UUID）
      beforeJsonb: before as unknown as Record<string, unknown>,
      afterJsonb: after as unknown as Record<string, unknown>,
      requestId: requestId ?? null,
    })

    return after
  }

  /**
   * 端点 #6：区块内排序门面（画布唯一排序路径，D-182-4 #6）。
   * 按 section 分派真源：banner → `home_banners.sort_order`；其余 → `home_modules.ordering`
   * （slot = section key）。**直调 queries 不经资源级 Service**——避免嵌套触发
   * `home_module.reorder` 二次记录（D-182-4.6 有意裁定：home_modules 排序历史回溯须
   * 联合 `home_module.reorder` ∪ `home_section.reorder` 两 actionType 查询）。
   * banner 排序经本门面**首次获得审计覆盖**（v1 legacy PATCH /admin/banners/reorder 无 audit）。
   *
   * @throws AppError VALIDATION_ERROR 422 — items 中 id 不属于该 section 真源
   * @returns null = section settings 行缺失（迁移漂移兜底 404）
   */
  async reorderSection(
    section: HomeSectionKey,
    params: z.infer<typeof ReorderSectionSchema>,
    actorId: string,
    requestId?: string,
  ): Promise<{ updated: number } | null> {
    // targetId 锚定 settings 行 id（D-182-5.3：section key 非 UUID，不可作 target_id）
    const settings = await findHomeSectionSettings(this.db, section)
    if (!settings) return null

    const ids = params.items.map((i) => i.id)

    if (section === 'banner') {
      // banner section 真源 = home_banners（D-181-1；冻结存量 home_modules banner 行不属本真源）
      const rows = await Promise.all(ids.map((id) => findBannerById(this.db, id)))
      const byId = new Map(rows.flatMap((r) => (r ? [[r.id, r] as const] : [])))
      const invalid = ids.filter((id) => !byId.has(id))
      if (invalid.length > 0) {
        throw new AppError(
          'VALIDATION_ERROR',
          `id 不属于 banner 区块真源 home_banners：${invalid.join(', ')}`,
          422,
        )
      }
      // R-MID-1：before 取 DB 原值（入参回写无取证价值）
      const beforeItems = params.items.map((i) => ({ id: i.id, ordering: byId.get(i.id)!.sortOrder }))
      const updated = await updateBannerSortOrders(
        this.db,
        params.items.map((i) => ({ id: i.id, sortOrder: i.ordering })),
      )
      this.writeReorderAudit(section, 'home_banners', settings.id, beforeItems, params.items, actorId, requestId)
      return { updated }
    }

    const rows = await Promise.all(ids.map((id) => findHomeModuleById(this.db, id)))
    const byId = new Map(rows.flatMap((r) => (r ? [[r.id, r] as const] : [])))
    const invalid = ids.filter((id) => byId.get(id)?.slot !== section)
    if (invalid.length > 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        `id 不属于 ${section} 区块真源 home_modules(slot=${section})：${invalid.join(', ')}`,
        422,
      )
    }
    const beforeItems = params.items.map((i) => ({ id: i.id, ordering: byId.get(i.id)!.ordering }))
    const updated = await reorderHomeModules(this.db, params.items)
    this.writeReorderAudit(section, 'home_modules', settings.id, beforeItems, params.items, actorId, requestId)
    return { updated }
  }

  /**
   * 端点 #7：手动触发候选重算入队（D-182-4.7 / ADR-183 D-183-3.3）。
   * 429 判定 = **主动检查** getJob+getState（不得依赖 add() 去重副作用——add 命中
   * 幂等键不抛错，端点拿不到信号）；入队失败异常上抛 → 500 不静默（D-183-3.6）。
   * audit `home_section.refresh_candidates`（轻量：afterJsonb 仅 { section, enqueuedAt }）。
   */
  async refreshCandidates(
    section: HomeSectionKey,
    actorId: string,
    requestId?: string,
  ): Promise<'not_found' | 'manual_only' | 'already_queued' | { enqueuedAt: string }> {
    const settings = await findHomeSectionSettings(this.db, section)
    if (!settings) return 'not_found'
    // manual_only 无候选可算（D-182-4.7）
    if (settings.autofillMode === 'manual_only') return 'manual_only'

    const jobId = `autofill:${section}`
    const existing = await homeAutofillQueue.getJob(jobId)
    if (existing) {
      const state = await existing.getState()
      if (state === 'active' || state === 'waiting' || state === 'delayed') {
        return 'already_queued'
      }
    }

    // per-add removeOnComplete/removeOnFail: true 释放 jobId（定频重入前提，D-183-3.3）
    await homeAutofillQueue.add(
      { kind: 'recalculate', section, trigger: 'manual' },
      { jobId, removeOnComplete: true, removeOnFail: true },
    )

    const enqueuedAt = new Date().toISOString()
    this.auditSvc.write({
      actorId,
      actionType: 'home_section.refresh_candidates',
      targetKind: 'home_section',
      targetId: settings.id, // D-182-5.3：锚定 settings 行 id
      beforeJsonb: null,
      afterJsonb: { section, enqueuedAt },
      requestId: requestId ?? null,
    })
    return { enqueuedAt }
  }

  /** audit `home_section.reorder`（D-182-4.6 载荷硬约束：sectionKey + 真源标识 + ids + before/after ordering 对比） */
  private writeReorderAudit(
    sectionKey: HomeSectionKey,
    source: 'home_banners' | 'home_modules',
    targetId: string,
    beforeItems: ReadonlyArray<{ id: string; ordering: number }>,
    afterItems: ReadonlyArray<{ id: string; ordering: number }>,
    actorId: string,
    requestId?: string,
  ): void {
    this.auditSvc.write({
      actorId,
      actionType: 'home_section.reorder',
      targetKind: 'home_section',
      targetId,
      beforeJsonb: { sectionKey, source, items: beforeItems },
      afterJsonb: {
        sectionKey,
        source,
        ids: afterItems.map((i) => i.id),
        items: afterItems.map((i) => ({ id: i.id, ordering: i.ordering })),
      },
      requestId: requestId ?? null,
    })
  }

  /**
   * 端点 #1：整页预览聚合（画布数据源，D-182-4 #1）。
   * 实现拆至 home-curation.preview.ts（file-size-budget 500 行硬限），本方法单点委托。
   */
  async buildPreview(query: z.infer<typeof PreviewQuerySchema>): Promise<HomePreview> {
    return buildHomePreview(this.db, query)
  }
}

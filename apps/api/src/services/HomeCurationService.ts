/**
 * HomeCurationService.ts — Home Curation 聚合层（ADR-182 D-182-1）
 *
 * 分层：Route → 本 Service → home-section-settings / home-modules / home-banners queries。
 * 本卡（CHG-HOME-PREVIEW-API-A）承载 settings 域（端点 #2/#3）；
 * preview 整页聚合（端点 #1）归 -B 卡；candidates/apply/refresh 归 Phase 3。
 */

import { z } from 'zod'
import type { Pool } from 'pg'
import {
  HOME_SECTION_KEYS,
  HOME_AUTOFILL_MODES,
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
import { AuditLogService } from '@/api/services/AuditLogService'

// ── zod schemas（ADR-182 D-182-4 #3 / #9）──────────────────────────

export const SectionParamSchema = z.enum(
  HOME_SECTION_KEYS as [HomeSectionKey, ...HomeSectionKey[]],
)

/** PATCH settings body：.strict() partial + ≥1 字段（D-182-4 #3） */
export const UpdateSectionSettingsSchema = z.object({
  autofillMode: z.enum(HOME_AUTOFILL_MODES as [string, ...string[]]).optional(),
  refreshIntervalMinutes: z.number().int().min(1).nullable().optional(),
  displayCount: z.number().int().min(1).max(50).optional(),
  allowDuplicates: z.boolean().optional(),
  pinnedLimit: z.number().int().min(1).nullable().optional(),
  // JSONB 整体替换（非深合并，与 ADR-104 metadata 同语义）
  settings: z.record(z.unknown()).optional(),
}).strict().refine((v) => Object.keys(v).length > 0, { message: '至少一字段' })

// ── Service ───────────────────────────────────────────────────────

export class HomeCurationService {
  private readonly auditSvc: AuditLogService

  constructor(private readonly db: Pool) {
    this.auditSvc = new AuditLogService(db)
  }

  /**
   * 端点 #2：7 区块 settings 全量 + 状态摘要（D-182-4 #2）。
   * 快照摘要在 ADR-183 落地前恒为 null（未生成语义，与端点 #4 snapshotAt 同源）。
   * 输出按 HOME_SECTION_KEYS 枚举序（前台渲染顺序），非 DB 字典序。
   */
  async listSectionSummaries(): Promise<HomeSectionSummary[]> {
    const [settingsRows, pinnedCounts] = await Promise.all([
      listHomeSectionSettings(this.db),
      countPinnedBySection(this.db),
    ])
    const bySection = new Map(settingsRows.map((s) => [s.section, s]))

    const summaries: HomeSectionSummary[] = []
    for (const key of HOME_SECTION_KEYS) {
      const settings = bySection.get(key)
      // seed 7 行恒存在（migration 095）；缺行 = 迁移漂移，跳过并由消费端按缺失处理
      if (!settings) continue
      summaries.push({
        settings,
        pinnedCount: pinnedCounts[key] ?? 0,
        lastSnapshotAt: null,   // ADR-183 快照表落地后接入
        candidateCount: null,   // 同上
        // D-182-6.2：type_shortcuts 前台静态 ALL_CATEGORIES 暂未消费此配置
        frontendWired: key !== 'type_shortcuts',
      })
    }
    return summaries
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
}

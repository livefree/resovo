/**
 * HomePublishService.ts — Home Curation 发布治理（ADR-185 D-185-1/-2/-3）
 *
 * 分层：Route → 本 Service → home-publish queries。端点 #1–#4 承载
 * （#5–#7 versions 列表/详情/rollback 归 CHG-HOME-AUDIT-ROLLBACK 卡 26）。
 * zod schemas → home-publish.schemas.ts（home-curation 同先例拆分）。
 *
 * publish 时序（D-185-3.2）：陈旧双信号 409 → 整页重校验（D-182-4.5 口径挪点）
 * → 单事务（草稿乐观锁删除 + 三表全量替换 + 回读拍版本）→ audit home_page.publish。
 * 缓存失效钩子归 CHG-HOME-CACHE-INVALIDATE（卡 27，事务外 / 失败不回滚发布 D-185-5.2）。
 */

import type { z } from 'zod'
import type { Pool } from 'pg'
import {
  HOME_SECTION_KEYS,
  type HomeConfigDraft,
  type HomePageConfig,
  type HomeSectionKey,
} from '@resovo/types'
import {
  findHomeConfigDraft,
  upsertHomeConfigDraft,
  deleteHomeConfigDraft,
  findLatestVersionNo,
  findTruthTablesMaxUpdatedAt,
  publishHomeConfig,
} from '@/api/db/queries/home-publish'
import { listVideoCardsByIds } from '@/api/db/queries/videos.status'
import { AuditLogService } from '@/api/services/AuditLogService'
import { AppError } from '@/api/lib/errors'
import {
  HomePageConfigSchema,
  SaveDraftSchema,
  PublishSchema,
} from '@/api/services/home-publish.schemas'

// route 层消费入口保持单点（HomeCurationService 同范式 re-export）
export { HomePageConfigSchema, SaveDraftSchema, PublishSchema }

// ── sectionsChanged 摘要（audit afterJsonb，D-185-4.1）─────────────────────

/**
 * 比较用归一化：剥离 updatedAt（发布重写恒刷新）+ createdAt（行元数据，
 * 且 JS ms 管道会截断 pg 微秒精度——恒等重发布伪报变化，dev 实测）；
 * 内容身份 = id + 内容字段，增删仍经 id 在场性检出。按稳定键排序。
 */
function normalizeEntries<T extends { createdAt?: string; updatedAt?: string }>(
  entries: readonly T[],
  sortKey: string,
): string {
  const stripped = entries.map((entry) => {
    const { createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = entry
    return rest as Record<string, unknown>
  })
  stripped.sort((a, b) => String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? '')))
  return JSON.stringify(stripped)
}

/**
 * section 粒度变更摘要（轻量启发式——审计摘要而非权威 diff；
 * 权威 diff 由消费端按两版本 config 计算，D-185-4.2）。
 * banner 区块 = home_banners + settings['banner']；其余 = slot 模块组 + settings。
 */
export function computeSectionsChanged(prev: HomePageConfig, next: HomePageConfig): HomeSectionKey[] {
  const changed: HomeSectionKey[] = []
  const settingsBySection = (config: HomePageConfig, section: HomeSectionKey) =>
    config.settings.filter((s) => s.section === section)
  const modulesBySlot = (config: HomePageConfig, slot: HomeSectionKey) =>
    config.modules.filter((m) => m.slot === slot)

  for (const section of HOME_SECTION_KEYS) {
    const settingsDiffer =
      normalizeEntries(settingsBySection(prev, section), 'section') !==
      normalizeEntries(settingsBySection(next, section), 'section')
    const contentDiffer = section === 'banner'
      ? normalizeEntries(prev.banners, 'id') !== normalizeEntries(next.banners, 'id')
      : normalizeEntries(modulesBySlot(prev, section), 'id') !==
        normalizeEntries(modulesBySlot(next, section), 'id')
    if (settingsDiffer || contentDiffer) changed.push(section)
  }
  return changed
}

// ── Service ─────────────────────────────────────────────────────────────────

export class HomePublishService {
  private readonly auditSvc: AuditLogService

  constructor(private readonly db: Pool) {
    this.auditSvc = new AuditLogService(db)
  }

  /** 端点 #1：读当前草稿（无草稿 200 data:null——存在性非错误，D-185-3.1） */
  async getDraft(): Promise<HomeConfigDraft | null> {
    return findHomeConfigDraft(this.db)
  }

  /** 端点 #2：整页草稿保存（整体替换；不计 audit——编辑态噪音，D-185-3.1） */
  async saveDraft(input: z.infer<typeof SaveDraftSchema>, actorId: string): Promise<HomeConfigDraft> {
    return upsertHomeConfigDraft(this.db, { config: input.config as HomePageConfig, actorId })
  }

  /** 端点 #3：丢弃草稿（不计 audit，D-185-3.1） */
  async discardDraft(): Promise<{ deleted: boolean }> {
    const deleted = await deleteHomeConfigDraft(this.db)
    return { deleted }
  }

  /**
   * 端点 #4：发布（D-185-3.2）。
   * 单事务 = 草稿应用三表（全量替换）→ 拍版本（source='publish'）→ 删草稿；
   * audit `home_page.publish`（targetId = 版本行 UUID，afterJsonb 轻量摘要 D-185-4.1）。
   *
   * @throws AppError VALIDATION_ERROR 422 — 无草稿可发布
   * @throws AppError STATE_CONFLICT 409 — 草稿陈旧（双信号，D-185-2.2）/
   *   整页重校验失败（D-182-4.5 口径挪点）/ 并发竞态（乐观锁失败）
   */
  async publish(
    params: z.infer<typeof PublishSchema>,
    actorId: string,
    requestId?: string,
  ): Promise<{ versionNo: number }> {
    const draft = await findHomeConfigDraft(this.db)
    if (!draft) {
      throw new AppError('VALIDATION_ERROR', '无草稿可发布——请先保存草稿', 422)
    }

    // 陈旧双信号①：base_version_no 失配（不提供强制覆盖参数，防误覆盖热修，D-185-3.2）
    const latestNo = await findLatestVersionNo(this.db)
    if ((draft.baseVersionNo ?? null) !== (latestNo ?? null)) {
      throw new AppError(
        'STATE_CONFLICT',
        `草稿基线已过时：草稿基于版本 ${draft.baseVersionNo ?? '（无）'}，当前最新版本 ${latestNo ?? '（无）'}——请丢弃草稿后基于最新配置重建`,
        409,
      )
    }

    // 陈旧双信号②：三真源表直写晚于草稿（资源级紧急通道 / 门面旁路，D-185-2.2）
    const tablesMaxUpdatedAt = await findTruthTablesMaxUpdatedAt(this.db)
    if (
      tablesMaxUpdatedAt &&
      new Date(tablesMaxUpdatedAt).getTime() > new Date(draft.updatedAt).getTime()
    ) {
      throw new AppError(
        'STATE_CONFLICT',
        `草稿基线已过时：正式配置在草稿最后保存（${draft.updatedAt}）之后被直写（${tablesMaxUpdatedAt}）——请丢弃草稿后基于最新配置重建`,
        409,
      )
    }

    // 发布时整页重校验（D-182-4.5 口径挪点）：video 引用可见性 + 可播性。
    // 范围 = modules video 引用（#5 原语义对象）；banner linkTarget 为 short_id
    // 非本口径对象（横图警告级提示归卡 25 发布确认 UI）。
    const videoIds = [...new Set(
      draft.config.modules
        .filter((m) => m.contentRefType === 'video')
        .map((m) => m.contentRefId),
    )]
    if (videoIds.length > 0) {
      const cards = await listVideoCardsByIds(this.db, videoIds)
      const playable = new Set(cards.filter((c) => c.sourceCount > 0).map((c) => c.id))
      const invalid = videoIds.filter((id) => !playable.has(id))
      if (invalid.length > 0) {
        throw new AppError(
          'STATE_CONFLICT',
          `发布校验失败——video 引用不可见或无可播源：${invalid.join(', ')}（请在草稿中移除后重试）`,
          409,
        )
      }
    }

    const result = await publishHomeConfig(this.db, {
      draft: { id: draft.id, updatedAt: draft.updatedAt },
      config: draft.config,
      source: 'publish',
      note: params.note ?? null,
      actorId,
    })
    if (!result) {
      // 乐观锁失败：草稿在校验后被并发修改 / 丢弃 / 发布
      throw new AppError('STATE_CONFLICT', '草稿已被并发修改或丢弃，请刷新后重试', 409)
    }

    this.auditSvc.write({
      actorId,
      actionType: 'home_page.publish',
      targetKind: 'home_page',
      targetId: result.versionId, // D-185-3.5：锚定版本行 UUID
      beforeJsonb: null,
      // D-185-4.1 轻量摘要：全量 config 在版本表，audit 不重复存储
      afterJsonb: {
        versionNo: result.versionNo,
        baseVersionNo: draft.baseVersionNo,
        sectionsChanged: computeSectionsChanged(result.prevConfig, result.publishedConfig),
        counts: {
          banners: result.publishedConfig.banners.length,
          modules: result.publishedConfig.modules.length,
        },
      },
      requestId: requestId ?? null,
    })

    return { versionNo: result.versionNo }
  }
}

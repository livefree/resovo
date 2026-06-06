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
  type AutofillCandidatesResult,
  type Banner,
  type HomeModule,
  type HomePreview,
  type HomePreviewCard,
  type HomePreviewCardFlag,
  type HomePreviewSection,
  type HomeSectionKey,
  type HomeSectionSettings,
  type HomeSectionSummary,
  type VideoCard,
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
import { listAllBanners, findBannerById, updateBannerSortOrders } from '@/api/db/queries/home-banners'
import { listAdminHomeModules, findHomeModuleById, reorderHomeModules } from '@/api/db/queries/home-modules'
import { listTrendingVideos } from '@/api/db/queries/videos'
import { listVideosByRatingDesc, listVideoCardsByIds } from '@/api/db/queries/videos.status'
import { occupyVideoIds, isOccupied } from '@/api/services/home-autofill'
import { AuditLogService } from '@/api/services/AuditLogService'
import { AppError } from '@/api/lib/errors'

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

/** POST reorder body（D-182-4 #6：≥1 ≤200；形态对齐 HomeModulesService.ReorderSchema） */
export const ReorderSectionSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    ordering: z.number().int().min(0),
  })).min(1).max(200),
}).strict()

/** GET /admin/home/preview query（D-182-4 #1） */
export const PreviewQuerySchema = z.object({
  brand_slug: z.string().min(1).max(64).optional(),
  locale: z.string().min(2).max(10).optional(),
  at: z.string().datetime().optional(),
  device: z.enum(['desktop', 'mobile']).default('desktop'),
})

/** GET autofill-candidates query（D-182-4 #4：limit ≤100 默认 50；布尔显式枚举防 z.coerce 把 'false' 判 true） */
export const CandidatesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  include_filtered: z.enum(['true', 'false']).optional()
    .transform((v) => v === 'true'),
})

// ── preview 聚合纯函数（导出供单测）──────────────────────────────

/** brand_scope 协议过滤（ADR-046：all-brands 或 brand_slug 匹配） */
function brandVisible(row: { brandScope: string; brandSlug: string | null }, brandSlug: string | null): boolean {
  return row.brandScope === 'all-brands' || (brandSlug !== null && row.brandSlug === brandSlug)
}

/** 时间窗 flags 派生（D-181-3 统一口径；at 模拟时间） */
function timeWindowFlags(startAt: string | null, endAt: string | null, enabled: boolean, at: Date): HomePreviewCardFlag[] {
  const flags: HomePreviewCardFlag[] = []
  if (!enabled) flags.push('disabled')
  if (endAt && new Date(endAt).getTime() <= at.getTime()) flags.push('expired')
  else if (startAt && new Date(startAt).getTime() > at.getTime()) flags.push('pending')
  return flags
}

/** banner 行 → 卡（D-181-3 字段映射：active_from→startAt / active_to→endAt / is_active→enabled） */
function bannerToCard(banner: Banner, at: Date): HomePreviewCard {
  return {
    source: 'pinned',
    refId: banner.id,
    videoId: banner.linkType === 'video' ? banner.linkTarget : null,
    title: banner.title['zh-CN'] ?? banner.title['en'] ?? Object.values(banner.title)[0] ?? null,
    imageUrl: banner.imageUrl,
    linkHint: banner.linkTarget || null,
    startAt: banner.activeFrom,
    endAt: banner.activeTo,
    enabled: banner.isActive,
    // image_url NOT NULL（049）→ missing_image 不触发；尺寸/比例警告归 Phase 2 IMAGE-GUARD-BANNER
    flags: timeWindowFlags(banner.activeFrom, banner.activeTo, banner.isActive, at),
    explain: null,
  }
}

/** home_modules pinned 行 → 卡（video 充实经 cardMap；ref_broken = video 引用 404） */
function moduleToCard(module: HomeModule, cardMap: ReadonlyMap<string, VideoCard>, at: Date): HomePreviewCard {
  const isVideo = module.contentRefType === 'video'
  const video = isVideo ? cardMap.get(module.contentRefId) : undefined
  const flags = timeWindowFlags(module.startAt, module.endAt, module.enabled, at)
  if (isVideo && !video) flags.push('ref_broken')
  if (video && video.sourceCount === 0) flags.push('unplayable')
  const imageUrl = module.imageUrl ?? video?.coverUrl ?? null
  if (!imageUrl) flags.push('missing_image')
  return {
    source: 'pinned',
    refId: module.id,
    videoId: isVideo ? module.contentRefId : null,
    title: module.title['zh-CN'] ?? module.title['en'] ?? video?.title ?? null,
    imageUrl,
    linkHint: isVideo ? (video?.slug ?? module.contentRefId) : module.contentRefId,
    startAt: module.startAt,
    endAt: module.endAt,
    enabled: module.enabled,
    flags,
    explain: null,
  }
}

/** 自动补位视频 → 卡（origin 开放字符串：trending / rating，D-182-4.4 同口径） */
function videoToAutoCard(video: VideoCard, origin: string, rank: number, source: 'auto' | 'fallback'): HomePreviewCard {
  const flags: HomePreviewCardFlag[] = []
  if (!video.coverUrl) flags.push('missing_image')
  if (video.sourceCount === 0) flags.push('unplayable')
  return {
    source,
    refId: null,
    videoId: video.id,
    title: video.title,
    imageUrl: video.coverUrl,
    linkHint: video.slug,
    startAt: null,
    endAt: null,
    enabled: true,
    flags,
    explain: { origin, rank, score: video.rating ?? null },
  }
}

const EMPTY_CARD: HomePreviewCard = {
  source: 'empty',
  refId: null,
  videoId: null,
  title: null,
  imageUrl: null,
  linkHint: null,
  startAt: null,
  endAt: null,
  enabled: true,
  flags: [],
  explain: null,
}

/** hot shelf section → 站内 trending 兜底的 video type（D-183-1 三池映射） */
const HOT_SECTION_TYPE: Partial<Record<HomeSectionKey, 'movie' | 'series' | 'anime'>> = {
  hot_movies: 'movie',
  hot_series: 'series',
  hot_anime: 'anime',
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

    const candidates = (query.include_filtered
      ? snapshot.candidates
      : snapshot.candidates.filter((c) => !c.filtered)
    ).slice(0, query.limit)

    return {
      candidates,
      snapshotAt: snapshot.generatedAt,
      policyVersion: snapshot.policyVersion,
      ...(query.include_filtered ? { gaps: snapshot.gaps } : {}),
    }
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
   * Phase 1 = 正式配置预览（无草稿叠加）；**跳过 Redis 缓存**（方案 §12）；
   * `at` 仅影响时间窗判定，不回放历史数据。
   * 跨区块去重 = 聚合层唯一权威（ADR-183 D-183-6）：按 HOME_SECTION_KEYS 渲染序
   * 先到先得，pinned 进占用集、auto/fallback 补位跳过已占用；allow_duplicates 豁免。
   */
  async buildPreview(query: z.infer<typeof PreviewQuerySchema>): Promise<HomePreview> {
    const at = query.at ? new Date(query.at) : new Date()
    const brandSlug = query.brand_slug ?? null

    const [settingsRows, bannersResult, modulesResult] = await Promise.all([
      listHomeSectionSettings(this.db),
      listAllBanners(this.db, { page: 1, limit: 100 }),
      listAdminHomeModules(this.db, { page: 1, limit: 500 }),
    ])
    const settingsBySection = new Map(settingsRows.map((s) => [s.section, s]))

    // brand 过滤（ADR-046 协议）+ 按 section 分组（banner slot 行已冻结，归冻结存量不进 preview）
    const banners = bannersResult.rows.filter((b) => brandVisible(b, brandSlug))
    const modulesBySlot = new Map<string, HomeModule[]>()
    for (const m of modulesResult.rows) {
      if (m.slot === 'banner' || !brandVisible(m, brandSlug)) continue
      const list = modulesBySlot.get(m.slot) ?? []
      list.push(m)
      modulesBySlot.set(m.slot, list)
    }

    // video 引用批量充实（避免 N+1）
    const videoIds = [...modulesBySlot.values()].flat()
      .filter((m) => m.contentRefType === 'video')
      .map((m) => m.contentRefId)
    const cardMap = new Map(
      (videoIds.length > 0 ? await listVideoCardsByIds(this.db, videoIds) : []).map((v) => [v.id, v]),
    )

    // 跨区块占用集（聚合层唯一权威，D-183-6；去重纯函数单一实现 services/home-autofill/dedup）
    const occupied = new Set<string>()

    const sections: HomePreviewSection[] = []
    for (const key of HOME_SECTION_KEYS) {
      const settings = settingsBySection.get(key)
      if (!settings) continue // seed 恒存在；缺行 = 迁移漂移，跳过

      let cards: HomePreviewCard[]
      if (key === 'banner') {
        cards = banners.map((b) => bannerToCard(b, at))
      } else {
        const pinned = (modulesBySlot.get(key) ?? []).map((m) => moduleToCard(m, cardMap, at))
        cards = pinned
        // pinned 视频进占用集（人工优先，不被去重）
        occupyVideoIds(occupied, pinned.map((c) => c.videoId), settings.allowDuplicates)
        // 自动补位（活跃 pinned 计数后补到 displayCount；Phase 3 候选快照实装前走站内信号）
        const activeCount = pinned.filter((c) => c.enabled && c.flags.length === 0).length
        const need = Math.max(0, settings.displayCount - activeCount)
        if (need > 0 && settings.autofillMode !== 'manual_only' && key !== 'type_shortcuts') {
          const fill = await this.fetchAutoFill(key, need, pinned, occupied, settings)
          cards = [...pinned, ...fill]
          occupyVideoIds(occupied, fill.map((c) => c.videoId), settings.allowDuplicates)
        }
      }

      // 空卡片占位 = max(0, displayCount − 非 empty 卡数)（D-182-3 公式）
      const emptyCount = Math.max(0, settings.displayCount - cards.length)
      for (let i = 0; i < emptyCount; i += 1) cards.push({ ...EMPTY_CARD })

      sections.push({ key, settings, cards })
    }

    return {
      sections,
      generatedAt: new Date().toISOString(),
      context: { brandSlug, locale: query.locale ?? null, at: query.at ?? null, device: query.device },
    }
  }

  /** 自动补位取数（Phase 1：top10 走 rating、featured 走 trending、hot_* 走 trending 兜底） */
  private async fetchAutoFill(
    key: HomeSectionKey,
    need: number,
    pinned: HomePreviewCard[],
    occupied: ReadonlySet<string>,
    settings: HomeSectionSettings,
  ): Promise<HomePreviewCard[]> {
    const pinnedIds = pinned.flatMap((c) => (c.videoId ? [c.videoId] : []))
    const skip = (id: string) => pinnedIds.includes(id) || isOccupied(occupied, id, settings.allowDuplicates)

    let candidates: VideoCard[]
    let origin: string
    let source: 'auto' | 'fallback'
    if (key === 'top10') {
      // 取 need + 占用余量，过滤后截断（excludeIds 仅排 pinned，占用集本地过滤）
      candidates = await listVideosByRatingDesc(this.db, Math.min(need + occupied.size, 100), pinnedIds)
      origin = 'rating'
      source = 'auto'
    } else {
      const type = HOT_SECTION_TYPE[key]
      candidates = await listTrendingVideos(this.db, { period: 'week', type, limit: Math.min(need + occupied.size, 50) })
      origin = 'trending'
      // hot_*：豆瓣/Bangumi 候选快照实装（Phase 3）前为 fallback 语义；featured 为 auto
      source = type ? 'fallback' : 'auto'
    }

    const fill: HomePreviewCard[] = []
    let rank = 1
    for (const video of candidates) {
      if (fill.length >= need) break
      if (skip(video.id)) continue
      fill.push(videoToAutoCard(video, origin, rank, source))
      rank += 1
    }
    return fill
  }
}

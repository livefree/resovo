/**
 * home-publish.schemas.ts — 发布治理端点 zod schemas（ADR-185 D-185-3）
 * （home-curation.schemas.ts 同先例：schemas 独立文件，service 保持编排职责）
 *
 * HomePageConfig 三键整页校验：settings 必须恰好覆盖 7 区块各一次（PUT 整页语义）；
 * module slot × contentRefType 兼容为 DB CHECK home_modules_ref_type_slot_compat
 * （migration 094）的同源镜像——事务内约束失败提前到 422（与 HomeModulesService
 * applyBusinessRules compat 表同源，slot 扩值必须同卡同步，ADR-181 BLOCKER 警示）。
 * banner slot 模块在此**放行**：发布/回滚是存量恢复路径而非新建（ADR-181 冻结的是
 * 编辑器新建入口），版本快照含 legacy banner-slot 行时必须可恢复。
 */

import { z } from 'zod'
import {
  HOME_AUTOFILL_MODES,
  HOME_SECTION_KEYS,
  type HomeAutofillMode,
  type HomeSectionKey,
} from '@resovo/types'

const SlotEnum = z.enum(['banner', 'featured', 'top10', 'type_shortcuts', 'hot_movies', 'hot_series', 'hot_anime'])
const BrandScopeEnum = z.enum(['all-brands', 'brand-specific'])
const ContentRefTypeEnum = z.enum(['video', 'external_url', 'custom_html', 'video_type'])

/** migration 094 DB CHECK 同源镜像（第 4 处；扩 slot 必须同卡同步全部位点） */
const SLOT_REF_TYPE_COMPAT: Record<string, readonly string[]> = {
  banner: ['video', 'external_url', 'custom_html'],
  featured: ['video'],
  top10: ['video'],
  type_shortcuts: ['video_type'],
  hot_movies: ['video'],
  hot_series: ['video'],
  hot_anime: ['video'],
}

const BannerEntrySchema = z.object({
  id: z.string().uuid().optional(),
  title: z.record(z.string()),
  // NOT NULL（ERRATA：缺图态 schema 吸收，「缺横版大图」结构上不可达）
  imageUrl: z.string().min(1).max(2048),
  linkType: z.enum(['video', 'external']),
  linkTarget: z.string().min(1).max(2048),
  sortOrder: z.number().int().min(0),
  activeFrom: z.string().datetime({ offset: true }).nullable(),
  activeTo: z.string().datetime({ offset: true }).nullable(),
  isActive: z.boolean(),
  brandScope: BrandScopeEnum,
  brandSlug: z.string().min(1).max(100).nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}).strict()

const ModuleEntrySchema = z.object({
  id: z.string().uuid().optional(),
  slot: SlotEnum,
  brandScope: BrandScopeEnum,
  brandSlug: z.string().min(1).max(100).nullable(),
  ordering: z.number().int().min(0),
  contentRefType: ContentRefTypeEnum,
  contentRefId: z.string().min(1).max(2048),
  title: z.record(z.string()),
  imageUrl: z.string().min(1).max(2048).nullable(),
  startAt: z.string().datetime({ offset: true }).nullable(),
  endAt: z.string().datetime({ offset: true }).nullable(),
  enabled: z.boolean(),
  metadata: z.record(z.unknown()),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}).strict()

const SectionSettingsEntrySchema = z.object({
  id: z.string().uuid().optional(),
  section: z.enum(HOME_SECTION_KEYS as [HomeSectionKey, ...HomeSectionKey[]]),
  autofillMode: z.enum(HOME_AUTOFILL_MODES as [HomeAutofillMode, ...HomeAutofillMode[]]),
  refreshIntervalMinutes: z.number().int().min(1).nullable(),
  displayCount: z.number().int().min(1).max(50),
  allowDuplicates: z.boolean(),
  pinnedLimit: z.number().int().min(1).nullable(),
  settings: z.record(z.unknown()),
  updatedAt: z.string().optional(),
}).strict()

export const HomePageConfigSchema = z.object({
  banners: z.array(BannerEntrySchema).max(100),
  modules: z.array(ModuleEntrySchema).max(500),
  settings: z.array(SectionSettingsEntrySchema).length(HOME_SECTION_KEYS.length),
}).strict().superRefine((config, ctx) => {
  // settings 恰好覆盖 7 区块各一次（整页语义，部分覆盖拒收）
  const seen = new Set(config.settings.map((s) => s.section))
  if (seen.size !== HOME_SECTION_KEYS.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['settings'],
      message: `settings 必须覆盖全部 ${HOME_SECTION_KEYS.length} 区块各一次（缺 ${HOME_SECTION_KEYS.filter((k) => !seen.has(k)).join(', ')}）`,
    })
  }
  // slot × contentRefType 兼容（migration 094 CHECK 镜像）
  config.modules.forEach((m, i) => {
    if (!(SLOT_REF_TYPE_COMPAT[m.slot] ?? []).includes(m.contentRefType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['modules', i, 'contentRefType'],
        message: `slot ${m.slot} × contentRefType ${m.contentRefType} 组合不被允许`,
      })
    }
  })
  // brand 约束（HomeModulesService applyBusinessRules 同款）
  for (const [listKey, list] of [['banners', config.banners], ['modules', config.modules]] as const) {
    list.forEach((entry, i) => {
      if (entry.brandScope === 'brand-specific' && !entry.brandSlug) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [listKey, i, 'brandSlug'],
          message: 'brand-specific 必须指定 brandSlug',
        })
      }
      if (entry.brandScope === 'all-brands' && entry.brandSlug) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [listKey, i, 'brandSlug'],
          message: 'all-brands 不得指定 brandSlug',
        })
      }
    })
  }
})

/** PUT /admin/home/draft body（D-185-3.1 整体替换） */
export const SaveDraftSchema = z.object({
  config: HomePageConfigSchema,
}).strict()

/** POST /admin/home/publish body（D-185-3.2） */
export const PublishSchema = z.object({
  note: z.string().min(1).max(500).optional(),
}).strict()

// ── 端点 #5–#7（CHG-HOME-AUDIT-ROLLBACK / D-185-3.3-3.4）────────────────────

/** GET /admin/home/versions query（轻量行分页） */
export const ListVersionsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

/** :versionNo 路径参数（正整数；非法 → 422 先于 404 判定，D-182-4 #9 同款） */
export const VersionNoParamSchema = z.coerce.number().int().min(1)

/** POST /admin/home/versions/:versionNo/rollback body */
export const RollbackSchema = z.object({
  note: z.string().min(1).max(500).optional(),
}).strict()

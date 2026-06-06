/**
 * HomeModulesService.ts — home_modules admin CRUD 业务层（ADR-104）
 *
 * 职责：
 *   - list(): 按过滤条件分页列出所有模块（含禁用 + 过期）
 *   - create(): zod 预校验 + DB 写入 + fire-and-forget audit log
 *   - update(): zod 预校验 + before 快照 + DB 写入 + fire-and-forget audit log
 *
 * 校验策略（ADR-104 决策要点 7）：
 *   - Service 层 zod 预校验覆盖所有可恢复违例（brand_scope 互斥 / 时间窗 / slot×contentRefType）
 *   - DB CHECK 兜底仅在并发竞争或迁移漂移时触发，由路由层转换为 STATE_CONFLICT 409
 */

import { z } from 'zod'
import type { Pool } from 'pg'
import type { HomeModule } from '@resovo/types'
import {
  listAdminHomeModules,
  findHomeModuleById,
  createHomeModule,
  updateHomeModule,
  deleteHomeModule,
  reorderHomeModules,
} from '@/api/db/queries/home-modules'
import { AuditLogService } from '@/api/services/AuditLogService'
import { AppError, ERRORS } from '@/api/lib/errors'

// ── zod schemas（ADR-104 端点契约，R1 修订：CreateBase + applyBusinessRules）──

// ADR-181 D-181-4（migration 094）：+3 hot slot（热门 shelf pinned 专用，content_ref_type 仅 video）
const SlotEnum = z.enum(['banner', 'featured', 'top10', 'type_shortcuts', 'hot_movies', 'hot_series', 'hot_anime'])
const BrandScopeEnum = z.enum(['all-brands', 'brand-specific'])
const ContentRefTypeEnum = z.enum(['video', 'external_url', 'custom_html', 'video_type'])

export const ListSchema = z.object({
  slot: SlotEnum.optional(),
  brandScope: BrandScopeEnum.optional(),
  brandSlug: z.string().min(1).max(100).optional(),
  enabled: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

const CreateBase = z.object({
  slot: SlotEnum,
  brandScope: BrandScopeEnum,
  brandSlug: z.string().min(1).max(100).nullable().optional(),
  ordering: z.number().int().min(0).default(0),
  contentRefType: ContentRefTypeEnum,
  contentRefId: z.string().min(1).max(2048),
  // ADR-104 AMENDMENT 2026-06-05（D-104-9）：多语言标题映射，值收紧为 string
  // （i18n 文案，非自由 JSONB；与 home_banners 路由 z.record(z.string()) 一致）
  title: z.record(z.string()).default({}),
  // D-104-9：运营横图 URL；.url() 对 R2/local-fs 双 provider 绝对 URL 形态安全（A-1 实证）
  imageUrl: z.string().url().max(2048).nullable().optional(),
  startAt: z.string().datetime().nullable().optional(),
  endAt: z.string().datetime().nullable().optional(),
  enabled: z.boolean().default(true),
  metadata: z.record(z.unknown()).default({}),
})

type CreateInput = Partial<z.input<typeof CreateBase>>

function applyBusinessRules<T extends z.ZodTypeAny>(schema: T): z.ZodTypeAny {
  return schema
    .refine(
      (v: CreateInput) => v.brandScope === undefined || !(v.brandScope === 'brand-specific' && !v.brandSlug),
      { message: 'brand-specific 必须指定 brandSlug', path: ['brandSlug'] },
    )
    .refine(
      (v: CreateInput) => v.brandScope === undefined || !(v.brandScope === 'all-brands' && v.brandSlug),
      { message: 'all-brands 不得指定 brandSlug', path: ['brandSlug'] },
    )
    .refine(
      (v: CreateInput) => !(v.startAt && v.endAt && new Date(v.startAt) >= new Date(v.endAt)),
      { message: 'startAt 必须早于 endAt', path: ['startAt'] },
    )
    .refine(
      (v: CreateInput) => {
        if (v.slot === undefined || v.contentRefType === undefined) return true
        // 与 DB CHECK home_modules_ref_type_slot_compat（migration 094）同源的第 3 处规则，
        // slot 扩值必须同卡同步（ADR-181 arch-reviewer BLOCKER 警示）
        const compat: Record<string, readonly string[]> = {
          banner: ['video', 'external_url', 'custom_html'],
          featured: ['video'],
          top10: ['video'],
          type_shortcuts: ['video_type'],
          hot_movies: ['video'],
          hot_series: ['video'],
          hot_anime: ['video'],
        }
        return compat[v.slot]?.includes(v.contentRefType) ?? false
      },
      { message: 'slot × contentRefType 组合不被允许', path: ['contentRefType'] },
    )
}

// CHG-HOME-BANNER-UNIFY-A / ADR-181 D-181-1.2(a)：banner slot 运营语义冻结——
// Create 拒绝新建（update / delete / reorder / publish-toggle / list 保留，存量清理与审计可见性需要）
export const BANNER_SLOT_FROZEN_MESSAGE =
  'banner slot 已冻结（ADR-181）：Hero Banner 请改用 /admin/banners（home_banners 真源）'

export const CreateSchema = applyBusinessRules(CreateBase).refine(
  (v: CreateInput) => v.slot !== 'banner',
  { message: BANNER_SLOT_FROZEN_MESSAGE, path: ['slot'] },
)

// UpdateSchema：omit enabled（强制走 publish-toggle 专用端点；ADR-104 Y2 闭合）
// .strict() 确保 enabled 字段被显式拒绝（unrecognized_keys），而非静默剥离后报"至少一字段"
export const UpdateSchema = applyBusinessRules(CreateBase.omit({ enabled: true }).partial().strict())
  .refine((v) => Object.keys(v as object).length > 0, { message: '至少一字段' })

export const ReorderSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    ordering: z.number().int().min(0),
  })).min(1).max(200),
})

export const PublishToggleSchema = z.object({
  enabled: z.boolean(),
})

export type ListParams = z.infer<typeof ListSchema>
export type CreateParams = z.infer<typeof CreateSchema>
export type UpdateParams = z.infer<typeof UpdateSchema>
export type ReorderParams = z.infer<typeof ReorderSchema>
export type PublishToggleParams = z.infer<typeof PublishToggleSchema>

// ── Service ──────────────────────────────────────────────────────────────────

export class HomeModulesService {
  private auditSvc: AuditLogService

  constructor(private readonly db: Pool) {
    this.auditSvc = new AuditLogService(db)
  }

  async list(params: ListParams): Promise<{ rows: HomeModule[]; total: number; page: number; limit: number }> {
    const result = await listAdminHomeModules(this.db, params)
    return { ...result, page: params.page, limit: params.limit }
  }

  async create(input: CreateParams, actorId: string, requestId?: string): Promise<HomeModule> {
    const module = await createHomeModule(this.db, {
      slot: input.slot,
      brandScope: input.brandScope,
      brandSlug: input.brandSlug ?? null,
      ordering: input.ordering,
      contentRefType: input.contentRefType,
      contentRefId: input.contentRefId,
      title: input.title ?? {},
      imageUrl: input.imageUrl ?? null,
      startAt: input.startAt ?? null,
      endAt: input.endAt ?? null,
      enabled: input.enabled,
      metadata: input.metadata,
    })

    this.auditSvc.write({
      actorId,
      actionType: 'home_module.create',
      targetKind: 'home_module',
      targetId: module.id,
      beforeJsonb: null,
      afterJsonb: module as unknown as Record<string, unknown>,
      requestId: requestId ?? null,
    })

    return module
  }

  async update(id: string, input: UpdateParams, actorId: string, requestId?: string): Promise<HomeModule | null> {
    const before = await findHomeModuleById(this.db, id)
    if (!before) return null

    // ADR-181 D-181-1.2(a) 冻结意图防护：slot 改为 banner = 变相新建，拒绝；
    // 存量 banner 行回传 slot='banner'（未变化，Drawer 编辑总携带 slot）放行。
    if (input.slot === 'banner' && before.slot !== 'banner') {
      throw new AppError('VALIDATION_ERROR', BANNER_SLOT_FROZEN_MESSAGE, 422)
    }

    const after = await updateHomeModule(this.db, id, input)
    if (!after) return null

    this.auditSvc.write({
      actorId,
      actionType: 'home_module.update',
      targetKind: 'home_module',
      targetId: id,
      beforeJsonb: before as unknown as Record<string, unknown>,
      afterJsonb: after as unknown as Record<string, unknown>,
      requestId: requestId ?? null,
    })

    return after
  }

  async delete(id: string, actorId: string, requestId?: string): Promise<boolean> {
    const before = await findHomeModuleById(this.db, id)
    if (!before) return false

    const deleted = await deleteHomeModule(this.db, id)
    if (!deleted) return false

    this.auditSvc.write({
      actorId,
      actionType: 'home_module.delete',
      targetKind: 'home_module',
      targetId: id,
      beforeJsonb: before as unknown as Record<string, unknown>,
      afterJsonb: null,
      requestId: requestId ?? null,
    })

    return true
  }

  async reorder(
    params: ReorderParams,
    actorId: string,
    requestId?: string,
  ): Promise<{ updated: number }> {
    // R-MID-1 修复（中期审计 2026-05-12）：ADR-104 §audit log 协议表 reorder 行要求
    // beforeJsonb 含 oldOrdering（DB 原值），afterJsonb 含 newOrdering（入参）。
    // 之前实现 beforeItems = params.items.map(...) 取的是入参 newOrdering，导致 audit log
    // before ≡ after 失去取证价值；改为先并发读 DB 取 oldOrdering，items 中不存在的 id
    // 在 audit 中跳过（与 reorderHomeModules 静默忽略行为一致）。
    const beforeRows = await Promise.all(
      params.items.map((item) => findHomeModuleById(this.db, item.id)),
    )
    const beforeItems = beforeRows
      .filter((r): r is HomeModule => r !== null)
      .map((r) => ({ id: r.id, ordering: r.ordering }))

    const updated = await reorderHomeModules(this.db, params.items)

    this.auditSvc.write({
      actorId,
      actionType: 'home_module.reorder',
      targetKind: 'home_module',
      targetId: null,
      beforeJsonb: { items: beforeItems },
      afterJsonb: { items: params.items.map((item) => ({ id: item.id, ordering: item.ordering })) },
      requestId: requestId ?? null,
    })

    return { updated }
  }

  async publishToggle(
    id: string,
    params: PublishToggleParams,
    actorId: string,
    requestId?: string,
  ): Promise<HomeModule | null> {
    const before = await findHomeModuleById(this.db, id)
    if (!before) return null

    const after = await updateHomeModule(this.db, id, { enabled: params.enabled })
    if (!after) return null

    this.auditSvc.write({
      actorId,
      actionType: 'home_module.publish_toggle',
      targetKind: 'home_module',
      targetId: id,
      beforeJsonb: { enabled: before.enabled },
      afterJsonb: { enabled: after.enabled },
      requestId: requestId ?? null,
    })

    return after
  }
}

export { AppError, ERRORS }

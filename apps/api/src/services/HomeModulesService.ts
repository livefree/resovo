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
} from '@/api/db/queries/home-modules'
import { AuditLogService } from '@/api/services/AuditLogService'
import { AppError, ERRORS } from '@/api/lib/errors'

// ── zod schemas（ADR-104 端点契约，R1 修订：CreateBase + applyBusinessRules）──

const SlotEnum = z.enum(['banner', 'featured', 'top10', 'type_shortcuts'])
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
        const compat: Record<string, readonly string[]> = {
          banner: ['video', 'external_url', 'custom_html'],
          featured: ['video'],
          top10: ['video'],
          type_shortcuts: ['video_type'],
        }
        return compat[v.slot]?.includes(v.contentRefType) ?? false
      },
      { message: 'slot × contentRefType 组合不被允许', path: ['contentRefType'] },
    )
}

export const CreateSchema = applyBusinessRules(CreateBase)

// UpdateSchema：omit enabled（强制走 publish-toggle 专用端点；ADR-104 Y2 闭合）
// .strict() 确保 enabled 字段被显式拒绝（unrecognized_keys），而非静默剥离后报"至少一字段"
export const UpdateSchema = applyBusinessRules(CreateBase.omit({ enabled: true }).partial().strict())
  .refine((v) => Object.keys(v as object).length > 0, { message: '至少一字段' })

export type ListParams = z.infer<typeof ListSchema>
export type CreateParams = z.infer<typeof CreateSchema>
export type UpdateParams = z.infer<typeof UpdateSchema>

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
}

export { AppError, ERRORS }

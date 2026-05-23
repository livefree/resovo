/**
 * FilterPresetService.ts — FilterPreset 业务层（ADR-144 / CHG-SN-8-FUP-PRESET-TEAM-EP-A）
 *
 * 职责：
 *   - zod 校验
 *   - RBAC（owner 全权 + admin 强制删 shared + moderator 不可改他人）
 *   - is_default 互斥事务（DB 部分唯一索引兜底）
 *   - audit fire-and-forget（R-MID-1 第 21-23 次系统化）
 */
import type { Pool } from 'pg'
import { z } from 'zod'
import {
  listFilterPresets,
  findFilterPresetById,
  insertFilterPreset,
  updateFilterPreset,
  clearDefaultForOwnerTab,
  deleteFilterPreset,
  type FilterPresetRow,
} from '../db/queries/filterPresets.js'
import type { AuditLogService } from './AuditLogService.js'

// ── 错误类型 ────────────────────────────────────────────────────────────

export class NotFoundError extends Error {
  constructor(msg = 'NOT_FOUND') { super(msg); this.name = 'NotFoundError' }
}
export class ForbiddenError extends Error {
  constructor(msg = 'FORBIDDEN') { super(msg); this.name = 'ForbiddenError' }
}
export class ConflictError extends Error {
  constructor(msg = 'STATE_CONFLICT') { super(msg); this.name = 'ConflictError' }
}

// ── zod schemas ────────────────────────────────────────────────────────

const SCOPE_ENUM = z.enum(['private', 'shared'])
const TAB_ENUM = z.enum(['pending', 'staging', 'rejected', 'all'])

export const ListFilterPresetsQuerySchema = z.object({
  tab: TAB_ENUM.optional(),
  scope: SCOPE_ENUM.optional(),
})

export const CreateFilterPresetSchema = z.object({
  name: z.string().min(1).max(100),
  scope: SCOPE_ENUM.default('private'),
  tab: TAB_ENUM,
  query: z.record(z.unknown()).default({}),
  isDefault: z.boolean().default(false),
})

export const UpdateFilterPresetSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  scope: SCOPE_ENUM.optional(),
  tab: TAB_ENUM.optional(),
  query: z.record(z.unknown()).optional(),
  isDefault: z.boolean().optional(),
}).refine(v => Object.keys(v).length > 0, { message: '至少提供一个更新字段' })

// ── DTO ────────────────────────────────────────────────────────────────

export interface FilterPresetDto {
  readonly id: string
  readonly ownerUserId: string
  readonly ownerUsername: string | null
  readonly name: string
  readonly scope: 'private' | 'shared'
  readonly tab: 'pending' | 'staging' | 'rejected' | 'all'
  readonly query: Record<string, unknown>
  readonly isDefault: boolean
  readonly createdAt: string
  readonly updatedAt: string
}

function toDto(row: FilterPresetRow): FilterPresetDto {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    ownerUsername: row.owner_username,
    name: row.name,
    scope: row.scope,
    tab: row.tab,
    query: row.query_jsonb,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ── Service ────────────────────────────────────────────────────────────

export interface ActorContext {
  readonly userId: string
  readonly role: 'admin' | 'moderator' | 'user'
}

export class FilterPresetService {
  constructor(
    private readonly db: Pool,
    private readonly auditSvc: AuditLogService,
  ) {}

  async list(actor: ActorContext, query: z.infer<typeof ListFilterPresetsQuerySchema>): Promise<readonly FilterPresetDto[]> {
    const rows = await listFilterPresets(this.db, {
      viewerUserId: actor.userId,
      tab: query.tab,
      scope: query.scope,
    })
    return rows.map(toDto)
  }

  async create(actor: ActorContext, input: z.infer<typeof CreateFilterPresetSchema>): Promise<FilterPresetDto> {
    // is_default 互斥：先清同 owner+tab 旧 default
    if (input.isDefault) {
      await clearDefaultForOwnerTab(this.db, actor.userId, input.tab)
    }
    let row: FilterPresetRow
    try {
      row = await insertFilterPreset(this.db, {
        ownerUserId: actor.userId,
        name: input.name,
        scope: input.scope,
        tab: input.tab,
        query: input.query,
        isDefault: input.isDefault,
      })
    } catch (err: unknown) {
      // 23505 部分唯一索引违反（极端并发场景）
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
        throw new ConflictError('同一 tab 已有 default 预设')
      }
      throw err
    }

    this.auditSvc.write({
      actorId: actor.userId,
      actionType: 'filter_preset.create',
      targetKind: 'filter_preset',
      targetId: row.id,
      beforeJsonb: null,
      afterJsonb: { id: row.id, name: row.name, scope: row.scope, tab: row.tab, queryKeys: Object.keys(row.query_jsonb) },
    })

    return toDto(row)
  }

  async update(actor: ActorContext, id: string, patch: z.infer<typeof UpdateFilterPresetSchema>): Promise<FilterPresetDto> {
    const existing = await findFilterPresetById(this.db, id)
    if (!existing) throw new NotFoundError()
    if (existing.owner_user_id !== actor.userId) {
      // owner 外不可改（admin 也不可改他人，仅可强制删 shared）
      throw new ForbiddenError('仅 owner 可编辑预设')
    }

    // is_default 互斥：若 isDefault=true 或修改 tab + isDefault=true，先清新 tab 旧 default
    if (patch.isDefault === true) {
      const targetTab = patch.tab ?? existing.tab
      await clearDefaultForOwnerTab(this.db, actor.userId, targetTab, id)
    }

    let updated: FilterPresetRow | null
    try {
      updated = await updateFilterPreset(this.db, id, patch)
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
        throw new ConflictError('同一 tab 已有 default 预设')
      }
      throw err
    }
    if (!updated) throw new NotFoundError()

    // diff-only audit：仅记变更字段
    const beforeDiff: Record<string, unknown> = {}
    const afterDiff: Record<string, unknown> = {}
    if (patch.name !== undefined && patch.name !== existing.name)             { beforeDiff.name = existing.name; afterDiff.name = updated.name }
    if (patch.scope !== undefined && patch.scope !== existing.scope)          { beforeDiff.scope = existing.scope; afterDiff.scope = updated.scope }
    if (patch.tab !== undefined && patch.tab !== existing.tab)                { beforeDiff.tab = existing.tab; afterDiff.tab = updated.tab }
    if (patch.isDefault !== undefined && patch.isDefault !== existing.is_default) { beforeDiff.isDefault = existing.is_default; afterDiff.isDefault = updated.is_default }
    if (patch.query !== undefined)                                            { beforeDiff.queryKeys = Object.keys(existing.query_jsonb); afterDiff.queryKeys = Object.keys(updated.query_jsonb) }

    this.auditSvc.write({
      actorId: actor.userId,
      actionType: 'filter_preset.update',
      targetKind: 'filter_preset',
      targetId: id,
      beforeJsonb: Object.keys(beforeDiff).length > 0 ? beforeDiff : null,
      afterJsonb: Object.keys(afterDiff).length > 0 ? afterDiff : null,
    })

    return toDto(updated)
  }

  async remove(actor: ActorContext, id: string): Promise<void> {
    const existing = await findFilterPresetById(this.db, id)
    if (!existing) throw new NotFoundError()

    const isOwner = existing.owner_user_id === actor.userId
    const isAdminForceDeleteShared = actor.role === 'admin' && existing.scope === 'shared'
    if (!isOwner && !isAdminForceDeleteShared) {
      throw new ForbiddenError('仅 owner 或 admin 强制删 shared 预设')
    }

    const deleted = await deleteFilterPreset(this.db, id)
    if (!deleted) throw new NotFoundError()

    this.auditSvc.write({
      actorId: actor.userId,
      actionType: 'filter_preset.delete',
      targetKind: 'filter_preset',
      targetId: id,
      beforeJsonb: { id: existing.id, name: existing.name, scope: existing.scope, tab: existing.tab },
      afterJsonb: null,
    })
  }
}

/**
 * home-modules.ts — home_modules 表 DB 查询（ADR-052）
 * 所有 SQL 参数化，不拼接字符串（db-rules.md）
 * 不含业务逻辑，业务在 HomeModulesService 层
 */

import type { Pool } from 'pg'
import type {
  HomeModule,
  HomeModuleSlot,
  HomeModuleContentRefType,
  CreateHomeModuleInput,
  UpdateHomeModuleInput,
  ReorderHomeModuleItem,
} from '@/types'

// ── DB 行类型 ─────────────────────────────────────────────────────

interface DbHomeModuleRow {
  id: string
  slot: HomeModuleSlot
  brand_scope: 'all-brands' | 'brand-specific'
  brand_slug: string | null
  ordering: number
  content_ref_type: HomeModuleContentRefType
  content_ref_id: string
  start_at: string | null
  end_at: string | null
  enabled: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

function mapRow(row: DbHomeModuleRow): HomeModule {
  return {
    id: row.id,
    slot: row.slot,
    brandScope: row.brand_scope,
    brandSlug: row.brand_slug,
    ordering: row.ordering,
    contentRefType: row.content_ref_type,
    contentRefId: row.content_ref_id,
    startAt: row.start_at,
    endAt: row.end_at,
    enabled: row.enabled,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ── 查询 ──────────────────────────────────────────────────────────

/**
 * 按 slot + 品牌查询当前激活模块列表（前台主查询路径）
 * brand_scope 协议：WHERE brand_scope = 'all-brands' OR brand_slug = $2（ADR-052）
 */
export async function listActiveHomeModules(
  db: Pool,
  slot: HomeModuleSlot,
  brandSlug: string | null,
): Promise<HomeModule[]> {
  const result = await db.query<DbHomeModuleRow>(
    `SELECT id, slot, brand_scope, brand_slug, ordering,
            content_ref_type, content_ref_id,
            start_at, end_at, enabled, metadata, created_at, updated_at
     FROM home_modules
     WHERE slot = $1
       AND enabled = true
       AND (brand_scope = 'all-brands' OR brand_slug = $2)
       AND (start_at IS NULL OR start_at <= NOW())
       AND (end_at   IS NULL OR end_at   >  NOW())
     ORDER BY ordering ASC, created_at ASC`,
    [slot, brandSlug],
  )
  return result.rows.map(mapRow)
}

/**
 * Admin：按过滤条件列出全部模块（含禁用与已过期），支持分页
 */
export async function listAdminHomeModules(
  db: Pool,
  params: {
    slot?: HomeModuleSlot
    brandScope?: 'all-brands' | 'brand-specific'
    brandSlug?: string
    enabled?: boolean
    page: number
    limit: number
  },
): Promise<{ rows: HomeModule[]; total: number }> {
  const conditions: string[] = []
  const values: unknown[] = []

  if (params.slot !== undefined) {
    values.push(params.slot)
    conditions.push(`slot = $${values.length}`)
  }
  if (params.brandScope !== undefined) {
    values.push(params.brandScope)
    conditions.push(`brand_scope = $${values.length}`)
  }
  if (params.brandSlug !== undefined) {
    values.push(params.brandSlug)
    conditions.push(`brand_slug = $${values.length}`)
  }
  if (params.enabled !== undefined) {
    values.push(params.enabled)
    conditions.push(`enabled = $${values.length}`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const offset = (params.page - 1) * params.limit

  const [dataResult, countResult] = await Promise.all([
    db.query<DbHomeModuleRow>(
      `SELECT id, slot, brand_scope, brand_slug, ordering,
              content_ref_type, content_ref_id,
              start_at, end_at, enabled, metadata, created_at, updated_at
       FROM home_modules
       ${where}
       ORDER BY slot ASC, ordering ASC, created_at ASC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, params.limit, offset],
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM home_modules ${where}`,
      values,
    ),
  ])

  return {
    rows: dataResult.rows.map(mapRow),
    total: parseInt(countResult.rows[0]?.count ?? '0', 10),
  }
}

/** 按 id 查询单条 */
export async function findHomeModuleById(
  db: Pool,
  id: string,
): Promise<HomeModule | null> {
  const result = await db.query<DbHomeModuleRow>(
    `SELECT id, slot, brand_scope, brand_slug, ordering,
            content_ref_type, content_ref_id,
            start_at, end_at, enabled, metadata, created_at, updated_at
     FROM home_modules
     WHERE id = $1`,
    [id],
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

/**
 * 创建模块。
 * slot × content_ref_type 合法性由 DB CHECK 强制（ADR-052）；
 * 违反时抛 DB 错误，Service 层建议预校验以给出友好提示。
 */
export async function createHomeModule(
  db: Pool,
  input: CreateHomeModuleInput,
): Promise<HomeModule> {
  const result = await db.query<DbHomeModuleRow>(
    `INSERT INTO home_modules
       (slot, brand_scope, brand_slug, ordering, content_ref_type, content_ref_id,
        start_at, end_at, enabled, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, slot, brand_scope, brand_slug, ordering,
               content_ref_type, content_ref_id,
               start_at, end_at, enabled, metadata, created_at, updated_at`,
    [
      input.slot,
      input.brandScope,
      input.brandSlug ?? null,
      input.ordering ?? 0,
      input.contentRefType,
      input.contentRefId,
      input.startAt ?? null,
      input.endAt ?? null,
      input.enabled ?? true,
      JSON.stringify(input.metadata ?? {}),
    ],
  )
  return mapRow(result.rows[0])
}

/** 部分更新（仅更新 input 中定义的字段） */
export async function updateHomeModule(
  db: Pool,
  id: string,
  input: UpdateHomeModuleInput,
): Promise<HomeModule | null> {
  const sets: string[] = []
  const values: unknown[] = []

  const fieldMap: Array<[keyof UpdateHomeModuleInput, string]> = [
    ['slot', 'slot'],
    ['brandScope', 'brand_scope'],
    ['brandSlug', 'brand_slug'],
    ['ordering', 'ordering'],
    ['contentRefType', 'content_ref_type'],
    ['contentRefId', 'content_ref_id'],
    ['startAt', 'start_at'],
    ['endAt', 'end_at'],
    ['enabled', 'enabled'],
    ['metadata', 'metadata'],
  ]

  for (const [key, col] of fieldMap) {
    if (key in input) {
      values.push(key === 'metadata' ? JSON.stringify(input[key]) : input[key])
      sets.push(`${col} = $${values.length}`)
    }
  }

  if (sets.length === 0) return findHomeModuleById(db, id)

  values.push(id)
  const result = await db.query<DbHomeModuleRow>(
    `UPDATE home_modules
     SET ${sets.join(', ')}
     WHERE id = $${values.length}
     RETURNING id, slot, brand_scope, brand_slug, ordering,
               content_ref_type, content_ref_id,
               start_at, end_at, enabled, metadata, created_at, updated_at`,
    values,
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

/** 硬删除（运营下线通过 enabled=false；DELETE 仅用于清理错误条目） */
export async function deleteHomeModule(
  db: Pool,
  id: string,
): Promise<boolean> {
  const result = await db.query(
    `DELETE FROM home_modules WHERE id = $1`,
    [id],
  )
  return (result.rowCount ?? 0) > 0
}

/**
 * 批量更新 ordering（单事务内执行，全部成功或回滚）
 * 返回实际更新行数。items 中不存在的 id 会被忽略。
 */
export async function reorderHomeModules(
  db: Pool,
  items: ReorderHomeModuleItem[],
): Promise<number> {
  if (items.length === 0) return 0

  const client = await db.connect()
  let updated = 0
  try {
    await client.query('BEGIN')
    for (const { id, ordering } of items) {
      const r = await client.query(
        `UPDATE home_modules SET ordering = $2 WHERE id = $1`,
        [id, ordering],
      )
      updated += r.rowCount ?? 0
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
  return updated
}

/** Admin 工具：按 content_ref 反查（用于 video 软删时的级联失效提示） */
export async function listHomeModulesByContentRef(
  db: Pool,
  contentRefType: HomeModuleContentRefType,
  contentRefId: string,
): Promise<HomeModule[]> {
  const result = await db.query<DbHomeModuleRow>(
    `SELECT id, slot, brand_scope, brand_slug, ordering,
            content_ref_type, content_ref_id,
            start_at, end_at, enabled, metadata, created_at, updated_at
     FROM home_modules
     WHERE content_ref_type = $1 AND content_ref_id = $2
     ORDER BY slot ASC, ordering ASC`,
    [contentRefType, contentRefId],
  )
  return result.rows.map(mapRow)
}

/**
 * filterPresets.ts — user_filter_presets DB queries（ADR-144 / CHG-SN-8-FUP-PRESET-TEAM-EP-A）
 *
 * 仅 SQL 层；不含业务逻辑（RBAC + zod 校验 + audit fire-and-forget 在 Service 层）
 */
import type { Pool, PoolClient } from 'pg'

export interface FilterPresetRow {
  readonly id: string
  readonly owner_user_id: string
  readonly owner_username: string | null
  readonly name: string
  readonly scope: 'private' | 'shared'
  readonly tab: 'pending' | 'staging' | 'rejected' | 'all'
  readonly query_jsonb: Record<string, unknown>
  readonly is_default: boolean
  readonly created_at: string
  readonly updated_at: string
}

export interface ListFilterPresetsParams {
  readonly viewerUserId: string
  readonly tab?: 'pending' | 'staging' | 'rejected' | 'all'
  readonly scope?: 'private' | 'shared'
  readonly limit?: number
}

const DEFAULT_LIMIT = 200

/**
 * 列出可见预设：own private + own shared + 他人 shared
 * - tab/scope 可选 filter
 * - LEFT JOIN users 取 ownerUsername（owner 删除场景保留行）
 * - 200 上限（ADR-144 D-144-3）
 */
export async function listFilterPresets(
  db: Pool,
  params: ListFilterPresetsParams,
): Promise<readonly FilterPresetRow[]> {
  const limit = Math.min(params.limit ?? DEFAULT_LIMIT, DEFAULT_LIMIT)
  const tabFilter = params.tab ? `AND ufp.tab = $${params.scope ? 4 : 3}` : ''

  // 可见性：own(任意 scope) + 他人 shared
  const args: unknown[] = [params.viewerUserId, limit]
  let sql = `
    SELECT ufp.id, ufp.owner_user_id, u.username AS owner_username, ufp.name,
           ufp.scope, ufp.tab, ufp.query_jsonb, ufp.is_default,
           ufp.created_at, ufp.updated_at
    FROM user_filter_presets ufp
    LEFT JOIN users u ON u.id = ufp.owner_user_id
    WHERE (ufp.owner_user_id = $1 OR ufp.scope = 'shared')
  `
  if (params.scope) {
    sql += ` AND ufp.scope = $3`
    args.push(params.scope)
  }
  if (params.tab) {
    sql += ` AND ufp.tab = $${args.length + 1}`
    args.push(params.tab)
  }
  sql += ` ORDER BY ufp.is_default DESC, ufp.updated_at DESC LIMIT $2`

  const res = await db.query<FilterPresetRow>(sql, args)
  return res.rows
}

export async function findFilterPresetById(
  db: Pool,
  id: string,
): Promise<FilterPresetRow | null> {
  const res = await db.query<FilterPresetRow>(
    `SELECT ufp.id, ufp.owner_user_id, u.username AS owner_username, ufp.name,
            ufp.scope, ufp.tab, ufp.query_jsonb, ufp.is_default,
            ufp.created_at, ufp.updated_at
     FROM user_filter_presets ufp
     LEFT JOIN users u ON u.id = ufp.owner_user_id
     WHERE ufp.id = $1`,
    [id],
  )
  return res.rows[0] ?? null
}

export interface CreateFilterPresetInput {
  readonly ownerUserId: string
  readonly name: string
  readonly scope: 'private' | 'shared'
  readonly tab: 'pending' | 'staging' | 'rejected' | 'all'
  readonly query: Record<string, unknown>
  readonly isDefault: boolean
}

export async function insertFilterPreset(
  client: Pool | PoolClient,
  input: CreateFilterPresetInput,
): Promise<FilterPresetRow> {
  const res = await client.query<FilterPresetRow>(
    `INSERT INTO user_filter_presets (owner_user_id, name, scope, tab, query_jsonb, is_default)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)
     RETURNING id, owner_user_id, NULL::text AS owner_username, name, scope, tab,
               query_jsonb, is_default, created_at, updated_at`,
    [input.ownerUserId, input.name, input.scope, input.tab, JSON.stringify(input.query), input.isDefault],
  )
  return res.rows[0]!
}

export interface UpdateFilterPresetPatch {
  readonly name?: string
  readonly scope?: 'private' | 'shared'
  readonly tab?: 'pending' | 'staging' | 'rejected' | 'all'
  readonly query?: Record<string, unknown>
  readonly isDefault?: boolean
}

export async function updateFilterPreset(
  client: Pool | PoolClient,
  id: string,
  patch: UpdateFilterPresetPatch,
): Promise<FilterPresetRow | null> {
  const sets: string[] = []
  const args: unknown[] = []
  let i = 1
  if (patch.name !== undefined)      { sets.push(`name = $${i++}`);          args.push(patch.name) }
  if (patch.scope !== undefined)     { sets.push(`scope = $${i++}`);         args.push(patch.scope) }
  if (patch.tab !== undefined)       { sets.push(`tab = $${i++}`);           args.push(patch.tab) }
  if (patch.query !== undefined)     { sets.push(`query_jsonb = $${i++}::jsonb`); args.push(JSON.stringify(patch.query)) }
  if (patch.isDefault !== undefined) { sets.push(`is_default = $${i++}`);    args.push(patch.isDefault) }
  if (sets.length === 0) return findFilterPresetById(client as Pool, id)

  args.push(id)
  const res = await client.query<FilterPresetRow>(
    `UPDATE user_filter_presets SET ${sets.join(', ')}
     WHERE id = $${i}
     RETURNING id, owner_user_id, NULL::text AS owner_username, name, scope, tab,
               query_jsonb, is_default, created_at, updated_at`,
    args,
  )
  return res.rows[0] ?? null
}

/**
 * 清除同 owner + 同 tab 旧 default（设新 default 前调用）。
 * 配合 DB 部分唯一索引 idx_ufp_default_unique 保证 race-safe。
 */
export async function clearDefaultForOwnerTab(
  client: Pool | PoolClient,
  ownerUserId: string,
  tab: 'pending' | 'staging' | 'rejected' | 'all',
  excludeId?: string,
): Promise<void> {
  if (excludeId) {
    await client.query(
      `UPDATE user_filter_presets SET is_default = FALSE
       WHERE owner_user_id = $1 AND tab = $2 AND is_default = TRUE AND id != $3`,
      [ownerUserId, tab, excludeId],
    )
  } else {
    await client.query(
      `UPDATE user_filter_presets SET is_default = FALSE
       WHERE owner_user_id = $1 AND tab = $2 AND is_default = TRUE`,
      [ownerUserId, tab],
    )
  }
}

export async function deleteFilterPreset(db: Pool, id: string): Promise<boolean> {
  const res = await db.query(`DELETE FROM user_filter_presets WHERE id = $1`, [id])
  return (res.rowCount ?? 0) > 0
}

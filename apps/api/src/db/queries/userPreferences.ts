/**
 * userPreferences.ts — 用户偏好 DB 查询（ADR-165 / CHG-SN-9-ROUTE-LABEL-D-A1）
 *
 * 设计：
 *   - R-165-1：独立 query 文件 / 不复用 findUserById SELECT *（防 JSONB 隐式拉取性能债）
 *   - R-165-3：顶层模块 PATCH 语义 / JSONB merge SQL `preferences || $1::jsonb`
 *
 * 仅接受当前请求 userId（洞察 5 admin 域 RBAC 副作用规避 / 不暴露 admin 全量列表）。
 */

import type { Pool } from 'pg'
import type { UserPreferences, UserPreferencesPatch } from '@resovo/types'

/**
 * 仅 SELECT preferences 列（R-165-1 / 不复用 findUserById SELECT *）。
 *
 * @returns 用户偏好 / 未找到（用户不存在 / 已软删）→ null
 */
export async function getUserPreferences(
  db: Pool,
  userId: string,
): Promise<UserPreferences | null> {
  const result = await db.query<{ preferences: UserPreferences }>(
    `SELECT preferences
     FROM users
     WHERE id = $1 AND deleted_at IS NULL`,
    [userId],
  )
  return result.rows[0]?.preferences ?? null
}

/**
 * 顶层模块 PATCH 更新（ADR-165 R-165-3 / D-165-7）：
 *
 * - `patch[key] = value` → JSONB merge 该顶层 key（覆盖 / 不影响其他模块）
 * - `patch[key] = null` → 删除该顶层 key（`preferences - 'key'`）
 * - `patch[key] = undefined` → 不改（被 zod 过滤前不进入 SQL）
 *
 * 跨模块零冲突：tab1 改 routeTheme + tab2 改 playerSettings 互不影响。
 * 模块内 last-write-wins。
 *
 * @returns 更新后的完整 preferences / 用户不存在 → null
 */
export async function updateUserPreferences(
  db: Pool,
  userId: string,
  patch: UserPreferencesPatch,
): Promise<UserPreferences | null> {
  // 分离要 merge 的字段（非 null）和要 delete 的字段（null）
  const mergeEntries: Array<[string, unknown]> = []
  const deleteKeys: string[] = []
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      deleteKeys.push(key)
    } else if (value !== undefined) {
      mergeEntries.push([key, value])
    }
  }

  if (mergeEntries.length === 0 && deleteKeys.length === 0) {
    // 空 patch → 直接返回当前值（幂等）
    return getUserPreferences(db, userId)
  }

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    if (mergeEntries.length > 0) {
      const mergeObj: Record<string, unknown> = Object.fromEntries(mergeEntries)
      await client.query(
        `UPDATE users
         SET preferences = preferences || $1::jsonb
         WHERE id = $2 AND deleted_at IS NULL`,
        [JSON.stringify(mergeObj), userId],
      )
    }

    if (deleteKeys.length > 0) {
      // 用 #- 操作符删除每个顶层 key（多个 key 依次删除）
      for (const key of deleteKeys) {
        await client.query(
          `UPDATE users
           SET preferences = preferences - $1::text
           WHERE id = $2 AND deleted_at IS NULL`,
          [key, userId],
        )
      }
    }

    const result = await client.query<{ preferences: UserPreferences }>(
      `SELECT preferences
       FROM users
       WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    )

    await client.query('COMMIT')
    return result.rows[0]?.preferences ?? null
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

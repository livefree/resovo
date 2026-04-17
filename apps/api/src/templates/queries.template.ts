/**
 * TEMPLATE: 数据库查询层
 * 使用方法：复制此文件，替换 [resource] 和 [Resource]，填充 TODO 部分
 * 规则：只写 SQL，不含业务逻辑；全部参数化查询，禁止字符串拼接
 */

import type { Pool } from 'pg'
import { nanoid } from 'nanoid'
// TODO: 替换为实际类型
import type { [Resource], Create[Resource]Input } from '@/types/[resource].types'

// ── 查询函数 ─────────────────────────────────────────────────────

export async function findById(
  db: Pool,
  shortId: string,
): Promise<[Resource] | null> {
  const result = await db.query<[Resource]>(
    // TODO: 替换表名和字段
    `SELECT * FROM [resource]s
     WHERE short_id = $1
       AND deleted_at IS NULL`,
    [shortId],
  )
  return result.rows[0] ?? null
}

export async function list(
  db: Pool,
  params: {
    page: number
    limit: number
    // TODO: 添加过滤参数类型
  },
): Promise<{ rows: [Resource][]; total: number }> {
  const offset = (params.page - 1) * params.limit

  // 动态构建 WHERE 条件（按需使用）
  const conditions: string[] = ['deleted_at IS NULL']
  const values: unknown[] = []
  let idx = 1

  // TODO: 添加过滤条件示例：
  // if (params.type) {
  //   conditions.push(`type = $${idx++}`)
  //   values.push(params.type)
  // }

  const where = conditions.join(' AND ')

  const [rowsResult, countResult] = await Promise.all([
    db.query<[Resource]>(
      `SELECT * FROM [resource]s
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, params.limit, offset],
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM [resource]s WHERE ${where}`,
      values,
    ),
  ])

  return {
    rows: rowsResult.rows,
    total: countResult.rows[0].count,
  }
}

export async function create(
  db: Pool,
  input: Create[Resource]Input,
): Promise<[Resource]> {
  const result = await db.query<[Resource]>(
    // TODO: 替换字段列表
    `INSERT INTO [resource]s (id, short_id, owner_id, title, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, NOW())
     RETURNING *`,
    [nanoid(8), input.ownerId, input.title],
  )
  return result.rows[0]
}

export async function update(
  db: Pool,
  shortId: string,
  input: Partial<Create[Resource]Input>,
): Promise<[Resource]> {
  // 只更新传入的字段
  const fields: string[] = []
  const values: unknown[] = []
  let idx = 1

  // TODO: 列出所有可更新字段
  if (input.title !== undefined) { fields.push(`title = $${idx++}`); values.push(input.title) }
  // if (input.description !== undefined) { ... }

  if (fields.length === 0) throw new Error('No fields to update')

  fields.push(`updated_at = NOW()`)
  values.push(shortId)

  const result = await db.query<[Resource]>(
    `UPDATE [resource]s
     SET ${fields.join(', ')}
     WHERE short_id = $${idx}
       AND deleted_at IS NULL
     RETURNING *`,
    values,
  )
  return result.rows[0]
}

export async function softDelete(db: Pool, shortId: string): Promise<void> {
  await db.query(
    `UPDATE [resource]s
     SET deleted_at = NOW()
     WHERE short_id = $1`,
    [shortId],
  )
}

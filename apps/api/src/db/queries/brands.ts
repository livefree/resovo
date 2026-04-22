/**
 * brands.ts — brands 表查询（TOKEN-08）
 *
 * 类型约束：
 *   - BrandOverrides 顶层只允许 semantic + component 两个键（设计约束 ADR-022）
 *   - 结构校验由 service 层 zod schema 完成；本文件只做 SQL ↔ 实体映射
 *   - 所有读路径排除软删除（deleted_at IS NULL）
 */

import type { Pool } from 'pg'

export interface BrandOverrides {
  readonly semantic?: Record<string, unknown>
  readonly component?: Record<string, unknown>
}

export interface Brand {
  readonly id: string
  readonly slug: string
  readonly name: string
  readonly overrides: BrandOverrides
  readonly createdAt: Date
  readonly updatedAt: Date
}

interface BrandDbRow {
  id: string
  slug: string
  name: string
  overrides: BrandOverrides
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

export interface UpsertBrandInput {
  slug: string
  name: string
  overrides: BrandOverrides
}

function rowToBrand(row: BrandDbRow): Brand {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    overrides: row.overrides ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getBrandBySlug(db: Pool, slug: string): Promise<Brand | null> {
  const result = await db.query<BrandDbRow>(
    `SELECT id, slug, name, overrides, created_at, updated_at, deleted_at
       FROM brands
      WHERE slug = $1 AND deleted_at IS NULL
      LIMIT 1`,
    [slug],
  )
  const row = result.rows[0]
  return row ? rowToBrand(row) : null
}

export async function listBrands(db: Pool): Promise<Brand[]> {
  const result = await db.query<BrandDbRow>(
    `SELECT id, slug, name, overrides, created_at, updated_at, deleted_at
       FROM brands
      WHERE deleted_at IS NULL
      ORDER BY created_at ASC`,
  )
  return result.rows.map(rowToBrand)
}

/**
 * updateBrandOverridesIfUnchanged — 乐观锁更新 overrides
 * expectedUpdatedAt 不匹配时返回 null（版本冲突），调用方映射 409
 */
export async function updateBrandOverridesIfUnchanged(
  db: Pool,
  slug: string,
  overrides: BrandOverrides,
  expectedUpdatedAt: Date,
): Promise<Brand | null> {
  const result = await db.query<BrandDbRow>(
    `UPDATE brands
        SET overrides   = $1::jsonb,
            updated_at  = now()
      WHERE slug        = $2
        AND deleted_at  IS NULL
        AND updated_at  = $3
      RETURNING id, slug, name, overrides, created_at, updated_at, deleted_at`,
    [JSON.stringify(overrides ?? {}), slug, expectedUpdatedAt],
  )
  const row = result.rows[0]
  return row ? rowToBrand(row) : null
}

export async function upsertBrand(db: Pool, input: UpsertBrandInput): Promise<Brand> {
  const { slug, name, overrides } = input
  const result = await db.query<BrandDbRow>(
    `INSERT INTO brands (slug, name, overrides)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (slug) WHERE deleted_at IS NULL
     DO UPDATE SET
       name      = EXCLUDED.name,
       overrides = EXCLUDED.overrides
     RETURNING id, slug, name, overrides, created_at, updated_at, deleted_at`,
    [slug, name, JSON.stringify(overrides ?? {})],
  )
  const row = result.rows[0]
  if (!row) throw new Error(`upsertBrand: no row returned for slug=${slug}`)
  return rowToBrand(row)
}

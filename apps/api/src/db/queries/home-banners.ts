// home-banners.ts — home_banners 表 DB 查询
// 所有 SQL 参数化，不拼接字符串（db-rules.md）

import type { Pool } from 'pg'
import type {
  Banner,
  BannerCard,
  CreateBannerInput,
  UpdateBannerInput,
} from '@/types'

// ── DB 行类型 ────────────────────────────────────────────────────────────────

interface DbBannerRow {
  id: string
  title: Record<string, string>
  image_url: string
  link_type: string
  link_target: string
  sort_order: number
  active_from: string | null
  active_to: string | null
  is_active: boolean
  brand_scope: string
  brand_slug: string | null
  created_at: string
  updated_at: string
}

interface DbBannerCardRow extends DbBannerRow {
  video_type: string | null
  video_slug: string | null
}

// ── Row mappers ──────────────────────────────────────────────────────────────

function mapRow(row: DbBannerRow): Banner {
  return {
    id: row.id,
    title: row.title,
    imageUrl: row.image_url,
    linkType: row.link_type as Banner['linkType'],
    linkTarget: row.link_target,
    sortOrder: row.sort_order,
    activeFrom: row.active_from,
    activeTo: row.active_to,
    isActive: row.is_active,
    brandScope: row.brand_scope as Banner['brandScope'],
    brandSlug: row.brand_slug,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapCard(row: DbBannerCardRow): BannerCard & { videoType: string | null; videoSlug: string | null } {
  return {
    id: row.id,
    title: row.title,
    imageUrl: row.image_url,
    linkType: row.link_type as BannerCard['linkType'],
    linkTarget: row.link_target,
    sortOrder: row.sort_order,
    videoType: row.video_type ?? null,
    videoSlug: row.video_slug ?? null,
  }
}

// ── 公开查询 ─────────────────────────────────────────────────────────────────

export async function listActiveBanners(
  db: Pool,
  opts: { locale?: string; brandSlug?: string | null } = {}
): Promise<ReturnType<typeof mapCard>[]> {
  const now = new Date().toISOString()
  const params: unknown[] = [now, now]
  const conditions: string[] = [
    'b.is_active = true',
    '(b.active_from IS NULL OR b.active_from <= $1)',
    '(b.active_to IS NULL OR b.active_to >= $2)',
  ]

  if (opts.brandSlug) {
    params.push(opts.brandSlug)
    conditions.push(`(b.brand_scope = 'all-brands' OR b.brand_slug = $${params.length})`)
  } else {
    conditions.push(`b.brand_scope = 'all-brands'`)
  }

  const where = conditions.join(' AND ')
  const result = await db.query<DbBannerCardRow>(
    `SELECT b.*,
            v.type  AS video_type,
            v.slug  AS video_slug
       FROM home_banners b
       LEFT JOIN videos v
         ON b.link_type = 'video' AND v.short_id = b.link_target
      WHERE ${where}
      ORDER BY b.sort_order ASC`,
    params
  )
  return result.rows.map(mapCard)
}

// ── Admin 查询 ───────────────────────────────────────────────────────────────

// 允许的排序字段白名单（防止 SQL 注入）
const ALLOWED_SORT_FIELDS: Record<string, string> = {
  sortOrder: 'sort_order',
  createdAt: 'created_at',
  isActive:  'is_active',
}

export async function listAllBanners(
  db: Pool,
  opts: { page: number; limit: number; sortField?: string; sortDir?: string }
): Promise<{ rows: Banner[]; total: number }> {
  const offset = (opts.page - 1) * opts.limit
  const col = ALLOWED_SORT_FIELDS[opts.sortField ?? ''] ?? 'sort_order'
  const dir = opts.sortDir === 'desc' ? 'DESC' : 'ASC'
  const orderClause = col === 'sort_order'
    ? `${col} ${dir}, created_at DESC`
    : `${col} ${dir}, sort_order ASC`

  const [rows, countResult] = await Promise.all([
    db.query<DbBannerRow>(
      `SELECT * FROM home_banners ORDER BY ${orderClause} LIMIT $1 OFFSET $2`,
      [opts.limit, offset]
    ),
    db.query<{ count: string }>(`SELECT COUNT(*) FROM home_banners`),
  ])
  return {
    rows: rows.rows.map(mapRow),
    total: parseInt(countResult.rows[0].count, 10),
  }
}

export async function findBannerById(
  db: Pool,
  id: string
): Promise<Banner | null> {
  const result = await db.query<DbBannerRow>(
    `SELECT * FROM home_banners WHERE id = $1`,
    [id]
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function createBanner(
  db: Pool,
  input: CreateBannerInput
): Promise<Banner> {
  const result = await db.query<DbBannerRow>(
    `INSERT INTO home_banners
       (title, image_url, link_type, link_target, sort_order,
        active_from, active_to, is_active, brand_scope, brand_slug)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      JSON.stringify(input.title),
      input.imageUrl,
      input.linkType,
      input.linkTarget,
      input.sortOrder ?? 0,
      input.activeFrom ?? null,
      input.activeTo ?? null,
      input.isActive ?? true,
      input.brandScope ?? 'all-brands',
      input.brandSlug ?? null,
    ]
  )
  return mapRow(result.rows[0])
}

export async function updateBanner(
  db: Pool,
  id: string,
  input: UpdateBannerInput
): Promise<Banner | null> {
  const setClauses: string[] = []
  const params: unknown[] = []
  let idx = 1

  if (input.title !== undefined) {
    setClauses.push(`title = $${idx++}`)
    params.push(JSON.stringify(input.title))
  }
  if (input.imageUrl !== undefined) {
    setClauses.push(`image_url = $${idx++}`)
    params.push(input.imageUrl)
  }
  if (input.linkType !== undefined) {
    setClauses.push(`link_type = $${idx++}`)
    params.push(input.linkType)
  }
  if (input.linkTarget !== undefined) {
    setClauses.push(`link_target = $${idx++}`)
    params.push(input.linkTarget)
  }
  if (input.sortOrder !== undefined) {
    setClauses.push(`sort_order = $${idx++}`)
    params.push(input.sortOrder)
  }
  if (input.activeFrom !== undefined) {
    setClauses.push(`active_from = $${idx++}`)
    params.push(input.activeFrom)
  }
  if (input.activeTo !== undefined) {
    setClauses.push(`active_to = $${idx++}`)
    params.push(input.activeTo)
  }
  if (input.isActive !== undefined) {
    setClauses.push(`is_active = $${idx++}`)
    params.push(input.isActive)
  }
  if (input.brandScope !== undefined) {
    setClauses.push(`brand_scope = $${idx++}`)
    params.push(input.brandScope)
  }
  if (input.brandSlug !== undefined) {
    setClauses.push(`brand_slug = $${idx++}`)
    params.push(input.brandSlug)
  }

  if (setClauses.length === 0) return findBannerById(db, id)

  params.push(id)
  const result = await db.query<DbBannerRow>(
    `UPDATE home_banners SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function deleteBanner(db: Pool, id: string): Promise<boolean> {
  const result = await db.query(
    `DELETE FROM home_banners WHERE id = $1`,
    [id]
  )
  return (result.rowCount ?? 0) > 0
}

export async function updateBannerSortOrders(
  db: Pool,
  orders: Array<{ id: string; sortOrder: number }>
): Promise<void> {
  if (orders.length === 0) return
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    for (const { id, sortOrder } of orders) {
      await client.query(
        `UPDATE home_banners SET sort_order = $1 WHERE id = $2`,
        [sortOrder, id]
      )
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

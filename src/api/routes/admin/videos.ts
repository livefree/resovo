/**
 * admin/videos.ts — 视频内容管理接口
 * ADMIN-02
 *
 * GET    /admin/videos              列表（含 is_published 筛选，需 moderator+）
 * PATCH  /admin/videos/:id/publish  上下架（单条，需 moderator+）
 * POST   /admin/videos/batch-publish 批量上下架（需 moderator+，事务）
 * GET    /admin/videos/:id          获取单条详情（含未发布，需 moderator+）
 * PUT    /admin/videos/:id          编辑元数据（需 moderator+）
 * POST   /admin/videos              手动新增视频（需 moderator+）
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import type { VideoType, VideoStatus, VideoCategory } from '@/types'

// ── Zod Schema ────────────────────────────────────────────────────

const PublishSchema = z.object({
  isPublished: z.boolean(),
})

const BatchPublishSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  isPublished: z.boolean(),
})

const VideoMetaSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  titleEn: z.string().max(200).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  coverUrl: z.string().url().optional().nullable(),
  type: z.enum(['movie', 'series', 'anime', 'variety'] as const).optional(),
  category: z.string().max(50).optional().nullable(),
  year: z.number().int().min(1900).max(2100).optional().nullable(),
  country: z.string().max(10).optional().nullable(),
  episodeCount: z.number().int().min(0).optional(),
  status: z.enum(['ongoing', 'completed'] as const).optional(),
  rating: z.number().min(0).max(10).optional().nullable(),
  director: z.array(z.string()).optional(),
  cast: z.array(z.string()).optional(),
  writers: z.array(z.string()).optional(),
})

const CreateVideoSchema = VideoMetaSchema.required({ title: true, type: true })

const ListQuerySchema = z.object({
  status: z.enum(['pending', 'published', 'unpublished', 'all']).optional().default('all'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  q: z.string().max(100).optional(),
})

// ── 路由注册 ──────────────────────────────────────────────────────

export async function adminVideoRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['moderator', 'admin'])]

  // ── GET /admin/videos ────────────────────────────────────────
  fastify.get('/admin/videos', { preHandler: auth }, async (request, reply) => {
    const parsed = ListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const { status, page, limit, q } = parsed.data
    const conditions: string[] = ['v.deleted_at IS NULL']
    const params: unknown[] = []
    let idx = 1

    if (status === 'pending') {
      conditions.push(`v.is_published = false`)
    } else if (status === 'published') {
      conditions.push(`v.is_published = true`)
    } else if (status === 'unpublished') {
      // 包括 is_published=false（已审未发和已下架，此处不区分）
      conditions.push(`v.is_published = false`)
    }
    // 'all' → 不过滤

    if (q) {
      conditions.push(`(v.title ILIKE $${idx} OR v.title_en ILIKE $${idx})`)
      params.push(`%${q}%`)
      idx++
    }

    const where = conditions.join(' AND ')
    const offset = (page - 1) * limit

    const [rows, countResult] = await Promise.all([
      db.query(
        `SELECT v.id, v.short_id, v.title, v.title_en, v.cover_url, v.type,
                v.year, v.is_published, v.created_at, v.updated_at,
                (SELECT COUNT(*) FROM video_sources WHERE video_id = v.id AND is_active = true AND deleted_at IS NULL)::int AS source_count
         FROM videos v
         WHERE ${where}
         ORDER BY v.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
      db.query<{ count: string }>(
        `SELECT COUNT(*) FROM videos v WHERE ${where}`,
        params
      ),
    ])

    return reply.send({
      data: rows.rows,
      total: parseInt(countResult.rows[0]?.count ?? '0'),
      page,
      limit,
    })
  })

  // ── GET /admin/videos/:id ────────────────────────────────────
  fastify.get('/admin/videos/:id', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const result = await db.query(
      `SELECT v.*,
        (SELECT COUNT(*) FROM video_sources WHERE video_id = v.id AND is_active = true AND deleted_at IS NULL)::int AS source_count
       FROM videos v
       WHERE v.id = $1 AND v.deleted_at IS NULL`,
      [id]
    )
    const video = result.rows[0]
    if (!video) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 },
      })
    }
    return reply.send({ data: video })
  })

  // ── PATCH /admin/videos/:id/publish ─────────────────────────
  fastify.patch('/admin/videos/:id/publish', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = PublishSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const result = await db.query(
      `UPDATE videos SET is_published = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, is_published`,
      [parsed.data.isPublished, id]
    )
    if (result.rowCount === 0) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 },
      })
    }
    return reply.send({ data: result.rows[0] })
  })

  // ── POST /admin/videos/batch-publish ────────────────────────
  fastify.post('/admin/videos/batch-publish', { preHandler: auth }, async (request, reply) => {
    const parsed = BatchPublishSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const { ids, isPublished } = parsed.data
    const client = await db.connect()
    try {
      await client.query('BEGIN')
      const placeholders = ids.map((_, i) => `$${i + 2}`).join(', ')
      const result = await client.query(
        `UPDATE videos SET is_published = $1, updated_at = NOW()
         WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
        [isPublished, ...ids]
      )
      await client.query('COMMIT')
      return reply.send({ data: { updated: result.rowCount ?? 0 } })
    } catch (err) {
      await client.query('ROLLBACK')
      request.log.error({ err }, 'batch-publish failed')
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: '批量操作失败', status: 500 },
      })
    } finally {
      client.release()
    }
  })

  // ── PATCH /admin/videos/:id ──────────────────────────────────
  fastify.patch('/admin/videos/:id', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = VideoMetaSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const data = parsed.data
    const sets: string[] = ['updated_at = NOW()']
    const params: unknown[] = []
    let idx = 1

    const fieldMap: Record<string, string> = {
      title: 'title',
      titleEn: 'title_en',
      description: 'description',
      coverUrl: 'cover_url',
      type: 'type',
      category: 'category',
      year: 'year',
      country: 'country',
      episodeCount: 'episode_count',
      status: 'status',
      rating: 'rating',
      director: 'director',
      cast: 'cast',
      writers: 'writers',
    }

    for (const [key, col] of Object.entries(fieldMap)) {
      if (key in data && data[key as keyof typeof data] !== undefined) {
        sets.push(`${col} = $${idx++}`)
        const val = data[key as keyof typeof data]
        // Arrays stored as JSON in Postgres
        params.push(Array.isArray(val) ? JSON.stringify(val) : val)
      }
    }

    params.push(id)
    const result = await db.query(
      `UPDATE videos SET ${sets.join(', ')}
       WHERE id = $${idx} AND deleted_at IS NULL
       RETURNING *`,
      params
    )
    if (result.rowCount === 0) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 },
      })
    }
    return reply.send({ data: result.rows[0] })
  })

  // ── POST /admin/videos ───────────────────────────────────────
  fastify.post('/admin/videos', { preHandler: auth }, async (request, reply) => {
    const parsed = CreateVideoSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? '参数错误',
          status: 422,
        },
      })
    }

    const d = parsed.data
    const result = await db.query(
      `INSERT INTO videos
         (title, title_en, description, cover_url, type, category, year, country,
          episode_count, status, rating, director, cast, writers, is_published)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        d.title,
        d.titleEn ?? null,
        d.description ?? null,
        d.coverUrl ?? null,
        d.type,
        d.category ?? null,
        d.year ?? null,
        d.country ?? null,
        d.episodeCount ?? 1,
        d.status ?? 'completed',
        d.rating ?? null,
        JSON.stringify(d.director ?? []),
        JSON.stringify(d.cast ?? []),
        JSON.stringify(d.writers ?? []),
        false, // is_published default false (ADR-010)
      ]
    )
    return reply.code(201).send({ data: result.rows[0] })
  })
}

// ── 类型导出（供其他模块使用） ─────────────────────────────────────

export type { VideoType, VideoStatus, VideoCategory }

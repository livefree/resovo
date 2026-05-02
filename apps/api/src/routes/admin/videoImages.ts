/**
 * admin/videoImages.ts — 视频图片管理接口（IMG-06）
 *
 * GET /admin/videos/:id/images
 * PUT /admin/videos/:id/images
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { findAdminVideoById } from '@/api/db/queries/videos'
import { findCatalogById, updateCatalogFields } from '@/api/db/queries/mediaCatalog'
import { imageHealthQueue } from '@/api/lib/queue'
import type { ImageKind } from '@/types'

const ImageUpdateSchema = z.object({
  kind: z.enum(['poster', 'backdrop', 'logo', 'banner_backdrop'] as const),
  url:  z.string().url(),
})

type ImageKindFields = {
  urlField: keyof import('@/api/db/queries/mediaCatalog').CatalogUpdateData
  statusField: keyof import('@/api/db/queries/mediaCatalog').CatalogUpdateData
}

const IMAGE_KIND_FIELDS: Record<string, ImageKindFields> = {
  poster:          { urlField: 'coverUrl',          statusField: 'posterStatus' },
  backdrop:        { urlField: 'backdropUrl',        statusField: 'backdropStatus' },
  logo:            { urlField: 'logoUrl',            statusField: 'logoStatus' },
  banner_backdrop: { urlField: 'bannerBackdropUrl',  statusField: 'bannerBackdropStatus' },
}

export async function adminVideoImagesRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['moderator', 'admin'])]
  const adminOnly = [fastify.authenticate, fastify.requireRole(['admin'])]

  // ── GET /admin/videos/:id/images ────────────────────────────
  fastify.get('/admin/videos/:id/images', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const video = await findAdminVideoById(db, id)
    if (!video) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 },
      })
    }
    const catalog = await findCatalogById(db, video.catalog_id)
    if (!catalog) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '关联 catalog 不存在', status: 404 },
      })
    }
    return reply.send({
      data: {
        poster:          { url: catalog.coverUrl,          status: catalog.posterStatus },
        backdrop:        { url: catalog.backdropUrl,       status: catalog.backdropStatus },
        logo:            { url: catalog.logoUrl,           status: catalog.logoStatus },
        banner_backdrop: { url: catalog.bannerBackdropUrl, status: catalog.bannerBackdropStatus },
        lastStatusUpdatedAt: catalog.updatedAt,
      },
    })
  })

  // ── PUT /admin/videos/:id/images ─────────────────────────────
  fastify.put('/admin/videos/:id/images', { preHandler: adminOnly }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = ImageUpdateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }
    const { kind, url } = parsed.data

    const video = await findAdminVideoById(db, id)
    if (!video) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 },
      })
    }

    const fields = IMAGE_KIND_FIELDS[kind]!
    await updateCatalogFields(db, video.catalog_id, {
      [fields.urlField]:    url,
      [fields.statusField]: 'pending_review',
    })

    await imageHealthQueue.add('health-check', {
      type: 'health-check',
      catalogId: video.catalog_id,
      videoId: id,
      kind: kind as ImageKind,
      url,
    })
    await imageHealthQueue.add('blurhash-extract', {
      type: 'blurhash-extract',
      catalogId: video.catalog_id,
      videoId: id,
      kind: kind as ImageKind,
      url,
    })

    return reply.send({ data: { kind, url, status: 'pending_review' } })
  })
}

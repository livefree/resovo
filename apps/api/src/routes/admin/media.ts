/**
 * admin/media.ts — 后台媒体资产上传（IMG-06）
 *
 * POST /v1/admin/media/images — 图片上传（multipart）
 *
 * 权限：admin only（对齐 /admin/banners 系列；moderator 如需扩展请走 ADR）
 *
 * 架构分层：
 *   Route 只做编排：multipart 解析 → 调 MediaImageService → 返回 response
 *   业务逻辑（校验、存 R2、写 DB、入队）全部在 MediaImageService
 */

import type { FastifyInstance } from 'fastify'
import type { MultipartFile } from '@fastify/multipart'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { MediaImageService } from '@/api/services/MediaImageService'
import { ImageStorageError } from '@/api/services/ImageStorageService'
import type { ImageKind } from '@/types'

const OwnerTypeSchema = z.enum(['video', 'banner'])
const KindSchema = z.enum([
  'poster',
  'backdrop',
  'logo',
  'banner_backdrop',
  'stills',
  'thumbnail',
] as const)

export async function adminMediaRoutes(fastify: FastifyInstance): Promise<void> {
  const adminOnly = [fastify.authenticate, fastify.requireRole(['admin'])]
  const mediaImageService = new MediaImageService(db)

  // ── POST /admin/media/images ─────────────────────────────────────
  fastify.post('/admin/media/images', { preHandler: adminOnly }, async (request, reply) => {
    // 解析 multipart
    const data = await (request as unknown as { file: () => Promise<MultipartFile | undefined> }).file()
    if (!data) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '未找到上传文件', status: 422 },
      })
    }

    // 读取文件 buffer
    const chunks: Buffer[] = []
    for await (const chunk of data.file) {
      chunks.push(chunk as Buffer)
    }
    const buffer = Buffer.concat(chunks)

    // 解析字段
    const ownerTypeRaw = (data.fields['ownerType'] as { value: string } | undefined)?.value
    const ownerIdRaw = (data.fields['ownerId'] as { value: string } | undefined)?.value
    const kindRaw = (data.fields['kind'] as { value: string } | undefined)?.value

    const ownerTypeParsed = OwnerTypeSchema.safeParse(ownerTypeRaw)
    if (!ownerTypeParsed.success) {
      return reply.code(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: "ownerType 必须为 'video' 或 'banner'",
          status: 422,
        },
      })
    }
    const ownerType = ownerTypeParsed.data

    if (!ownerIdRaw || ownerIdRaw.trim().length === 0) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '缺少 ownerId 字段', status: 422 },
      })
    }

    let kind: ImageKind | undefined
    if (ownerType === 'video') {
      const kindParsed = KindSchema.safeParse(kindRaw)
      if (!kindParsed.success) {
        return reply.code(422).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: "ownerType='video' 必须提供合法 kind（poster/backdrop/logo/banner_backdrop）",
            status: 422,
          },
        })
      }
      kind = kindParsed.data
    }

    // 调 Service
    try {
      const result = await mediaImageService.upload({
        buffer,
        contentType: data.mimetype,
        ownerType,
        ownerId: ownerIdRaw.trim(),
        kind,
      })
      return reply.code(201).send({ data: result })
    } catch (err) {
      if (err instanceof ImageStorageError) {
        return reply.code(err.statusCode).send({
          error: { code: err.code, message: err.message, status: err.statusCode },
        })
      }
      const msg = err instanceof Error ? err.message : String(err)
      process.stderr.write(`[admin/media/images] 500: ${msg}\n`)
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: `上传失败：${msg}`, status: 500 },
      })
    }
  })
}

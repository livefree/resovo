/**
 * subtitles.ts — 字幕路由
 * SUBTITLE-01
 *
 * GET  /videos/:id/subtitles          — 获取字幕列表（公开）
 * POST /videos/:id/subtitles          — 上传字幕（需登录，最大 2MB，.srt/.ass/.vtt）
 */

import type { FastifyInstance } from 'fastify'
import type { MultipartFile } from '@fastify/multipart'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { SubtitleService } from '@/api/services/SubtitleService'

export async function subtitleRoutes(fastify: FastifyInstance) {
  const subtitleService = new SubtitleService(db)

  // ── GET /videos/:id/subtitles ─────────────────────────────────

  fastify.get('/videos/:id/subtitles', async (request, reply) => {
    const { id } = request.params as { id: string }
    const QuerySchema = z.object({
      episode: z.coerce.number().int().positive().optional(),
    })

    const parsed = QuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const subtitles = await subtitleService.list(id, parsed.data.episode)
    return reply.send({ data: subtitles })
  })

  // ── POST /videos/:id/subtitles ────────────────────────────────

  fastify.post(
    '/videos/:id/subtitles',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id: videoId } = request.params as { id: string }

      // Fastify multipart 文件上传（需在 server.ts 注册 @fastify/multipart）
      const data = await (request as unknown as { file: () => Promise<MultipartFile | undefined> }).file()
      if (!data) {
        return reply.code(422).send({
          error: { code: 'VALIDATION_ERROR', message: '未找到上传文件', status: 422 },
        })
      }

      // 读取文件内容
      const chunks: Buffer[] = []
      for await (const chunk of data.file) {
        chunks.push(chunk as Buffer)
      }
      const buffer = Buffer.concat(chunks)

      // 解析字段
      const language = (data.fields['language'] as { value: string } | undefined)?.value
      const episodeStr = (data.fields['episode'] as { value: string } | undefined)?.value

      if (!language) {
        return reply.code(422).send({
          error: { code: 'VALIDATION_ERROR', message: '缺少 language 字段', status: 422 },
        })
      }

      // 验证语言格式（BCP 47 简单校验）
      if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(language)) {
        return reply.code(422).send({
          error: { code: 'VALIDATION_ERROR', message: 'language 格式不正确（应为 BCP 47，如 zh-CN）', status: 422 },
        })
      }

      const episodeNumber = episodeStr ? parseInt(episodeStr, 10) : undefined

      try {
        const { subtitle } = await subtitleService.upload({
          videoId,
          language,
          episodeNumber,
          filename: data.filename,
          buffer,
        })
        return reply.code(201).send({ data: subtitle })
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode ?? 500
        const message = err instanceof Error ? err.message : '上传失败'
        return reply.code(statusCode).send({
          error: { code: 'UPLOAD_ERROR', message, status: statusCode },
        })
      }
    }
  )
}

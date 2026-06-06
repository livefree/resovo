/**
 * admin/home.ts — Home Curation 聚合门面 API（CHG-HOME-PREVIEW-API-A）
 * ADR-182：/admin/home/*（admin only；Route → HomeCurationService → queries）
 *
 * 已落地端点：
 * GET   /admin/home/preview                     — 整页预览聚合（#1）
 * GET   /admin/home/sections                    — 7 区块 settings + 状态摘要（#2）
 * PATCH /admin/home/sections/:section/settings  — 更新区块设置（#3，audit home_section.settings_update）
 * POST  /admin/home/sections/:section/reorder   — 区块内排序门面（#6，audit home_section.reorder，CHG-HOME-CARD-DND-A）
 *
 * #4/#5/#7 归 Phase 3。
 * 路由注册顺序声明（ADR-182）：`:section` 子动作为静态后缀路由，未来加入 `:section`
 * 通配动态路由时静态后缀必须先注册（参 home-modules.ts reorder 先于 /:id 范式）。
 */

import type { FastifyInstance } from 'fastify'
import { db } from '@/api/lib/postgres'
import {
  HomeCurationService,
  SectionParamSchema,
  UpdateSectionSettingsSchema,
  ReorderSectionSchema,
  PreviewQuerySchema,
} from '@/api/services/HomeCurationService'
import { isAppError } from '@/api/lib/errors'

export async function adminHomeRoutes(fastify: FastifyInstance) {
  const svc = new HomeCurationService(db)
  const adminOnly = [fastify.authenticate, fastify.requireRole(['admin'])]

  // ── GET /admin/home/preview ───────────────────────────────────────────────
  // CHG-HOME-PREVIEW-API-B / D-182-4 #1：整页预览聚合（跳缓存；Phase 1 正式配置预览无草稿叠加）

  fastify.get('/admin/home/preview', { preHandler: adminOnly }, async (request, reply) => {
    const parsed = PreviewQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }
    const data = await svc.buildPreview(parsed.data)
    return reply.send({ data })
  })

  // ── GET /admin/home/sections ──────────────────────────────────────────────

  fastify.get('/admin/home/sections', { preHandler: adminOnly }, async (_request, reply) => {
    const data = await svc.listSectionSummaries()
    return reply.send({ data })
  })

  // ── PATCH /admin/home/sections/:section/settings ──────────────────────────

  fastify.patch('/admin/home/sections/:section/settings', { preHandler: adminOnly }, async (request, reply) => {
    // D-182-4 #9：非法 section 枚举外值 → 422（先于 404 判定）
    const sectionParsed = SectionParamSchema.safeParse((request.params as { section: string }).section)
    if (!sectionParsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: `section 必须为 ${SectionParamSchema.options.join(' / ')}`, status: 422 },
      })
    }

    const bodyParsed = UpdateSectionSettingsSchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: bodyParsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }

    const updated = await svc.updateSettings(
      sectionParsed.data,
      bodyParsed.data,
      request.user!.userId,
      request.id,
    )
    if (!updated) {
      // seed 7 行恒存在；缺行 = 迁移漂移兜底（D-182-4 #8）
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: `home_section ${sectionParsed.data} settings 不存在`, status: 404 },
      })
    }
    return reply.send({ data: updated })
  })

  // ── POST /admin/home/sections/:section/reorder ────────────────────────────
  // CHG-HOME-CARD-DND-A / D-182-4 #6：区块内排序门面（画布唯一排序路径，按 section 分派真源）

  fastify.post('/admin/home/sections/:section/reorder', { preHandler: adminOnly }, async (request, reply) => {
    // D-182-4 #9：非法 section 枚举外值 → 422（先于 404 判定）
    const sectionParsed = SectionParamSchema.safeParse((request.params as { section: string }).section)
    if (!sectionParsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: `section 必须为 ${SectionParamSchema.options.join(' / ')}`, status: 422 },
      })
    }

    const bodyParsed = ReorderSectionSchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: bodyParsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }

    try {
      const result = await svc.reorderSection(
        sectionParsed.data,
        bodyParsed.data,
        request.user!.userId,
        request.id,
      )
      if (!result) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: `home_section ${sectionParsed.data} settings 不存在`, status: 404 },
        })
      }
      return reply.send({ data: result })
    } catch (err) {
      // 归属校验失败（id 不属于该 section 真源，D-182-4 #6）
      if (isAppError(err, 'VALIDATION_ERROR')) {
        return reply.code(422).send({
          error: { code: 'VALIDATION_ERROR', message: err.message, status: 422 },
        })
      }
      throw err
    }
  })
}

/**
 * admin/home.ts — Home Curation 聚合门面 API（CHG-HOME-PREVIEW-API-A）
 * ADR-182：/admin/home/*（admin only；Route → HomeCurationService → queries）
 *
 * 本卡落地端点 #2/#3：
 * GET   /admin/home/sections                    — 7 区块 settings + 状态摘要
 * PATCH /admin/home/sections/:section/settings  — 更新区块设置（audit home_section.settings_update）
 *
 * 端点 #1 preview 归 CHG-HOME-PREVIEW-API-B；#4/#5/#7 归 Phase 3；#6 归 Phase 2。
 * 路由注册顺序声明（ADR-182）：`:section` 子动作为静态后缀路由，未来加入 `:section`
 * 通配动态路由时静态后缀必须先注册（参 home-modules.ts reorder 先于 /:id 范式）。
 */

import type { FastifyInstance } from 'fastify'
import { db } from '@/api/lib/postgres'
import {
  HomeCurationService,
  SectionParamSchema,
  UpdateSectionSettingsSchema,
  PreviewQuerySchema,
} from '@/api/services/HomeCurationService'

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
}

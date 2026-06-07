/**
 * admin/home-publish.ts — Home Curation 发布治理 API（CHG-HOME-DRAFT-PUBLISH-A）
 * ADR-185：/admin/home/{draft,publish}（admin only；Route → HomePublishService → queries）
 *
 * 已落地端点（ADR-185 端点契约 #1–#7 全量）：
 * GET    /admin/home/draft                          — 读当前草稿（无草稿 200 data:null，#1）
 * PUT    /admin/home/draft                          — 整页草稿保存（整体替换，不计 audit，#2）
 * DELETE /admin/home/draft                          — 丢弃草稿（不计 audit，#3）
 * POST   /admin/home/publish                        — 发布（单事务 + audit home_page.publish，#4）
 * GET    /admin/home/versions                       — 版本分页列表（轻量行，#5，CHG-HOME-AUDIT-ROLLBACK）
 * GET    /admin/home/versions/:versionNo            — 版本详情（全量 config = diff 数据源，#6）
 * POST   /admin/home/versions/:versionNo/rollback   — 版本回滚（roll-forward + audit home_page.rollback，#7）
 *
 * 独立子路由文件（D-185-6.1：home.ts 248 行 + 7 新端点逼近 500 行硬限）。
 * 路由注册顺序声明（ADR-185）：/admin/home/draft 与 /admin/home/versions* 为静态
 * 前缀，与既有 /admin/home/sections/:section/* 无前缀包含冲突；rollback 静态后缀
 * 先于 :versionNo 详情注册（D-182 同款范式）。
 */

import type { FastifyInstance } from 'fastify'
import { db } from '@/api/lib/postgres'
import {
  HomePublishService,
  SaveDraftSchema,
  PublishSchema,
  ListVersionsSchema,
  VersionNoParamSchema,
  RollbackSchema,
} from '@/api/services/HomePublishService'
import { isAppError } from '@/api/lib/errors'

export async function adminHomePublishRoutes(fastify: FastifyInstance) {
  const svc = new HomePublishService(db)
  const adminOnly = [fastify.authenticate, fastify.requireRole(['admin'])]

  // ── GET /admin/home/draft ─────────────────────────────────────────────────
  // D-185-3.1：无草稿 200 { data: null }——存在性非错误。
  // staleness 顶层 additive（CHG-HOME-DRAFT-PUBLISH-B / D-185-2.2 编辑器提示；
  // 候选端点 gaps additive 同范式非 break）

  fastify.get('/admin/home/draft', { preHandler: adminOnly }, async (_request, reply) => {
    const { draft, staleness } = await svc.getDraftWithStaleness()
    return reply.send({ data: draft, staleness })
  })

  // ── PUT /admin/home/draft ─────────────────────────────────────────────────
  // D-185-3.1：整页整体替换（非 PATCH 深合并，settings JSONB 同款语义）

  fastify.put('/admin/home/draft', { preHandler: adminOnly }, async (request, reply) => {
    const parsed = SaveDraftSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }
    const data = await svc.saveDraft(parsed.data, request.user!.userId)
    return reply.send({ data })
  })

  // ── DELETE /admin/home/draft ──────────────────────────────────────────────

  fastify.delete('/admin/home/draft', { preHandler: adminOnly }, async (_request, reply) => {
    const data = await svc.discardDraft()
    return reply.send({ data })
  })

  // ── POST /admin/home/publish ──────────────────────────────────────────────
  // D-185-3.2：无草稿 422 / 陈旧双信号·重校验失败·并发竞态 409

  fastify.post('/admin/home/publish', { preHandler: adminOnly }, async (request, reply) => {
    const parsed = PublishSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }

    try {
      const data = await svc.publish(parsed.data, request.user!.userId, request.id)
      return reply.send({ data })
    } catch (err) {
      // 无草稿可发布
      if (isAppError(err, 'VALIDATION_ERROR')) {
        return reply.code(422).send({
          error: { code: 'VALIDATION_ERROR', message: err.message, status: 422 },
        })
      }
      // 草稿陈旧（双信号）/ 整页重校验失败 / 并发竞态
      if (isAppError(err, 'STATE_CONFLICT')) {
        return reply.code(409).send({
          error: { code: 'STATE_CONFLICT', message: err.message, status: 409 },
        })
      }
      throw err
    }
  })

  // ── POST /admin/home/versions/:versionNo/rollback ─────────────────────────
  // CHG-HOME-AUDIT-ROLLBACK / D-185-3.4：rollback 静态后缀先于详情路由注册

  fastify.post('/admin/home/versions/:versionNo/rollback', { preHandler: adminOnly }, async (request, reply) => {
    const noParsed = VersionNoParamSchema.safeParse((request.params as { versionNo: string }).versionNo)
    if (!noParsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'versionNo 必须为正整数', status: 422 },
      })
    }
    const bodyParsed = RollbackSchema.safeParse(request.body ?? {})
    if (!bodyParsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: bodyParsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }

    try {
      const data = await svc.rollback(noParsed.data, bodyParsed.data, request.user!.userId, request.id)
      if (!data) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: `版本 v${noParsed.data} 不存在`, status: 404 },
        })
      }
      return reply.send({ data })
    } catch (err) {
      // 版本数 < 2 无可回滚目标（D-185-1.5）
      if (isAppError(err, 'VALIDATION_ERROR')) {
        return reply.code(422).send({
          error: { code: 'VALIDATION_ERROR', message: err.message, status: 422 },
        })
      }
      if (isAppError(err, 'STATE_CONFLICT')) {
        return reply.code(409).send({
          error: { code: 'STATE_CONFLICT', message: err.message, status: 409 },
        })
      }
      throw err
    }
  })

  // ── GET /admin/home/versions ───────────────────────────────────────────────
  // D-185-3.3：轻量行分页（不含 config 载荷）

  fastify.get('/admin/home/versions', { preHandler: adminOnly }, async (request, reply) => {
    const parsed = ListVersionsSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }
    const result = await svc.listVersions(parsed.data)
    return reply.send({ data: result.rows, total: result.total, page: result.page, limit: result.limit })
  })

  // ── GET /admin/home/versions/:versionNo ────────────────────────────────────
  // D-185-3.3：详情含全量 config（消费端 diff 数据源，D-185-4.2）

  fastify.get('/admin/home/versions/:versionNo', { preHandler: adminOnly }, async (request, reply) => {
    const noParsed = VersionNoParamSchema.safeParse((request.params as { versionNo: string }).versionNo)
    if (!noParsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'versionNo 必须为正整数', status: 422 },
      })
    }
    const data = await svc.getVersion(noParsed.data)
    if (!data) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: `版本 v${noParsed.data} 不存在`, status: 404 },
      })
    }
    return reply.send({ data })
  })
}

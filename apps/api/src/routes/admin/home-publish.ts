/**
 * admin/home-publish.ts — Home Curation 发布治理 API（CHG-HOME-DRAFT-PUBLISH-A）
 * ADR-185：/admin/home/{draft,publish}（admin only；Route → HomePublishService → queries）
 *
 * 已落地端点（ADR-185 端点契约 #1–#4）：
 * GET    /admin/home/draft    — 读当前草稿（无草稿 200 data:null，#1）
 * PUT    /admin/home/draft    — 整页草稿保存（整体替换，不计 audit，#2）
 * DELETE /admin/home/draft    — 丢弃草稿（不计 audit，#3）
 * POST   /admin/home/publish  — 发布（单事务 + audit home_page.publish，#4）
 *
 * 端点 #5–#7（versions 列表/详情/rollback）归 CHG-HOME-AUDIT-ROLLBACK（卡 26）。
 * 独立子路由文件（D-185-6.1：home.ts 248 行 + 7 新端点逼近 500 行硬限）。
 * 路由注册顺序声明（ADR-185）：/admin/home/draft 为静态前缀，与既有
 * /admin/home/sections/:section/* 无前缀包含冲突。
 */

import type { FastifyInstance } from 'fastify'
import { db } from '@/api/lib/postgres'
import {
  HomePublishService,
  SaveDraftSchema,
  PublishSchema,
} from '@/api/services/HomePublishService'
import { isAppError } from '@/api/lib/errors'

export async function adminHomePublishRoutes(fastify: FastifyInstance) {
  const svc = new HomePublishService(db)
  const adminOnly = [fastify.authenticate, fastify.requireRole(['admin'])]

  // ── GET /admin/home/draft ─────────────────────────────────────────────────
  // D-185-3.1：无草稿 200 { data: null }——存在性非错误

  fastify.get('/admin/home/draft', { preHandler: adminOnly }, async (_request, reply) => {
    const data = await svc.getDraft()
    return reply.send({ data })
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
}

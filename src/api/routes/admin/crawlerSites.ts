/**
 * admin/crawlerSites.ts — 爬虫源站配置 CRUD API
 * CHG-34: admin only
 *
 * GET    /admin/crawler/sites             — 列表
 * POST   /admin/crawler/sites             — 新增
 * PATCH  /admin/crawler/sites/:key        — 更新
 * DELETE /admin/crawler/sites/:key        — 删除（from_config=true 不可删）
 * POST   /admin/crawler/sites/batch       — 批量操作
 * POST   /admin/crawler/sites/validate    — 验证 API 可达性
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import * as crawlerSitesQueries from '@/api/db/queries/crawlerSites'
import type { CrawlerSiteBatchAction } from '@/types'

const SourceTypeSchema = z.enum(['vod', 'shortdrama'])
const FormatSchema = z.enum(['json', 'xml'])

const CreateSiteSchema = z.object({
  key:        z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'key 只能含字母数字下划线短横线'),
  name:       z.string().min(1).max(200),
  apiUrl:     z.string().url(),
  detail:     z.string().max(500).optional(),
  sourceType: SourceTypeSchema.default('vod'),
  format:     FormatSchema.default('json'),
  weight:     z.number().int().min(0).max(100).default(50),
  isAdult:    z.boolean().default(false),
})

const UpdateSiteSchema = z.object({
  name:       z.string().min(1).max(200).optional(),
  apiUrl:     z.string().url().optional(),
  detail:     z.string().max(500).optional(),
  sourceType: SourceTypeSchema.optional(),
  format:     FormatSchema.optional(),
  weight:     z.number().int().min(0).max(100).optional(),
  isAdult:    z.boolean().optional(),
  disabled:   z.boolean().optional(),
})

const BatchSchema = z.object({
  keys:   z.array(z.string()).min(1),
  action: z.enum(['enable', 'disable', 'delete', 'mark_adult', 'unmark_adult', 'mark_shortdrama', 'mark_vod']),
})

const ValidateSchema = z.object({
  apiUrl: z.string().url(),
})

export async function adminCrawlerSitesRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['admin'])]

  // ── GET /admin/crawler/sites ──────────────────────────────

  fastify.get('/admin/crawler/sites', { preHandler: auth }, async (_request, reply) => {
    const sites = await crawlerSitesQueries.listCrawlerSites(db)
    return reply.send({ data: sites })
  })

  // ── POST /admin/crawler/sites ─────────────────────────────

  fastify.post('/admin/crawler/sites', { preHandler: auth }, async (request, reply) => {
    const parsed = CreateSiteSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 400 },
      })
    }

    const existing = await crawlerSitesQueries.findCrawlerSite(db, parsed.data.key)
    if (existing) {
      return reply.code(409).send({
        error: { code: 'DUPLICATE_KEY', message: `源站 key "${parsed.data.key}" 已存在`, status: 409 },
      })
    }

    const site = await crawlerSitesQueries.upsertCrawlerSite(db, {
      ...parsed.data,
      fromConfig: false,
    })
    return reply.code(201).send({ data: site })
  })

  // ── PATCH /admin/crawler/sites/:key ──────────────────────

  fastify.patch('/admin/crawler/sites/:key', { preHandler: auth }, async (request, reply) => {
    const { key } = request.params as { key: string }
    const parsed = UpdateSiteSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 400 },
      })
    }

    const site = await crawlerSitesQueries.updateCrawlerSite(db, key, parsed.data)
    if (!site) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '源站不存在', status: 404 },
      })
    }
    return reply.send({ data: site })
  })

  // ── DELETE /admin/crawler/sites/:key ─────────────────────

  fastify.delete('/admin/crawler/sites/:key', { preHandler: auth }, async (request, reply) => {
    const { key } = request.params as { key: string }

    const existing = await crawlerSitesQueries.findCrawlerSite(db, key)
    if (!existing) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '源站不存在', status: 404 },
      })
    }
    if (existing.fromConfig) {
      return reply.code(403).send({
        error: { code: 'FORBIDDEN', message: '配置文件来源的源站不可删除，请在配置文件中移除后重新保存', status: 403 },
      })
    }

    await crawlerSitesQueries.deleteCrawlerSite(db, key)
    return reply.code(204).send()
  })

  // ── POST /admin/crawler/sites/batch ──────────────────────

  fastify.post('/admin/crawler/sites/batch', { preHandler: auth }, async (request, reply) => {
    const parsed = BatchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 400 },
      })
    }

    const affected = await crawlerSitesQueries.batchUpdateCrawlerSites(
      db,
      parsed.data.keys,
      parsed.data.action as CrawlerSiteBatchAction,
    )
    return reply.send({ data: { affected } })
  })

  // ── POST /admin/crawler/sites/validate ───────────────────

  fastify.post('/admin/crawler/sites/validate', { preHandler: auth }, async (request, reply) => {
    const parsed = ValidateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: '请提供合法的 apiUrl', status: 400 },
      })
    }

    const { apiUrl } = parsed.data
    const testUrl = `${apiUrl.replace(/\/$/, '')}?ac=list&pg=1`
    const start = Date.now()
    let status: 'ok' | 'error' | 'timeout' = 'error'
    let httpStatus: number | null = null
    let latencyMs: number | null = null

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 8000)
      const res = await fetch(testUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'User-Agent': 'Resovo-Crawler/1.0' },
      })
      clearTimeout(timer)
      latencyMs = Date.now() - start
      httpStatus = res.status
      status = res.ok ? 'ok' : 'error'
    } catch (err) {
      latencyMs = Date.now() - start
      const isTimeout = err instanceof Error && err.name === 'AbortError'
      status = isTimeout ? 'timeout' : 'error'
    }

    return reply.send({ data: { status, httpStatus, latencyMs } })
  })
}

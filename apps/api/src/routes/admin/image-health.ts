/**
 * admin/image-health.ts — 图片健康监控 API
 * IMG-05: admin only
 *
 * GET  /admin/image-health/stats                  — 总览统计
 * GET  /admin/image-health/broken-domains         — TOP 破损域名
 * GET  /admin/image-health/missing-videos         — 缺图视频列表（分页）
 * POST /admin/image-health/backfill               — 手动触发存量 pending_review 回填（CHORE-09）
 * POST /admin/image-health/rescan                 — 重扫封面（ADR-135）
 * POST /admin/image-health/switch-fallback-domain — 批量切 fallback 域（ADR-135）
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import {
  getImageHealthStats,
  getTopBrokenDomains,
  listMissingPosterVideos,
  getBrokenEventsTrend,
  rescanPosters,
  switchFallbackDomain,
} from '@/api/db/queries/imageHealth'
import type { MissingVideoSortField, SortDir } from '@/api/db/queries/imageHealth'
import { getFieldProposalsByCatalogIdAndField, markFieldProposalApplied } from '@/api/db/queries/metadata-field-proposals'
import { CATALOG_SOURCE_PRIORITY, MediaCatalogService } from '@/api/services/MediaCatalogService'
import type { CatalogMetadataSource } from '@/api/services/MediaCatalogService'
import { enqueueBackfillJob } from '@/api/workers/imageBackfillWorker'
import { insertAuditLog } from '@/api/db/queries/auditLog'
import { imageHealthQueue } from '@/api/lib/queue'
import type { ImageKind } from '@/types'

const BrokenDomainsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

const MissingVideosQuerySchema = z.object({
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
  // ADR-150 阶段 5 EP-4 follow-up（2026-05-25）：sort 白名单扩 4 子查询派生字段
  sortField: z.enum([
    'created_at', 'title', 'poster_status',
    'poster_source', 'broken_domain', 'occurrence_count', 'last_seen_broken_at',
  ]).default('created_at'),
  sortDir:   z.enum(['asc', 'desc']).default('desc'),
})

// ADR-208 D-208-2：补图候选读端点。field 枚举 = metadata_field_proposals.field_name 图片三字段
const CandidatesQuerySchema = z.object({
  catalogId: z.string().uuid(),
  field:     z.enum(['coverUrl', 'backdropUrl', 'logoUrl']),
})

// ADR-208 D-208-3：应用候选补图。source 用 z.string()（proposals.source_kind 是开放字符串，119:39），
// 运行时再校验 ∈ CatalogMetadataSource → 422 INVALID_SOURCE（禁 as cast 兜底，Codex CONCERN-1）。
const ApplyCandidateBodySchema = z.object({
  catalogId: z.string().uuid(),
  videoId:   z.string().uuid(),
  field:     z.enum(['coverUrl', 'backdropUrl', 'logoUrl']),
  source:    z.string().min(1),
  sourceRef: z.string().nullable(),
})

// field → media_catalog 状态列 + 入队 ImageKind（与 videoImages IMAGE_KIND_FIELDS 对齐）
const CANDIDATE_FIELD_MAP: Record<
  'coverUrl' | 'backdropUrl' | 'logoUrl',
  { statusField: 'posterStatus' | 'backdropStatus' | 'logoStatus'; kind: ImageKind }
> = {
  coverUrl:    { statusField: 'posterStatus',   kind: 'poster' },
  backdropUrl: { statusField: 'backdropStatus', kind: 'backdrop' },
  logoUrl:     { statusField: 'logoStatus',     kind: 'logo' },
}

// proposals.source_kind 是开放字符串列，apply 前须收口到 safeUpdate 接受的 CatalogMetadataSource
const VALID_CATALOG_SOURCES = new Set<string>(['manual', 'tmdb', 'bangumi', 'douban', 'crawler'])
function isCatalogMetadataSource(s: string): s is CatalogMetadataSource {
  return VALID_CATALOG_SOURCES.has(s)
}

export async function adminImageHealthRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['admin'])]

  // ── GET /admin/image-health/stats ─────────────────────────────
  fastify.get('/admin/image-health/stats', { preHandler: auth }, async (_req, reply) => {
    const [stats, brokenTrend] = await Promise.all([
      getImageHealthStats(db),
      getBrokenEventsTrend(db, 7),
    ])
    return reply.send({ data: { ...stats, brokenTrend } })
  })

  // ── GET /admin/image-health/broken-domains ─────────────────────
  fastify.get('/admin/image-health/broken-domains', { preHandler: auth }, async (request, reply) => {
    const parsed = BrokenDomainsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Invalid query', status: 400 },
      })
    }
    const rows = await getTopBrokenDomains(db, parsed.data.limit)
    return reply.send({ data: rows })
  })

  // ── GET /admin/image-health/missing-videos ─────────────────────
  fastify.get('/admin/image-health/missing-videos', { preHandler: auth }, async (request, reply) => {
    const parsed = MissingVideosQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Invalid query', status: 400 },
      })
    }
    const { page, limit, sortField, sortDir } = parsed.data
    const offset = (page - 1) * limit

    const [rows, countResult] = await Promise.all([
      listMissingPosterVideos(db, limit, offset, sortField as MissingVideoSortField, sortDir as SortDir),
      db.query<{ total: string }>(
        `SELECT COUNT(v.id)::int AS total
         FROM videos v
         JOIN media_catalog mc ON mc.id = v.catalog_id
         WHERE v.deleted_at IS NULL
           AND mc.poster_status IN ('missing', 'broken', 'pending_review')`
      ),
    ])

    return reply.send({
      data: rows,
      total: parseInt(countResult.rows[0]?.total ?? '0'),
    })
  })

  // ── GET /admin/image-health/candidates（ADR-208 D-208-2）──────────
  // 读单 catalog 单字段的跨源图片候选（metadata_field_proposals）。trust 用 canonical
  // CATALOG_SOURCE_PRIORITY 派生 + 排序（禁前端/SQL 硬编码 priority，D-205-3）。
  // 无候选返空数组（实时 TMDB 拉取推迟，§7.2）。
  fastify.get('/admin/image-health/candidates', { preHandler: auth }, async (request, reply) => {
    const parsed = CandidatesQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Invalid query', status: 400 },
      })
    }
    const { catalogId, field } = parsed.data
    const proposals = await getFieldProposalsByCatalogIdAndField(db, catalogId, field)
    const candidates = proposals
      // proposed_value 是 JSONB，图片字段存 URL 标量；非串候选防御性剔除（Codex CONCERN）
      .filter((p): p is typeof p & { proposedValue: string } =>
        typeof p.proposedValue === 'string' && p.proposedValue.length > 0)
      .map((p) => ({
        source:     p.sourceKind,
        sourceRef:  p.sourceRef,
        url:        p.proposedValue,
        confidence: p.confidence,
        isWinner:   p.isWinner,
        applied:    p.applied,
        trust:      CATALOG_SOURCE_PRIORITY[p.sourceKind] ?? 0,
      }))
      .sort((a, b) => b.trust - a.trust || (b.confidence ?? 0) - (a.confidence ?? 0))
    return reply.send({ data: { candidates } })
  })

  // ── POST /admin/image-health/apply-candidate（ADR-208 D-208-3）────
  // 应用选中候选：经 safeUpdate 优先级闸门 + hard/soft lock 写回 media_catalog（**禁自建平行闸门**），
  // status 重置 pending_review，入队健康巡检，审计 image_health.apply_candidate（零 migration）。
  // field∈skippedFields → 409 不静默成功（前端区分"已应用" vs "被锁未应用"）。
  fastify.post('/admin/image-health/apply-candidate', { preHandler: auth }, async (request, reply) => {
    const parsed = ApplyCandidateBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Invalid body', status: 400 },
      })
    }
    const { catalogId, videoId, field, source, sourceRef } = parsed.data

    // source 运行时校验（proposals.source_kind 开放字符串 → 收口 CatalogMetadataSource，Codex CONCERN-1）
    if (!isCatalogMetadataSource(source)) {
      return reply.code(422).send({
        error: { code: 'INVALID_SOURCE', message: `未知来源：${source}`, status: 422 },
      })
    }

    // ① 取候选行（PK 精确 catalog+field+source）
    const proposals = await getFieldProposalsByCatalogIdAndField(db, catalogId, field)
    const proposal = proposals.find((p) => p.sourceKind === source)
    if (!proposal) {
      return reply.code(404).send({
        error: { code: 'CANDIDATE_NOT_FOUND', message: '候选不存在或已被清理，请刷新', status: 404 },
      })
    }
    if (typeof proposal.proposedValue !== 'string' || proposal.proposedValue.length === 0) {
      return reply.code(422).send({
        error: { code: 'INVALID_CANDIDATE_VALUE', message: '候选值非法（非 URL 标量）', status: 422 },
      })
    }
    // PK 不含 sourceRef：候选被后台 reconcile 重建后 source_ref 可能变 → 显式一致校验（Codex CONCERN-3）
    if (proposal.sourceRef !== sourceRef) {
      return reply.code(409).send({
        error: { code: 'CANDIDATE_STALE', message: '候选已更新，请刷新后重试', status: 409 },
      })
    }
    const url = proposal.proposedValue
    const { statusField, kind } = CANDIDATE_FIELD_MAP[field]

    // ② safeUpdate 复用闸门（优先级 + hard/soft lock 全内置；url + 状态列同源写，受同一闸门，M1）
    const catalogService = new MediaCatalogService(db)
    const result = await catalogService.safeUpdate(
      catalogId,
      { [field]: url, [statusField]: 'pending_review' },
      source,
      { sourceRef: sourceRef ?? undefined },
    )
    if (result.updated === null) {
      return reply.code(404).send({
        error: { code: 'CATALOG_NOT_FOUND', message: 'catalog 不存在', status: 404 },
      })
    }
    if (result.skippedFields.includes(field)) {
      // 被锁/被拦未写入 → 不静默成功；返 skippedFields 供前端区分"已应用" vs "被锁未应用"
      return reply.code(409).send({
        error: {
          code: 'FIELD_LOCKED_OR_LOWER_PRIORITY',
          message: '字段被锁定或来源优先级不足，未应用',
          status: 409,
        },
        skippedFields: result.skippedFields,
      })
    }

    // ③ 同步 proposal applied=true（best-effort：与 reconcile delete-then-upsert 并发不强一致，M2）
    try {
      await markFieldProposalApplied(db, catalogId, field, source)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      request.log.warn(`[apply-candidate] markFieldProposalApplied 失败（best-effort 忽略）: ${msg}`)
    }

    // ④ 入队 health-check + blurhash-extract（二 job 类型均必需 videoId，imageHealthWorker.ts:28）
    await imageHealthQueue.add('health-check', { type: 'health-check', catalogId, videoId, kind, url })
    await imageHealthQueue.add('blurhash-extract', { type: 'blurhash-extract', catalogId, videoId, kind, url })

    // ⑤ 审计（target_id=catalogId，供按 catalog 检索审计时间线，M3）
    await insertAuditLog(db, {
      actorId: request.user!.userId,
      actionType: 'image_health.apply_candidate',
      targetKind: 'image_health',
      targetId: catalogId,
      afterJsonb: { field, source, sourceRef, url, videoId },
      requestId: request.id,
    })

    return reply.send({ data: { applied: true, status: 'pending_review' } })
  })

  // ── POST /admin/image-health/backfill ──────────────────────────
  // CHORE-09: 管理员手动触发存量 pending_review 图片 URL 回填
  // 触发 imageBackfillWorker 批量扫 media_catalog.poster_status='pending_review'
  // 等字段，分批入队 health-check + blurhash-extract
  fastify.post('/admin/image-health/backfill', { preHandler: auth }, async (_req, reply) => {
    try {
      await enqueueBackfillJob()
      return reply.send({
        data: {
          enqueued: true,
          message: '已入队 backfill 任务，worker 分批扫描 pending_review 图片；请 30-60 秒后刷新状态',
        },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      process.stderr.write(`[POST /admin/image-health/backfill] 500: ${msg}\n`)
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: `触发失败：${msg}`, status: 500 },
      })
    }
  })

  // ── POST /admin/image-health/rescan（ADR-135）──────────────────
  const RescanBodySchema = z.object({
    scope: z.enum(['all', 'broken_only', 'missing_only']).default('broken_only'),
  })

  fastify.post('/admin/image-health/rescan', { preHandler: auth }, async (request, reply) => {
    const parsed = RescanBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Invalid body', status: 400 },
      })
    }
    const { scope } = parsed.data
    try {
      const rescanResult = await rescanPosters(db, scope)
      await enqueueBackfillJob()
      await insertAuditLog(db, {
        actorId: request.user!.userId,
        actionType: 'image_health.rescan',
        targetKind: 'image_health',
        afterJsonb: { scope, updatedCount: rescanResult.updatedCount, enqueued: true },
        requestId: request.id,
      })
      return reply.send({
        data: { updatedCount: rescanResult.updatedCount, enqueued: true, scope },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      process.stderr.write(`[POST /admin/image-health/rescan] 500: ${msg}\n`)
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: `操作失败：${msg}`, status: 500 },
      })
    }
  })

  // ── POST /admin/image-health/switch-fallback-domain（ADR-135）──
  const SwitchDomainBodySchema = z.object({
    fromDomain: z.string().min(3).max(253),
    toDomain:   z.string().min(3).max(253),
    dryRun:     z.boolean().default(true),
  })

  fastify.post('/admin/image-health/switch-fallback-domain', { preHandler: auth }, async (request, reply) => {
    const parsed = SwitchDomainBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Invalid body', status: 400 },
      })
    }
    const { fromDomain, toDomain, dryRun } = parsed.data
    try {
      const switchResult = await switchFallbackDomain(db, fromDomain, toDomain, dryRun)
      if (!dryRun) {
        await insertAuditLog(db, {
          actorId: request.user!.userId,
          actionType: 'image_health.switch_domain',
          targetKind: 'image_health',
          afterJsonb: { fromDomain, toDomain, dryRun, affectedRows: switchResult.affectedRows },
          requestId: request.id,
        })
      }
      return reply.send({ data: switchResult })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      process.stderr.write(`[POST /admin/image-health/switch-fallback-domain] 500: ${msg}\n`)
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: `操作失败：${msg}`, status: 500 },
      })
    }
  })
}

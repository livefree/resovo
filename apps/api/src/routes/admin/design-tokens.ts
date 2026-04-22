/**
 * admin/design-tokens.ts — Design Token 管理接口（REG-M1-04 / ADR-043）
 *
 * GET    /admin/design-tokens                   — Brand 列表（只读预览）
 * GET    /admin/design-tokens/:brandSlug        — 单个 Brand + resolved + overrideMap
 * PUT    /admin/design-tokens/:brandSlug        — 写回 overrides（dev only，生产 403）
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import * as brandsQueries from '@/api/db/queries/brands'
import {
  DesignTokensService,
  DesignTokensWriteDisabledError,
  DesignTokensConflictError,
  DesignTokensValidationError,
  DesignTokensBuildError,
} from '@/api/services/DesignTokensService'

const BRAND_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,31}$/

const BrandSlugParamsSchema = z.object({
  brandSlug: z.string().regex(BRAND_SLUG_RE, 'invalid brand slug'),
})

const PutBrandBodySchema = z.object({
  overrides: z.unknown(),
  expectedUpdatedAt: z.string().datetime({ message: 'expectedUpdatedAt must be ISO 8601' }),
  commitMessage: z.string().max(200).optional(),
})

export async function adminDesignTokenRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['admin'])]
  const service = new DesignTokensService(db)

  // ── GET /admin/design-tokens ──────────────────────────────────
  fastify.get('/admin/design-tokens', { preHandler: auth }, async (_request, reply) => {
    try {
      const brands = await brandsQueries.listBrands(db)
      return reply.send({ data: brands, total: brands.length })
    } catch (err: unknown) {
      const pg = err as { code?: string }
      if (pg.code === '42P01') {
        return reply.send({ data: [], total: 0, _note: 'brands table not yet migrated' })
      }
      throw err
    }
  })

  // ── GET /admin/design-tokens/:brandSlug ───────────────────────
  fastify.get<{ Params: { brandSlug: string } }>(
    '/admin/design-tokens/:brandSlug',
    { preHandler: auth },
    async (request, reply) => {
      const params = BrandSlugParamsSchema.safeParse(request.params)
      if (!params.success) return reply.code(400).send({ error: { code: 'INVALID_PARAMS', details: params.error.issues } })

      const { brandSlug } = params.data
      const brand = await service.getBrand(brandSlug)
      if (!brand) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: `Brand "${brandSlug}" not found` } })

      const overrideMap = await service.getBrandOverrideMap(brandSlug)
      return reply.send({ data: { brand, overrideMap } })
    },
  )

  // ── PUT /admin/design-tokens/:brandSlug ───────────────────────
  fastify.put<{ Params: { brandSlug: string } }>(
    '/admin/design-tokens/:brandSlug',
    { preHandler: auth },
    async (request, reply) => {
      const params = BrandSlugParamsSchema.safeParse(request.params)
      if (!params.success) return reply.code(400).send({ error: { code: 'INVALID_PARAMS', details: params.error.issues } })

      const body = PutBrandBodySchema.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: { code: 'INVALID_BODY', details: body.error.issues } })

      const { brandSlug } = params.data
      const { overrides, expectedUpdatedAt, commitMessage } = body.data

      try {
        const result = await service.updateBrand(brandSlug, {
          overrides,
          expectedUpdatedAt: new Date(expectedUpdatedAt),
          commitMessage,
        })
        return reply.send({ data: result })
      } catch (err) {
        if (err instanceof DesignTokensWriteDisabledError) {
          return reply.code(403).send({ error: { code: err.code, message: err.message } })
        }
        if (err instanceof DesignTokensConflictError) {
          return reply.code(409).send({ error: { code: err.code, message: err.message } })
        }
        if (err instanceof DesignTokensValidationError) {
          return reply.code(422).send({ error: { code: err.code, message: err.message, details: err.details } })
        }
        if (err instanceof DesignTokensBuildError) {
          return reply.code(500).send({ error: { code: err.code, message: err.message } })
        }
        throw err
      }
    },
  )
}

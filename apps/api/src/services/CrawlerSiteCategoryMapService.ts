/**
 * CrawlerSiteCategoryMapService.ts — 站点分类映射 service 层（ADR-123 / CHG-SN-7-REDO-01-F）
 *
 * 职责：
 *   - listMappingsBySiteKey: 委托 query；前置 site 存在性校验
 *   - replaceMappingsBySiteKey: 事务内全量替换 + audit fire-and-forget（before/after 快照）
 *
 * audit 协议（ADR-121 R-MID-1 7 文件 RETRO 框架 / 第 14 次系统化）：
 *   - actionType: 'crawler_site.category_mapping_update'
 *   - targetKind: 'crawler_site'
 *   - targetId: site key 字符串
 *   - beforeJsonb: { mappings: Array<{ sourceLabel, targetGenre }> }
 *   - afterJsonb:  { mappings: Array<{ sourceLabel, targetGenre }> }
 */

import { z } from 'zod'
import type { Pool } from 'pg'
import {
  listMappingsBySiteKey as listMappingsRaw,
  replaceMappingsBySiteKey,
  siteKeyExists,
} from '@/api/db/queries/crawlerSiteCategoryMaps'
import { AuditLogService } from '@/api/services/AuditLogService'
import { AppError } from '@/api/lib/errors'
import type { CategoryMappingRow, CategoryMappingInput } from '@resovo/types'

// ── target_genre CHECK 22 值（与 migration 064 + ADR-123 §SQL CHECK 同源）─

const CATEGORY_MAPPING_TARGET_GENRES = [
  'action', 'comedy', 'romance', 'thriller', 'horror',
  'sci_fi', 'fantasy', 'history', 'crime', 'mystery',
  'war', 'family', 'biography', 'martial_arts',
  'adventure', 'disaster', 'musical', 'western',
  'sport', 'other',
  '_unmapped', '_discard',
] as const

// ── Zod schemas（ADR-123 §zod 严格对齐）────────────────────────────

const CategoryMappingInputSchema = z.object({
  sourceLabel: z.string().min(1).max(200),
  targetGenre: z.enum(CATEGORY_MAPPING_TARGET_GENRES),
})

export const PutCategoryMappingSchema = z.object({
  mappings: z.array(CategoryMappingInputSchema).max(500, '单站点映射上限 500 条'),
}).refine(
  (v) => new Set(v.mappings.map((m) => m.sourceLabel)).size === v.mappings.length,
  { message: 'mappings 中 sourceLabel 不得重复', path: ['mappings'] },
)

export const CategoryMappingParamsSchema = z.object({
  key: z.string().min(1).max(100),
}).strict()

// ── Service ───────────────────────────────────────────────────────

export class CrawlerSiteCategoryMapService {
  private auditSvc: AuditLogService

  constructor(private db: Pool) {
    this.auditSvc = new AuditLogService(db)
  }

  async listMappingsBySiteKey(siteKey: string): Promise<readonly CategoryMappingRow[]> {
    const exists = await siteKeyExists(this.db, siteKey)
    if (!exists) {
      throw new AppError('NOT_FOUND', `站点 ${siteKey} 不存在`, 404)
    }
    return listMappingsRaw(this.db, siteKey)
  }

  /**
   * PUT 全量替换 + audit fire-and-forget（before/after 快照）。
   * 返回 written = 新写入行数。
   */
  async replaceMappingsBySiteKey(
    siteKey: string,
    mappings: readonly CategoryMappingInput[],
    actorId: string,
    requestId?: string,
  ): Promise<{ readonly written: number }> {
    const exists = await siteKeyExists(this.db, siteKey)
    if (!exists) {
      throw new AppError('NOT_FOUND', `站点 ${siteKey} 不存在`, 404)
    }

    const before = await listMappingsRaw(this.db, siteKey)
    const { written } = await replaceMappingsBySiteKey(this.db, siteKey, mappings)

    // audit beforeJsonb / afterJsonb 仅持 (sourceLabel, targetGenre) 简化形态
    // （ADR-123 §audit log 协议表 / 不含 createdAt/updatedAt 噪声）
    const beforePayload = before.map((m) => ({ sourceLabel: m.sourceLabel, targetGenre: m.targetGenre }))
    const afterPayload = mappings.map((m) => ({ sourceLabel: m.sourceLabel, targetGenre: m.targetGenre }))

    this.auditSvc.write({
      actorId,
      actionType: 'crawler_site.category_mapping_update',
      targetKind: 'crawler_site',
      targetId: siteKey,
      beforeJsonb: { mappings: beforePayload },
      afterJsonb: { mappings: afterPayload, written },
      requestId: requestId ?? null,
    })

    return { written }
  }
}

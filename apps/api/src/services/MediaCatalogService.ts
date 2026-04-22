/**
 * MediaCatalogService.ts — 作品元数据层（media_catalog）业务逻辑
 *
 * 职责：
 * 1. findOrCreate：5 步精确→模糊匹配，找到或新建 catalog 条目
 * 2. safeUpdate：source 优先级 + locked_fields 双重保护的元数据更新
 * 3. lockFields：将字段名写入 locked_fields（manual 编辑后调用）
 *
 * locked_fields 规则（Service 层执行，非 DB 触发器）：
 * - 被锁字段只允许更高优先级来源覆盖
 * - 'manual' 优先级最高（5），写入后字段自动加锁
 */

import type { Pool, PoolClient } from 'pg'
import type { VideoType } from '@/types'
import * as catalogQueries from '@/api/db/queries/mediaCatalog'
import type { MediaCatalogRow, CatalogInsertData, CatalogUpdateData } from '@/api/db/queries/mediaCatalog'
import * as provenanceQueries from '@/api/db/queries/metadataProvenance'

export { MediaCatalogRow, CatalogInsertData, CatalogUpdateData }

// ── 元数据来源优先级 ──────────────────────────────────────────────

export const CATALOG_SOURCE_PRIORITY: Record<string, number> = {
  manual:  5,
  tmdb:    4,
  bangumi: 3,
  douban:  3,
  crawler: 1,
}

export type CatalogMetadataSource = 'manual' | 'tmdb' | 'bangumi' | 'douban' | 'crawler'

// ── 匹配键类型 ────────────────────────────────────────────────────

export interface CatalogLookupKey {
  /** 精确 ID 匹配（优先级降序） */
  imdbId?: string | null
  tmdbId?: number | null
  doubanId?: string | null
  bangumiId?: number | null
  /** 三元组模糊匹配（无精确 ID 时使用） */
  titleNormalized?: string
  year?: number | null
  type?: VideoType
}

// ── findOrCreate 输入 ─────────────────────────────────────────────

export interface FindOrCreateCatalogInput extends CatalogInsertData {
  /** 用于匹配已有条目的键（同 CatalogInsertData 中的对应字段） */
  metadataSource: CatalogMetadataSource
}

// ── 服务类 ────────────────────────────────────────────────────────

export class MediaCatalogService {
  constructor(private db: Pool) {}

  /**
   * findOrCreate — 5 步匹配策略
   *
   * 匹配优先级（精确 ID 优先）：
   * 1. imdb_id（全球唯一）
   * 2. tmdb_id
   * 3. douban_id
   * 4. bangumi_subject_id
   * 5. title_normalized + year + type 三元组（模糊）
   *
   * 均未命中时，INSERT 新条目（ON CONFLICT DO NOTHING，再 SELECT）
   */
  async findOrCreate(input: FindOrCreateCatalogInput): Promise<MediaCatalogRow> {
    const client: PoolClient = await this.db.connect()
    try {
      await client.query('BEGIN')

      // Step 1: imdb_id
      if (input.imdbId) {
        const found = await catalogQueries.findCatalogByImdbId(client, input.imdbId)
        if (found) {
          await client.query('COMMIT')
          return found
        }
      }

      // Step 2: tmdb_id
      if (input.tmdbId != null) {
        const found = await catalogQueries.findCatalogByTmdbId(client, input.tmdbId)
        if (found) {
          await client.query('COMMIT')
          return found
        }
      }

      // Step 3: douban_id
      if (input.doubanId) {
        const found = await catalogQueries.findCatalogByDoubanId(client, input.doubanId)
        if (found) {
          await client.query('COMMIT')
          return found
        }
      }

      // Step 4: bangumi_subject_id
      if (input.bangumiSubjectId != null) {
        const found = await catalogQueries.findCatalogByBangumiId(client, input.bangumiSubjectId)
        if (found) {
          await client.query('COMMIT')
          return found
        }
      }

      // Step 5: title_normalized + year + type 三元组
      const found5 = await catalogQueries.findCatalogByNormalizedKey(
        client,
        input.titleNormalized,
        input.year ?? null,
        input.type
      )
      if (found5) {
        await client.query('COMMIT')
        return found5
      }

      // 全部未命中 → INSERT（ON CONFLICT DO NOTHING 防止并发重复）
      const inserted = await catalogQueries.insertCatalog(client, input)
      if (inserted) {
        await client.query('COMMIT')
        return inserted
      }

      // INSERT 被 ON CONFLICT 跳过（并发写入导致）→ 再次查询
      const retry =
        (input.imdbId ? await catalogQueries.findCatalogByImdbId(client, input.imdbId) : null) ??
        (input.tmdbId != null ? await catalogQueries.findCatalogByTmdbId(client, input.tmdbId) : null) ??
        (input.doubanId ? await catalogQueries.findCatalogByDoubanId(client, input.doubanId) : null) ??
        await catalogQueries.findCatalogByNormalizedKey(
          client,
          input.titleNormalized,
          input.year ?? null,
          input.type
        )

      if (!retry) {
        throw new Error(`MediaCatalogService.findOrCreate: unable to find or create catalog for "${input.title}"`)
      }

      await client.query('COMMIT')
      return retry
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  /**
   * safeUpdate — 优先级 + locked_fields + video_metadata_locks 三重保护的元数据更新
   *
   * 规则（ADMIN-14 调整）：
   * 1. 若来源优先级 < 当前 catalog 的 metadata_source 优先级 → 跳过所有字段
   * 2. 硬锁（video_metadata_locks.hard）：任何来源（含 manual）都不能覆盖 → skippedFields
   * 3. 软锁（locked_fields）：
   *    - source='manual' 允许覆盖自己锁定的字段（避免"首次编辑即冻结"）
   *    - 其他来源仍被软锁阻挡（保护人工结果不被低优先级源污染）
   * 4. 若来源为 'manual' → 写入后自动将写入字段加入 locked_fields（幂等去重）
   * 5. 若提供 provenanceCtx → 写入后记录字段来源到 video_metadata_provenance
   *
   * 返回：
   *   - updated: 更新后的 catalog（若无字段被写入则返回原 catalog，或 null 表示 catalog 不存在）
   *   - skippedFields: 因 hard lock 被过滤、未写入的字段名数组（供前端区分"已保存" vs "被锁未保存"）
   */
  async safeUpdate(
    catalogId: string,
    fields: CatalogUpdateData,
    source: CatalogMetadataSource,
    provenanceCtx?: { sourceRef?: string }
  ): Promise<{ updated: MediaCatalogRow | null; skippedFields: string[] }> {
    const [current, hardLocked] = await Promise.all([
      catalogQueries.findCatalogById(this.db, catalogId),
      provenanceQueries.getHardLockedFields(this.db, catalogId),
    ])
    if (!current) return { updated: null, skippedFields: [] }

    const incomingPriority = CATALOG_SOURCE_PRIORITY[source] ?? 0
    const currentPriority = CATALOG_SOURCE_PRIORITY[current.metadataSource] ?? 0

    // 来源优先级低于当前 → 跳过整个更新（全部视为 skipped）
    if (incomingPriority < currentPriority) {
      return { updated: current, skippedFields: Object.keys(fields) }
    }

    const hardLockedSet = new Set(hardLocked)
    const softLockedSet = new Set(current.lockedFields)
    const filteredFields: CatalogUpdateData = {}
    const skippedFields: string[] = []

    for (const [key, value] of Object.entries(fields) as [keyof CatalogUpdateData, unknown][]) {
      // 硬锁：任何来源都阻挡
      if (hardLockedSet.has(key as string)) {
        skippedFields.push(key as string)
        continue
      }
      // 软锁：非 manual 来源被阻挡；manual 允许覆盖
      if (softLockedSet.has(key as string) && source !== 'manual') {
        skippedFields.push(key as string)
        continue
      }
      ;(filteredFields as Record<string, unknown>)[key] = value
    }

    if (Object.keys(filteredFields).length === 0) {
      return { updated: current, skippedFields }
    }

    // 若来源为 manual，自动锁定写入的字段（幂等去重）
    if (source === 'manual') {
      const newLockedFields = [
        ...current.lockedFields,
        ...Object.keys(filteredFields),
      ]
      const uniqueLocked = [...new Set(newLockedFields)]
      await catalogQueries.setLockedFields(this.db, catalogId, uniqueLocked)
    }

    const updated = await catalogQueries.updateCatalogFields(this.db, catalogId, {
      ...filteredFields,
      metadataSource: source,
    })

    // 写入字段来源 provenance（非阻塞，失败不影响主流程）
    if (provenanceCtx !== undefined) {
      const writtenFields = Object.keys(filteredFields).filter((k) => k !== 'metadataSource')
      void provenanceQueries.batchUpsertFieldProvenance(
        this.db,
        catalogId,
        writtenFields,
        source,
        provenanceCtx.sourceRef ?? null,
        incomingPriority,
      ).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        process.stderr.write(`[MediaCatalogService] provenance write failed for ${catalogId}: ${msg}\n`)
      })
    }

    return { updated, skippedFields }
  }

  /**
   * lockFields — 手动锁定指定字段（管理员确认内容后调用）
   */
  async lockFields(catalogId: string, fields: string[]): Promise<void> {
    await catalogQueries.addLockedFields(this.db, catalogId, fields)
  }

  /**
   * unlockFields — 解锁指定字段（管理员需要允许外部覆盖时调用）
   */
  async unlockFields(catalogId: string, fields: string[]): Promise<void> {
    const current = await catalogQueries.findCatalogById(this.db, catalogId)
    if (!current) return
    const remaining = current.lockedFields.filter((f) => !fields.includes(f))
    await catalogQueries.setLockedFields(this.db, catalogId, remaining)
  }

  /**
   * linkVideo — 将 videos.catalog_id 绑定到指定 catalog（通常在 findOrCreate 后调用）
   */
  async linkVideo(videoId: string, catalogId: string): Promise<void> {
    await catalogQueries.linkVideoToCatalog(this.db, videoId, catalogId)
  }

  /**
   * findById — 直接按 catalog ID 查找（供其他 Service 使用）
   */
  async findById(catalogId: string): Promise<MediaCatalogRow | null> {
    return catalogQueries.findCatalogById(this.db, catalogId)
  }
}

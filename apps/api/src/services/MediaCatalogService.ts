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
   * 规则：
   * 1. 若来源优先级 < 当前 catalog 的 metadata_source 优先级 → 跳过所有字段
   * 2. 对每个字段，若字段名在 locked_fields 或 video_metadata_locks(hard) 中 → 跳过该字段
   * 3. 若来源为 'manual' → 写入后自动将写入字段加入 locked_fields
   * 4. 若提供 provenanceCtx → 写入后记录字段来源到 video_metadata_provenance
   *
   * 返回更新后的 catalog（若无字段写入则返回原 catalog）
   */
  async safeUpdate(
    catalogId: string,
    fields: CatalogUpdateData,
    source: CatalogMetadataSource,
    provenanceCtx?: { sourceRef?: string }
  ): Promise<MediaCatalogRow | null> {
    const [current, hardLocked] = await Promise.all([
      catalogQueries.findCatalogById(this.db, catalogId),
      provenanceQueries.getHardLockedFields(this.db, catalogId),
    ])
    if (!current) return null

    const incomingPriority = CATALOG_SOURCE_PRIORITY[source] ?? 0
    const currentPriority = CATALOG_SOURCE_PRIORITY[current.metadataSource] ?? 0

    // 来源优先级低于当前 → 跳过整个更新
    if (incomingPriority < currentPriority) return current

    // 过滤掉 locked_fields 和 hard lock 字段
    const lockedSet = new Set([...current.lockedFields, ...hardLocked])
    const filteredFields: CatalogUpdateData = {}

    for (const [key, value] of Object.entries(fields) as [keyof CatalogUpdateData, unknown][]) {
      if (!lockedSet.has(key)) {
        (filteredFields as Record<string, unknown>)[key] = value
      }
    }

    if (Object.keys(filteredFields).length === 0) return current

    // 若来源为 manual，自动锁定写入的字段
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

    return updated
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

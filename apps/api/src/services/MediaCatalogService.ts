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
import * as externalRefQueries from '@/api/db/queries/catalogExternalRefs'

export { MediaCatalogRow, CatalogInsertData, CatalogUpdateData }

// ── 四列 cache ↔ catalog_external_refs 写侧接线映射（ADR-177 YY-C / CHG-VIR-12-D）──
// safeUpdate 写这些字段时同事务写 exact ref / 降级 ref（imdb/tmdb 零写入方且 kind
// 写入时判定〔D-177-11〕，不入此表 —— 富集实装卡接入时补行）。
const CATALOG_EXTERNAL_REF_FIELDS: ReadonlyArray<{
  readonly field: keyof CatalogUpdateData
  readonly provider: externalRefQueries.ExternalRefProvider
}> = [
  { field: 'bangumiSubjectId', provider: 'bangumi' },
  { field: 'doubanId', provider: 'douban' },
]

// ── 元数据来源优先级 ──────────────────────────────────────────────

export const CATALOG_SOURCE_PRIORITY: Record<string, number> = {
  manual:  5,
  tmdb:    4,
  // ADR-161 决策要点 2：anime 下 Bangumi 优先于豆瓣。bangumi 来源仅对 anime 写入
  // （step3 与占位均 anime-only），全局提级至 4（> douban:3）即等价「anime Bangumi 优先」，
  // 非 anime 不受影响；manual(5) 仍最高。同级（== tmdb:4）后写覆盖（当前无 tmdb anime 自动写入）。
  bangumi: 4,
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

// ── findOrCreate 命中步骤（CHG-VIR-10 / ADR-105a D-105a-16）──────────

/**
 * findOrCreate 5 步匹配的命中点（Service 内部返回值契约，不动端点 / 不改绑定语义）。
 * ingest shadow scoring 用于「现有 5 步 vs 新评分」对比切片（D-105a-12 生产绑定零变更）。
 * `conflict_recovered` = INSERT 被并发 ON CONFLICT 跳过后重查收敛路径。
 */
export type CatalogMatchStep =
  | 'imdb_id'
  | 'tmdb_id'
  | 'douban_id'
  | 'bangumi_id'
  | 'title_triple'
  | 'created'
  | 'conflict_recovered'

export interface CatalogMatchResult {
  readonly catalog: MediaCatalogRow
  readonly matchedStep: CatalogMatchStep
}

// ── 外部 ID 绑定判定（ADR-174 D-174-3 唯一约束兜底真去重）────────────

/**
 * 写外部 ID（当前仅 bangumi_subject_id）到 catalog 前的真去重判定结果：
 * - safe：无他行占用该外部 ID（或占用者即当前行）→ 当前 catalog 可直接绑定
 * - redirect：他行已占用且重指向安全 → video.catalog_id 应改指 target（运行时即时去重）
 * - conflict：他行已占用但重指向不安全（type 不同 / year 显著冲突）→ 调用方降级处理
 *
 * follow-up（ADR-174 #1）：douban/imdb/tmdb 同类唯一约束同构，届时提取为
 * `linkExternalIdOrRedirect(provider, externalId, ...)` 通用原语，本判定即其只读内核。
 */
export type CatalogBindingResolution =
  | { kind: 'safe' }
  | { kind: 'redirect'; targetCatalogId: string }
  | { kind: 'conflict' }

/**
 * 重指向安全性判定：把 video 从 current catalog 改指到已占用同一 subject 的 existing catalog，
 * 仅当二者确属同一作品时才安全。判据（保守）：
 * - type 必须相同（不同内容类型 → 重指向会错分视频，必拒）
 * - year 若双方均有且差距 ≥2（与置信度评分「年份差≥2 不加分」一致）→ 视为不同版本/季，拒
 * 缺 year 不阻断（多数裂行同源同 year，缺值留给 type 把关）。
 */
function isRedirectSafe(current: MediaCatalogRow, existing: MediaCatalogRow): boolean {
  if (current.type !== existing.type) return false
  if (current.year != null && existing.year != null && Math.abs(current.year - existing.year) >= 2) {
    return false
  }
  return true
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
    return (await this.findOrCreateWithMatch(input)).catalog
  }

  /**
   * findOrCreateWithMatch — findOrCreate 真源实现，额外透出命中步骤 matchedStep
   * （CHG-VIR-10 / D-105a-16：ingest shadow 对比「现有 5 步 vs 新评分」用；
   * 匹配逻辑与绑定语义零变更 / D-105a-12）。
   */
  async findOrCreateWithMatch(input: FindOrCreateCatalogInput): Promise<CatalogMatchResult> {
    const client: PoolClient = await this.db.connect()
    try {
      await client.query('BEGIN')

      // Step 1: imdb_id
      if (input.imdbId) {
        const found = await catalogQueries.findCatalogByImdbId(client, input.imdbId)
        if (found) {
          await client.query('COMMIT')
          return { catalog: found, matchedStep: 'imdb_id' }
        }
      }

      // Step 2: tmdb_id
      if (input.tmdbId != null) {
        const found = await catalogQueries.findCatalogByTmdbId(client, input.tmdbId)
        if (found) {
          await client.query('COMMIT')
          return { catalog: found, matchedStep: 'tmdb_id' }
        }
      }

      // Step 3: douban_id
      if (input.doubanId) {
        const found = await catalogQueries.findCatalogByDoubanId(client, input.doubanId)
        if (found) {
          await client.query('COMMIT')
          return { catalog: found, matchedStep: 'douban_id' }
        }
      }

      // Step 4: bangumi_subject_id
      if (input.bangumiSubjectId != null) {
        const found = await catalogQueries.findCatalogByBangumiId(client, input.bangumiSubjectId)
        if (found) {
          await client.query('COMMIT')
          return { catalog: found, matchedStep: 'bangumi_id' }
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
        return { catalog: found5, matchedStep: 'title_triple' }
      }

      // 全部未命中 → INSERT（ON CONFLICT DO NOTHING 防止并发重复）
      const inserted = await catalogQueries.insertCatalog(client, input)
      if (inserted) {
        await client.query('COMMIT')
        return { catalog: inserted, matchedStep: 'created' }
      }

      // INSERT 被 ON CONFLICT 跳过（并发写入导致）→ 再次查询
      // ADR-161 Y5：补 bangumiId 分支（与 Step4 对称），保证并发 seed + enrich step3
      // 写同一 subject 时若因 bangumi_subject_id 唯一冲突被跳过仍能查回收敛。
      const retry =
        (input.imdbId ? await catalogQueries.findCatalogByImdbId(client, input.imdbId) : null) ??
        (input.tmdbId != null ? await catalogQueries.findCatalogByTmdbId(client, input.tmdbId) : null) ??
        (input.doubanId ? await catalogQueries.findCatalogByDoubanId(client, input.doubanId) : null) ??
        (input.bangumiSubjectId != null ? await catalogQueries.findCatalogByBangumiId(client, input.bangumiSubjectId) : null) ??
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
      return { catalog: retry, matchedStep: 'conflict_recovered' }
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
    provenanceCtx?: { sourceRef?: string; db?: Pool | PoolClient }
  ): Promise<{ updated: MediaCatalogRow | null; skippedFields: string[] }> {
    // 可选 db：调用方在外部事务（如 BangumiService.confirmMatch）时传入 PoolClient
    // 共享同一连接确保原子性；默认走 this.db 与现有调用方零兼容性破坏
    const db = provenanceCtx?.db ?? this.db
    const [current, hardLocked] = await Promise.all([
      catalogQueries.findCatalogById(db, catalogId),
      provenanceQueries.getHardLockedFields(db, catalogId),
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
      // CHORE-11 (2026-05-29) FIX-FIX：value === undefined 直接 skip 整段（含 provenance 计算），
      //   避免 caller 用 `field: X ?? undefined` 模式时 provenance 误记"写入"了该字段。
      //   此处不计入 skippedFields（语义：不是"被锁阻挡"的 skipped，是"没传值"）。
      //   updateCatalogFields 兜底层也有 undefined skip，双层保护；本层修是为了 provenance 准确性。
      if (value === undefined) continue
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

    // ── catalog_external_refs 写侧接线（ADR-177 YY-C / CHG-VIR-12-D）─────────
    // 四列 cache 写入与 exact ref 必须同事务（杜绝孤儿 cache / cache 滞后窗口）：
    // - 值非 null → resolveAndWriteExactRef（R10 守卫 + 索引① 预检；exact 冲突 = 归并
    //   信号降级 candidate，该字段**不写 cache**〔cache 槽位属 holder〕计入 skippedFields）
    // - 值为 null（清空 cache）→ demoteExactRef 同事务降级 ref（D-177-5 反向）
    // - imdb/tmdb 不在 EXTERNAL_KIND_BY_PROVIDER（零写入方 / kind 写入时判定），不触发
    // 外部 ID 字段未命中时 refFields 为空 → 不起事务，主路径行为逐值不变。
    const refFields = CATALOG_EXTERNAL_REF_FIELDS.filter(
      ({ field }) => (filteredFields as Record<string, unknown>)[field] !== undefined
    )
    const ownTx = refFields.length > 0 && provenanceCtx?.db === undefined
    const client: Pool | PoolClient = ownTx ? await this.db.connect() : db
    try {
      if (ownTx) await client.query('BEGIN')

      for (const { field, provider } of refFields) {
        const value = (filteredFields as Record<string, unknown>)[field]
        if (value === null) {
          await externalRefQueries.demoteExactRef(client, catalogId, provider)
          continue
        }
        const externalKind = externalRefQueries.EXTERNAL_KIND_BY_PROVIDER[provider]
        if (externalKind === undefined) continue // 防御：映射外 provider 不写 ref
        const result = await externalRefQueries.resolveAndWriteExactRef(client, {
          catalogId,
          provider,
          externalId: String(value),
          externalKind,
          source: source === 'manual' ? 'manual' : 'auto',
          linkedBy: `safe-update:${source}`,
        })
        if (result.outcome === 'conflict_candidate' || result.outcome === 'kind_conflict') {
          delete (filteredFields as Record<string, unknown>)[field]
          skippedFields.push(field)
        }
      }

      // conflict 剔除后可能无字段可写（candidate ref 已落）
      if (Object.keys(filteredFields).length === 0) {
        if (ownTx) await client.query('COMMIT')
        return { updated: current, skippedFields }
      }

      // 若来源为 manual，自动锁定写入的字段（幂等去重；以 conflict 剔除后的最终字段集为准）
      if (source === 'manual') {
        const newLockedFields = [
          ...current.lockedFields,
          ...Object.keys(filteredFields),
        ]
        const uniqueLocked = [...new Set(newLockedFields)]
        await catalogQueries.setLockedFields(client, catalogId, uniqueLocked)
      }

      const updated = await catalogQueries.updateCatalogFields(client, catalogId, {
        ...filteredFields,
        metadataSource: source,
      })
      if (ownTx) await client.query('COMMIT')
      return this.finishSafeUpdate(db, catalogId, filteredFields, source, provenanceCtx, updated, skippedFields)
    } catch (err) {
      if (ownTx) await client.query('ROLLBACK')
      throw err
    } finally {
      if (ownTx) (client as PoolClient).release()
    }
  }

  /** safeUpdate 收尾：provenance fire-and-forget（失败不影响主流程） */
  private finishSafeUpdate(
    db: Pool | PoolClient,
    catalogId: string,
    filteredFields: CatalogUpdateData,
    source: CatalogMetadataSource,
    provenanceCtx: { sourceRef?: string; db?: Pool | PoolClient } | undefined,
    updated: MediaCatalogRow | null,
    skippedFields: string[]
  ): { updated: MediaCatalogRow | null; skippedFields: string[] } {

    // 写入字段来源 provenance（非阻塞，失败不影响主流程）
    if (provenanceCtx !== undefined) {
      const writtenFields = Object.keys(filteredFields).filter((k) => k !== 'metadataSource')
      void provenanceQueries.batchUpsertFieldProvenance(
        db,
        catalogId,
        writtenFields,
        source,
        provenanceCtx.sourceRef ?? null,
        CATALOG_SOURCE_PRIORITY[source] ?? 0,
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
   * resolveBangumiBinding — ADR-174 D-174-3：写 bangumi_subject_id 前的唯一约束兜底真去重判定。
   *
   * 只读：判定该 subject 是否已被他行占用，以及当前 video 能否安全重指向（不写库，
   * redirect 的 linkVideo 由调用方在事务内执行以保原子性）。db 透传调用方的事务连接，
   * 确保读到事务内一致快照。
   */
  async resolveBangumiBinding(
    db: Pool | PoolClient,
    currentCatalogId: string,
    bangumiId: number,
  ): Promise<CatalogBindingResolution> {
    const existing = await catalogQueries.findCatalogByBangumiId(db, bangumiId)
    // 无他行占用，或占用者即当前行 → 当前 catalog 直接绑定（safe，无需查当前行）
    if (!existing || existing.id === currentCatalogId) return { kind: 'safe' }
    // 他行已占用 → 取当前行判定重指向安全性
    const current = await catalogQueries.findCatalogById(db, currentCatalogId)
    if (!current || !isRedirectSafe(current, existing)) return { kind: 'conflict' }
    return { kind: 'redirect', targetCatalogId: existing.id }
  }

  /**
   * linkVideo — 将 videos.catalog_id 绑定到指定 catalog（通常在 findOrCreate 后调用）。
   * 可选 db：调用方在外部事务（如 BangumiService 真去重重指向）时传入 PoolClient 共享连接保原子性；
   * 不传则走 this.db（既有调用方零兼容性破坏）。
   */
  async linkVideo(videoId: string, catalogId: string, db?: Pool | PoolClient): Promise<void> {
    await catalogQueries.linkVideoToCatalog(db ?? this.db, videoId, catalogId)
  }

  /**
   * findById — 直接按 catalog ID 查找（供其他 Service 使用）
   */
  async findById(catalogId: string): Promise<MediaCatalogRow | null> {
    return catalogQueries.findCatalogById(this.db, catalogId)
  }
}

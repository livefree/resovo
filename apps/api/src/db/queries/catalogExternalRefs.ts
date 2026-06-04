/**
 * catalogExternalRefs.ts — catalog_external_refs 写侧原语（ADR-177 / CHG-VIR-12-D / Phase 5d）
 *
 * 表为 catalog 级外部身份**单一真源**（D-177-1，migration 091）；`media_catalog` 四外部 ID
 * 列降级为读优化 cache（D-177-5）。本文件承载：
 *   - D-177-11 provider → external_kind 映射常量（单一真源，对等 ALIAS_KINDS 范式）
 *   - R10 应用层守卫（external_kind 全局一致 + exact↔parent 取值域互斥）
 *   - exact 写入「索引① 预检主导 + ON CONFLICT 仅并发保险」（RR-A 范式 / D-177-9）：
 *     exact 冲突 = catalog 归并信号 → 降级 candidate，**不靠唯一索引报错兜底**（R3/D-177-4）
 *   - candidate 幂等写入（D-174-3 双写消费 + exact 冲突降级共用；candidate 不进 partial
 *     unique 故不能依赖 ON CONFLICT —— WHERE NOT EXISTS 口径，与 12-C 回填脚本一致）
 *
 * 事务边界：本文件不开事务。YY-C「exact ref 与 cache 回填同事务」由调用方
 * （MediaCatalogService.safeUpdate）保证 —— 传入同一 Pool/PoolClient。
 */

import type { Pool, PoolClient } from 'pg'

export type ExternalRefProvider = 'imdb' | 'tmdb' | 'douban' | 'bangumi'
export type ExternalRefKind = 'show' | 'season' | 'movie' | 'subject'

/**
 * D-177-11 provider → external_kind 映射（确定级）：
 * - bangumi / douban → 'subject'（provider 原生条目，产品形态按季独立分条目 = 精确级）
 * - imdb / tmdb 不入此表：写入时由富集数据形态判定 show/movie/season（方向定档，
 *   当前零写入方；事后推断不可靠 YY-D，不提供默认值防误用）
 */
export const EXTERNAL_KIND_BY_PROVIDER: Partial<Record<ExternalRefProvider, ExternalRefKind>> = {
  bangumi: 'subject',
  douban: 'subject',
}

/** R10 取值域：精确级 kind → exact 域；show → parent 域（candidate/rejected 不受限） */
export const PRECISE_KINDS: readonly ExternalRefKind[] = ['subject', 'season', 'movie']

export interface ExternalRefWriteInput {
  readonly catalogId: string
  readonly provider: ExternalRefProvider
  /** provider 侧 ID（统一 TEXT / D-177-1） */
  readonly externalId: string
  readonly externalKind: ExternalRefKind
  readonly source: 'auto' | 'manual'
  /** 写入主体留痕（如 'safe-update' / 'bangumi-enrich-conflict'） */
  readonly linkedBy: string
  /** 分季 ref（NULL=非分季；CHECK>0 / R9 哨兵口径） */
  readonly seasonNumber?: number | null
  /** 上卷派生溯源（YY-B / D-177-4 规则名；非上卷写入留 NULL） */
  readonly rollupRule?: string | null
}

export type ExactRefOutcome =
  /** exact 已写入（或并发保险后确认归属自身） */
  | { readonly outcome: 'exact_written' }
  /** 自身已持有同 exact（幂等命中） */
  | { readonly outcome: 'already_exact' }
  /** 他 catalog 已持同精确实体 exact → 降级 candidate（D-177-4 归并信号） */
  | { readonly outcome: 'conflict_candidate'; readonly holderCatalogId: string }
  /** R10 守卫：同 (provider, external_id) 既有行 external_kind 不一致 → 拒写 */
  | { readonly outcome: 'kind_conflict'; readonly existingKind: string }

/**
 * exact 写入原语（R10 守卫 + 索引① 预检主导 / RR-A 范式）。
 * 仅服务精确级 kind（show 级 parent 写入属上卷 job 路径，不在本原语）；
 * 传入 show 是调用方契约错误 → throw（程序错误非数据状态）。
 */
export async function resolveAndWriteExactRef(
  db: Pool | PoolClient,
  input: ExternalRefWriteInput
): Promise<ExactRefOutcome> {
  if (!PRECISE_KINDS.includes(input.externalKind)) {
    throw new Error(
      `resolveAndWriteExactRef: kind '${input.externalKind}' 非精确级（R10：show 级只可 parent，走上卷路径）`
    )
  }

  // R10 守卫：同 (provider, external_id) 的 external_kind 全局一致（应用层 best-effort，
  // 跨行不变量 DB 无法表达；报表/上卷为第二道检出）
  const kindRow = await db.query<{ external_kind: string }>(
    `SELECT external_kind FROM catalog_external_refs
      WHERE provider = $1 AND external_id = $2
      LIMIT 1`,
    [input.provider, input.externalId]
  )
  const existingKind = kindRow.rows[0]?.external_kind
  if (existingKind !== undefined && existingKind !== input.externalKind) {
    return { outcome: 'kind_conflict', existingKind }
  }

  // 索引① 预检（RR-A：预检主导，不靠唯一索引报错兜底）
  const holder = await db.query<{ catalog_id: string }>(
    `SELECT catalog_id FROM catalog_external_refs
      WHERE provider = $1 AND external_id = $2 AND external_kind = $3 AND relation = 'exact'
      LIMIT 1`,
    [input.provider, input.externalId, input.externalKind]
  )
  const holderId = holder.rows[0]?.catalog_id
  if (holderId === input.catalogId) {
    return { outcome: 'already_exact' }
  }
  if (holderId !== undefined) {
    // exact 冲突 = catalog 归并信号（D-177-4）：降级 candidate 交上卷/人工，不炸事务
    await insertCandidateRef(db, input)
    return { outcome: 'conflict_candidate', holderCatalogId: holderId }
  }

  // 未占用 → INSERT exact。ON CONFLICT DO NOTHING（不指定目标 = 覆盖索引①②）仅作并发保险
  const inserted = await db.query(
    `INSERT INTO catalog_external_refs
       (catalog_id, provider, external_id, external_kind, relation,
        season_number, source, is_primary, linked_by, rollup_rule)
     VALUES ($1, $2, $3, $4, 'exact', $5, $6, true, $7, $8)
     ON CONFLICT DO NOTHING`,
    [
      input.catalogId,
      input.provider,
      input.externalId,
      input.externalKind,
      input.seasonNumber ?? null,
      input.source,
      input.linkedBy,
      input.rollupRule ?? null,
    ]
  )
  if (inserted.rowCount === 0) {
    // 并发窗口被他者占用 → 重查降级（与预检命中同分支收敛）
    const recheck = await db.query<{ catalog_id: string }>(
      `SELECT catalog_id FROM catalog_external_refs
        WHERE provider = $1 AND external_id = $2 AND external_kind = $3 AND relation = 'exact'
        LIMIT 1`,
      [input.provider, input.externalId, input.externalKind]
    )
    const concurrentHolder = recheck.rows[0]?.catalog_id
    if (concurrentHolder === input.catalogId) return { outcome: 'already_exact' }
    if (concurrentHolder !== undefined) {
      await insertCandidateRef(db, input)
      return { outcome: 'conflict_candidate', holderCatalogId: concurrentHolder }
    }
    // 撞的是索引②（自身重复行竞态）→ 等价幂等命中
    return { outcome: 'already_exact' }
  }
  return { outcome: 'exact_written' }
}

/**
 * candidate 幂等写入。跳过条件（NOT EXISTS）：同 catalog + provider + external_id 已有
 * `candidate`（重复信号）**或 `exact`**（自身已确认绑定，candidate 纯噪声 / CHG-VIR-12-E）；
 * `rejected` 不阻插（拒绝后新证据可再候选，复活语义）。
 * 消费方：D-174-3 catalog 层冲突双写（D-177-7/D-177-13）+ exact 冲突降级（本文件）+
 * 上卷 job（D-177-4 candidate 产出）。
 * @returns true=新插入 / false=已存在（幂等）
 */
export async function insertCandidateRef(
  db: Pool | PoolClient,
  input: ExternalRefWriteInput
): Promise<boolean> {
  const r = await db.query(
    `INSERT INTO catalog_external_refs
       (catalog_id, provider, external_id, external_kind, relation,
        season_number, source, is_primary, linked_by, rollup_rule)
     SELECT $1, $2, $3, $4, 'candidate', $5, $6, false, $7, $8
      WHERE NOT EXISTS (
        SELECT 1 FROM catalog_external_refs
        WHERE catalog_id = $1 AND provider = $2 AND external_id = $3
          AND relation IN ('candidate', 'exact')
      )`,
    [
      input.catalogId,
      input.provider,
      input.externalId,
      input.externalKind,
      input.seasonNumber ?? null,
      input.source,
      input.linkedBy,
      input.rollupRule ?? null,
    ]
  )
  return (r.rowCount ?? 0) > 0
}

/**
 * exact 降级原语（D-177-5「删/降级 exact 时清 cache」的 ref 侧）：
 * catalog 清空某 provider 的 cache 列时，其 exact ref 同步降级 candidate（保留审计痕迹，
 * 不 DELETE；candidate 不进 partial unique，降级后行退出索引②无冲突）。
 * cache 列清空本身由调用方（safeUpdate → updateCatalogFields）同事务完成。
 * @returns 降级的行数（0=本无 exact，幂等）
 */
export async function demoteExactRef(
  db: Pool | PoolClient,
  catalogId: string,
  provider: ExternalRefProvider
): Promise<number> {
  const r = await db.query(
    `UPDATE catalog_external_refs
        SET relation = 'candidate', is_primary = false, updated_at = NOW(),
            notes = COALESCE(notes || ' | ', '') || 'demoted: cache cleared'
      WHERE catalog_id = $1 AND provider = $2 AND relation = 'exact'`,
    [catalogId, provider]
  )
  return r.rowCount ?? 0
}

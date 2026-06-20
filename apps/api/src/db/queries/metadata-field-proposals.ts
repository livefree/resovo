/**
 * metadata-field-proposals.ts — 多源交叉验证字段级 proposal 载体读写原语
 *
 * ADR-205 D-205-2：reconcile（gather→reconcile→write）逐字段裁决的候选/winner/冲突载体。
 *   每 catalog 每字段每源一行（PK (catalog_id, field_name, source_kind)，M6 不变量）。
 *   `video_metadata_provenance` 仍为 last-writer SSOT，二者正交。
 *
 * 本文件（META-49-A）仅含写侧 upsert + 单 catalog 读（独立验证）。
 *   reconcile 编排（49-B）/ 冲突行批量 LATERAL 读注入 derive（49-C）另卡。
 */

import type { Pool, PoolClient } from 'pg'

// ── 行类型 ────────────────────────────────────────────────────────

export interface FieldProposalRow {
  catalogId: string
  fieldName: string
  sourceKind: string
  sourceRef: string | null
  /** JSONB 候选值（标量/数组，reconcile 比较前经 canonical 归一，D-205-3）。 */
  proposedValue: unknown
  confidence: number | null
  /** 逻辑 winner（reconcile 裁决胜出）；与 applied 解耦（D-205-4）。 */
  isWinner: boolean
  /** 实际经 safeUpdate 落 media_catalog（优先级闸门放行后为 true）。 */
  applied: boolean
  /** 跨源冲突标记（reconcile 写 / derive 读，D-205-6）；null=无冲突。 */
  conflictState: string | null
  proposedAt: string
}

/**
 * 写入输入（catalogId 由 batchUpsert 第二参数统一携带）。
 * `proposedValue` 必须为可 JSON 序列化的非 undefined 值（proposed_value 列 NOT NULL）。
 */
export interface FieldProposalInput {
  fieldName: string
  sourceKind: string
  sourceRef?: string | null
  proposedValue: unknown
  confidence?: number | null
  isWinner?: boolean
  applied?: boolean
  conflictState?: string | null
}

// ── 内部 DB 行类型 ────────────────────────────────────────────────

interface DbFieldProposalRow {
  catalog_id: string
  field_name: string
  source_kind: string
  source_ref: string | null
  proposed_value: unknown
  confidence: string | null
  is_winner: boolean
  applied: boolean
  conflict_state: string | null
  proposed_at: string
}

// ── 映射 ─────────────────────────────────────────────────────────

function mapProposal(row: DbFieldProposalRow): FieldProposalRow {
  return {
    catalogId: row.catalog_id,
    fieldName: row.field_name,
    sourceKind: row.source_kind,
    sourceRef: row.source_ref,
    proposedValue: row.proposed_value,
    // NUMERIC 经 node-pg 默认返回 string（保精度）→ 收口为 number
    confidence: row.confidence === null ? null : Number(row.confidence),
    isWinner: row.is_winner,
    applied: row.applied,
    conflictState: row.conflict_state,
    proposedAt: row.proposed_at,
  }
}

// ── 写侧 ──────────────────────────────────────────────────────────

/**
 * 批量 upsert 字段 proposal（reconcile 相位调用，与 winner 写入共享事务 client）。
 *
 * - `proposed_at` 不在 INSERT 列（走 DB DEFAULT NOW()，对齐 provenance updated_at 范式）；
 *   ON CONFLICT UPDATE 路径显式 `proposed_at = NOW()`（UPDATE 不触 column DEFAULT）。
 * - `proposed_value` 经 `JSON.stringify` + `$N::jsonb` cast——node-pg 不自动序列化 jsonb
 *   参数（数组会被误转 PG array、对象转 '[object Object]'），必须显式 stringify。
 * - ON CONFLICT (catalog_id, field_name, source_kind)（M6 同源同字段单 proposal）DO UPDATE
 *   全量覆盖，让同一源的最新提案替换旧值。
 */
export async function batchUpsertFieldProposals(
  db: Pool | PoolClient,
  catalogId: string,
  proposals: FieldProposalInput[],
): Promise<void> {
  if (proposals.length === 0) return
  let idx = 1
  const values: string[] = []
  const params: unknown[] = []
  for (const p of proposals) {
    // 列序：catalog_id, field_name, source_kind, source_ref, proposed_value(::jsonb),
    //       confidence, is_winner, applied, conflict_state
    values.push(
      `($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}::jsonb, $${idx++}, $${idx++}, $${idx++}, $${idx++})`,
    )
    params.push(
      catalogId,
      p.fieldName,
      p.sourceKind,
      p.sourceRef ?? null,
      JSON.stringify(p.proposedValue),
      p.confidence ?? null,
      p.isWinner ?? false,
      p.applied ?? false,
      p.conflictState ?? null,
    )
  }
  await db.query(
    `INSERT INTO metadata_field_proposals
       (catalog_id, field_name, source_kind, source_ref, proposed_value, confidence, is_winner, applied, conflict_state)
     VALUES ${values.join(', ')}
     ON CONFLICT (catalog_id, field_name, source_kind) DO UPDATE SET
       source_ref = EXCLUDED.source_ref,
       proposed_value = EXCLUDED.proposed_value,
       confidence = EXCLUDED.confidence,
       is_winner = EXCLUDED.is_winner,
       applied = EXCLUDED.applied,
       conflict_state = EXCLUDED.conflict_state,
       proposed_at = NOW()`,
    params,
  )
}

/**
 * 删除指定字段的全部 proposal（reconcile 逐字段全量重算前清旧）。
 *
 * META-49-B2（Codex stop-time review FIX「stale proposal rows never cleared」）：`batchUpsert` 只
 * upsert 不删——重 enrich/refresh 时若某字段 winner 翻转（旧 winner 源不再提案）或冲突消解（旧 conflict
 * 源退出），旧行 `is_winner=true`/`conflict_state='conflict'` 残留 → 双 winner / 幽灵冲突
 * （49-C derive 经 partial index `WHERE conflict_state IS NOT NULL` 读到永不清除的假冲突）。
 *
 * reconcile 对本次**决出的字段**先删后插（同事务）：每字段 proposal 行 = 本次 reconcile 的候选全集，
 * 杜绝跨 run 残留。未决字段（本 run 无源提案）的历史 proposal 保留（未被重新评估）。
 */
export async function deleteFieldProposalsByFields(
  db: Pool | PoolClient,
  catalogId: string,
  fieldNames: string[],
): Promise<void> {
  if (fieldNames.length === 0) return
  await db.query(
    `DELETE FROM metadata_field_proposals WHERE catalog_id = $1 AND field_name = ANY($2::text[])`,
    [catalogId, fieldNames],
  )
}

// ── 读侧（单 catalog，独立验证 / 49-B 调试；批量多 catalog conflict 读归 49-C）──────

/**
 * 批量取一组 catalog 的「冲突字段名」（conflict_state 非空，走 partial index
 * `idx_metadata_field_proposals_conflict`，避免 cell N+1）。META-49-C derive 注入：有冲突字段的
 * catalog → overall 派为 needs_review。返回 `Map<catalogId, 冲突字段名[]>`（去重升序）。
 */
export async function getConflictFieldsByCatalogIds(
  db: Pool | PoolClient,
  catalogIds: string[],
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>()
  if (catalogIds.length === 0) return result
  const res = await db.query<{ catalog_id: string; field_name: string }>(
    `SELECT DISTINCT catalog_id, field_name
       FROM metadata_field_proposals
      WHERE catalog_id = ANY($1::uuid[]) AND conflict_state IS NOT NULL
      ORDER BY catalog_id, field_name`,
    [catalogIds],
  )
  for (const r of res.rows) {
    const list = result.get(r.catalog_id) ?? []
    list.push(r.field_name)
    result.set(r.catalog_id, list)
  }
  return result
}

/** 查询单 catalog 全部字段 proposal（按 field_name, source_kind 稳定排序）。 */
export async function getFieldProposalsByCatalogId(
  db: Pool | PoolClient,
  catalogId: string,
): Promise<FieldProposalRow[]> {
  const result = await db.query<DbFieldProposalRow>(
    `SELECT catalog_id, field_name, source_kind, source_ref, proposed_value,
            confidence, is_winner, applied, conflict_state, proposed_at
     FROM metadata_field_proposals
     WHERE catalog_id = $1
     ORDER BY field_name, source_kind`,
    [catalogId],
  )
  return result.rows.map(mapProposal)
}

/**
 * 查询单 catalog 单字段的跨源 proposal 候选（ADR-208 D-208-2：image-health candidates 端点数据源）。
 * 仅返该 (catalog_id, field_name) 跨 source_kind 全部行；trust 排序由调用方用 canonical
 * CATALOG_SOURCE_PRIORITY 派生（禁 SQL 内硬编码 priority，D-205-3）。confidence 降序作次级稳定排序。
 */
export async function getFieldProposalsByCatalogIdAndField(
  db: Pool | PoolClient,
  catalogId: string,
  fieldName: string,
): Promise<FieldProposalRow[]> {
  const result = await db.query<DbFieldProposalRow>(
    `SELECT catalog_id, field_name, source_kind, source_ref, proposed_value,
            confidence, is_winner, applied, conflict_state, proposed_at
     FROM metadata_field_proposals
     WHERE catalog_id = $1 AND field_name = $2
     ORDER BY confidence DESC NULLS LAST, source_kind`,
    [catalogId, fieldName],
  )
  return result.rows.map(mapProposal)
}

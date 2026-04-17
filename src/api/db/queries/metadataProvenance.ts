/**
 * metadataProvenance.ts — 字段来源追踪与精细化锁定查询
 * META-09：两张表的读写原语
 * - video_metadata_provenance：追踪每个字段最后一次由哪个来源写入
 * - video_metadata_locks：精细化字段级锁（soft/hard）
 */

import type { Pool, PoolClient } from 'pg'

// ── 行类型 ────────────────────────────────────────────────────────

export interface ProvenanceRow {
  catalogId: string
  fieldName: string
  sourceKind: string
  sourceRef: string | null
  sourcePriority: number
  updatedAt: string
}

export interface LockRow {
  catalogId: string
  fieldName: string
  lockMode: 'soft' | 'hard'
  lockedBy: string
  lockedAt: string
  reason: string | null
}

// ── 内部 DB 行类型 ────────────────────────────────────────────────

interface DbProvenanceRow {
  catalog_id: string
  field_name: string
  source_kind: string
  source_ref: string | null
  source_priority: number
  updated_at: string
}

interface DbLockRow {
  catalog_id: string
  field_name: string
  lock_mode: 'soft' | 'hard'
  locked_by: string
  locked_at: string
  reason: string | null
}

// ── 映射 ─────────────────────────────────────────────────────────

function mapProvenance(row: DbProvenanceRow): ProvenanceRow {
  return {
    catalogId: row.catalog_id,
    fieldName: row.field_name,
    sourceKind: row.source_kind,
    sourceRef: row.source_ref,
    sourcePriority: row.source_priority,
    updatedAt: row.updated_at,
  }
}

function mapLock(row: DbLockRow): LockRow {
  return {
    catalogId: row.catalog_id,
    fieldName: row.field_name,
    lockMode: row.lock_mode,
    lockedBy: row.locked_by,
    lockedAt: row.locked_at,
    reason: row.reason,
  }
}

// ── Provenance 查询 ───────────────────────────────────────────────

/** 批量 upsert 字段来源（写入后调用） */
export async function batchUpsertFieldProvenance(
  db: Pool | PoolClient,
  catalogId: string,
  fieldNames: string[],
  sourceKind: string,
  sourceRef: string | null,
  sourcePriority: number,
): Promise<void> {
  if (fieldNames.length === 0) return
  let idx = 1
  const values: string[] = []
  const params: unknown[] = []
  for (const fieldName of fieldNames) {
    values.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`)
    params.push(catalogId, fieldName, sourceKind, sourceRef, sourcePriority)
  }
  await db.query(
    `INSERT INTO video_metadata_provenance
       (catalog_id, field_name, source_kind, source_ref, source_priority, updated_at)
     VALUES ${values.join(', ')}
     ON CONFLICT (catalog_id, field_name) DO UPDATE SET
       source_kind = EXCLUDED.source_kind,
       source_ref = EXCLUDED.source_ref,
       source_priority = EXCLUDED.source_priority,
       updated_at = NOW()`,
    params,
  )
}

/** 查询 catalog 所有字段的来源记录 */
export async function getProvenanceByCatalogId(
  db: Pool | PoolClient,
  catalogId: string,
): Promise<ProvenanceRow[]> {
  const result = await db.query<DbProvenanceRow>(
    `SELECT catalog_id, field_name, source_kind, source_ref, source_priority, updated_at
     FROM video_metadata_provenance
     WHERE catalog_id = $1
     ORDER BY field_name`,
    [catalogId],
  )
  return result.rows.map(mapProvenance)
}

// ── Lock 查询 ─────────────────────────────────────────────────────

/** 查询 catalog 所有 hard-locked 字段名 */
export async function getHardLockedFields(
  db: Pool | PoolClient,
  catalogId: string,
): Promise<string[]> {
  const result = await db.query<{ field_name: string }>(
    `SELECT field_name FROM video_metadata_locks
     WHERE catalog_id = $1 AND lock_mode = 'hard'`,
    [catalogId],
  )
  return result.rows.map((r) => r.field_name)
}

/** 查询 catalog 所有锁记录 */
export async function getLocksByCatalogId(
  db: Pool | PoolClient,
  catalogId: string,
): Promise<LockRow[]> {
  const result = await db.query<DbLockRow>(
    `SELECT catalog_id, field_name, lock_mode, locked_by, locked_at, reason
     FROM video_metadata_locks
     WHERE catalog_id = $1
     ORDER BY field_name`,
    [catalogId],
  )
  return result.rows.map(mapLock)
}

/** Upsert 单个字段锁 */
export async function upsertFieldLock(
  db: Pool | PoolClient,
  catalogId: string,
  fieldName: string,
  lockMode: 'soft' | 'hard',
  lockedBy: string,
  reason?: string,
): Promise<void> {
  await db.query(
    `INSERT INTO video_metadata_locks
       (catalog_id, field_name, lock_mode, locked_by, reason, locked_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (catalog_id, field_name) DO UPDATE SET
       lock_mode = EXCLUDED.lock_mode,
       locked_by = EXCLUDED.locked_by,
       reason = EXCLUDED.reason,
       locked_at = NOW()`,
    [catalogId, fieldName, lockMode, lockedBy, reason ?? null],
  )
}

/** 删除指定字段锁 */
export async function removeFieldLock(
  db: Pool | PoolClient,
  catalogId: string,
  fieldName: string,
): Promise<void> {
  await db.query(
    `DELETE FROM video_metadata_locks WHERE catalog_id = $1 AND field_name = $2`,
    [catalogId, fieldName],
  )
}

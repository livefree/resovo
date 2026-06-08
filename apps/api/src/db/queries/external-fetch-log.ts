// external-fetch-log.ts — external_data.external_fetch_log 查询（ADR-188 D-188-3/4/7）
// provider 无关采集操作流水：在线出口埋点写入（insertFetchLog）+ 后台读
// （queryFetchLog 过滤分页 activity / aggregateFetchLog 概览）+ 保留 purge（deleteFetchLogBefore）。
// 所有 SQL 参数化，不拼接用户值（db-rules.md）。

import type { Pool } from 'pg'
import type { ProviderKey, AcquisitionMethod, ProviderCapability } from '@resovo/types'

// ── 类型 ──────────────────────────────────────────────────────────────────────

export type FetchStatus = 'ok' | 'fail' | 'timeout'
export type FetchSource = 'enrich_worker' | 'collections_worker' | 'admin_search'

/** 埋点写入入参（在线出口捕获后调用；source 由调用方传，缺省 null）。 */
export interface FetchLogInput {
  readonly provider: ProviderKey
  readonly operation: ProviderCapability
  readonly method: AcquisitionMethod
  readonly status: FetchStatus
  readonly source?: FetchSource | null
  readonly target?: string | null
  readonly itemCount?: number
  readonly durationMs?: number | null
  readonly error?: string | null
}

export interface FetchLogRow {
  id: string
  provider: string
  operation: string
  method: string
  status: string
  source: string | null
  target: string | null
  itemCount: number
  durationMs: number | null
  error: string | null
  createdAt: string
}

interface DbFetchLogRow {
  id: string
  provider: string
  operation: string
  method: string
  status: string
  source: string | null
  target: string | null
  item_count: number
  duration_ms: number | null
  error: string | null
  created_at: string
}

function mapFetchLogRow(row: DbFetchLogRow): FetchLogRow {
  return {
    id: row.id,
    provider: row.provider,
    operation: row.operation,
    method: row.method,
    status: row.status,
    source: row.source,
    target: row.target,
    itemCount: row.item_count,
    durationMs: row.duration_ms,
    error: row.error,
    createdAt: row.created_at,
  }
}

// ── 写入（在线出口埋点，D-188-4）──────────────────────────────────────────────

/**
 * 写一行采集操作流水。调用方 await + try/catch 吞错（旁路不阻塞业务，ADR-188 M2）——
 * 本函数只负责参数化 INSERT，错误向上抛由埋点 helper 吞掉。
 */
export async function insertFetchLog(db: Pool, input: FetchLogInput): Promise<void> {
  await db.query(
    `INSERT INTO external_data.external_fetch_log
       (provider, operation, method, status, source, target, item_count, duration_ms, error)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      input.provider,
      input.operation,
      input.method,
      input.status,
      input.source ?? null,
      input.target ?? null,
      input.itemCount ?? 0,
      input.durationMs ?? null,
      input.error ?? null,
    ],
  )
}

// ── 读取（activity 端点）──────────────────────────────────────────────────────

export interface FetchLogFilter {
  readonly provider: string
  readonly operation?: string
  readonly method?: string
  readonly status?: string
  /** ISO datetime；仅返回 created_at >= since */
  readonly since?: string
  readonly limit?: number
  readonly offset?: number
}

export interface FetchLogPage {
  readonly rows: FetchLogRow[]
  readonly total: number
}

/** 采集流水过滤分页（activity 端点；动态 WHERE 全参数化，limit clamp 1–100）。 */
export async function queryFetchLog(db: Pool, filter: FetchLogFilter): Promise<FetchLogPage> {
  const conds: string[] = ['provider = $1']
  const params: unknown[] = [filter.provider]
  let i = 2
  if (filter.operation) {
    conds.push(`operation = $${i++}`)
    params.push(filter.operation)
  }
  if (filter.method) {
    conds.push(`method = $${i++}`)
    params.push(filter.method)
  }
  if (filter.status) {
    conds.push(`status = $${i++}`)
    params.push(filter.status)
  }
  if (filter.since) {
    conds.push(`created_at >= $${i++}`)
    params.push(filter.since)
  }
  const where = conds.join(' AND ')
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 100)
  const offset = Math.max(filter.offset ?? 0, 0)

  const totalRes = await db.query<{ count: string }>(
    `SELECT COUNT(*)::TEXT AS count FROM external_data.external_fetch_log WHERE ${where}`,
    params,
  )
  const rowsRes = await db.query<DbFetchLogRow>(
    `SELECT id::TEXT AS id, provider, operation, method, status, source, target,
            item_count, duration_ms, error, created_at::TEXT AS created_at
       FROM external_data.external_fetch_log
      WHERE ${where}
      ORDER BY created_at DESC
      LIMIT $${i++} OFFSET $${i}`,
    [...params, limit, offset],
  )
  return {
    rows: rowsRes.rows.map(mapFetchLogRow),
    total: Number.parseInt(totalRes.rows[0]?.count ?? '0', 10),
  }
}

// ── 聚合（overview 概览，D-188-5）──────────────────────────────────────────────

export interface FetchAggregateBucket {
  readonly key: string
  readonly total: number
  readonly ok: number
  readonly fail: number
  readonly timeout: number
}

export interface FetchAggregate {
  readonly total: number
  readonly ok: number
  readonly fail: number
  readonly timeout: number
  readonly avgDurationMs: number | null
  readonly byOperation: FetchAggregateBucket[]
  readonly byMethod: FetchAggregateBucket[]
}

interface DbBucketRow {
  key: string
  total: string
  ok: string
  fail: string
  timeout: string
}

const STATUS_FILTERS = `
  COUNT(*)::TEXT AS total,
  COUNT(*) FILTER (WHERE status = 'ok')::TEXT AS ok,
  COUNT(*) FILTER (WHERE status = 'fail')::TEXT AS fail,
  COUNT(*) FILTER (WHERE status = 'timeout')::TEXT AS timeout`

function mapBucket(row: DbBucketRow): FetchAggregateBucket {
  return {
    key: row.key,
    total: Number.parseInt(row.total, 10),
    ok: Number.parseInt(row.ok, 10),
    fail: Number.parseInt(row.fail, 10),
    timeout: Number.parseInt(row.timeout, 10),
  }
}

/**
 * 概览：provider 在 since 之后的采集用量 / 成功率 / 平均延迟，按 operation + method 分桶。
 * 三查询共用 (provider, created_at) 索引；月量级 < 100 万行即席聚合够用（不建 rollup，D-188-7）。
 */
export async function aggregateFetchLog(
  db: Pool,
  provider: string,
  since: string,
): Promise<FetchAggregate> {
  const totalRes = await db.query<{ total: string; ok: string; fail: string; timeout: string; avg_ms: string | null }>(
    `SELECT ${STATUS_FILTERS}, AVG(duration_ms)::TEXT AS avg_ms
       FROM external_data.external_fetch_log
      WHERE provider = $1 AND created_at >= $2`,
    [provider, since],
  )
  const byOpRes = await db.query<DbBucketRow>(
    `SELECT operation AS key, ${STATUS_FILTERS}
       FROM external_data.external_fetch_log
      WHERE provider = $1 AND created_at >= $2
      GROUP BY operation
      ORDER BY COUNT(*) DESC`,
    [provider, since],
  )
  const byMethodRes = await db.query<DbBucketRow>(
    `SELECT method AS key, ${STATUS_FILTERS}
       FROM external_data.external_fetch_log
      WHERE provider = $1 AND created_at >= $2
      GROUP BY method
      ORDER BY COUNT(*) DESC`,
    [provider, since],
  )
  const t = totalRes.rows[0]
  return {
    total: Number.parseInt(t?.total ?? '0', 10),
    ok: Number.parseInt(t?.ok ?? '0', 10),
    fail: Number.parseInt(t?.fail ?? '0', 10),
    timeout: Number.parseInt(t?.timeout ?? '0', 10),
    avgDurationMs: t?.avg_ms == null ? null : Math.round(Number(t.avg_ms)),
    byOperation: byOpRes.rows.map(mapBucket),
    byMethod: byMethodRes.rows.map(mapBucket),
  }
}

// ── 保留 purge（D-188-7；maintenanceWorker 调用）────────────────────────────────

/** 删除早于 cutoff（ISO）的流水行，返回删除行数（30 天保留，maintenanceWorker 30天 purge job）。 */
export async function deleteFetchLogBefore(db: Pool, cutoffIso: string): Promise<number> {
  const result = await db.query(
    `DELETE FROM external_data.external_fetch_log WHERE created_at < $1`,
    [cutoffIso],
  )
  return result.rowCount ?? 0
}

/**
 * taskRuns.ts — task_runs 统一抽象层 SQL（ADR-194 path B / NTLG-P2-a-A）
 *
 * task_runs = 当前无持久 run 表的 bull 作业统一登记层（D-194-1/2「只读投影」）。
 * crawler 不写本表（crawler_runs 仍唯一真源）；统一视图由 TaskAggregator 读时 union 投影（归 -B）。
 * SQL 集中本文件（db-rules：SQL 落 queries 层，DbTaskRunReporter 仅编排调用，不直写）。
 *
 * 时间戳返回 Date（raw pg），与 TaskAggregator 既有 CrawlerRunRow 约定一致——消费方（-B 聚合）
 * 统一 .toISOString() 投影 AdminTaskItem；id BIGSERIAL → string（id::text，避 JS 大数精度 + 对齐 TaskRunId）。
 */

import type { Pool } from 'pg'
import type { TaskResultDigest, AdminTaskItem } from '@resovo/types'

/** 最小查询接口（Pool / PoolClient 皆满足；支持事务内调用与测试 BEGIN/ROLLBACK 零污染，同 notifications.ts） */
export type Queryable = Pick<Pool, 'query'>

/**
 * task_runs.status 6 态（DB CHECK 收口，§4.2 统一状态机 + cancelling 协作式取消中间态 D-194-6）。
 * cancelling = running→cancelling→cancelled 的中间态（P2-a-C 控制路径写、worker 轮询信号），非 finish 终态。
 */
export type TaskRunStatus = 'pending' | 'running' | 'cancelling' | 'success' | 'failed' | 'cancelled'

/** finish 终态三值（ADR-193 TaskRunReporter.finish result.status 对齐；cancelling 非终态，不在此列） */
export type TaskRunFinishStatus = 'success' | 'failed' | 'cancelled'

/** task_runs 行（list 返回；时间戳为 raw Date，消费方投影时 toISOString） */
export interface TaskRunRow {
  id: string
  kind: string
  title: string
  ref: string | null
  status: TaskRunStatus
  progress: number | null
  /** JSONB 反序列化为 TaskResultDigest（finish 写入的形状；ADR-193） */
  digest: TaskResultDigest | null
  error: string | null
  startedAt: Date | null
  finishedAt: Date | null
  createdAt: Date
}

export interface InsertTaskRunInput {
  kind: string
  title: string
  ref?: string | null
}

export interface FinishTaskRunInput {
  status: TaskRunFinishStatus
  digest?: TaskResultDigest | null
  error?: string | null
}

export interface ListTaskRunsParams {
  limit: number
  /** ISO 8601 时间下界（含）；省略则不限时间窗 */
  since?: string
}

/**
 * 登记一次任务运行（TaskRunReporter.start）。status='running' + started_at=NOW()（worker 取走即开跑，§4.2）。
 * 返回新行 id（id::text）。失败由调用方（DbTaskRunReporter）catch 降级 sentinel（不阻断作业，§11 D4）。
 */
export async function insertTaskRun(db: Queryable, input: InsertTaskRunInput): Promise<{ id: string }> {
  const res = await db.query<{ id: string }>(
    `INSERT INTO task_runs (kind, title, ref, status, started_at)
     VALUES ($1, $2, $3, 'running', NOW())
     RETURNING id::text AS "id"`,
    [input.kind, input.title, input.ref ?? null],
  )
  return { id: res.rows[0]!.id }
}

/**
 * 更新进度（TaskRunReporter.progress）。pct 调用方已 clamp 0-100（DB CHECK 兜底）。
 * 仅作用于 running 行（终态行不回退进度）。
 */
export async function updateTaskRunProgress(db: Queryable, id: string, pct: number): Promise<void> {
  await db.query(
    `UPDATE task_runs
        SET progress = $2, updated_at = NOW()
      WHERE id = $1::bigint AND status = 'running'`,
    [id, pct],
  )
}

/**
 * 终态登记 + digest 落库（TaskRunReporter.finish）。status→终态 + finished_at=NOW() + digest/error。
 * digest 经 JSON.stringify 落 JSONB（同 notifications.payload 范式）。
 */
export async function finishTaskRun(db: Queryable, id: string, input: FinishTaskRunInput): Promise<void> {
  await db.query(
    `UPDATE task_runs
        SET status = $2,
            digest = $3::jsonb,
            error = $4,
            finished_at = NOW(),
            updated_at = NOW()
      WHERE id = $1::bigint`,
    [
      id,
      input.status,
      input.digest != null ? JSON.stringify(input.digest) : null,
      input.error ?? null,
    ],
  )
}

/**
 * 单行查询（TaskRunReporter 之外的控制路径消费，NTLG-P2-a-C）。
 * id 来自 `taskrun-<id>` 剥前缀后的裸值——`/^\d+$/` 守卫防非数字值触发 `$1::bigint` 报错（直接返 null → 404），
 * 与 crawler_runs UUID 列同类防御（避免 -B→-C 间隙的非法转换 500）。
 */
export async function getTaskRunById(db: Queryable, id: string): Promise<TaskRunRow | null> {
  if (!/^\d+$/.test(id)) return null
  const res = await db.query<TaskRunRow>(
    `SELECT
       id::text AS "id", kind AS "kind", title AS "title", ref AS "ref",
       status AS "status", progress AS "progress", digest AS "digest", error AS "error",
       started_at AS "startedAt", finished_at AS "finishedAt", created_at AS "createdAt"
     FROM task_runs
     WHERE id = $1::bigint`,
    [id],
  )
  return res.rows[0] ?? null
}

/**
 * 取 ids 中处于终态（success/failed/cancelled）的 task_run id 集合（ADR-197 D-197-2 taskrun dismiss 守卫）。
 * 非终态（running/pending/cancelling）不返回 → 不可 dismiss（进行中任务移除会破窗 D-197-2）。
 * id 来自 `taskrun-<id>` 剥前缀的裸数字值；非数字过滤防 `$1::bigint` 报错（同 getTaskRunById 防御）。
 */
export async function selectTerminalTaskRunIds(db: Queryable, ids: readonly string[]): Promise<Set<string>> {
  const valid = ids.filter((id) => /^\d+$/.test(id))
  if (valid.length === 0) return new Set()
  const res = await db.query<{ id: string }>(
    `SELECT id::text AS "id" FROM task_runs
      WHERE id = ANY($1::bigint[]) AND status IN ('success', 'failed', 'cancelled')`,
    [valid],
  )
  return new Set(res.rows.map((r) => r.id))
}

/**
 * 列任务运行（最近 N，按 created_at DESC + 可选时间窗）。供 -B TaskAggregator 副源投影消费。
 * 命中 idx_task_runs_created_at（created_at DESC 排序 + LIMIT）。
 */
export async function listTaskRuns(db: Queryable, params: ListTaskRunsParams): Promise<TaskRunRow[]> {
  const conds: string[] = []
  const values: unknown[] = []
  if (params.since) {
    values.push(params.since)
    conds.push(`created_at >= $${values.length}::timestamptz`)
  }
  values.push(params.limit)
  const limitIdx = values.length
  const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : ''
  const res = await db.query<TaskRunRow>(
    `SELECT
       id::text AS "id",
       kind AS "kind",
       title AS "title",
       ref AS "ref",
       status AS "status",
       progress AS "progress",
       digest AS "digest",
       error AS "error",
       started_at AS "startedAt",
       finished_at AS "finishedAt",
       created_at AS "createdAt"
     FROM task_runs
     ${where}
     ORDER BY created_at DESC
     LIMIT $${limitIdx}`,
    values,
  )
  return res.rows
}

/**
 * task_runs.status（6 态）→ AdminTaskItem.status（4 态）映射单一真源（ADR-194 D-194-5）。
 * cancelling 折叠为 running（非 finish 终态）；cancelled 折叠为 failed。
 * TaskAggregator 与 AdminSearchService 共用本表，避免两处状态映射漂移。
 */
export const TASK_RUN_STATUS_MAP: Record<TaskRunStatus, AdminTaskItem['status']> = {
  pending: 'pending',
  running: 'running',
  cancelling: 'running',
  success: 'success',
  failed: 'failed',
  cancelled: 'failed',
}

/** 后台全局搜索 task 入参（ADR-200 D-200-4：q + 近期窗口下界 + limit 上限）。 */
export interface SearchTaskRunsParams {
  q: string
  /** 时间窗下界（天）；命中 idx_task_runs_created_at，默认 30 天 */
  sinceDays?: number
  limit: number
}

/**
 * 后台搜索任务运行（ADR-200 D-200-4，task 为**新增 q 能力**）：title ILIKE +
 * **强制 `created_at >= NOW()-interval` 下界**（默认 30 天，命中 idx_task_runs_created_at）+ 硬上限 limit，
 * 禁裸全表 title ILIKE 无界扫历史。
 */
export async function searchTaskRuns(
  db: Queryable,
  params: SearchTaskRunsParams
): Promise<TaskRunRow[]> {
  const sinceDays = params.sinceDays ?? 30
  const res = await db.query<TaskRunRow>(
    `SELECT
       id::text AS "id",
       kind AS "kind",
       title AS "title",
       ref AS "ref",
       status AS "status",
       progress AS "progress",
       digest AS "digest",
       error AS "error",
       started_at AS "startedAt",
       finished_at AS "finishedAt",
       created_at AS "createdAt"
     FROM task_runs
     WHERE created_at >= NOW() - make_interval(days => $1::int)
       AND title ILIKE $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [sinceDays, `%${params.q}%`, params.limit],
  )
  return res.rows
}

/**
 * crawlerTasks.ts — crawler_tasks 表 DB 查询
 * CRAWLER-02: 任务状态跟踪
 */

import type { Pool } from 'pg'

// ── 类型 ──────────────────────────────────────────────────────────

export type CrawlerTaskStatus = 'pending' | 'running' | 'done' | 'failed'

export interface CrawlerTask {
  id: string
  sourceSite: string
  targetUrl: string
  status: CrawlerTaskStatus
  retryCount: number
  result: Record<string, unknown> | null
  scheduledAt: string
  finishedAt: string | null
}

interface DbCrawlerTaskRow {
  id: string
  source_site: string
  target_url: string
  status: CrawlerTaskStatus
  retry_count: number
  result: Record<string, unknown> | null
  scheduled_at: string
  finished_at: string | null
}

function mapTask(row: DbCrawlerTaskRow): CrawlerTask {
  return {
    id: row.id,
    sourceSite: row.source_site,
    targetUrl: row.target_url,
    status: row.status,
    retryCount: row.retry_count,
    result: row.result,
    scheduledAt: row.scheduled_at,
    finishedAt: row.finished_at,
  }
}

// ── 创建任务记录 ──────────────────────────────────────────────────

export async function createTask(
  db: Pool,
  input: {
    sourceSite: string
    targetUrl: string
    scheduledAt?: Date
  }
): Promise<CrawlerTask> {
  const result = await db.query<DbCrawlerTaskRow>(
    `INSERT INTO crawler_tasks (source_site, target_url, status, retry_count, scheduled_at)
     VALUES ($1, $2, 'pending', 0, COALESCE($3, NOW()))
     RETURNING *`,
    [input.sourceSite, input.targetUrl, input.scheduledAt ?? null]
  )
  return mapTask(result.rows[0])
}

// ── 更新任务状态 ──────────────────────────────────────────────────

export async function updateTaskStatus(
  db: Pool,
  id: string,
  status: CrawlerTaskStatus,
  result?: Record<string, unknown>
): Promise<void> {
  const finishedAt = (status === 'done' || status === 'failed') ? new Date() : null
  await db.query(
    `UPDATE crawler_tasks
     SET status = $1,
         result = COALESCE($2::jsonb, result),
         finished_at = $3,
         retry_count = CASE WHEN $1 = 'failed' THEN retry_count + 1 ELSE retry_count END
     WHERE id = $4`,
    [status, result ? JSON.stringify(result) : null, finishedAt, id]
  )
}

// ── 查询任务列表 ──────────────────────────────────────────────────

export async function listTasks(
  db: Pool,
  params: { status?: CrawlerTaskStatus; limit?: number; offset?: number }
): Promise<{ rows: CrawlerTask[]; total: number }> {
  const conditions: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (params.status) {
    conditions.push(`status = $${idx++}`)
    values.push(params.status)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = params.limit ?? 20
  const offset = params.offset ?? 0

  const [dataResult, countResult] = await Promise.all([
    db.query<DbCrawlerTaskRow>(
      `SELECT * FROM crawler_tasks ${where}
       ORDER BY scheduled_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      [...values, limit, offset]
    ),
    db.query<{ total: string }>(
      `SELECT COUNT(*) as total FROM crawler_tasks ${where}`,
      values
    ),
  ])

  return {
    rows: dataResult.rows.map(mapTask),
    total: parseInt(countResult.rows[0].total, 10),
  }
}

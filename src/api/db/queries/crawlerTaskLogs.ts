import type { Pool } from 'pg'

export type CrawlerTaskLogLevel = 'info' | 'warn' | 'error'

export interface CrawlerTaskLog {
  id: string
  taskId: string | null
  sourceSite: string | null
  level: CrawlerTaskLogLevel
  stage: string
  message: string
  details: Record<string, unknown> | null
  createdAt: string
}

interface DbCrawlerTaskLogRow {
  id: string
  task_id: string | null
  source_site: string | null
  level: CrawlerTaskLogLevel
  stage: string
  message: string
  details: Record<string, unknown> | null
  created_at: string
}

function mapLog(row: DbCrawlerTaskLogRow): CrawlerTaskLog {
  return {
    id: row.id,
    taskId: row.task_id,
    sourceSite: row.source_site,
    level: row.level,
    stage: row.stage,
    message: row.message,
    details: row.details,
    createdAt: row.created_at,
  }
}

export async function createCrawlerTaskLog(
  db: Pool,
  input: {
    taskId?: string | null
    sourceSite?: string | null
    level?: CrawlerTaskLogLevel
    stage: string
    message: string
    details?: Record<string, unknown> | null
  },
): Promise<void> {
  await db.query(
    `INSERT INTO crawler_task_logs (task_id, source_site, level, stage, message, details)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      input.taskId ?? null,
      input.sourceSite ?? null,
      input.level ?? 'info',
      input.stage,
      input.message,
      input.details ? JSON.stringify(input.details) : null,
    ],
  )
}

export async function listCrawlerTaskLogs(
  db: Pool,
  params: { taskId: string; limit?: number },
): Promise<CrawlerTaskLog[]> {
  const limit = Math.max(1, Math.min(params.limit ?? 200, 500))
  const result = await db.query<DbCrawlerTaskLogRow>(
    `SELECT *
     FROM crawler_task_logs
     WHERE task_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [params.taskId, limit],
  )
  return result.rows.map(mapLog)
}

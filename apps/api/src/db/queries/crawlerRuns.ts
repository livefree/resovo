import type { Pool } from 'pg'

export type CrawlerRunTriggerType = 'single' | 'batch' | 'all' | 'schedule'
export type CrawlerRunMode = 'incremental' | 'full'
export type CrawlerRunStatus = 'queued' | 'running' | 'paused' | 'success' | 'partial_failed' | 'failed' | 'cancelled'
export type CrawlerRunControlStatus = 'active' | 'pausing' | 'paused' | 'cancelling' | 'cancelled'
/** Migration 032：采集模式（batch=定时批量，keyword=关键词搜索，source-refetch=单视频补源） */
export type CrawlerRunCrawlMode = 'batch' | 'keyword' | 'source-refetch'

export interface CrawlerRun {
  id: string
  triggerType: CrawlerRunTriggerType
  mode: CrawlerRunMode
  status: CrawlerRunStatus
  controlStatus: CrawlerRunControlStatus
  requestedSiteCount: number
  enqueuedSiteCount: number
  skippedSiteCount: number
  timeoutSeconds: number
  createdBy: string | null
  scheduleId: string | null
  summary: Record<string, unknown> | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
  updatedAt: string
  // Migration 032 — 采集模式扩展
  crawlMode: CrawlerRunCrawlMode
  keyword: string | null
  targetVideoId: string | null
}

interface DbRunRow {
  id: string
  trigger_type: CrawlerRunTriggerType
  mode: CrawlerRunMode
  status: CrawlerRunStatus
  control_status: CrawlerRunControlStatus
  requested_site_count: number
  enqueued_site_count: number
  skipped_site_count: number
  timeout_seconds: number
  created_by: string | null
  schedule_id: string | null
  summary: Record<string, unknown> | null
  started_at: string | null
  finished_at: string | null
  created_at: string
  updated_at: string
  // Migration 032
  crawl_mode: CrawlerRunCrawlMode
  keyword: string | null
  target_video_id: string | null
}

function mapRun(row: DbRunRow): CrawlerRun {
  return {
    id: row.id,
    triggerType: row.trigger_type,
    mode: row.mode,
    status: row.status,
    controlStatus: row.control_status,
    requestedSiteCount: row.requested_site_count,
    enqueuedSiteCount: row.enqueued_site_count,
    skippedSiteCount: row.skipped_site_count,
    timeoutSeconds: row.timeout_seconds,
    createdBy: row.created_by,
    scheduleId: row.schedule_id,
    summary: row.summary,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    crawlMode: row.crawl_mode ?? 'batch',
    keyword: row.keyword ?? null,
    targetVideoId: row.target_video_id ?? null,
  }
}

export async function createRun(
  db: Pool,
  input: {
    triggerType: CrawlerRunTriggerType
    mode: CrawlerRunMode
    requestedSiteCount: number
    timeoutSeconds: number
    createdBy?: string | null
    scheduleId?: string | null
    summary?: Record<string, unknown> | null
    // Migration 032
    crawlMode?: CrawlerRunCrawlMode
    keyword?: string | null
    targetVideoId?: string | null
  },
): Promise<CrawlerRun> {
  const result = await db.query<DbRunRow>(
    `INSERT INTO crawler_runs (
       trigger_type, mode, status, control_status,
       requested_site_count, timeout_seconds, created_by, schedule_id, summary,
       crawl_mode, keyword, target_video_id
     ) VALUES ($1, $2, 'queued', 'active', $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
     RETURNING *`,
    [
      input.triggerType,
      input.mode,
      input.requestedSiteCount,
      input.timeoutSeconds,
      input.createdBy ?? null,
      input.scheduleId ?? null,
      input.summary ? JSON.stringify(input.summary) : null,
      input.crawlMode ?? 'batch',
      input.keyword ?? null,
      input.targetVideoId ?? null,
    ],
  )
  return mapRun(result.rows[0])
}

export async function getRunById(db: Pool, runId: string): Promise<CrawlerRun | null> {
  const result = await db.query<DbRunRow>(
    `SELECT * FROM crawler_runs WHERE id = $1`,
    [runId],
  )
  return result.rows[0] ? mapRun(result.rows[0]) : null
}

// sub 2 EXTEND（2026-05-24）：sort 全栈白名单（防 SQL 注入 / 与 distinct-whitelist 同范式）
// camelCase 业务 key → snake_case DB column 映射 / 白名单外字段 throw（sub 2 PATCH R-EP3A-2 反"假装实现"）
const CRAWLER_RUNS_SORT_FIELD_MAP: Record<string, string> = {
  createdAt: 'created_at',
  finishedAt: 'finished_at',
}

// sub 2 PATCH Y-EP3A-1（2026-05-24）：SQL identifier 正则（与 distinct-whitelist DT_DISTINCT_IDENT_REGEX 同范式 / 启动期断言）
// 允许：col 或 table.col 形式（crawlerRuns 用 'created_at' / auditLog 用 'al.created_at'）
const SORT_IDENT_REGEX = /^(?:[a-z_]+\.)?[a-z_]+$/

// 启动期断言所有白名单 SQL ident 合规（不进生产）
for (const [k, v] of Object.entries(CRAWLER_RUNS_SORT_FIELD_MAP)) {
  if (!SORT_IDENT_REGEX.test(v)) {
    throw new Error(`[crawlerRuns] invalid SQL ident "${v}" for sortField=${k}`)
  }
}

export async function listRuns(
  db: Pool,
  params: {
    // ADR-149 EP-5-crawler-runs-PATCH-A：支持多选过滤（单值 / 数组兼容）
    status?: CrawlerRunStatus | readonly CrawlerRunStatus[]
    triggerType?: CrawlerRunTriggerType | readonly CrawlerRunTriggerType[]
    // sub1-EXTEND（2026-05-24）：ADR-150 D-150-1 双轨补齐 — id text / siteCount number / createdAt date
    idPrefix?: string
    siteCountMin?: number
    siteCountMax?: number
    createdAtFrom?: string
    createdAtTo?: string
    // CW1-E-EP step 1b / ADR-152 R-152-3：finishedAfter 谓词下推（与 createdAtFrom 同范式）
    // WHERE finished_at >= $::timestamptz（小时级精度，非 ::date）
    finishedAfter?: string
    // sub 2 EXTEND：sort 字段白名单（createdAt / finishedAt）+ 方向
    sortField?: string
    sortDirection?: 'asc' | 'desc'
    limit?: number
    offset?: number
  } = {},
): Promise<{ rows: CrawlerRun[]; total: number }> {
  const conditions: string[] = []
  const values: unknown[] = []
  let idx = 1
  if (params.status !== undefined) {
    const arr = Array.isArray(params.status) ? params.status : [params.status]
    if (arr.length > 0) {
      conditions.push(`status = ANY($${idx++}::text[])`)
      values.push(arr)
    }
  }
  if (params.triggerType !== undefined) {
    const arr = Array.isArray(params.triggerType) ? params.triggerType : [params.triggerType]
    if (arr.length > 0) {
      conditions.push(`trigger_type = ANY($${idx++}::text[])`)
      values.push(arr)
    }
  }
  // sub1-EXTEND：id::text LIKE 前缀匹配（lowercase 一致化 / pg LIKE 大小写敏感）
  if (params.idPrefix && params.idPrefix.length > 0) {
    conditions.push(`id::text LIKE $${idx++}`)
    values.push(`${params.idPrefix.toLowerCase()}%`)
  }
  // sub1-EXTEND：enqueued_site_count BETWEEN（双侧可选）
  if (params.siteCountMin !== undefined) {
    conditions.push(`enqueued_site_count >= $${idx++}`)
    values.push(params.siteCountMin)
  }
  if (params.siteCountMax !== undefined) {
    conditions.push(`enqueued_site_count <= $${idx++}`)
    values.push(params.siteCountMax)
  }
  // sub1-EXTEND：created_at 范围（to 当作 endOfDay → 加 1 天用 < / 包含 to 当日全天）
  if (params.createdAtFrom) {
    conditions.push(`created_at >= $${idx++}::date`)
    values.push(params.createdAtFrom)
  }
  if (params.createdAtTo) {
    conditions.push(`created_at < ($${idx++}::date + INTERVAL '1 day')`)
    values.push(params.createdAtTo)
  }
  // CW1-E-EP step 1b / ADR-152 R-152-3：finishedAfter 谓词下推
  if (params.finishedAfter) {
    conditions.push(`finished_at >= $${idx++}::timestamptz`)
    values.push(params.finishedAfter)
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = params.limit ?? 20
  const offset = params.offset ?? 0

  // sub 2 EXTEND：sort 字段白名单 lookup + 方向 / 无 sortField → 默认 created_at DESC
  // sub 2 PATCH R-EP3A-2（2026-05-24）：非白名单 sortField throw（反 M-SN-8 "假装实现"模式 /
  //   前端守卫为第一道防御 / 本层 throw 为 fail-fast 安全网 / fastify 500 显式报错）
  let sortCol = 'created_at'
  if (params.sortField) {
    const mapped = CRAWLER_RUNS_SORT_FIELD_MAP[params.sortField]
    if (!mapped) {
      throw new Error(`[crawlerRuns.listRuns] invalid sortField "${params.sortField}" (not in whitelist)`)
    }
    sortCol = mapped
  }
  const sortDir = params.sortDirection === 'asc' ? 'ASC' : 'DESC'

  const [dataResult, countResult] = await Promise.all([
    db.query<DbRunRow>(
      `SELECT * FROM crawler_runs ${where}
       ORDER BY ${sortCol} ${sortDir}, id DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      [...values, limit, offset],
    ),
    db.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM crawler_runs ${where}`,
      values,
    ),
  ])

  return {
    rows: dataResult.rows.map(mapRun),
    total: parseInt(countResult.rows[0]?.total ?? '0', 10) || 0,
  }
}

export async function setRunEnqueueStats(
  db: Pool,
  runId: string,
  stats: { enqueued: number; skipped: number; summary?: Record<string, unknown> },
): Promise<void> {
  await db.query(
    `UPDATE crawler_runs
     SET enqueued_site_count = $1,
         skipped_site_count = $2,
         summary = COALESCE(summary, '{}'::jsonb) || COALESCE($3::jsonb, '{}'::jsonb),
         updated_at = NOW()
     WHERE id = $4`,
    [stats.enqueued, stats.skipped, stats.summary ? JSON.stringify(stats.summary) : null, runId],
  )
}

export async function updateRunControlStatus(
  db: Pool,
  runId: string,
  controlStatus: CrawlerRunControlStatus,
): Promise<void> {
  await db.query(
    `UPDATE crawler_runs
     SET control_status = $1,
         updated_at = NOW()
     WHERE id = $2`,
    [controlStatus, runId],
  )
}

export async function requestCancelAllActiveRuns(db: Pool): Promise<{ count: number; runIds: string[] }> {
  const result = await db.query<{ id: string }>(
    `UPDATE crawler_runs
     SET control_status = 'cancelling',
         updated_at = NOW()
     WHERE status IN ('queued', 'running', 'paused')
       AND control_status NOT IN ('cancelling', 'cancelled')
     RETURNING id`,
  )
  return {
    count: result.rowCount ?? 0,
    runIds: result.rows.map((r) => r.id),
  }
}

export async function listActiveRunIds(db: Pool): Promise<string[]> {
  const result = await db.query<{ id: string }>(
    `SELECT id FROM crawler_runs WHERE status IN ('queued', 'running', 'paused')`,
  )
  return result.rows.map((row) => row.id)
}

// CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A2.1 / ADR-146：返回 newStatus 供调用方判断是否触发 webhook
export interface SyncRunStatusResult {
  status: CrawlerRunStatus
  siteKey: string | null
  summary: Record<string, unknown> | null
}

export async function syncRunStatusFromTasks(db: Pool, runId: string): Promise<SyncRunStatusResult | null> {
  const result = await db.query<{ status: CrawlerRunStatus; site_key: string | null; summary: Record<string, unknown> | null }>(
    `WITH agg AS (
       SELECT
         COUNT(*)::int AS total,
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)::int AS pending,
         SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END)::int AS running,
         SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END)::int AS paused,
         SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END)::int AS done,
         SUM(CASE WHEN status IN ('failed', 'timeout') THEN 1 ELSE 0 END)::int AS failed,
         SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)::int AS cancelled,
         SUM(CASE WHEN (result ->> 'videosUpserted') ~ '^[0-9]+$' THEN (result ->> 'videosUpserted')::int ELSE 0 END)::int AS videos_upserted,
         SUM(CASE WHEN (result ->> 'sourcesUpserted') ~ '^[0-9]+$' THEN (result ->> 'sourcesUpserted')::int ELSE 0 END)::int AS sources_upserted,
         SUM(CASE WHEN (result ->> 'errors') ~ '^[0-9]+$' THEN (result ->> 'errors')::int ELSE 0 END)::int AS errors
       FROM crawler_tasks
       WHERE run_id = $1
     )
     UPDATE crawler_runs r
     SET status = CASE
           -- CHG-SN-9-CW1-CW2-HOTFIX-B Step 1：孤儿 run（0 task）的 control_status
           -- 已经过 cancel/pause 路由置位时，应立即终态化；否则历史 0-task run 的
           -- status 永远保持 'queued'，前端点 [取消] 后看到 toast 成功但 UI 无变化、
           -- 行又出现 [取消] 按钮（W1/W2 用户走读暴露的根因）。
           -- CASE 短路：更精确条件优先，原 a.total = 0 兜底保留（control_status='active'
           -- 时不变）。worker 8 处 sync 调用方零行为变化（worker job 必先创 task，
           -- a.total > 0 永远不命中新 case）。
           WHEN a.total = 0 AND r.control_status IN ('cancelling', 'cancelled') THEN 'cancelled'
           WHEN a.total = 0 AND r.control_status IN ('pausing', 'paused') THEN 'paused'
           WHEN a.total = 0 THEN r.status
           WHEN r.control_status IN ('pausing', 'paused') AND a.running = 0 AND (a.pending > 0 OR a.paused > 0) THEN 'paused'
           WHEN a.running > 0 THEN 'running'
           WHEN a.pending > 0 THEN 'queued'
           WHEN a.cancelled = a.total THEN 'cancelled'
           WHEN a.failed > 0 AND a.done > 0 THEN 'partial_failed'
           WHEN a.failed > 0 AND a.done = 0 THEN 'failed'
           ELSE 'success'
         END,
         control_status = CASE
           WHEN a.total > 0 AND a.cancelled = a.total THEN 'cancelled'
           ELSE r.control_status
         END,
         started_at = CASE
           WHEN r.started_at IS NULL AND (a.running > 0 OR a.paused > 0 OR a.done > 0 OR a.failed > 0 OR a.cancelled > 0) THEN NOW()
           ELSE r.started_at
         END,
         finished_at = CASE
           WHEN a.pending = 0 AND a.running = 0 AND a.paused = 0 THEN NOW()
           ELSE NULL
         END,
         updated_at = NOW(),
         summary = COALESCE(r.summary, '{}'::jsonb) || jsonb_build_object(
           'total', a.total,
           'pending', a.pending,
           'running', a.running,
           'paused', a.paused,
           'done', a.done,
           'failed', a.failed,
           'cancelled', a.cancelled,
           'videosUpserted', a.videos_upserted,
           'sourcesUpserted', a.sources_upserted,
           'errors', a.errors
         )
     FROM agg a
     WHERE r.id = $1
     RETURNING
       r.status,
       (SELECT source_site FROM crawler_tasks WHERE run_id = r.id ORDER BY scheduled_at ASC LIMIT 1) AS site_key,
       r.summary`,
    [runId],
  )
  const row = result.rows[0]
  if (!row) return null
  return { status: row.status, siteKey: row.site_key, summary: row.summary }
}

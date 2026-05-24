/**
 * distinct-whitelist.ts — ADR-150 阶段 3 / EP-2 Step 3 / D-150-3 v1 通用 distinct 端点白名单
 *
 * 6 表初始白名单（高使用频率 admin 表 / 含已知有索引列）。
 * 新表 / 新列追加必须走 ADR-150 AMENDMENT（不可在本文件直接 PR）。
 *
 * SQL 注入三重防御之一（drizzle column reference 替代）：
 *   - 本文件白名单值是**硬编码 const SQL 表达式字符串**（不来自外部输入）
 *   - identifier 二次校验 `/^[a-z_]+$/`（额外防御层）
 *   - Service 层 SQL 模板用 `${tableName}.${columnName}` 插值这些 const 值（参数 q + limit 走 $param）
 */

/**
 * 表名白名单（zod enum 真源 / 配合 _datatable.ts route schema）。
 * 注意：'sources' 是逻辑名（实际查 video_sources 表 / DT_DISTINCT_FROM 映射）。
 */
export const DT_DISTINCT_TABLES = [
  'crawler_runs',
  'admin_audit_log',
  'users',
  'user_submissions',
  'sources',
  'videos',
] as const

export type DtDistinctTable = (typeof DT_DISTINCT_TABLES)[number]

/**
 * 列白名单 — 三层映射：tableName → columnName → SQL 表达式（含表名前缀）。
 * 缺省 SELECT FROM 用 tableName，可由 DT_DISTINCT_FROM 覆盖（如 sources → video_sources）。
 */
export const DT_DISTINCT_COLUMN_SQL: Record<DtDistinctTable, Record<string, string>> = {
  crawler_runs: {
    status: 'crawler_runs.status',
    trigger_type: 'crawler_runs.trigger_type',
    crawl_mode: 'crawler_runs.crawl_mode',
  },
  admin_audit_log: {
    action_type: 'admin_audit_log.action_type',
    target_kind: 'admin_audit_log.target_kind',
  },
  users: {
    role: 'users.role',
  },
  user_submissions: {
    status: 'user_submissions.status',
    kind: 'user_submissions.kind',
  },
  sources: {
    site_key: 'video_sources.source_site_key',
    probe_status: 'video_sources.probe_status',
    render_status: 'video_sources.render_status',
  },
  videos: {
    type: 'videos.type',
    source_check_status: 'videos.source_check_status',
  },
}

/**
 * 表名 → 实际查询表（FROM 子句）。
 * 缺省 = 表名本身；sources 逻辑名映射到 video_sources 实表。
 */
export const DT_DISTINCT_FROM: Partial<Record<DtDistinctTable, string>> = {
  sources: 'video_sources',
}

/**
 * 派生白名单：tableName → columnName[]（用于 route 层快速 lookup）。
 */
export const DT_DISTINCT_WHITELIST: Record<DtDistinctTable, readonly string[]> = Object.fromEntries(
  (Object.entries(DT_DISTINCT_COLUMN_SQL) as [DtDistinctTable, Record<string, string>][]).map(
    ([t, cols]) => [t, Object.keys(cols)] as const,
  ),
) as unknown as Record<DtDistinctTable, readonly string[]>

/**
 * SQL identifier 二次校验正则（额外防御层）。
 * 白名单 const 值理论上 100% 安全（硬编码 / 不来自输入），但本正则作为编译期 + 运行时双保险。
 * 允许：小写字母 + 下划线 + 单个 . 分隔（表名.列名）。
 */
export const DT_DISTINCT_IDENT_REGEX = /^[a-z_]+\.[a-z_]+$/

/**
 * 编译期断言所有白名单值符合 identifier 正则（启动时如有错误立即抛错 / 不进生产）。
 */
for (const [table, cols] of Object.entries(DT_DISTINCT_COLUMN_SQL) as [DtDistinctTable, Record<string, string>][]) {
  for (const [col, sql] of Object.entries(cols)) {
    if (!DT_DISTINCT_IDENT_REGEX.test(sql)) {
      throw new Error(`[distinct-whitelist] invalid SQL ident "${sql}" for ${table}.${col}`)
    }
  }
}

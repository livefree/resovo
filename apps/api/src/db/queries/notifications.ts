/**
 * notifications.ts — 通知独立存储 SQL（ADR-192 / NTLG-P1-a-A）
 *
 * 通知与审计解耦双写后的独立真源读写（脱离 admin_audit_log 派生）。
 * SQL 集中本文件（db-rules：SQL 落 queries 层，NotificationService 仅编排，不直写）。
 *
 * 已读混合模型（D-192-3）：
 *   - broadcast/role → notification_read_cursor 高水位线（per-user 一行）
 *   - 定向（scope='user:<id>'）→ notification_reads 逐行（P1 仅建表预留）
 * 未读计数口径见 countUnreadNotifications（D-192-5，cursor + (scope,created_at) 索引支撑，不补 anti-join D-192-4）。
 *
 * 字段 camelCase 别名（PG 双引号保留大小写，教训自 CHG-SN-4-09d）；bigserial id → string（避免 JS 大数精度）。
 */

import type { Pool } from 'pg'

/** 最小查询接口（Pool / PoolClient 皆满足；支持事务内调用与测试 BEGIN/ROLLBACK 零污染） */
export type Queryable = Pick<Pool, 'query'>

/** 通知 level 三值（对齐 AdminNotificationItem.level + DB CHECK，D-192-6） */
export type NotificationLevel = 'info' | 'warn' | 'danger'

/** emit/insert 入参（字段一一对应 notifications schema 列；source_kind 必填 ADR-193 D-193-2） */
export interface InsertNotificationInput {
  type: string
  level: NotificationLevel
  title: string
  sourceKind: string
  body?: string | null
  payload?: unknown
  href?: string | null
  sourceRef?: string | null
  /** 默认由 service 落 'broadcast'；DB 列 NOT NULL */
  scope: string
  dedupKey?: string | null
  /** ISO 8601；未提供则无 TTL */
  expiresAt?: string | null
}

/** 通知行（list 返回；read 状态由 service 据 cursor 计算，不在行内） */
export interface NotificationRow {
  id: string
  type: string
  level: NotificationLevel
  title: string
  body: string | null
  payload: Record<string, unknown> | null
  href: string | null
  sourceKind: string
  sourceRef: string | null
  scope: string
  createdAt: string
  expiresAt: string | null
}

/**
 * list / count 共享过滤参数（buildNotificationFilter 同口径，避免谓词漂移）。
 * 消息中心检索/过滤字段（ADR-196 D-196-4）为加性——drawer 省略=旧行为。
 */
export interface CountNotificationsParams {
  /** 命中的 scope 集合（broadcast + role:* + user:<当前>），WHERE scope = ANY */
  scopes: string[]
  /** ISO 8601 时间下界（含 created_at >=）；省略则不限时间窗 */
  since?: string
  /** ISO 8601 时间上界（含 created_at <=）；与 since 组日期范围（ADR-196 D-196-4） */
  until?: string
  /** 是否包含已过期通知（默认 false，过滤 expires_at <= NOW()） */
  includeExpired?: boolean
  /**
   * 限定 source_kind 集合（WHERE source_kind = ANY）；省略则不限。
   * NTLG-P1-c-C：drawer general lane 限 ['admin_action'] —— crawler 完成仍经 background-events
   * finished lane 进抽屉（ADR-155），list 读全表会与之重复；admin_action allowlist 保新 list ≡ 旧 audit 派生 list。
   */
  sourceKinds?: string[]
  /** 标题 ILIKE 检索（% / _ 转义防通配注入，ADR-196 D-196-4）；省略则不检索 */
  q?: string
  /** level 过滤（WHERE level = ANY）；空/省略则不限 */
  levels?: NotificationLevel[]
  /** type 过滤（WHERE type = ANY）；空/省略则不限 */
  types?: string[]
  /** 已读态过滤（broadcast/role 按 cursorReadAt 比较：unread=created_at>基线 / read=<=）；需 cursorReadAt 才生效 */
  readState?: 'read' | 'unread'
  /** readState 比较基线（getEffectiveReadCursor）；readState 设而此缺则跳过该过滤 */
  cursorReadAt?: string | null
  /**
   * 抽屉 dismiss 排除（ADR-197 D-197-4）：存在 → 拼 NOT EXISTS notification_dismissals
   * （item_key = notifications.id::text，general 项 item_key=行 id 纯数字串）排除该 user 已软移除项；
   * 缺省 → 不排除（消息中心 history 模式不传，保留全量）。仅 general SQL 侧排除；派生项（audit/task）
   * 由 Service 内存 anti-set 过滤（D-197-4，禁 SQL 拼 item_key anti-join）。
   */
  excludeDismissedForUser?: string
}

export interface ListNotificationsParams extends CountNotificationsParams {
  limit: number
  /** keyset 分页游标（上一页末行 created_at+id，ADR-196 D-196-4）；省略=首页 */
  cursor?: { createdAt: string; id: string }
}

export interface CountUnreadParams {
  userId: string
  /** broadcast + role:* 等「高水位线」适用 scope（不含定向 user:<id>） */
  broadcastScopes: string[]
  /** 定向 scope（'user:<userId>'）；逐行 reads 判定 */
  targetedScope: string
}

/**
 * 插入通知；dedup_key 命中 uq_notifications_dedup_key 时幂等不新建（ON CONFLICT DO NOTHING，D-192-2）。
 * 返回新建/既存行 id（DO NOTHING 命中冲突时 RETURNING 无行 → 反查既存 id 保幂等语义）。
 */
export async function insertNotification(db: Queryable, input: InsertNotificationInput): Promise<{ id: string }> {
  const res = await db.query<{ id: string }>(
    `INSERT INTO notifications
       (type, level, title, body, payload, href, source_kind, source_ref, dedup_key, scope, expires_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11::timestamptz)
     ON CONFLICT (dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING
     RETURNING id::text AS "id"`,
    [
      input.type,
      input.level,
      input.title,
      input.body ?? null,
      input.payload !== undefined && input.payload !== null ? JSON.stringify(input.payload) : null,
      input.href ?? null,
      input.sourceKind,
      input.sourceRef ?? null,
      input.dedupKey ?? null,
      input.scope,
      input.expiresAt ?? null,
    ],
  )
  if (res.rows[0]) return res.rows[0]
  // ON CONFLICT DO NOTHING 命中：反查既存行 id（幂等返回，dedupKey 必非空才会走到这里）
  const existing = await db.query<{ id: string }>(
    `SELECT id::text AS "id" FROM notifications WHERE dedup_key = $1 LIMIT 1`,
    [input.dedupKey],
  )
  return { id: existing.rows[0]?.id ?? '' }
}

/**
 * 共享 WHERE 构造（listNotifications / countNotifications 同口径，避免谓词漂移）。
 * 返回 { clause, values }；调用方追加 LIMIT 等尾参时基于 values.length 续编号。
 */
function buildNotificationFilter(params: CountNotificationsParams): { clause: string; values: unknown[] } {
  const conds: string[] = ['scope = ANY($1::text[])']
  const values: unknown[] = [params.scopes]
  if (params.since) {
    values.push(params.since)
    conds.push(`created_at >= $${values.length}::timestamptz`)
  }
  if (params.until) {
    values.push(params.until)
    conds.push(`created_at <= $${values.length}::timestamptz`)
  }
  if (params.sourceKinds) {
    values.push(params.sourceKinds)
    conds.push(`source_kind = ANY($${values.length}::text[])`)
  }
  if (params.levels && params.levels.length > 0) {
    values.push(params.levels)
    conds.push(`level = ANY($${values.length}::text[])`)
  }
  if (params.types && params.types.length > 0) {
    values.push(params.types)
    conds.push(`type = ANY($${values.length}::text[])`)
  }
  if (params.q) {
    // ILIKE 通配（% _ \）转义防用户输入被当通配符；配合默认 ESCAPE '\'
    values.push(`%${params.q.replace(/[\\%_]/g, '\\$&')}%`)
    conds.push(`title ILIKE $${values.length}`)
  }
  if (params.readState && params.cursorReadAt) {
    values.push(params.cursorReadAt)
    conds.push(
      params.readState === 'unread'
        ? `created_at > $${values.length}::timestamptz`
        : `created_at <= $${values.length}::timestamptz`,
    )
  }
  if (params.excludeDismissedForUser) {
    // ADR-197 D-197-4：drawer 模式排除该 user 已 dismiss 的 general 项（item_key=行 id）；
    // history 模式不传此入参 → 消息中心保留全量。派生项 dismiss 由 Service 内存过滤（非此处）。
    values.push(params.excludeDismissedForUser)
    conds.push(
      `NOT EXISTS (SELECT 1 FROM notification_dismissals d ` +
        `WHERE d.user_id = $${values.length}::uuid AND d.item_key = notifications.id::text)`,
    )
  }
  if (!params.includeExpired) {
    conds.push('(expires_at IS NULL OR expires_at > NOW())')
  }
  return { clause: conds.join(' AND '), values }
}

/**
 * 列通知（scope + 可选过滤 + 可选 keyset 游标 + limit，按 created_at DESC, id DESC）。
 * 命中 idx_notifications_scope_created_at（scope 等值 + created_at 排序，ADR-196 黄线 2；id 仅同 created_at 平局稳定键）。
 * read 状态不在行内计算——由 service 据 cursor（broadcast/role）/ reads（定向）判定（readState 过滤为 SQL 侧 created_at 比较，非行内 read）。
 */
export async function listNotifications(db: Queryable, params: ListNotificationsParams): Promise<NotificationRow[]> {
  const { clause, values } = buildNotificationFilter(params)
  let where = clause
  if (params.cursor) {
    // keyset：DESC 排序下取「严格小于游标」的行（created_at 更早，或同 created_at 而 id 更小），稳定无重无漏
    values.push(params.cursor.createdAt)
    const cIdx = values.length
    values.push(params.cursor.id)
    const iIdx = values.length
    where += ` AND (created_at < $${cIdx}::timestamptz OR (created_at = $${cIdx}::timestamptz AND id < $${iIdx}::bigint))`
  }
  values.push(params.limit)
  const limitIdx = values.length
  const res = await db.query<NotificationRow>(
    `SELECT
       id::text AS "id",
       type AS "type",
       level AS "level",
       title AS "title",
       body AS "body",
       payload AS "payload",
       href AS "href",
       source_kind AS "sourceKind",
       source_ref AS "sourceRef",
       scope AS "scope",
       created_at AS "createdAt",
       expires_at AS "expiresAt"
     FROM notifications
     WHERE ${where}
     ORDER BY created_at DESC, id DESC
     LIMIT $${limitIdx}`,
    values,
  )
  return res.rows
}

/**
 * 计数匹配通知（与 listNotifications 同 WHERE 口径，无 LIMIT；供 list meta.total 保真）。
 * 命中 idx_notifications_scope_created_at。
 */
export async function countNotifications(db: Queryable, params: CountNotificationsParams): Promise<number> {
  const { clause, values } = buildNotificationFilter(params)
  const res = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS "count" FROM notifications WHERE ${clause}`,
    values,
  )
  return Number.parseInt(res.rows[0]?.count ?? '0', 10) || 0
}

/**
 * 未读计数（D-192-5 混合模型口径）：
 *   broadcast/role 未读 = scope ∈ broadcastScopes 且 created_at > COALESCE(cursor.read_at, users.created_at)
 *   定向未读        = scope = targetedScope
 *   两者皆排除：已过期（expires_at <= NOW()）+ 已逐行读过（NOT EXISTS notification_reads）
 * cursor 缺省（新用户无 cursor 行）→ COALESCE 回落 users.created_at（加入时间，不回溯历史，D-192-3）。
 * 仅命中 idx_notifications_scope_created_at + reads PK 点查；不补 anti-join（D-192-4）。
 */
export async function countUnreadNotifications(db: Queryable, params: CountUnreadParams): Promise<number> {
  const res = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS "count"
       FROM notifications n
       LEFT JOIN notification_read_cursor c ON c.user_id = $1
       LEFT JOIN users u ON u.id = $1
      WHERE (n.expires_at IS NULL OR n.expires_at > NOW())
        AND NOT EXISTS (
              SELECT 1 FROM notification_reads r
               WHERE r.notification_id = n.id AND r.user_id = $1
            )
        AND (
              (n.scope = ANY($2::text[]) AND n.created_at > COALESCE(c.read_at, u.created_at))
              OR n.scope = $3
            )`,
    [params.userId, params.broadcastScopes, params.targetedScope],
  )
  return Number.parseInt(res.rows[0]?.count ?? '0', 10) || 0
}

/**
 * 取 user 的「有效已读高水位线」= COALESCE(cursor.read_at, users.created_at)（与 countUnreadNotifications D-192-5 同口径）。
 * NTLG-P1-c-C list 读路径用：客户端据此基线对 general + background 合并项统一计算 read（替 localStorage 单一已读源）。
 * cursor 缺省回落加入时间（新管理员不回溯历史，D-192-3）；返 ISO 8601 字符串（PG timestamptz→Date 规整为 ISO）。
 * user 不存在 → null（防御；本查询仅由已鉴权 admin 路径调用，users 行恒存在）。
 */
export async function getEffectiveReadCursor(db: Queryable, userId: string): Promise<string | null> {
  const res = await db.query<{ readAt: Date | string | null }>(
    `SELECT COALESCE(c.read_at, u.created_at) AS "readAt"
       FROM users u
       LEFT JOIN notification_read_cursor c ON c.user_id = u.id
      WHERE u.id = $1`,
    [userId],
  )
  const raw = res.rows[0]?.readAt
  return raw != null ? new Date(raw).toISOString() : null
}

/** 取 user 的已读高水位线（无 cursor 行返 null，service 据 users.created_at 兜底） */
export async function getReadCursor(db: Queryable, userId: string): Promise<{ readAt: string } | null> {
  const res = await db.query<{ readAt: string }>(
    `SELECT read_at AS "readAt" FROM notification_read_cursor WHERE user_id = $1`,
    [userId],
  )
  return res.rows[0] ?? null
}

/**
 * upsert 已读高水位线（markAllRead：broadcast/role 仅写一行，避免「用户×N 条」写放大 D-192-3）。
 * readAt 由 service 决定（markAllRead=NOW() / 新用户初始化=加入时间）。
 */
export async function upsertReadCursor(db: Queryable, userId: string, readAt: string): Promise<void> {
  await db.query(
    `INSERT INTO notification_read_cursor (user_id, read_at)
     VALUES ($1, $2::timestamptz)
     ON CONFLICT (user_id) DO UPDATE SET read_at = EXCLUDED.read_at`,
    [userId, readAt],
  )
}

/**
 * 物理删除已过期通知（ADR-195 D-195-4 / NTLG-P2-d-A），返回删除行数。
 * 口径 `expires_at IS NOT NULL AND expires_at <= $1`——`expires_at IS NULL`=永不过期永不删
 *   （对齐 D-195-1 + ADR-192 D-192-5 未读过滤口径，是其精确逻辑补集）。
 * `notification_reads` 经 FK ON DELETE CASCADE（migration 100）自动级联清理；
 *   `notification_read_cursor`（per-user 高水位、不引用具体 notification）不受影响。
 * 镜像 ADR-188 `deleteFetchLogBefore` 范式（物理 DELETE 否决软隐藏 D-195-4：通知非合规真源，audit_log 才是）。
 */
export async function deleteExpiredNotifications(db: Queryable, nowIso: string): Promise<number> {
  const result = await db.query(
    `DELETE FROM notifications WHERE expires_at IS NOT NULL AND expires_at <= $1::timestamptz`,
    [nowIso],
  )
  return result.rowCount ?? 0
}

// ── dismiss 软移除（ADR-197 / NTLG-NTF-DISMISS-A）────────────────────────────

/**
 * 批量插入 dismiss 记录（幂等 ON CONFLICT DO NOTHING，D-197-2）。
 * item_keys = 前端抽屉项最终 id 原值（general 纯数字串 / 'bg-audit:<id>' / 'taskrun-<id>' 等，跨源 TEXT）。
 * 白名单守卫（可 dismiss 范围 D-197-2）归 Service 层；本 query 仅落库（单条 dismiss 传 [itemKey] 复用）。
 * 返回实际新插入行数（ON CONFLICT 命中冲突的既存项不计入 rowCount）；空数组 no-op 返 0。
 */
export async function insertDismissals(db: Queryable, userId: string, itemKeys: readonly string[]): Promise<number> {
  if (itemKeys.length === 0) return 0
  const res = await db.query(
    `INSERT INTO notification_dismissals (user_id, item_key)
     SELECT $1::uuid, k FROM unnest($2::text[]) AS k
     ON CONFLICT (user_id, item_key) DO NOTHING`,
    [userId, itemKeys as string[]],
  )
  return res.rowCount ?? 0
}

/**
 * 取该 user 全部 dismiss 的 item_key 集合（D-197-4）。
 * 供 Service 内存 anti-set 过滤派生项（finished audit 'bg-audit:<id>' / 终态 task 'taskrun-<id>'）——
 * 派生项无 notifications 行不能走 SQL NOT EXISTS，Service 取本 Set 在 map 后 .filter 比对。
 * 命中 PK 前缀（user_id 等值）。
 */
export async function selectDismissedKeys(db: Queryable, userId: string): Promise<Set<string>> {
  const res = await db.query<{ itemKey: string }>(
    `SELECT item_key AS "itemKey" FROM notification_dismissals WHERE user_id = $1`,
    [userId],
  )
  return new Set(res.rows.map((r) => r.itemKey))
}

/**
 * 清理陈旧 dismiss 记录（D-197-6，ADR-195 purge worker 接入归 -B）。
 * 删 dismissed_at < cutoff——cutoff 由调用方按 age N≥90d（对齐 ADMIN_ACTION_TTL_DAYS）计算，
 * 保证被 dismiss 的真源项早已 TTL purge 后才清其 dismissal（避免项复现；派生项 finished window ≤24h ≪ N 安全）。
 * notification_dismissals 用 TEXT item_key 跨源无 FK、不随 notifications purge CASCADE → 本兜底独立清理。
 * 返回删除行数。
 */
export async function deleteStaleDismissals(db: Queryable, cutoffIso: string): Promise<number> {
  const result = await db.query(
    `DELETE FROM notification_dismissals WHERE dismissed_at < $1::timestamptz`,
    [cutoffIso],
  )
  return result.rowCount ?? 0
}

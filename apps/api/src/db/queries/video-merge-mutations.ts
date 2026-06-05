/**
 * video-merge-mutations.ts — video 合并/拆分/撤销 DB 查询（ADR-105 / CHG-SN-5-10）
 *
 * 所有写操作均通过 PoolClient（事务内）执行；只读辅助查询用 Pool。
 */

import type { Pool, PoolClient } from 'pg'

// ── 原始 DB 行类型 ────────────────────────────────────────────────

export interface RawVideoRow {
  readonly id: string
  readonly short_id: string
  readonly slug: string | null
  readonly title: string
  readonly title_en: string | null
  readonly description: string | null
  readonly cover_url: string | null
  readonly type: string
  readonly category: string | null
  readonly rating: number | null
  readonly year: number | null
  readonly country: string | null
  readonly episode_count: number
  readonly status: string
  readonly director: string[]
  readonly cast: string[]
  readonly writers: string[]
  readonly is_published: boolean
  // ADR-105 AMENDMENT 2026-06-04 D-105-11（CHG-VIR-13-D1）：状态 2 列——
  // merge snapshot 写 targetStatusBefore 的还原依据 + BEGIN 前 (current, desired) 矩阵输入
  readonly review_status: string
  readonly visibility_status: string
  readonly title_normalized: string | null
  readonly catalog_id: string | null
  readonly deleted_at: string | null
  readonly created_at: string
  readonly updated_at: string
}

export interface RawSourceRow {
  readonly id: string
  readonly video_id: string
  readonly episode_number: number | null
  readonly source_url: string
  readonly source_name: string
  readonly source_site_key: string | null
  readonly quality: string | null
  readonly type: string
  readonly is_active: boolean
  readonly deleted_at: string | null
  readonly created_at: string
}

export interface RawAuditRow {
  readonly id: string
  readonly action: 'merge' | 'split'
  readonly source_video_ids: string[]
  readonly target_video_ids: string[]
  readonly snapshot_jsonb: Record<string, unknown>
  readonly performed_by: string
  readonly reason: string | null
  readonly performed_at: string
  readonly reverted_at: string | null
  readonly reverted_by: string | null
  readonly reverted_reason: string | null
}

// ── 只读辅助查询 ──────────────────────────────────────────────────

/** 批量拉取 video 完整行（含软删除标记，用于状态校验）
 *  CHG-SN-5-13-PATCH-2: migration 029 删 videos 15 列迁至 media_catalog；
 *  JOIN media_catalog 取 mc.* 兼容既有 RawVideoRow 消费方（merge snapshot_jsonb）。
 */
export async function fetchVideosByIds(
  db: Pool | PoolClient,
  ids: string[],
): Promise<RawVideoRow[]> {
  if (ids.length === 0) return []
  const result = await db.query<RawVideoRow>(
    `SELECT v.id, v.short_id, v.slug, v.title,
            mc.title_en, mc.description, mc.cover_url,
            v.type, v.source_category AS category, mc.rating, mc.year, mc.country,
            v.episode_count, mc.status,
            mc.director, mc."cast", mc.writers, v.is_published,
            v.review_status, v.visibility_status,
            mc.title_normalized,
            v.catalog_id, v.deleted_at, v.created_at::text, v.updated_at::text
       FROM videos v
       JOIN media_catalog mc ON mc.id = v.catalog_id
      WHERE v.id = ANY($1::uuid[])`,
    [ids],
  )
  return result.rows
}

/** 拉取指定 video 的全部活跃 sources（未软删除） */
export async function fetchSourcesByVideoId(
  db: Pool | PoolClient,
  videoId: string,
): Promise<RawSourceRow[]> {
  const result = await db.query<RawSourceRow>(
    `SELECT id, video_id, episode_number, source_url, source_name,
            source_site_key, quality, type, is_active,
            deleted_at, created_at::text
       FROM video_sources
      WHERE video_id = $1
        AND deleted_at IS NULL`,
    [videoId],
  )
  return result.rows
}

/** 拉取指定 video 列表的全部活跃 sources（未软删除） */
export async function fetchSourcesByVideoIds(
  db: Pool | PoolClient,
  videoIds: string[],
): Promise<RawSourceRow[]> {
  if (videoIds.length === 0) return []
  const result = await db.query<RawSourceRow>(
    `SELECT id, video_id, episode_number, source_url, source_name,
            source_site_key, quality, type, is_active,
            deleted_at, created_at::text
       FROM video_sources
      WHERE video_id = ANY($1::uuid[])
        AND deleted_at IS NULL`,
    [videoIds],
  )
  return result.rows
}

// ── 自动去重取并集（ADR-105 AMENDMENT 2026-06-05 D-105-13~16 / CHG-MERGE-DEDUP-EP）────
// 原 detectMergeConflicts / detectSplitConflictsForTarget（R-105-1 方案 A 预检 409）已废止删除。

/**
 * merge 事务内确定性去重（D-105-13）：对合并后集合（sources + target）中重复的
 * (episode_number, source_url) 组（IS NOT DISTINCT 口径对齐唯一键 NULLS NOT DISTINCT /
 * Y-105-D4）软删非保留行。
 *
 * 保留优先级（R-105-D2 确定性）：target 行恒胜 → sourceVideoIds 数组序首胜 → id tiebreak。
 * target 行恒不被软删（双保险 WHERE video_id <> target；ORDER 已保证其 rn=1）。
 *
 * @returns 被软删的 source 行 ids（snapshot.dedupedSourceIds / unmerge 还原依据 D-105-14）
 */
export async function dedupeSourcesForMerge(
  client: PoolClient,
  sourceVideoIds: string[],
  targetVideoId: string,
): Promise<string[]> {
  const result = await client.query<{ id: string }>(
    `WITH ranked AS (
       SELECT s.id, s.video_id,
              ROW_NUMBER() OVER (
                PARTITION BY s.episode_number, s.source_url
                ORDER BY CASE WHEN s.video_id = $2 THEN 0 ELSE 1 END,
                         array_position($1::uuid[], s.video_id),
                         s.id
              ) AS rn
         FROM video_sources s
        WHERE s.video_id = ANY($1::uuid[] || $2::uuid)
          AND s.deleted_at IS NULL
     )
     UPDATE video_sources vs
        SET deleted_at = NOW(), updated_at = NOW()
       FROM ranked r
      WHERE vs.id = r.id AND r.rn > 1 AND r.video_id <> $2
     RETURNING vs.id`,
    [sourceVideoIds, targetVideoId],
  )
  return result.rows.map((r) => r.id)
}

/**
 * 残余冲突防御预检（Y-105-D3）：去重后、转移前，检测幸存 source 活行与 target
 * **全部行（含软删）**的 (episode_number, source_url) 冲突——唯一键不含 deleted_at，
 * target 历史软删行仍占槽位，命中则转移必撞键 → Service 层 409 整体 ROLLBACK（零物理删除）。
 */
export async function detectResidualTargetConflicts(
  client: PoolClient,
  sourceVideoIds: string[],
  targetVideoId: string,
): Promise<number> {
  const result = await client.query<{ conflict_count: string }>(
    `SELECT COUNT(*)::text AS conflict_count
       FROM video_sources s
       JOIN video_sources t
         ON s.episode_number IS NOT DISTINCT FROM t.episode_number
        AND s.source_url = t.source_url
      WHERE s.video_id = ANY($1::uuid[])
        AND s.deleted_at IS NULL
        AND t.video_id = $2`,
    [sourceVideoIds, targetVideoId],
  )
  return parseInt(result.rows[0]?.conflict_count ?? '0', 10)
}

/**
 * split 拆到已有 video 的转入行去重（D-105-15，对称 D-105-13）：转入组与已有 target
 * **活行**重复的转入行软删（target 恒胜 / D-105-5 不动已有 target）。
 * Y-105-D4：必须在事务内 assignSourcesToVideo **之前**调用。
 *
 * @returns 被软删的转入行 ids
 */
export async function dedupeSourcesForSplitTarget(
  client: PoolClient,
  sourceIds: string[],
  targetVideoId: string,
): Promise<string[]> {
  if (sourceIds.length === 0) return []
  const result = await client.query<{ id: string }>(
    `UPDATE video_sources vs
        SET deleted_at = NOW(), updated_at = NOW()
      WHERE vs.id = ANY($1::uuid[])
        AND vs.deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM video_sources t
           WHERE t.video_id = $2
             AND t.deleted_at IS NULL
             AND t.episode_number IS NOT DISTINCT FROM vs.episode_number
             AND t.source_url = vs.source_url
        )
     RETURNING vs.id`,
    [sourceIds, targetVideoId],
  )
  return result.rows.map((r) => r.id)
}

/**
 * split 转入残余冲突防御预检（Y-105-D3 split 版）：去重后幸存转入行 vs target
 * **全部行（含软删）**。
 */
export async function detectResidualSplitTargetConflicts(
  client: PoolClient,
  sourceIds: string[],
  targetVideoId: string,
): Promise<number> {
  if (sourceIds.length === 0) return 0
  const result = await client.query<{ conflict_count: string }>(
    `SELECT COUNT(*)::text AS conflict_count
       FROM video_sources s
       JOIN video_sources t
         ON s.episode_number IS NOT DISTINCT FROM t.episode_number
        AND s.source_url = t.source_url
      WHERE s.id = ANY($1::uuid[])
        AND s.deleted_at IS NULL
        AND t.video_id = $2`,
    [sourceIds, targetVideoId],
  )
  return parseInt(result.rows[0]?.conflict_count ?? '0', 10)
}

/**
 * unmerge 还原被去重软删的源（D-105-14）：恢复 deleted_at = NULL。
 * 调用时序：reassignSourcesToOriginal **之后**（先归还原 video 再复活，避免瞬时撞 target 槽位）。
 */
export async function restoreSourcesByIds(
  client: PoolClient,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return
  await client.query(
    `UPDATE video_sources
        SET deleted_at = NULL, updated_at = NOW()
      WHERE id = ANY($1::uuid[])`,
    [ids],
  )
}

/**
 * 事务内补写 snapshot_jsonb.dedupedSourceIds（D-105-14；零 DDL 自由字段，
 * 沿 created_target_video_ids / updateAuditTargetIds jsonb merge 范式）。
 */
export async function setAuditDedupedSourceIds(
  client: PoolClient,
  auditId: string,
  dedupedSourceIds: string[],
): Promise<void> {
  await client.query(
    `UPDATE video_merge_audit
        SET snapshot_jsonb = snapshot_jsonb
          || jsonb_build_object('dedupedSourceIds', $2::jsonb)
      WHERE id = $1`,
    [auditId, JSON.stringify(dedupedSourceIds)],
  )
}

/** 按 auditId 拉取 video_merge_audit 行 */
export async function fetchAuditById(
  db: Pool | PoolClient,
  auditId: string,
): Promise<RawAuditRow | null> {
  const result = await db.query<RawAuditRow>(
    `SELECT id, action,
            source_video_ids, target_video_ids,
            snapshot_jsonb, performed_by, reason,
            performed_at::text, reverted_at::text,
            reverted_by, reverted_reason
       FROM video_merge_audit
      WHERE id = $1`,
    [auditId],
  )
  return result.rows[0] ?? null
}

// ── 事务内写操作（PoolClient 参数，调用方负责 BEGIN/COMMIT/ROLLBACK）────

/** 插入 video_merge_audit 行，返回生成的 id */
export async function insertMergeAudit(
  client: PoolClient,
  params: {
    action: 'merge' | 'split'
    sourceVideoIds: string[]
    targetVideoIds: string[]
    snapshotJsonb: Record<string, unknown>
    performedBy: string
    reason: string | null
  },
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO video_merge_audit
       (action, source_video_ids, target_video_ids, snapshot_jsonb, performed_by, reason)
     VALUES ($1, $2::uuid[], $3::uuid[], $4, $5, $6)
     RETURNING id`,
    [
      params.action,
      params.sourceVideoIds,
      params.targetVideoIds,
      JSON.stringify(params.snapshotJsonb),
      params.performedBy,
      params.reason ?? null,
    ],
  )
  return result.rows[0]!.id
}

/** 将 sourceVideoIds 的全部活跃 sources 转移到 targetVideoId */
export async function transferSourcesToTarget(
  client: PoolClient,
  sourceVideoIds: string[],
  targetVideoId: string,
): Promise<void> {
  await client.query(
    `UPDATE video_sources
        SET video_id = $1, updated_at = NOW()
      WHERE video_id = ANY($2::uuid[])
        AND deleted_at IS NULL`,
    [targetVideoId, sourceVideoIds],
  )
}

/** 软删除 source videos（合并完成后） */
export async function softDeleteVideos(
  client: PoolClient,
  videoIds: string[],
): Promise<void> {
  await client.query(
    `UPDATE videos
        SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = ANY($1::uuid[])`,
    [videoIds],
  )
}

/** 还原软删除的 videos（unmerge） */
export async function restoreVideos(
  client: PoolClient,
  videoIds: string[],
): Promise<void> {
  await client.query(
    `UPDATE videos
        SET deleted_at = NULL, updated_at = NOW()
      WHERE id = ANY($1::uuid[])`,
    [videoIds],
  )
}

/**
 * 将指定 source IDs 重新归属回其原始 video_id。
 * snapshotSources 是 snapshot 中保存的原始 source 行，通过 id 精确匹配归还。
 */
export async function reassignSourcesToOriginal(
  client: PoolClient,
  snapshotSources: Array<{ id: string; video_id: string }>,
): Promise<void> {
  if (snapshotSources.length === 0) return
  // 使用 unnest 批量更新，避免 N+1
  const ids = snapshotSources.map(s => s.id)
  const videoIds = snapshotSources.map(s => s.video_id)
  await client.query(
    `UPDATE video_sources vs
        SET video_id = data.video_id::uuid, updated_at = NOW()
       FROM unnest($1::uuid[], $2::uuid[]) AS data(id, video_id)
      WHERE vs.id = data.id`,
    [ids, videoIds],
  )
}

/** 标记 audit 已撤销 */
export async function markAuditReverted(
  client: PoolClient,
  auditId: string,
  revertedBy: string,
  revertedReason: string | null,
): Promise<void> {
  await client.query(
    `UPDATE video_merge_audit
        SET reverted_at = NOW(),
            reverted_by = $2,
            reverted_reason = $3
      WHERE id = $1`,
    [auditId, revertedBy, revertedReason ?? null],
  )
}

/**
 * 插入新 video 行（split 创建新视频用）。
 * 新 video 继承原 video 的 short_id 前缀+随机后缀逻辑由 DB DEFAULT 处理（gen_random_uuid）；
 * short_id 需传入外部生成值（Service 层负责生成唯一 8 位 short_id）。
 */
export async function insertNewVideo(
  client: PoolClient,
  params: {
    shortId: string
    /** 已由调用方 MediaCatalogService.findOrCreate 取得的作品层 catalog（migration 029 后 NOT NULL）。 */
    catalogId: string
    title: string  // videos.title 是 media_catalog.title 的冗余副本（与 createVideo 一致）
    type: string   // videos.type 是 media_catalog.type 的冗余副本
  },
): Promise<string> {
  // CHG-VIR-PRE-1: year / title_normalized 已由 migration 029 下沉到 media_catalog（DROP videos 列），
  // 不再写 videos；新建 video 必须携带 catalog_id（029 改 NOT NULL）。列集对齐 videos.mutations.createVideo。
  const result = await client.query<{ id: string }>(
    `INSERT INTO videos
       (short_id, catalog_id, title, type, is_published)
     VALUES ($1, $2, $3, $4, false)
     RETURNING id`,
    [
      params.shortId,
      params.catalogId,
      params.title,
      params.type,
    ],
  )
  return result.rows[0]!.id
}

/**
 * 回填 audit 行的 target_video_ids（split 流程：先 INSERT 占位空数组，创建完新 videos 后回填）。
 * CHG-SN-5-10-PATCH P2：原 Service 层 raw SQL UPDATE 抽出，避免越层。
 *
 * ADR-105 AMENDMENT 2026-06-03 D-105-4：可选同步回填 snapshot_jsonb.created_target_video_ids
 * （本次 split 新建的 video ids；已有 target = target_video_ids − created）。JSONB 自由字段零 DDL；
 * unmerge 仅软删 created（存量 audit 无该字段 → 兜底全视为新建，旧行为逐值一致）。
 */
export async function updateAuditTargetIds(
  client: PoolClient,
  auditId: string,
  targetVideoIds: string[],
  createdTargetVideoIds?: string[],
): Promise<void> {
  if (createdTargetVideoIds === undefined) {
    await client.query(
      `UPDATE video_merge_audit SET target_video_ids = $1::uuid[] WHERE id = $2`,
      [targetVideoIds, auditId],
    )
    return
  }
  await client.query(
    `UPDATE video_merge_audit
        SET target_video_ids = $1::uuid[],
            snapshot_jsonb = snapshot_jsonb
              || jsonb_build_object('created_target_video_ids', $3::jsonb)
      WHERE id = $2`,
    [targetVideoIds, auditId, JSON.stringify(createdTargetVideoIds)],
  )
}

/** 将指定 source IDs 归属到新 videoId（split 中分配 sources 到新 video） */
export async function assignSourcesToVideo(
  client: PoolClient,
  sourceIds: string[],
  targetVideoId: string,
): Promise<void> {
  if (sourceIds.length === 0) return
  await client.query(
    `UPDATE video_sources
        SET video_id = $1, updated_at = NOW()
      WHERE id = ANY($2::uuid[])
        AND deleted_at IS NULL`,
    [targetVideoId, sourceIds],
  )
}

// ── CHG-SN-6-AUDIT-TIMELINE (RETRO 4/7) — GET /admin/video-merges/audit ─────────

interface RawAuditTimelineRow {
  readonly id: string
  readonly action: 'merge' | 'split'
  readonly source_video_ids: string[]
  readonly target_video_ids: string[]
  readonly performed_by: string
  readonly performed_by_username: string | null
  readonly reason: string | null
  readonly performed_at: string
  readonly reverted_at: string | null
  readonly reverted_by: string | null
  readonly reverted_reason: string | null
  /** D-105-8（CHG-VIR-13-C2）：snapshot_jsonb.videos[] 投影 {videoId,title}[]（SQL 内 jsonb 抽取，
   *  避免传整个 snapshot；source 标题 = 软删视频唯一可靠源）；snapshot 无 videos 数组 → null */
  readonly snapshot_video_titles: { videoId: string; title: string | null }[] | null
}

/** 列出 audit timeline + LEFT JOIN users.username（ADR-105 AMENDMENT 2026-05-14）
 *  D-105-8（CHG-VIR-13-C2）：+snapshot videos 标题投影 */
export async function listAuditTimeline(
  db: Pool,
  params: { action: 'merge' | 'split' | null; videoId: string | null; offset: number; limit: number },
): Promise<RawAuditTimelineRow[]> {
  const { action, videoId, offset, limit } = params
  const result = await db.query<RawAuditTimelineRow>(
    `SELECT
       vma.id, vma.action,
       vma.source_video_ids, vma.target_video_ids,
       vma.performed_by, u.username AS performed_by_username,
       vma.reason,
       vma.performed_at::text AS performed_at,
       vma.reverted_at::text AS reverted_at,
       vma.reverted_by, vma.reverted_reason,
       CASE WHEN jsonb_typeof(vma.snapshot_jsonb->'videos') = 'array' THEN
         (SELECT jsonb_agg(jsonb_build_object('videoId', v->>'id', 'title', v->>'title'))
            FROM jsonb_array_elements(vma.snapshot_jsonb->'videos') v)
       ELSE NULL END AS snapshot_video_titles
     FROM video_merge_audit vma
     LEFT JOIN users u ON u.id = vma.performed_by
     WHERE ($1::text IS NULL OR vma.action = $1)
       AND ($2::uuid IS NULL OR $2 = ANY(vma.source_video_ids) OR $2 = ANY(vma.target_video_ids))
     ORDER BY vma.performed_at DESC
     LIMIT $3 OFFSET $4`,
    [action, videoId, limit, offset],
  )
  return result.rows
}

/** D-105-8（CHG-VIR-13-C2）：target 标题实时批量查（target 未删；轻量列集零 catalog JOIN） */
export async function fetchVideoTitles(
  db: Pool,
  ids: string[],
): Promise<{ id: string; title: string }[]> {
  if (ids.length === 0) return []
  const result = await db.query<{ id: string; title: string }>(
    `SELECT id, title FROM videos WHERE id = ANY($1::uuid[])`,
    [ids],
  )
  return result.rows
}

/** audit timeline 总数（同过滤条件）*/
export async function countAuditTimeline(
  db: Pool,
  params: { action: 'merge' | 'split' | null; videoId: string | null },
): Promise<number> {
  const { action, videoId } = params
  const result = await db.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM video_merge_audit vma
     WHERE ($1::text IS NULL OR vma.action = $1)
       AND ($2::uuid IS NULL OR $2 = ANY(vma.source_video_ids) OR $2 = ANY(vma.target_video_ids))`,
    [action, videoId],
  )
  return parseInt(result.rows[0]?.total ?? '0', 10)
}

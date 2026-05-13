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
            mc.director, mc."cast", mc.writers, v.is_published, mc.title_normalized,
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

/**
 * 前置冲突探测（ADR-105 R-105-1 + CHG-SN-5-10-PATCH P0-2）：
 * 检测合并后集合内任意两点是否存在相同 (episode_number, source_url) 组合，
 * 覆盖 source-vs-target + source-vs-source 全部冲突路径。
 *
 * @param videoIds 合并后集合 = [...sourceVideoIds, targetVideoId]，Service 层负责拼装
 * @returns 冲突对数（s1.id < s2.id 自连接 dedupe，避免镜像重复计）
 */
export async function detectMergeConflicts(
  db: Pool | PoolClient,
  videoIds: string[],
): Promise<number> {
  if (videoIds.length < 2) return 0
  const result = await db.query<{ conflict_count: string }>(
    `SELECT COUNT(*)::text AS conflict_count
       FROM video_sources s1
       JOIN video_sources s2
         ON s1.episode_number IS NOT DISTINCT FROM s2.episode_number
        AND s1.source_url = s2.source_url
        AND s1.id < s2.id
      WHERE s1.video_id = ANY($1::uuid[])
        AND s2.video_id = ANY($1::uuid[])
        AND s1.deleted_at IS NULL
        AND s2.deleted_at IS NULL`,
    [videoIds],
  )
  return parseInt(result.rows[0]?.conflict_count ?? '0', 10)
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
    title: string
    year: number | null
    type: string
    titleNormalized: string | null
  },
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO videos
       (short_id, title, year, type, title_normalized, is_published)
     VALUES ($1, $2, $3, $4, $5, false)
     RETURNING id`,
    [
      params.shortId,
      params.title,
      params.year ?? null,
      params.type,
      params.titleNormalized ?? null,
    ],
  )
  return result.rows[0]!.id
}

/**
 * 回填 audit 行的 target_video_ids（split 流程：先 INSERT 占位空数组，创建完新 videos 后回填）。
 * CHG-SN-5-10-PATCH P2：原 Service 层 raw SQL UPDATE 抽出，避免越层。
 */
export async function updateAuditTargetIds(
  client: PoolClient,
  auditId: string,
  targetVideoIds: string[],
): Promise<void> {
  await client.query(
    `UPDATE video_merge_audit SET target_video_ids = $1::uuid[] WHERE id = $2`,
    [targetVideoIds, auditId],
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

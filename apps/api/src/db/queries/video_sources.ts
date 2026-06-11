/**
 * video_sources.ts — video_sources admin 写操作 queries
 * CHG-SN-4-05: toggle(is_active) / disable-dead 批量禁用
 * CHG-SN-5-PRE-01-C: toggleVideoSource 乐观锁（DEBT-SN-4-05-A）
 *
 * 写路径同时维护 updated_at（乐观锁版本字段，Migration 061）；
 * probe 后台路径只写 last_checked / probe_status，不触发 updated_at。
 */

import type { Pool, PoolClient } from 'pg'
import type { VideoSourceLine } from '@resovo/types'
import { AppError } from '@/api/lib/errors'

interface DbVideoSourceLineRow {
  id: string
  video_id: string
  episode_number: number | null
  source_url: string
  source_name: string
  source_site_key: string | null
  user_label: string | null
  display_name: string | null
  type: string
  quality: string | null
  is_active: boolean
  probe_status: string
  render_status: string
  latency_ms: number | null
  last_probed_at: string | null
  last_rendered_at: string | null
  quality_detected: string | null
  quality_source: string
  resolution_width: number | null
  resolution_height: number | null
  detected_at: string | null
  last_checked: string | null
  submitted_by: string | null
  created_at: string
  updated_at: string
  fb_score: string | null
  fb_sample_weight: string | null
  last_feedback_at: string | null
}

function mapRow(row: DbVideoSourceLineRow): VideoSourceLine {
  return {
    id: row.id,
    videoId: row.video_id,
    episodeNumber: row.episode_number,
    sourceUrl: row.source_url,
    sourceName: row.source_name,
    sourceSiteKey: row.source_site_key,
    userLabel: row.user_label,
    displayName: row.display_name,
    type: row.type as VideoSourceLine['type'],
    quality: (row.quality as VideoSourceLine['quality']) ?? null,
    isActive: row.is_active,
    probeStatus: row.probe_status as VideoSourceLine['probeStatus'],
    renderStatus: row.render_status as VideoSourceLine['renderStatus'],
    latencyMs: row.latency_ms,
    lastProbedAt: row.last_probed_at,
    lastRenderedAt: row.last_rendered_at,
    qualityDetected: (row.quality_detected as VideoSourceLine['qualityDetected']) ?? null,
    qualitySource: row.quality_source as VideoSourceLine['qualitySource'],
    resolutionWidth: row.resolution_width,
    resolutionHeight: row.resolution_height,
    detectedAt: row.detected_at,
    lastChecked: row.last_checked,
    submittedBy: row.submitted_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // 105 新增（SRCHEALTH-P2-2）：pg NUMERIC 驱动层返回 string，转 number 保持 types 契约
    fbScore: row.fb_score === null ? null : Number(row.fb_score),
    fbSampleWeight: row.fb_sample_weight === null ? null : Number(row.fb_sample_weight),
    lastFeedbackAt: row.last_feedback_at,
  }
}

const SOURCE_SELECT = `
  vs.id, vs.video_id, vs.episode_number, vs.source_url, vs.source_name,
  vs.source_site_key, cs.user_label, cs.display_name,
  vs.type, vs.quality, vs.is_active,
  vs.probe_status, vs.render_status, vs.latency_ms,
  vs.last_probed_at, vs.last_rendered_at,
  vs.quality_detected, vs.quality_source,
  vs.resolution_width, vs.resolution_height, vs.detected_at,
  vs.last_checked, vs.submitted_by, vs.created_at, vs.updated_at,
  vs.fb_score, vs.fb_sample_weight, vs.last_feedback_at
`

export async function listVideoSources(
  db: Pool,
  videoId: string,
): Promise<VideoSourceLine[]> {
  const result = await db.query<DbVideoSourceLineRow>(
    `SELECT ${SOURCE_SELECT}
     FROM video_sources vs
     LEFT JOIN crawler_sites cs ON cs.key = COALESCE(vs.source_site_key, (
       SELECT v.site_key FROM videos v WHERE v.id = vs.video_id
     ))
     WHERE vs.video_id = $1 AND vs.deleted_at IS NULL
     ORDER BY vs.created_at ASC`,
    [videoId],
  )
  return result.rows.map(mapRow)
}

export async function findVideoSourceById(
  db: Pool,
  sourceId: string,
): Promise<VideoSourceLine | null> {
  const result = await db.query<DbVideoSourceLineRow>(
    `SELECT ${SOURCE_SELECT}
     FROM video_sources vs
     LEFT JOIN crawler_sites cs ON cs.key = COALESCE(vs.source_site_key, (
       SELECT v.site_key FROM videos v WHERE v.id = vs.video_id
     ))
     WHERE vs.id = $1 AND vs.deleted_at IS NULL`,
    [sourceId],
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export interface ToggleVideoSourceInput {
  sourceId: string
  isActive: boolean
  /** ISO 8601 时间戳；提供时启用乐观锁。current.updated_at 不匹配则抛 STATE_CONFLICT。 */
  expectedUpdatedAt?: string
}

export interface ToggleVideoSourceResult {
  id: string
  is_active: boolean
  updated_at: string
}

/**
 * 切换线路 is_active；可选乐观锁。
 * CHG-SN-5-PRE-01-C：tx + SELECT FOR UPDATE + version 比较，并发安全。
 *
 * 行为：
 *   - 行不存在 / deleted_at 非空 → 返回 null（404 路径）
 *   - expectedUpdatedAt 提供且不匹配 current.updated_at → 抛 AppError('STATE_CONFLICT', 409)
 *   - 否则 UPDATE is_active + last_checked + updated_at = NOW()
 */
export async function toggleVideoSource(
  db: Pool,
  input: ToggleVideoSourceInput,
): Promise<ToggleVideoSourceResult | null> {
  const client: PoolClient = await db.connect()
  try {
    await client.query('BEGIN')
    const currentResult = await client.query<{ id: string; updated_at: string; deleted_at: string | null }>(
      `SELECT id, updated_at, deleted_at
       FROM video_sources
       WHERE id = $1
       FOR UPDATE`,
      [input.sourceId],
    )
    const current = currentResult.rows[0]
    if (!current || current.deleted_at) {
      await client.query('ROLLBACK')
      return null
    }

    if (
      input.expectedUpdatedAt &&
      new Date(current.updated_at).toISOString() !== new Date(input.expectedUpdatedAt).toISOString()
    ) {
      throw new AppError('STATE_CONFLICT', 'Optimistic lock conflict on video source', 409)
    }

    const updateResult = await client.query<ToggleVideoSourceResult>(
      `UPDATE video_sources
       SET is_active = $1, last_checked = NOW(), updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, is_active, updated_at`,
      [input.isActive, input.sourceId],
    )
    await client.query('COMMIT')
    return updateResult.rows[0] ?? null
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

export interface DisableDeadResult {
  disabled: number
  sourceIds: string[]
}

export async function disableDeadSources(
  db: Pool,
  videoId: string,
): Promise<DisableDeadResult> {
  const result = await db.query<{ id: string }>(
    `UPDATE video_sources
     SET is_active = false, last_checked = NOW(), updated_at = NOW()
     WHERE video_id = $1
       AND deleted_at IS NULL
       AND probe_status = 'dead'
       AND is_active = true
     RETURNING id`,
    [videoId],
  )
  return {
    disabled: result.rowCount ?? 0,
    sourceIds: result.rows.map((r) => r.id),
  }
}

// ── CHG-356 / ADR-158 AMENDMENT：同步快探 + UPDATE DB helper ────────
// 与 toggleVideoSource (is_active / last_checked) 职责分离：本组 helpers 仅写探测信号字段

export interface UpdateSourceHealthAfterProbeInput {
  readonly probeStatus: 'ok' | 'dead'
  readonly latencyMs: number | null
}

/**
 * CHG-356 / ADR-158 AMENDMENT R3：probeOne 同步 UPDATE 信号字段
 * 字段：probe_status / latency_ms / last_probed_at
 * 不动 last_checked（与 v1 toggleVideoSource 职责分离 / Y B2）
 */
export async function updateSourceHealthAfterProbe(
  db: Pool,
  sourceId: string,
  input: UpdateSourceHealthAfterProbeInput,
): Promise<void> {
  await db.query(
    `UPDATE video_sources
        SET probe_status = $2,
            latency_ms = $3,
            last_probed_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL`,
    [sourceId, input.probeStatus, input.latencyMs],
  )
}

export interface UpdateSourceHealthAfterRenderCheckInput {
  readonly renderStatus: 'ok' | 'partial' | 'dead'
  readonly resolutionWidth: number | null
  readonly resolutionHeight: number | null
  readonly qualityDetected: string | null
}

/**
 * CHG-356 / ADR-158 AMENDMENT R3：renderCheckOne 同步 UPDATE 信号字段
 * SRCHEALTH-P1-3（D1/D2）：手动试播升级 manifest 真解析 → 三态 render_status +
 * 质量字段写入。UPDATE 语义与 worker level2-render updateSourceRender 逐条对齐：
 * width/height/quality_detected 无条件覆盖；quality_source / detected_at 仅在
 * 解析出尺寸（width 非 NULL）时写 'manifest_parse' / NOW()，否则保留既有值。
 */
export async function updateSourceHealthAfterRenderCheck(
  db: Pool,
  sourceId: string,
  input: UpdateSourceHealthAfterRenderCheckInput,
): Promise<void> {
  await db.query(
    `UPDATE video_sources
        SET render_status = $2,
            resolution_width = $3,
            resolution_height = $4,
            quality_detected = $5,
            quality_source = CASE WHEN $3 IS NOT NULL THEN 'manifest_parse' ELSE quality_source END,
            detected_at = CASE WHEN $3 IS NOT NULL THEN NOW() ELSE detected_at END,
            last_rendered_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL`,
    [sourceId, input.renderStatus, input.resolutionWidth, input.resolutionHeight, input.qualityDetected],
  )
}

export interface RecordAdminPlaybackVerifySuccessInput {
  /** admin 实测分辨率宽（像素）；NULL = 未携带分辨率 → 保留既有质量字段 */
  readonly resolutionWidth: number | null
  /** admin 实测分辨率高（像素）；NULL = 未携带 */
  readonly resolutionHeight: number | null
  /** 由 resolutionHeight 经 heightToQuality 映射的档位；NULL = 未携带分辨率（写质量字段的开关） */
  readonly qualityDetected: string | null
}

export interface RecordAdminPlaybackVerifySuccessResult {
  readonly newProbeStatus: 'pending' | 'ok' | 'partial' | 'dead'
  readonly newRenderStatus: 'pending' | 'ok' | 'partial' | 'dead'
}

/**
 * ADR-198 D-198-2/4/7：admin 审核台真实播放**成功** → 直更 source health（可信单点，绕众包门槛）。
 * - render_status='ok'（真实播放是 playability 最强证据，进 render 维度〔health 权重 0.6〕）。
 * - probe_status dead→ok 复活（**仅当前为 dead 时翻**；ok/pending/partial 不动——避免误盖既有非 dead 态）。
 * - last_rendered_at=NOW()（驱动 ADR P3-1 双时钟 render 衰减回升）+ last_admin_verified_at=NOW()（溯源）。
 * - 携分辨率（qualityDetected 非 NULL）时**无条件**覆盖 resolution_width/height + quality_detected +
 *   quality_source='admin_review' + detected_at（D-198-7：admin 实测 > 爬虫配置，区别于 feedback.ts 仅 NULL 时写）；
 *   未携带则保留既有质量字段。
 * - **不写** fb_score/fb_sample_weight/last_feedback_at（D-198-4 红线：admin 确定性写入不污染众包 EMA 统计）。
 * RETURNING 新 probe/render 状态供响应（无需 mapRow 全行）；行不存在/已删 → null（404 路径）。
 */
export async function recordAdminPlaybackVerifySuccess(
  db: Pool,
  sourceId: string,
  input: RecordAdminPlaybackVerifySuccessInput,
): Promise<RecordAdminPlaybackVerifySuccessResult | null> {
  const result = await db.query<{ probe_status: string; render_status: string }>(
    `UPDATE video_sources
        SET render_status = 'ok',
            probe_status = CASE WHEN probe_status = 'dead' THEN 'ok' ELSE probe_status END,
            last_rendered_at = NOW(),
            last_admin_verified_at = NOW(),
            resolution_width = CASE WHEN $4 IS NOT NULL THEN $2 ELSE resolution_width END,
            resolution_height = CASE WHEN $4 IS NOT NULL THEN $3 ELSE resolution_height END,
            quality_detected = CASE WHEN $4 IS NOT NULL THEN $4 ELSE quality_detected END,
            quality_source = CASE WHEN $4 IS NOT NULL THEN 'admin_review' ELSE quality_source END,
            detected_at = CASE WHEN $4 IS NOT NULL THEN NOW() ELSE detected_at END
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING probe_status, render_status`,
    [sourceId, input.resolutionWidth, input.resolutionHeight, input.qualityDetected],
  )
  const row = result.rows[0]
  if (!row) return null
  return {
    newProbeStatus: row.probe_status as RecordAdminPlaybackVerifySuccessResult['newProbeStatus'],
    newRenderStatus: row.render_status as RecordAdminPlaybackVerifySuccessResult['newRenderStatus'],
  }
}

/**
 * SRCHEALTH-P1-2（B2）：取视频全部 active source 的 probe_status，供探测后即时重算
 * videos.source_check_status（lib/source-check-status computeCheckStatus 的输入）。
 * WHERE 口径与 worker aggregate 聚合输入一致（is_active = true AND deleted_at IS NULL）。
 */
export async function listActiveProbeStatuses(
  db: Pool,
  videoId: string,
): Promise<string[]> {
  const result = await db.query<{ probe_status: string }>(
    `SELECT probe_status FROM video_sources
      WHERE video_id = $1 AND is_active = true AND deleted_at IS NULL`,
    [videoId],
  )
  return result.rows.map((r) => r.probe_status)
}

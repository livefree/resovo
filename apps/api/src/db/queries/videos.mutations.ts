/**
 * videos.mutations.ts — videos 写入 / 状态转换函数
 * 从 videos.ts 拆出（CHG-SN-7-MISC-API-QUERIES-SIZE）
 */

import type { Pool, PoolClient } from 'pg'
import type { VideoType, ReviewStatus, VisibilityStatus } from '@/types'
import type { DbVideoRow } from './videos.internal'
import { AppError } from '@/api/lib/errors'
import { generateShortId } from '@/api/lib/short-id'

// ── 创建 ─────────────────────────────────────────────────────────

export interface CreateVideoInput {
  /** 已在 MediaCatalogService.findOrCreate 后获得的 catalog ID */
  catalogId: string
  title: string    // 冗余副本（与 mc.title 保持一致）
  type: VideoType  // 冗余副本（与 mc.type 保持一致）
  episodeCount?: number
  siteKey?: string | null
  sourceCategory?: string | null
  contentRating?: 'general' | 'adult'
}

export async function createVideo(
  db: Pool,
  input: CreateVideoInput
): Promise<DbVideoRow> {
  const shortId = generateShortId()
  const result = await db.query<DbVideoRow>(
    `INSERT INTO videos
       (short_id, catalog_id, title, type, episode_count,
        site_key, source_category, content_rating, is_published)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id, short_id, slug, title, type, catalog_id, episode_count,
               is_published, created_at, updated_at,
               source_content_type, normalized_type, content_format, episode_pattern,
               review_status, visibility_status, needs_manual_review,
               content_rating, site_key, source_category`,
    [
      shortId,
      input.catalogId,
      input.title,
      input.type,
      input.episodeCount ?? 1,
      input.siteKey ?? null,
      input.sourceCategory ?? null,
      input.contentRating ?? 'general',
      false,
    ]
  )
  return result.rows[0]
}

/**
 * 更新 videos 表自有字段（冗余副本 + 平台实例字段）
 * 注意：title/type 是冗余字段，canonical 值在 media_catalog；
 *       元数据字段（titleEn/description/coverUrl 等）已迁移到 media_catalog，
 *       请通过 MediaCatalogService.safeUpdate 更新。
 */
export interface UpdateVideoMetaInput {
  title?: string      // 冗余副本更新（与 mc.title 同步时使用）
  type?: VideoType    // 冗余副本更新（与 mc.type 同步时使用）
  episodeCount?: number
  slug?: string | null
}

export async function updateVideoMeta(
  db: Pool,
  id: string,
  input: UpdateVideoMetaInput
): Promise<{ id: string; updated_at: string } | null> {
  const sets: string[] = ['updated_at = NOW()']
  const params: unknown[] = []
  let idx = 1

  const fieldMap: Record<string, string> = {
    title: 'title',
    type: 'type',
    episodeCount: 'episode_count',
    slug: 'slug',
  }

  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in input && input[key as keyof UpdateVideoMetaInput] !== undefined) {
      sets.push(`${col} = $${idx++}`)
      params.push(input[key as keyof UpdateVideoMetaInput])
    }
  }

  params.push(id)
  const result = await db.query<{ id: string; updated_at: string }>(
    `UPDATE videos SET ${sets.join(', ')}
     WHERE id = $${idx} AND deleted_at IS NULL
     RETURNING id, updated_at`,
    params
  )
  return result.rows[0] ?? null
}

export async function publishVideo(
  db: Pool,
  id: string,
  isPublished: boolean
): Promise<{ id: string; is_published: boolean } | null> {
  const result = await db.query<{ id: string; is_published: boolean }>(
    `UPDATE videos SET is_published = $1, updated_at = NOW()
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING id, is_published`,
    [isPublished, id]
  )
  return result.rows[0] ?? null
}

// ── 状态机转换 ────────────────────────────────────────────────────

export type VideoStateTransitionAction =
  | 'approve'
  | 'approve_and_publish'
  | 'reject'
  | 'reopen_pending'
  | 'publish'
  | 'unpublish'
  | 'set_internal'
  | 'set_hidden'
  | 'staging_revert'  // M-SN-4 D-01：暂存退回待审核（approved+internal/hidden+0 → pending_review）

export interface TransitionVideoStateInput {
  action: VideoStateTransitionAction
  reviewedBy?: string
  reason?: string
  expectedUpdatedAt?: string
  reviewLabelKey?: string
}

export interface TransitionVideoStateResult {
  id: string
  review_status: ReviewStatus
  visibility_status: VisibilityStatus
  is_published: boolean
  updated_at: string
}

/**
 * Single write entry for governance state transitions.
 * All transitions are applied atomically with row lock.
 */
export async function transitionVideoState(
  db: Pool,
  id: string,
  input: TransitionVideoStateInput,
): Promise<TransitionVideoStateResult | null> {
  const client: PoolClient = await db.connect()
  try {
    await client.query('BEGIN')
    const currentResult = await client.query<{
      id: string
      review_status: ReviewStatus
      visibility_status: VisibilityStatus
      is_published: boolean
      updated_at: string
      review_reason: string | null
      reviewed_by: string | null
      reviewed_at: string | null
      deleted_at: string | null
    }>(
      `SELECT id, review_status, visibility_status, is_published, updated_at,
              review_reason, reviewed_by, reviewed_at, deleted_at
       FROM videos
       WHERE id = $1
       FOR UPDATE`,
      [id],
    )
    const current = currentResult.rows[0]
    if (!current || current.deleted_at) {
      await client.query('ROLLBACK')
      return null
    }

    if (input.expectedUpdatedAt && new Date(current.updated_at).toISOString() !== new Date(input.expectedUpdatedAt).toISOString()) {
      throw new AppError('STATE_CONFLICT', 'Optimistic lock conflict', 409)
    }

    let nextReview = current.review_status
    let nextVisibility = current.visibility_status
    let nextPublished = current.is_published
    let reviewReason: string | null = current.review_reason
    let reviewedBy: string | null = current.reviewed_by
    let reviewedAt: string | null = current.reviewed_at

    switch (input.action) {
      case 'approve': {
        if (current.review_status !== 'pending_review') {
          throw new AppError('INVALID_TRANSITION', 'Invalid state transition', 422)
        }
        nextReview = 'approved'
        nextVisibility = 'internal'
        nextPublished = false
        reviewReason = input.reason ?? null
        reviewedBy = input.reviewedBy ?? null
        reviewedAt = new Date().toISOString()
        break
      }
      case 'approve_and_publish': {
        if (current.review_status !== 'pending_review') {
          throw new AppError('INVALID_TRANSITION', 'Invalid state transition', 422)
        }
        nextReview = 'approved'
        nextVisibility = 'public'
        nextPublished = true
        reviewReason = input.reason ?? null
        reviewedBy = input.reviewedBy ?? null
        reviewedAt = new Date().toISOString()
        break
      }
      case 'reject': {
        // M-SN-4 D-01：reject 限制为 pending_review 入参，与 trigger 白名单 + plan §1 D-01
        // 设计意图（暂存撤回须经 staging_revert 两步走）三层守门一致。
        // approved 视频不可直接 reject（即便允许，DB trigger 也会拒绝 approved → rejected_hidden
        // 转换；旧版应用层放行造成跨层不一致）。
        if (current.review_status !== 'pending_review') {
          throw new AppError('INVALID_TRANSITION', 'Invalid state transition', 422)
        }
        nextReview = 'rejected'
        nextVisibility = 'hidden'
        nextPublished = false
        reviewReason = input.reason ?? null
        reviewedBy = input.reviewedBy ?? null
        reviewedAt = new Date().toISOString()
        break
      }
      case 'reopen_pending': {
        if (current.review_status !== 'rejected') {
          throw new AppError('INVALID_TRANSITION', 'Invalid state transition', 422)
        }
        nextReview = 'pending_review'
        nextVisibility = 'hidden'
        nextPublished = false
        reviewReason = null
        reviewedBy = null
        reviewedAt = null
        break
      }
      case 'publish': {
        if (current.review_status !== 'approved') {
          throw new AppError('INVALID_TRANSITION', 'Invalid state transition', 422)
        }
        nextReview = 'approved'
        nextVisibility = 'public'
        nextPublished = true
        break
      }
      case 'unpublish': {
        if (current.review_status !== 'approved') {
          throw new AppError('INVALID_TRANSITION', 'Invalid state transition', 422)
        }
        nextReview = 'approved'
        nextVisibility = 'internal'
        nextPublished = false
        break
      }
      case 'set_internal': {
        if (current.review_status === 'rejected') {
          throw new AppError('INVALID_TRANSITION', 'Invalid state transition', 422)
        }
        nextVisibility = 'internal'
        nextPublished = false
        break
      }
      case 'set_hidden': {
        nextVisibility = 'hidden'
        nextPublished = false
        break
      }
      case 'staging_revert': {
        // M-SN-4 D-01：暂存（approved + internal|hidden + unpublished）→ 退回待审核
        // 已发布视频不可直接退回（必须先 unpublish），由 trigger 白名单兜底拒绝
        if (current.review_status !== 'approved' || current.is_published) {
          throw new AppError('INVALID_TRANSITION', 'Invalid state transition', 422)
        }
        nextReview = 'pending_review'
        nextVisibility = current.visibility_status  // 保持 internal | hidden
        nextPublished = false
        reviewReason = null
        reviewedBy = null
        reviewedAt = null
        break
      }
      default:
        throw new AppError('INVALID_TRANSITION', 'Invalid state transition', 422)
    }

    const result = await client.query<TransitionVideoStateResult>(
      `UPDATE videos
       SET review_status = $1,
           visibility_status = $2,
           is_published = $3,
           review_reason = $4,
           reviewed_by = $5,
           reviewed_at = $6::timestamptz,
           review_label_key = CASE WHEN $8::text IS NOT NULL THEN $8 ELSE review_label_key END,
           needs_manual_review = false,
           updated_at = NOW()
       WHERE id = $7 AND deleted_at IS NULL
       RETURNING id, review_status, visibility_status, is_published, updated_at`,
      [nextReview, nextVisibility, nextPublished, reviewReason, reviewedBy, reviewedAt, id, input.reviewLabelKey ?? null],
    )
    await client.query('COMMIT')
    return result.rows[0] ?? null
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function batchPublishVideos(
  db: Pool,
  ids: string[],
  isPublished: boolean
): Promise<number> {
  const client: PoolClient = await db.connect()
  try {
    await client.query('BEGIN')
    const placeholders = ids.map((_, i) => `$${i + 2}`).join(', ')
    const result = await client.query(
      `UPDATE videos SET is_published = $1, updated_at = NOW()
       WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
      [isPublished, ...ids]
    )
    await client.query('COMMIT')
    return result.rowCount ?? 0
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function batchUnpublishVideos(db: Pool, ids: string[]): Promise<number> {
  return batchPublishVideos(db, ids, false)
}

// ── 可见性切换（CHG-200）──────────────────────────────────────────

/**
 * 切换视频可见性状态（public ↔ hidden），同步更新 is_published 向后兼容。
 * 仅允许 approved 状态的视频切换到 public。
 */
export async function updateVisibility(
  db: Pool,
  id: string,
  visibility: VisibilityStatus
): Promise<{ id: string; visibility_status: string; is_published: boolean } | null> {
  const isPublished = visibility === 'public'
  const result = await db.query<{
    id: string; visibility_status: string; is_published: boolean
  }>(
    `UPDATE videos
     SET visibility_status = $1,
         is_published = $2,
         updated_at = NOW()
     WHERE id = $3 AND deleted_at IS NULL
     RETURNING id, visibility_status, is_published`,
    [visibility, isPublished, id]
  )
  return result.rows[0] ?? null
}

// ── 审核（CHG-201）────────────────────────────────────────────────

export type ReviewAction = 'approve' | 'approve_and_publish' | 'reject'

interface ReviewVideoInput {
  action: ReviewAction
  reason?: string
  reviewedBy: string
}

/** 状态转换映射：action → { review_status, visibility_status, is_published } */
const REVIEW_ACTION_MAP: Record<ReviewAction, {
  reviewStatus: ReviewStatus
  visibilityStatus: VisibilityStatus
  isPublished: boolean
}> = {
  approve: { reviewStatus: 'approved', visibilityStatus: 'internal', isPublished: false },
  approve_and_publish: { reviewStatus: 'approved', visibilityStatus: 'public', isPublished: true },
  reject: { reviewStatus: 'rejected', visibilityStatus: 'hidden', isPublished: false },
}

export async function reviewVideo(
  db: Pool,
  id: string,
  input: ReviewVideoInput
): Promise<{
  id: string
  review_status: string
  visibility_status: string
  is_published: boolean
} | null> {
  const mapping = REVIEW_ACTION_MAP[input.action]
  const isPublished = mapping.isPublished
  const result = await db.query<{
    id: string; review_status: string; visibility_status: string; is_published: boolean
  }>(
    `UPDATE videos
     SET review_status = $1,
         visibility_status = $2,
         is_published = $3,
         reviewed_by = $4,
         reviewed_at = NOW(),
         review_reason = $5,
         needs_manual_review = false,
         updated_at = NOW()
     WHERE id = $6 AND deleted_at IS NULL
     RETURNING id, review_status, visibility_status, is_published`,
    [mapping.reviewStatus, mapping.visibilityStatus, isPublished, input.reviewedBy, input.reason ?? null, id]
  )
  return result.rows[0] ?? null
}

// ── Admin 工具查询 ────────────────────────────────────────────────

/**
 * 按 short_id 查找视频 ID（含未发布视频，用于 admin 导入场景）
 */
export async function findVideoIdByShortId(
  db: Pool,
  shortId: string
): Promise<string | null> {
  const result = await db.query<{ id: string }>(
    `SELECT id FROM videos WHERE short_id = $1 AND deleted_at IS NULL`,
    [shortId]
  )
  return result.rows[0]?.id ?? null
}

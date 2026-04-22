/**
 * MediaImageService.ts — 图片上传 + 写库 + 入队组合器（IMG-06）
 *
 * 职责：
 *   1. 前置校验 owner 存在（404 → 阻止产生孤立 R2 对象）
 *   2. 调 ImageStorageService.upload() 存 R2
 *   3. 按 ownerType 调对应写库方法：
 *      - video → updateCatalogFields（videos.catalog_id）+ image job 入队
 *      - banner → BannerService.update()
 *   4. 写库失败触发补偿删除 R2 对象
 *   5. 返回 { url, key, hash, blurhashJobId }
 *
 * 架构边界（CLAUDE.md）：
 *   - Route 只负责：接 multipart → 调本 Service → 返回 response
 *   - 本 Service 编排 ImageStorageService + VideoImage helper + BannerService + imageHealthQueue
 *   - 写库逻辑复用已有 queries（updateCatalogFields / bannerQueries.updateBanner）
 *   - 不做 Rate limit / audit log（未来任务）
 */

import type { Pool } from 'pg'
import type { ImageKind } from '@/types'
import { findAdminVideoById } from '@/api/db/queries/videos'
import { findBannerById, updateBanner } from '@/api/db/queries/home-banners'
import { updateCatalogFields, type CatalogUpdateData } from '@/api/db/queries/mediaCatalog'
import { imageHealthQueue } from '@/api/lib/queue'
import {
  ImageStorageService,
  ImageStorageError,
  type OwnerType,
  type ImageUploadResult,
} from './ImageStorageService'

// ── 视频 kind → media_catalog 字段映射（复用 admin/videos.ts PUT /images 的表）──

interface CatalogImageFields {
  urlField:    keyof CatalogUpdateData
  statusField: keyof CatalogUpdateData
}

const VIDEO_KIND_FIELDS: Record<ImageKind, CatalogImageFields | null> = {
  poster:          { urlField: 'coverUrl',           statusField: 'posterStatus' },
  backdrop:        { urlField: 'backdropUrl',         statusField: 'backdropStatus' },
  logo:            { urlField: 'logoUrl',             statusField: 'logoStatus' },
  banner_backdrop: { urlField: 'bannerBackdropUrl',   statusField: 'bannerBackdropStatus' },
  stills:          null, // IMG-06 scope 外（未来 video_episode_images 关联）
  thumbnail:       null, // IMG-06 scope 外
}

/** blurhash 入队的 kind 白名单 — 仅有 blurhash 字段的 kind 入队 */
const BLURHASH_KINDS = new Set<ImageKind>(['poster', 'backdrop', 'banner_backdrop'])

// ── 输入 / 输出 ───────────────────────────────────────────────────

export interface MediaImageUploadInput {
  buffer: Buffer
  contentType: string
  ownerType: OwnerType
  ownerId: string
  kind?: ImageKind // ownerType='video' 时必填；'banner' 时忽略
}

export interface MediaImageUploadResult extends ImageUploadResult {
  ownerType: OwnerType
  ownerId: string
  kind: ImageKind | null // banner 时为 null
  /** blurhash 入队 job id；未入队（logo / banner / 未配 R2）则为 null */
  blurhashJobId: string | null
}

// ── MediaImageService ─────────────────────────────────────────────

export class MediaImageService {
  private storage: ImageStorageService

  constructor(
    private db: Pool,
    storage?: ImageStorageService,
  ) {
    this.storage = storage ?? new ImageStorageService()
  }

  /**
   * 上传图片并完成关联写库 + 入队。
   *
   * @throws ImageStorageError（415 / 413 / 503 / 404）
   * @throws Error（DB 写入失败 / R2 上传失败；route 层统一返 500 + 已触发补偿删除）
   */
  async upload(input: MediaImageUploadInput): Promise<MediaImageUploadResult> {
    // ── Step 1: owner 前置校验 ──
    if (input.ownerType === 'video') {
      if (!input.kind || VIDEO_KIND_FIELDS[input.kind] === null || VIDEO_KIND_FIELDS[input.kind] === undefined) {
        throw new ImageStorageError(
          `ownerType='video' 需要合法 kind（poster/backdrop/logo/banner_backdrop）；收到 ${String(input.kind)}`,
          400,
          'VALIDATION_ERROR',
        )
      }
      const video = await findAdminVideoById(this.db, input.ownerId)
      if (!video) {
        throw new ImageStorageError(
          `video 不存在：${input.ownerId}`,
          404,
          'OWNER_NOT_FOUND',
        )
      }
      return this.uploadForVideo(input, video.catalog_id, input.kind)
    }

    // ownerType === 'banner'
    const banner = await findBannerById(this.db, input.ownerId)
    if (!banner) {
      throw new ImageStorageError(
        `banner 不存在：${input.ownerId}`,
        404,
        'OWNER_NOT_FOUND',
      )
    }
    return this.uploadForBanner(input)
  }

  private async uploadForVideo(
    input: MediaImageUploadInput,
    catalogId: string,
    kind: ImageKind,
  ): Promise<MediaImageUploadResult> {
    const stored = await this.storage.upload({
      buffer: input.buffer,
      contentType: input.contentType,
      ownerType: 'video',
      ownerId: input.ownerId,
      kind,
    })

    const fields = VIDEO_KIND_FIELDS[kind]
    if (!fields) {
      // 不可能到达（Step 1 已校验），留作防御
      await this.storage.delete(stored.key)
      throw new ImageStorageError(`kind 不支持：${kind}`, 400, 'VALIDATION_ERROR')
    }

    try {
      await updateCatalogFields(this.db, catalogId, {
        [fields.urlField]:    stored.url,
        [fields.statusField]: 'pending_review',
      })
    } catch (err) {
      // 写库失败 → 补偿删除 R2 对象
      await this.storage.delete(stored.key)
      const msg = err instanceof Error ? err.message : String(err)
      process.stderr.write(
        `[MediaImageService] video catalog update failed; R2 object deleted; videoId=${input.ownerId} kind=${kind} key=${stored.key}: ${msg}\n`,
      )
      throw err
    }

    // health-check 始终入队（与现有 PUT /admin/videos/:id/images 对齐）
    await imageHealthQueue.add('health-check', {
      type: 'health-check',
      catalogId,
      videoId: input.ownerId,
      kind,
      url: stored.url,
    })

    // blurhash-extract 仅 kind ∈ {poster, backdrop, banner_backdrop} 入队
    let blurhashJobId: string | null = null
    if (BLURHASH_KINDS.has(kind)) {
      const job = await imageHealthQueue.add('blurhash-extract', {
        type: 'blurhash-extract',
        catalogId,
        videoId: input.ownerId,
        kind,
        url: stored.url,
      })
      blurhashJobId = String(job.id)
    }

    process.stderr.write(
      `[image-upload] ownerType=video ownerId=${input.ownerId} kind=${kind} key=${stored.key} size=${stored.size}\n`,
    )

    return {
      ...stored,
      ownerType: 'video',
      ownerId: input.ownerId,
      kind,
      blurhashJobId,
    }
  }

  private async uploadForBanner(
    input: MediaImageUploadInput,
  ): Promise<MediaImageUploadResult> {
    const stored = await this.storage.upload({
      buffer: input.buffer,
      contentType: input.contentType,
      ownerType: 'banner',
      ownerId: input.ownerId,
    })

    try {
      await updateBanner(this.db, input.ownerId, { imageUrl: stored.url })
    } catch (err) {
      await this.storage.delete(stored.key)
      const msg = err instanceof Error ? err.message : String(err)
      process.stderr.write(
        `[MediaImageService] banner update failed; R2 object deleted; bannerId=${input.ownerId} key=${stored.key}: ${msg}\n`,
      )
      throw err
    }

    // banner 无 blurhash 列（migration 048 未扩 home_banners），不入队
    // TODO: 未来为 home_banners 加 blurhash 列后，在此入 blurhash-extract job

    process.stderr.write(
      `[image-upload] ownerType=banner ownerId=${input.ownerId} key=${stored.key} size=${stored.size}\n`,
    )

    return {
      ...stored,
      ownerType: 'banner',
      ownerId: input.ownerId,
      kind: null,
      blurhashJobId: null,
    }
  }
}

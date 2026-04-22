/**
 * ImageStorageService.ts — 图片资产 R2 持久化（IMG-06）
 *
 * 职责：
 *   - 接收图片二进制 + ownerType + ownerId + (kind)
 *   - mimetype 白名单 + 大小上限校验
 *   - 计算 sha256(buf).slice(0,8) 作为 key hash 段（防 CDN 缓存不一致）
 *   - R2 PutObject → 返回 { url, key, contentType, size, hash }
 *   - R2 未配时返 503（STORAGE_NOT_CONFIGURED），不使用假域名占位
 *   - 提供 delete(key) 供上层补偿删除
 *
 * 边界：
 *   - 不写 DB（videos / home_banners 字段由 MediaImageService 组合写）
 *   - 不入队 blurhash job（由 MediaImageService 按 ownerType/kind 决策）
 *   - 不做 orphan cleanup（TODO: 未来 maintenance job 清理孤立对象）
 *
 * 复用 SubtitleService 的 R2 客户端构造范式，不引入新依赖。
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { createHash } from 'node:crypto'
import type { ImageKind } from '@/types'

// ── R2 客户端 ─────────────────────────────────────────────────────

function buildR2Client(): S3Client | null {
  const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env
  if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    return null
  }
  return new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  })
}

// ── 常量 ──────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

const ALLOWED_MIMETYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
])

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif':  'gif',
}

// ── 类型 ──────────────────────────────────────────────────────────

export type OwnerType = 'video' | 'banner'

export interface ImageUploadInput {
  buffer: Buffer
  contentType: string
  ownerType: OwnerType
  ownerId: string
  /** ownerType='video' 时必填；'banner' 时忽略 */
  kind?: ImageKind
}

export interface ImageUploadResult {
  url: string
  key: string
  contentType: string
  size: number
  hash: string
}

// ── 错误类型 ──────────────────────────────────────────────────────

export class ImageStorageError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'ImageStorageError'
  }
}

// ── ImageStorageService ───────────────────────────────────────────

export class ImageStorageService {
  private r2: S3Client | null
  private bucket: string

  constructor() {
    this.r2 = buildR2Client()
    // IMG-06: 图片与字幕分桶便于独立 lifecycle / CDN 规则
    this.bucket = process.env.R2_IMAGES_BUCKET ?? 'resovo-images'
  }

  /** R2 是否已配置；route 层可用此判断返 503 STORAGE_NOT_CONFIGURED */
  isConfigured(): boolean {
    return this.r2 !== null
  }

  /**
   * 校验文件 mimetype + 大小
   * @throws ImageStorageError（415 / 413）
   */
  validate(buffer: Buffer, contentType: string): void {
    if (!ALLOWED_MIMETYPES.has(contentType)) {
      throw new ImageStorageError(
        `不支持的图片格式：${contentType}；仅支持 ${[...ALLOWED_MIMETYPES].join('、')}`,
        415,
        'UNSUPPORTED_MEDIA_TYPE',
      )
    }
    if (buffer.length > MAX_FILE_SIZE) {
      throw new ImageStorageError(
        `图片文件不能超过 ${MAX_FILE_SIZE / 1024 / 1024}MB（当前 ${(buffer.length / 1024 / 1024).toFixed(2)}MB）`,
        413,
        'PAYLOAD_TOO_LARGE',
      )
    }
  }

  /**
   * 上传图片到 R2 并返回访问信息
   *
   * R2 key 规则（带 sha256 前 8 位 hash 防 CDN 缓存不一致）：
   *   video + poster          → posters/{videoId}-{hash}.{ext}
   *   video + backdrop        → backdrops/{videoId}-{hash}.{ext}
   *   video + logo            → logos/{videoId}-{hash}.{ext}
   *   video + banner_backdrop → banner-backdrops/{videoId}-{hash}.{ext}
   *   video + stills          → stills/{videoId}-{hash}.{ext}
   *   video + thumbnail       → thumbnails/{videoId}-{hash}.{ext}
   *   banner                  → banners/{bannerId}-{hash}.{ext}
   */
  async upload(input: ImageUploadInput): Promise<ImageUploadResult> {
    this.validate(input.buffer, input.contentType)

    if (!this.r2) {
      throw new ImageStorageError(
        'R2 尚未配置（需要 R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY）',
        503,
        'STORAGE_NOT_CONFIGURED',
      )
    }

    const hash = createHash('sha256').update(input.buffer).digest('hex').slice(0, 8)
    const ext = MIME_TO_EXT[input.contentType] ?? 'bin'
    const key = this.buildKey(input, hash, ext)

    await this.r2.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: input.buffer,
        ContentType: input.contentType,
      }),
    )

    const url = `${process.env.R2_ENDPOINT ?? ''}/${this.bucket}/${key}`

    return {
      url,
      key,
      contentType: input.contentType,
      size: input.buffer.length,
      hash,
    }
  }

  /**
   * 删除 R2 对象（供 MediaImageService 在写库失败后补偿回滚）
   * R2 未配置或 key 为空时静默返回
   */
  async delete(key: string): Promise<void> {
    if (!this.r2 || !key) return
    try {
      await this.r2.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      process.stderr.write(
        `[ImageStorageService] delete failed key=${key}: ${msg}\n`,
      )
      // TODO: orphan cleanup maintenance job 未来兜底
    }
  }

  private buildKey(
    input: Pick<ImageUploadInput, 'ownerType' | 'ownerId' | 'kind'>,
    hash: string,
    ext: string,
  ): string {
    if (input.ownerType === 'banner') {
      return `banners/${input.ownerId}-${hash}.${ext}`
    }
    // ownerType === 'video'
    const kind = input.kind ?? 'poster'
    const prefix = KIND_TO_PREFIX[kind]
    return `${prefix}/${input.ownerId}-${hash}.${ext}`
  }
}

const KIND_TO_PREFIX: Record<ImageKind, string> = {
  poster:          'posters',
  backdrop:        'backdrops',
  logo:            'logos',
  banner_backdrop: 'banner-backdrops',
  stills:          'stills',
  thumbnail:       'thumbnails',
}

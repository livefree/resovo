/**
 * ImageStorageService.ts — 图片资产持久化（IMG-06）
 *
 * 职责：
 *   - 接收图片二进制 + ownerType + ownerId + (kind)
 *   - mimetype 白名单 + 大小上限校验
 *   - 计算 sha256(buf).slice(0,8) 作为 key hash 段（防 CDN 缓存不一致）
 *   - 根据运行时 provider 存储 → 返回前台可展示的 URL
 *   - 提供 delete(key) 供上层补偿删除
 *
 * Provider 两种（运行时自动决定）：
 *   1. R2StorageProvider — R2 三件套 env 齐全时启用
 *      公开 URL 用 R2_PUBLIC_BASE_URL（R2.dev 子域名 / CNAME / Cloudflare Images fetch 源）
 *      未配 R2_PUBLIC_BASE_URL 时回退 R2_ENDPOINT 并 stderr warn（注意：R2_ENDPOINT
 *      是 S3 API endpoint，通常不是浏览器可公开访问的资源域名；仅兼容字幕历史行为）
 *   2. LocalFsStorageProvider — R2 未配时的本地开发 fallback
 *      写入 LOCAL_UPLOAD_DIR（默认 .uploads）+ 挂载到 GET /v1/uploads/*
 *      公开 URL 用 LOCAL_UPLOAD_PUBLIC_URL（默认 http://localhost:3001/v1/uploads）
 *      不引入 `@fastify/static`，由 adminMediaRoutes 自写路由返回文件
 *
 * 边界：
 *   - 不写 DB（videos / home_banners 字段由 MediaImageService 组合写）
 *   - 不入队 blurhash job（由 MediaImageService 按 ownerType/kind 决策）
 *   - 不做 orphan cleanup（TODO: 未来 maintenance job 清理孤立对象）
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { createHash } from 'node:crypto'
import { createReadStream, type ReadStream } from 'node:fs'
import { mkdir, stat, writeFile, unlink } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import type { ImageKind } from '@/types'

// ── Provider 抽象 ─────────────────────────────────────────────────

interface StorageProvider {
  readonly label: 'r2' | 'local-fs'
  write(key: string, buffer: Buffer, contentType: string): Promise<void>
  remove(key: string): Promise<void>
  publicUrl(key: string): string
}

// ── R2 Provider ───────────────────────────────────────────────────

class R2StorageProvider implements StorageProvider {
  readonly label = 'r2' as const
  private publicBaseWarned = false

  constructor(
    private client: S3Client,
    private bucket: string,
  ) {}

  async write(key: string, buffer: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    )
  }

  async remove(key: string): Promise<void> {
    if (!key) return
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      process.stderr.write(
        `[ImageStorageService] R2 delete failed key=${key}: ${msg}\n`,
      )
      // TODO: orphan cleanup maintenance job 未来兜底
    }
  }

  publicUrl(key: string): string {
    const publicBase = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, '')
    if (publicBase) {
      return `${publicBase}/${key}`
    }
    if (!this.publicBaseWarned) {
      process.stderr.write(
        '[ImageStorageService] R2_PUBLIC_BASE_URL not set; falling back to R2_ENDPOINT. ' +
        '注意：R2_ENDPOINT 是 S3 API endpoint，通常不是浏览器可公开访问的资源域名。' +
        '请配置 R2_PUBLIC_BASE_URL（R2.dev 子域名或 CNAME）以让前台能展示图片。\n',
      )
      this.publicBaseWarned = true
    }
    const endpoint = (process.env.R2_ENDPOINT ?? '').replace(/\/+$/, '')
    return `${endpoint}/${this.bucket}/${key}`
  }
}

// ── 本地 FS Provider ──────────────────────────────────────────────

class LocalFsStorageProvider implements StorageProvider {
  readonly label = 'local-fs' as const

  constructor(
    private baseDir: string,
    private baseUrl: string,
  ) {}

  async write(key: string, buffer: Buffer, _contentType: string): Promise<void> {
    const fullPath = this.resolveSafePath(key)
    await mkdir(dirname(fullPath), { recursive: true })
    await writeFile(fullPath, buffer)
  }

  async remove(key: string): Promise<void> {
    if (!key) return
    try {
      const fullPath = this.resolveSafePath(key)
      await unlink(fullPath)
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') {
        const msg = err instanceof Error ? err.message : String(err)
        process.stderr.write(
          `[ImageStorageService] local-fs delete failed key=${key}: ${msg}\n`,
        )
      }
    }
  }

  publicUrl(key: string): string {
    return `${this.baseUrl.replace(/\/+$/, '')}/${key}`
  }

  /** 防路径穿越 */
  private resolveSafePath(key: string): string {
    const base = resolve(this.baseDir)
    const joined = resolve(base, key)
    if (!joined.startsWith(base + '/') && joined !== base) {
      throw new ImageStorageError(
        `非法 key（疑似路径穿越）：${key}`,
        400,
        'INVALID_KEY',
      )
    }
    return joined
  }

  /** 供 route 层读文件时共享路径解析逻辑 */
  resolveFilePath(relativePath: string): string {
    return this.resolveSafePath(relativePath)
  }
}

// ── R2 客户端构造 ─────────────────────────────────────────────────

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

const KIND_TO_PREFIX: Record<ImageKind, string> = {
  poster:          'posters',
  backdrop:        'backdrops',
  logo:            'logos',
  banner_backdrop: 'banner-backdrops',
  stills:          'stills',
  thumbnail:       'thumbnails',
}

// ADR-051: route 层 `GET /uploads/*` 原本内联了扩展名映射 + fs I/O，
//          违反"Route 不含业务逻辑"分层；抽出到 Service 层供 route 纯 pipe
const EXT_TO_CONTENT_TYPE: Record<string, string> = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif':  'image/gif',
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
  /** 识别此次上传落地到哪个 provider，便于日志与 e2e 断言 */
  provider: 'r2' | 'local-fs'
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
  private provider: StorageProvider

  constructor(provider?: StorageProvider) {
    if (provider) {
      this.provider = provider
      return
    }
    const r2 = buildR2Client()
    if (r2) {
      const bucket = process.env.R2_IMAGES_BUCKET ?? 'resovo-images'
      this.provider = new R2StorageProvider(r2, bucket)
    } else {
      const baseDir = process.env.LOCAL_UPLOAD_DIR ?? '.uploads'
      // 默认指向 apps/api 的 port 4000（与 apps/server 的 NEXT_PUBLIC_API_URL 默认保持一致）
      // apps/server 跑在 3001（next dev -p 3001），不能作为 uploads base URL
      const baseUrl = process.env.LOCAL_UPLOAD_PUBLIC_URL ?? 'http://localhost:4000/v1/uploads'
      this.provider = new LocalFsStorageProvider(baseDir, baseUrl)
      process.stderr.write(
        `[ImageStorageService] R2 未配置，使用本地 FS fallback（${baseDir} → ${baseUrl}）；生产环境必须配置 R2 三件套\n`,
      )
    }
  }

  /** 当前 provider 标识 */
  getProviderLabel(): 'r2' | 'local-fs' {
    return this.provider.label
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
   * 上传图片 → 返回前台可展示的公开 URL
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

    const hash = createHash('sha256').update(input.buffer).digest('hex').slice(0, 8)
    const ext = MIME_TO_EXT[input.contentType] ?? 'bin'
    const key = this.buildKey(input, hash, ext)

    await this.provider.write(key, input.buffer, input.contentType)

    return {
      url: this.provider.publicUrl(key),
      key,
      contentType: input.contentType,
      size: input.buffer.length,
      hash,
      provider: this.provider.label,
    }
  }

  /**
   * 删除对象（供 MediaImageService 在写库失败后补偿回滚）
   */
  async delete(key: string): Promise<void> {
    await this.provider.remove(key)
  }

  /**
   * 供 route 层读取本地 fallback 文件；仅 LocalFsStorageProvider 有效
   * R2 provider 返 null，调用方应直接 302 到 provider 的公开 URL
   */
  resolveLocalFilePath(relativePath: string): string | null {
    if (this.provider instanceof LocalFsStorageProvider) {
      return this.provider.resolveFilePath(relativePath)
    }
    return null
  }

  /**
   * ADR-051: 返回本地 fallback 文件的可读流 + content-type + size
   *
   * Route 层只做 `reply.header + reply.send(stream)` pipe，不做 fs I/O
   * 业务逻辑（扩展名 → content-type 映射、路径穿越防御、ENOENT 处理）全在 Service
   *
   * @returns `{ stream, contentType, size }` 若文件存在；`null` 若：
   *   - R2 provider 下本地 fallback 关闭
   *   - 文件不存在（ENOENT）
   *   - path 为空
   * @throws `ImageStorageError(400, INVALID_KEY)` 路径穿越尝试
   */
  async serveLocalFile(
    relativePath: string,
  ): Promise<{ stream: ReadStream; contentType: string; size: number } | null> {
    if (!relativePath) return null
    const fullPath = this.resolveLocalFilePath(relativePath)
    if (!fullPath) return null // R2 provider 下本地 fallback 关闭

    try {
      const s = await stat(fullPath)
      if (!s.isFile()) return null
      const ext = extname(fullPath).toLowerCase()
      const contentType = EXT_TO_CONTENT_TYPE[ext] ?? 'application/octet-stream'
      return {
        stream: createReadStream(fullPath),
        contentType,
        size: s.size,
      }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ENOENT') return null
      throw err
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

// 导出 LocalFsStorageProvider 供测试 / route 内部类型收窄
export { LocalFsStorageProvider, R2StorageProvider }
export { KIND_TO_PREFIX, MIME_TO_EXT, MAX_FILE_SIZE, ALLOWED_MIMETYPES }

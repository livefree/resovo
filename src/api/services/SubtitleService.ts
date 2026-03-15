/**
 * SubtitleService.ts — 字幕上传与管理服务
 * SUBTITLE-01: 上传到 R2，写库
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import type { Pool } from 'pg'
import type { Subtitle, SubtitleFormat } from '@/types'
import { createSubtitle, findSubtitlesByVideoId } from '@/api/db/queries/subtitles'

// ── R2 客户端 ─────────────────────────────────────────────────────

function buildR2Client(): S3Client | null {
  const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env
  if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    return null  // R2 未配置，上传功能不可用
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

const MAX_FILE_SIZE = 2 * 1024 * 1024  // 2MB

const ALLOWED_FORMATS: SubtitleFormat[] = ['srt', 'ass', 'vtt']

const EXT_TO_FORMAT: Record<string, SubtitleFormat> = {
  '.srt': 'srt',
  '.ass': 'ass',
  '.vtt': 'vtt',
}

const LANGUAGE_LABELS: Record<string, string> = {
  'zh-CN': '中文简体',
  'zh-TW': '中文繁体',
  'en': '英文',
  'ja': '日文',
  'ko': '韩文',
  'fr': '法文',
  'de': '德文',
  'es': '西班牙文',
}

// ── SubtitleService 类 ────────────────────────────────────────────

export interface UploadSubtitleInput {
  videoId: string
  language: string         // BCP 47
  episodeNumber?: number   // 可选，电影不传
  filename: string         // 原始文件名（用于判断格式）
  buffer: Buffer           // 文件内容
}

export interface UploadSubtitleResult {
  subtitle: Subtitle
  fileUrl: string
}

export class SubtitleService {
  private r2: S3Client | null

  constructor(private db: Pool) {
    this.r2 = buildR2Client()
  }

  /**
   * 验证字幕文件格式和大小
   */
  validateFile(filename: string, size: number): { format: SubtitleFormat } {
    if (size > MAX_FILE_SIZE) {
      throw Object.assign(new Error('字幕文件不能超过 2MB'), { statusCode: 413 })
    }

    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
    const format = EXT_TO_FORMAT[ext]
    if (!format || !ALLOWED_FORMATS.includes(format)) {
      throw Object.assign(
        new Error(`不支持的格式：${ext}，仅支持 ${ALLOWED_FORMATS.join('、')}`),
        { statusCode: 422 }
      )
    }

    return { format }
  }

  /**
   * 上传字幕到 R2 并写入数据库
   */
  async upload(input: UploadSubtitleInput): Promise<UploadSubtitleResult> {
    const { format } = this.validateFile(input.filename, input.buffer.length)

    const bucket = process.env.R2_BUCKET ?? 'resovo-subtitles'
    const key = `subtitles/${input.videoId}/${input.language}${input.episodeNumber != null ? `-ep${input.episodeNumber}` : ''}.${format}`

    if (!this.r2) {
      // R2 未配置时使用占位 URL（开发环境）
      process.stderr.write('[SubtitleService] R2 not configured, using placeholder URL\n')
    } else {
      await this.r2.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: input.buffer,
          ContentType: this.getContentType(format),
        })
      )
    }

    const fileUrl = this.r2
      ? `${process.env.R2_ENDPOINT ?? ''}/${bucket}/${key}`
      : `https://r2.resovo.dev/${bucket}/${key}`

    const subtitle = await createSubtitle(this.db, {
      videoId: input.videoId,
      episodeNumber: input.episodeNumber ?? null,
      language: input.language,
      label: LANGUAGE_LABELS[input.language] ?? input.language,
      fileUrl,
      format,
    })

    return { subtitle, fileUrl }
  }

  /**
   * 获取视频字幕列表
   */
  async list(videoId: string, episode?: number): Promise<Subtitle[]> {
    return findSubtitlesByVideoId(this.db, videoId, episode)
  }

  private getContentType(format: SubtitleFormat): string {
    const map: Record<SubtitleFormat, string> = {
      vtt: 'text/vtt',
      srt: 'application/x-subrip',
      ass: 'text/x-ssa',
    }
    return map[format]
  }
}

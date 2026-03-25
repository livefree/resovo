/**
 * MigrationService.ts — 数据导入导出服务
 * CHG-31: 播放源 JSON 批量导入/导出
 */

import { z } from 'zod'
import type { Pool } from 'pg'
import { exportAllSources, type ExportedSource } from '@/api/db/queries/sources'
import { upsertSource } from '@/api/db/queries/sources'
import { findVideoIdByShortId } from '@/api/db/queries/videos'

// ── 导入记录的 Zod Schema ──────────────────────────────────────────

export const ImportSourceRecordSchema = z.object({
  shortId: z.string().min(1).max(50),
  sourceName: z.string().min(1).max(200),
  sourceUrl: z.string().url().max(2000),
  isActive: z.boolean().optional().default(true),
  type: z.enum(['hls', 'mp4', 'dash']).optional().default('hls'),
  episodeNumber: z.number().int().min(0).nullable().optional().default(null),
})

export type ImportSourceRecord = z.infer<typeof ImportSourceRecordSchema>

export interface ImportResult {
  imported: number
  skipped: number
  errors: Array<{ index: number; shortId?: string; error: string }>
}

// ── MigrationService ───────────────────────────────────────────────

export class MigrationService {
  constructor(private readonly db: Pool) {}

  /**
   * 导出所有播放源为 JSON 数组
   */
  async exportSources(): Promise<ExportedSource[]> {
    return exportAllSources(this.db)
  }

  /**
   * 批量导入播放源 JSON
   * - Zod 校验每条记录，单条失败不中断整批
   * - 按 video.short_id 查找视频，未找到视为 skip
   * - 已存在的 (video_id, source_url) 记录执行 upsert（ON CONFLICT 更新）
   */
  async importSources(rawRecords: unknown[]): Promise<ImportResult> {
    let imported = 0
    let skipped = 0
    const errors: ImportResult['errors'] = []

    for (let i = 0; i < rawRecords.length; i++) {
      const raw = rawRecords[i]
      const parsed = ImportSourceRecordSchema.safeParse(raw)

      if (!parsed.success) {
        errors.push({
          index: i,
          shortId: (raw as Record<string, unknown>)?.shortId as string | undefined,
          error: parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
        })
        continue
      }

      const { shortId, sourceName, sourceUrl, type, episodeNumber } = parsed.data

      const videoId = await findVideoIdByShortId(this.db, shortId)
      if (!videoId) {
        skipped++
        errors.push({ index: i, shortId, error: `视频 "${shortId}" 不存在，已跳过` })
        continue
      }

      try {
        await upsertSource(this.db, {
          videoId,
          sourceName,
          sourceUrl,
          type,
          episodeNumber: episodeNumber ?? 1,
        })
        imported++
      } catch (err) {
        errors.push({
          index: i,
          shortId,
          error: `写入失败: ${err instanceof Error ? err.message : String(err)}`,
        })
      }
    }

    return { imported, skipped, errors }
  }
}

/**
 * ImageHealthService.ts — 图片健康巡检业务层
 * 封装 imageHealthWorker / imageBlurhashWorker 的调用与协调。
 * 单次运行不超过 batchSize 张，worker 并发 + domain 限速由各 worker 内部控制。
 */

import type { Pool } from 'pg'
import type { ImageHealthQueue } from '@/api/workers/imageHealthWorker'
import {
  listPendingImageUrls,
  listMissingBlurhashUrls,
  updateCatalogImageStatus,
  getImageHealthStats,
  type ImageHealthStats,
} from '@/api/db/queries/imageHealth'
import type { ImageKind } from '@/types'

export type { ImageHealthStats }

export class ImageHealthService {
  constructor(private db: Pool) {}

  /** 将待检图 URL 批量入 imageHealthQueue */
  async enqueueHealthChecks(
    queue: ImageHealthQueue,
    batchSize = 200
  ): Promise<{ enqueued: number }> {
    const rows = await listPendingImageUrls(this.db, batchSize)
    if (rows.length === 0) return { enqueued: 0 }

    await Promise.all(
      rows.map(row =>
        queue.add(
          'health-check',
          { type: 'health-check', ...row },
          { jobId: `health-check-${row.catalogId}-${row.kind}`, removeOnComplete: 50 }
        )
      )
    )
    return { enqueued: rows.length }
  }

  /** 将缺 blurhash 的图片批量入 imageHealthQueue */
  async enqueueBlurhashExtract(
    queue: ImageHealthQueue,
    batchSize = 200
  ): Promise<{ enqueued: number }> {
    const rows = await listMissingBlurhashUrls(this.db, batchSize)
    if (rows.length === 0) return { enqueued: 0 }

    await Promise.all(
      rows.map(row =>
        queue.add(
          'blurhash-extract',
          { type: 'blurhash-extract', ...row },
          { jobId: `blurhash-${row.catalogId}-${row.kind}`, removeOnComplete: 50 }
        )
      )
    )
    return { enqueued: rows.length }
  }

  /** 批量标记图片状态（由 worker 回调时调用） */
  async applyStatusUpdates(
    updates: Array<{ catalogId: string; kind: ImageKind; status: string }>
  ): Promise<void> {
    const filtered = updates.filter(u =>
      ['poster', 'backdrop', 'logo', 'banner_backdrop'].includes(u.kind)
    )
    await updateCatalogImageStatus(
      this.db,
      filtered.map(u => ({
        catalogId: u.catalogId,
        kind: u.kind as 'poster' | 'backdrop' | 'logo' | 'banner_backdrop',
        status: u.status as import('@/types').ImageStatus,
      }))
    )
  }

  async getStats(): Promise<ImageHealthStats> {
    return getImageHealthStats(this.db)
  }
}

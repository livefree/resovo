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
  resolveImageEvents,
  getCatalogIdsByVideoIds,
  rescanPostersByCatalogIds,
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

  /**
   * ADR-209 D-209-2：批量标记破损事件已解决（route → service → query 守分层）。
   * 返回实际更新行数；resolvedCount=0（不存在/已解决）由 route 幂等处理、不报 404。
   */
  async resolveEvents(
    eventIds: string[],
    note?: string,
  ): Promise<{ resolvedCount: number }> {
    const resolvedCount = await resolveImageEvents(this.db, eventIds, note)
    return { resolvedCount }
  }

  /**
   * ADR-209 D-209-3：对选中视频精确重扫封面——scoped 闭环，禁全局副作用。
   * ① videoIds→distinct catalogIds ② scoped 重置 poster_status=pending_review（cover_url 守卫）
   * ③ 仅入队选中 catalog 的 pending 行（复用 worker dedup jobId）。
   * 纯 missing（无 cover_url）行被守卫跳过、不计 updatedCount。
   */
  async rescanSelectedVideos(
    queue: ImageHealthQueue,
    videoIds: string[],
  ): Promise<{ updatedCount: number; enqueuedCount: number; catalogIds: string[] }> {
    const catalogIds = await getCatalogIdsByVideoIds(this.db, videoIds)
    if (catalogIds.length === 0) {
      return { updatedCount: 0, enqueuedCount: 0, catalogIds: [] }
    }

    const { updatedCount } = await rescanPostersByCatalogIds(this.db, catalogIds)

    // 选中集 pending 行上界 = catalog 数 × 4 图种，limit 取上界保证不截断
    const rows = await listPendingImageUrls(this.db, catalogIds.length * 4, 0, catalogIds)
    await Promise.all(
      rows.map(row =>
        queue.add(
          'health-check',
          { type: 'health-check', ...row },
          { jobId: `health-check-${row.catalogId}-${row.kind}`, removeOnComplete: 50 },
        ),
      ),
    )

    return { updatedCount, enqueuedCount: rows.length, catalogIds }
  }
}

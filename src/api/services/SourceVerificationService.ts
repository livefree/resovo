/**
 * SourceVerificationService.ts — 失效源自动下架 + 自动补源触发（CHG-388）
 *
 * 职责：
 * 1. 查询孤岛视频（is_published=true + source_check_status='all_dead'）
 * 2. 对每条孤岛视频：
 *    a. 调用 transitionVideoState('unpublish') 自动下架
 *    b. 写 source_health_events(origin='island_detected')
 *    c. 通过 CrawlerRunService 推送 source-refetch Job
 * 3. 返回处理统计（unpublished / refetchEnqueued / skipped / failed）
 */

import type { Pool } from 'pg'
import * as sourcesQueries from '@/api/db/queries/sources'
import { transitionVideoState, bulkSyncSourceCheckStatus } from '@/api/db/queries/videos'
import { CrawlerRunService } from '@/api/services/CrawlerRunService'

export interface VerifyPublishedSourcesResult {
  unpublished: number
  refetchEnqueued: number
  skipped: number
  failed: number
}

export class SourceVerificationService {
  private runService: CrawlerRunService

  constructor(private db: Pool) {
    this.runService = new CrawlerRunService(db)
  }

  async verifyPublishedSources(batchLimit = 50): Promise<VerifyPublishedSourcesResult> {
    const result: VerifyPublishedSourcesResult = {
      unpublished: 0,
      refetchEnqueued: 0,
      skipped: 0,
      failed: 0,
    }

    // 先从 video_sources.is_active 聚合回写 source_check_status，
    // 确保 listIslandVideos 能读到最新失效状态而非仅依赖 MetadataEnrich 的快照
    await bulkSyncSourceCheckStatus(this.db, 'published', batchLimit * 10)

    const islands = await sourcesQueries.listIslandVideos(this.db, batchLimit)

    for (const video of islands) {
      try {
        // Step 1: unpublish（只允许 approved 状态）
        if (video.reviewStatus !== 'approved') {
          result.skipped++
          continue
        }

        const transitioned = await transitionVideoState(this.db, video.id, {
          action: 'unpublish',
          reviewedBy: 'system',
        })

        if (!transitioned) {
          result.skipped++
          continue
        }

        result.unpublished++

        // Step 2: 写 island_detected 事件
        await sourcesQueries.insertSourceHealthEvent(this.db, {
          videoId: video.id,
          origin: 'island_detected',
          oldStatus: 'public',
          newStatus: 'internal',
          triggeredBy: 'maintenance_worker',
        })

        // Step 3: 触发补源 Job
        try {
          await this.runService.createAndEnqueueRun({
            triggerType: 'all',
            mode: 'incremental',
            crawlMode: 'source-refetch',
            targetVideoId: video.id,
          })
          result.refetchEnqueued++
        } catch {
          // 补源入队失败不影响下架结果，只记录
          process.stderr.write(
            `[SourceVerificationService] refetch enqueue failed for ${video.id}\n`
          )
        }
      } catch (err) {
        result.failed++
        process.stderr.write(
          `[SourceVerificationService] error processing ${video.id}: ${
            err instanceof Error ? err.message : String(err)
          }\n`
        )
      }
    }

    return result
  }
}

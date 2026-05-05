/**
 * StagingPublishService.ts — 暂存发布服务
 * CHG-383: 就绪检查 + 单条/批量发布逻辑
 * CHG-401: ES 同步改用 VideoIndexSyncService
 */

import type { Pool } from 'pg'
import type { Client } from '@elastic/elasticsearch'
import * as stagingQueries from '@/api/db/queries/staging'
import * as videoQueries from '@/api/db/queries/videos'
import * as systemSettingsQueries from '@/api/db/queries/systemSettings'
import { VideoIndexSyncService } from '@/api/services/VideoIndexSyncService'
import { AuditLogService } from '@/api/services/AuditLogService'

export interface ReadinessResult {
  ready: boolean
  blockers: string[]
}

export class StagingPublishService {
  private readonly indexSync?: VideoIndexSyncService
  /** CHG-SN-4-10-A2：admin audit log（fire-and-forget） */
  private readonly auditSvc: AuditLogService

  constructor(
    private readonly db: Pool,
    private readonly es?: Client,
  ) {
    if (es) {
      this.indexSync = new VideoIndexSyncService(db, es)
    }
    this.auditSvc = new AuditLogService(db)
  }

  /** 从 system_settings 读取自动发布规则 */
  async getRules(): Promise<stagingQueries.StagingPublishRules> {
    const raw = await systemSettingsQueries.getSetting(this.db, 'auto_publish_staging_rules')
    if (!raw) return stagingQueries.DEFAULT_STAGING_RULES
    try {
      const parsed = JSON.parse(raw) as Partial<stagingQueries.StagingPublishRules>
      return {
        minMetaScore: parsed.minMetaScore ?? stagingQueries.DEFAULT_STAGING_RULES.minMetaScore,
        requireDoubanMatched: parsed.requireDoubanMatched ?? stagingQueries.DEFAULT_STAGING_RULES.requireDoubanMatched,
        requireCoverUrl: parsed.requireCoverUrl ?? stagingQueries.DEFAULT_STAGING_RULES.requireCoverUrl,
        minActiveSourceCount: parsed.minActiveSourceCount ?? stagingQueries.DEFAULT_STAGING_RULES.minActiveSourceCount,
      }
    } catch {
      return stagingQueries.DEFAULT_STAGING_RULES
    }
  }

  /** 保存规则到 system_settings */
  async saveRules(rules: stagingQueries.StagingPublishRules): Promise<void> {
    await systemSettingsQueries.setSetting(
      this.db,
      'auto_publish_staging_rules',
      JSON.stringify(rules),
    )
  }

  /** 计算单条视频的就绪状态 */
  checkReadiness(
    video: stagingQueries.StagingVideo,
    rules: stagingQueries.StagingPublishRules,
  ): ReadinessResult {
    const blockers: string[] = []

    if (video.metaScore < rules.minMetaScore) {
      blockers.push(`元数据评分 ${video.metaScore} 低于阈值 ${rules.minMetaScore}`)
    }
    if (rules.requireDoubanMatched && video.doubanStatus !== 'matched') {
      blockers.push(`豆瓣状态未匹配（当前：${video.doubanStatus}）`)
    }
    if (rules.requireCoverUrl && !video.coverUrl) {
      blockers.push('缺少封面图')
    }
    if (video.activeSourceCount < rules.minActiveSourceCount) {
      blockers.push(`活跃源数量 ${video.activeSourceCount} 低于要求 ${rules.minActiveSourceCount}`)
    }
    if (video.sourceCheckStatus === 'all_dead') {
      blockers.push('所有播放源均已失效')
    }

    return { ready: blockers.length === 0, blockers }
  }

  /** 手动发布单条暂存视频 */
  async publishSingle(videoId: string, publishedBy: string, requestId?: string): Promise<boolean> {
    // 预检：发布必须有活跃源，提前抛出友好错误（避免 DB 触发器技术性异常信息暴露给前端）
    const { rows: [sourceRow] } = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM video_sources
       WHERE video_id = $1 AND is_active = true AND deleted_at IS NULL`,
      [videoId],
    )
    if (parseInt(sourceRow?.count ?? '0', 10) === 0) {
      throw new Error('视频暂无活跃播放源，请先添加有效的视频源后再发布')
    }

    const row = await videoQueries.transitionVideoState(this.db, videoId, {
      action: 'publish',
      reviewedBy: publishedBy,
    })
    if (!row) return false
    void this.indexSync?.syncVideo(videoId)
    // CHG-SN-4-10-A2：审计日志（staging.publish）
    // published_at 由 DB trigger 写入，此处仅记 isPublished + 状态切换时刻
    this.auditSvc.write({
      actorId: publishedBy,
      actionType: 'staging.publish',
      targetKind: 'staging',
      targetId: videoId,
      afterJsonb: { isPublished: true, transitionedAt: row.updated_at },
      requestId,
    })
    return true
  }

  /**
   * 批量发布就绪视频
   * - 后台 Job 触发：triggeredBy 省略 → 不写 audit（系统操作走 Job log）
   * - 管理员手动触发（POST /admin/staging/batch-publish）：传 actorId → 写 audit
   * CHG-SN-4-10-A2：actor + audit 写 staging.batch_publish（按 plan §3.0.5
   * after = { ids: [], skipped: [] }）
   */
  async publishReadyBatch(
    maxBatch = 50,
    audit?: { actorId: string; requestId?: string },
  ): Promise<{ published: number; skipped: number; publishedIds: string[]; skippedIds: string[] }> {
    const rules = await this.getRules()
    const ids = await stagingQueries.listReadyStagingVideoIds(this.db, rules, maxBatch)

    let published = 0
    let skipped = 0
    const publishedIds: string[] = []
    const skippedIds: string[] = []
    for (const id of ids) {
      try {
        const row = await videoQueries.transitionVideoState(this.db, id, {
          action: 'publish',
        })
        if (row) {
          published++
          publishedIds.push(id)
          void this.indexSync?.syncVideo(id)
        } else {
          skipped++
          skippedIds.push(id)
        }
      } catch {
        skipped++
        skippedIds.push(id)
      }
    }

    await systemSettingsQueries.setSetting(
      this.db,
      'auto_publish_staging_last_run',
      new Date().toISOString(),
    )

    // CHG-SN-4-10-A2：admin 显式手动批量发布时写 audit log（system 自动 Job 不写）
    if (audit) {
      this.auditSvc.write({
        actorId: audit.actorId,
        actionType: 'staging.batch_publish',
        targetKind: 'staging',
        targetId: 'batch',
        afterJsonb: { ids: publishedIds, skipped: skippedIds },
        requestId: audit.requestId,
      })
    }

    return { published, skipped, publishedIds, skippedIds }
  }

}

/**
 * StagingPublishService.ts — 暂存发布服务
 * CHG-383: 就绪检查 + 单条/批量发布逻辑
 */

import type { Pool } from 'pg'
import type { Client } from '@elastic/elasticsearch'
import * as stagingQueries from '@/api/db/queries/staging'
import * as videoQueries from '@/api/db/queries/videos'
import * as systemSettingsQueries from '@/api/db/queries/systemSettings'

export interface ReadinessResult {
  ready: boolean
  blockers: string[]
}

export class StagingPublishService {
  constructor(
    private readonly db: Pool,
    private readonly es?: Client,
  ) {}

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
  async publishSingle(videoId: string, publishedBy: string): Promise<boolean> {
    const row = await videoQueries.transitionVideoState(this.db, videoId, {
      action: 'publish',
      reviewedBy: publishedBy,
    })
    if (!row) return false
    if (this.es) {
      void this.indexToES(videoId)
    }
    return true
  }

  /** 自动批量发布就绪视频（Job 调用） */
  async publishReadyBatch(maxBatch = 50): Promise<{ published: number; skipped: number }> {
    const rules = await this.getRules()
    const ids = await stagingQueries.listReadyStagingVideoIds(this.db, rules, maxBatch)

    let published = 0
    let skipped = 0
    for (const id of ids) {
      try {
        const row = await videoQueries.transitionVideoState(this.db, id, {
          action: 'publish',
        })
        if (row) {
          published++
          if (this.es) void this.indexToES(id)
        } else {
          skipped++
        }
      } catch {
        skipped++
      }
    }

    await systemSettingsQueries.setSetting(
      this.db,
      'auto_publish_staging_last_run',
      new Date().toISOString(),
    )

    return { published, skipped }
  }

  private async indexToES(videoId: string): Promise<void> {
    if (!this.es) return
    try {
      const result = await this.db.query<{
        id: string; title: string; type: string
        review_status: string; visibility_status: string; is_published: boolean
      }>(
        `SELECT id, title, type, review_status, visibility_status, is_published
         FROM videos WHERE id = $1`,
        [videoId],
      )
      const v = result.rows[0]
      if (!v) return
      await this.es.index({
        index: 'videos',
        id: v.id,
        document: v,
      })
    } catch {
      // ES 同步失败不影响主流程
    }
  }
}

/**
 * SourceService.ts — 播放源业务逻辑
 * ADR-001: 只返回 source_url 直链，不做任何代理或转发
 *
 * CHG-352 / route-labeling Phase 1 Layer A（2026-05-27）：
 *   listSources() 按 effective_score 排序返回（取代旧 created_at ASC 顺序）
 *   公式纯函数：apps/api/src/lib/route-scoring.ts
 *   arch-reviewer (claude-opus-4-7) A-CONDITIONAL → 3 红线 + 4 黄线全采纳：
 *     - R1: VideoSource.effectiveScore 可选字段（防破坏 5 处消费方）
 *     - R3: 公式抽到 lib 纯模块（本文件仅消费）
 *     - A1: Service 层 + JS sort（不放 SQL CASE WHEN）
 *     - D1: dead 自然末尾排序（公式天然成立 / 不需特殊处理）
 *     - E1: 仅前台 listSources 改 / admin SourcesMatrixService 不动（Phase 3 再扩）
 */

import type { Pool } from 'pg'
import type { VideoSource } from '@/types'
import * as sourceQueries from '@/api/db/queries/sources'
import * as videoQueries from '@/api/db/queries/videos'
import { calculateEffectiveScore, type RouteQuality } from '@/api/lib/route-scoring'

export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND'
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class SourceService {
  constructor(private db: Pool) {}

  /**
   * 获取视频播放源列表（按 effective_score 排序 / 最优线路排前）
   * ADR-001: 返回直链，不做代理
   * CHG-352: effectiveScore 字段透出供前台 SourceBar 消费（arch-reviewer R1 可选字段）
   */
  async listSources(videoShortId: string, episode?: number): Promise<VideoSource[]> {
    // 先确认视频存在且已发布
    const video = await videoQueries.findVideoByShortId(this.db, videoShortId)
    if (!video) throw new NotFoundError('视频不存在')

    // 取含信号字段的 raw rows（不污染 mapSource / arch-reviewer I1）
    const rows = await sourceQueries.findActiveSourcesWithSignalsByVideoId(this.db, video.id, episode)

    // 计算 effectiveScore + 合成 VideoSource + 排序（A1 / 稳定排序 by created_at ASC fallback）
    const withScore = rows.map((row) => ({
      source: sourceQueries.mapSourceBase(row),
      effectiveScore: calculateEffectiveScore({
        probeStatus: row.probe_status,
        renderStatus: row.render_status,
        latencyMs: row.latency_ms,
        quality: (row.quality as RouteQuality) ?? null,
        qualityDetected: (row.quality_detected as RouteQuality) ?? null,
        // priorityBonus 默认 0（Migration 064 未落地 / arch-reviewer C1）
      }),
      createdAt: row.created_at,
    }))

    // 按 effective_score DESC 排序；同分按 created_at ASC 稳定（arch-reviewer A 决策）
    withScore.sort((a, b) => {
      if (b.effectiveScore !== a.effectiveScore) return b.effectiveScore - a.effectiveScore
      return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0
    })

    return withScore.map(({ source, effectiveScore }) => ({ ...source, effectiveScore }))
  }
}

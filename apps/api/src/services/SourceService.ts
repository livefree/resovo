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
   * ADR-160 AMENDMENT 2 D-160-AMD2-2: options.preview=true 时派发 admin preview 视频校验路径
   *   - 内部派发：findVideoByShortIdAdminPreview（放行 internal/hidden / 保留 deleted_at IS NULL 守卫）
   *   - sources query 自身按 video_id 查 / 无 visibility 过滤 / 同样工作
   *   - 既有调用 0 影响（options 可选 / undefined 即走 public 路径）
   */
  async listSources(
    videoShortId: string,
    episode?: number,
    options?: { preview?: boolean },
  ): Promise<VideoSource[]> {
    // 先确认视频存在且已发布（preview 模式走 admin preview 校验路径）
    const video = options?.preview
      ? await videoQueries.findVideoByShortIdAdminPreview(this.db, videoShortId)
      : await videoQueries.findVideoByShortId(this.db, videoShortId)
    if (!video) throw new NotFoundError('视频不存在')

    // 取含信号字段的 raw rows（不污染 mapSource / arch-reviewer I1）
    const rows = await sourceQueries.findActiveSourcesWithSignalsByVideoId(this.db, video.id, episode)

    // SRCHEALTH-P3-1：单次取 now 全源共用（map 内逐行 Date.now() 会让 age 基准不一致破坏排序稳定性）
    const now = Date.now()

    // 计算 effectiveScore + 合成 VideoSource + 排序（A1 / 稳定排序 by created_at ASC fallback）
    const withScore = rows.map((row) => ({
      source: sourceQueries.mapSourceBase(row),
      effectiveScore: calculateEffectiveScore({
        probeStatus: row.probe_status,
        renderStatus: row.render_status,
        latencyMs: row.latency_ms,
        quality: (row.quality as RouteQuality) ?? null,
        qualityDetected: (row.quality_detected as RouteQuality) ?? null,
        // CHG-368-B-A3 / ADR-164 D-164-3：Migration 079 落地后激活 priority 通道
        //   sla.priority 范围 0-100（DB CHECK 强制 / Migration 079）→ route-scoring 归一化 / 100
        //   LEFT JOIN miss 时 alias_priority 为 null → fallback 0（与 Phase 1 行为一致 / 无回归）
        priorityBonus: row.alias_priority !== null ? row.alias_priority / 100 : 0,
        // SRCHEALTH-P3-1 双时钟新鲜度衰减（D3）：probe/render 子项分别按各自时间戳衰减
        lastProbedAt: row.last_probed_at,
        lastRenderedAt: row.last_rendered_at,
        now,
      }),
      hostTripped: row.host_tripped,
      createdAt: row.created_at,
    }))

    // SRCHEALTH-P3-3-B2（arch-reviewer claude-opus-4-8 裁决 C2）：熔断排序分桶——
    //   tripped 桶整体后置（熔断 = 整台 CDN 此刻不可达的强信号，熔断 ok 源排在非熔断
    //   dead 源之后），桶内保原 effectiveScore 序；不修改 effectiveScore 数值
    //   （降权在排序维度，与 route-scoring / P3-2 影子验证数值轴完全正交）。
    // 桶内沿用：effective_score DESC；同分 created_at ASC 稳定（arch-reviewer A 决策）
    withScore.sort((a, b) => {
      if (a.hostTripped !== b.hostTripped) return a.hostTripped ? 1 : -1
      if (b.effectiveScore !== a.effectiveScore) return b.effectiveScore - a.effectiveScore
      return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0
    })

    return withScore.map(({ source, effectiveScore, hostTripped }) =>
      ({ ...source, effectiveScore, hostTripped }))
  }
}

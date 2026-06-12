/**
 * enqueueVideoRescore.ts — 外部 ID 绑定后定向重评入队（BUGFIX-IDENTITY-ENRICH-RESCORE）
 *
 * 背景：ingest shadow scoring 是一次性快照（D-105a-16），enrichment 异步补强外部 ID
 * 证据后无重评机制 → 同名视频对因 ingest 时刻证据不足永久缺席 identity 候选。
 * 本 helper 由各 enrichment ref 写入完成位点 fire-and-forget 调用（容错范式沿
 * ingestShadow：失败仅 warn，不阻断 enrichment 主流程）。
 *
 * 挂钩裁定：仅 auto_matched / manual_confirmed 完成点入队；candidate 降级不入队
 * （externalIdLoader 双源——catalog 外部 ID 列 + is_primary manual_confirmed refs——
 * 均不认 candidate，证据面不变，重评必 noop）。
 *
 * jobId 按 videoId 固定：同视频短窗内重复绑定（如 douban+bangumi 接连 enrich）
 * 在前一 job 未完成时自动去抖；removeOnComplete 后可再次入队。
 */

import { identityCandidateQueue } from '@/api/lib/queue'
import { baseLogger } from '@/api/lib/logger'

export function enqueueIdentityVideoRescore(videoId: string): void {
  identityCandidateQueue
    .add(
      { type: 'video-rescore' as const, videoIds: [videoId] },
      { jobId: `video-rescore-${videoId}`, removeOnComplete: 20, removeOnFail: 10 },
    )
    .catch((err: unknown) => {
      baseLogger.warn(
        { err, video_id: videoId },
        '[identity] enqueue video-rescore failed (enrichment 主流程不受影响)',
      )
    })
}

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
 * 不设固定 jobId 去抖（Codex stop-time review FIX）：Bull 固定 jobId 在该 job 仍存于
 * completed/failed 历史时（removeOnComplete: N 为「保留最近 N 个」，低流量下长期驻留）
 * 会静默吞掉后续 add → 同视频后续绑定（douban 先 / bangumi 后等）不再触发重评，
 * 变相复现本卡要修的空窗。重评为幂等 upsert（hash noop）且单视频 ≤50 对侧轻量，
 * 重复跑成本可忽略——正确性（每次证据变化必触发）优先于去抖节省。
 */

import { identityCandidateQueue } from '@/api/lib/queue'
import { baseLogger } from '@/api/lib/logger'

export function enqueueIdentityVideoRescore(
  videoId: string,
  // GOV-4：标题变更位点传 'title_change'（migration 113）；缺省 'enrichment' 兼容既有调用方
  triggerSource: 'enrichment' | 'title_change' = 'enrichment',
): void {
  identityCandidateQueue
    .add(
      { type: 'video-rescore' as const, videoIds: [videoId], triggerSource },
      { removeOnComplete: 20, removeOnFail: 10 },
    )
    .catch((err: unknown) => {
      baseLogger.warn(
        { err, video_id: videoId, trigger_source: triggerSource },
        '[identity] enqueue video-rescore failed (调用方主流程不受影响)',
      )
    })
}

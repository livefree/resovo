/**
 * media-probe 类型契约 — 视频源 manifest 解析 + playability 判定的唯一真源。
 *
 * SRCHEALTH-P1-3 / arch-reviewer (claude-opus-4-8) 裁决：
 * - MediaProbeStatus 是 render 判定专用三态（无 pending——判定永不产出「未测」；
 *   不复用 worker ProbeStatus 四态，避免污染穷尽性检查）。
 * - QualityDetected 与 packages/types 的 ResolutionTier / DB quality_detected
 *   CHECK 7 值（059 migration）同字面量集合；本包零包间依赖，结构兼容可直接赋值。
 *   worker types.ts 的 QualityDetected 已改为 re-export 本包（副本消除）。
 */

export type MediaProbeStatus = 'ok' | 'partial' | 'dead'

export type QualityDetected = '4K' | '2K' | '1080P' | '720P' | '480P' | '360P' | '240P'

export interface MediaProbeVerdict {
  readonly status: MediaProbeStatus
  readonly width: number | null
  readonly height: number | null
  readonly quality: QualityDetected | null
  readonly errorDetail: string | null
}

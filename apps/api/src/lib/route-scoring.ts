/**
 * route-scoring.ts — Layer A effective_score 纯函数模块（CHG-352 / route-labeling Phase 1）
 *
 * 真源：docs/designs/route-labeling-system.md §Layer A
 * arch-reviewer (claude-opus-4-7) R3：抽到独立 lib 而非 SourceService 私有
 *   理由：(1) 纯函数易单测（不依赖 Pool/Service 实例）
 *        (2) 未来 SourcesMatrixService (Phase 3) / SourceHealthWorker 可复用
 *        (3) packages/types 是类型层不应放运行时常量（拒 F2）
 *
 * 公式：
 *   effective_score = 0.50×health + 0.30×quality + 0.15×latency + 0.05×priority
 *   health        = probe_map × 0.4 + render_map × 0.6
 *   probe / render_map: dead→0.0, pending→0.3, partial→0.6, ok→1.0
 *
 * 校准（arch-reviewer 关键洞察 #3 数学验证）：
 *   max = 1.00（全 ok + 4K + ≤200ms + priority=1）
 *   min = 0.020（全 dead + 240P + >2s + priority=0）
 *   中性 = 0.345（全 NULL/pending）
 *   pending 行（0.345）< probe=ok+240P+slow（0.530）但 > dead+4K+fast（0.45）— 期望行为
 */

// ── 类型 ────────────────────────────────────────────────────────────

export type DualSignalStatus = 'dead' | 'pending' | 'partial' | 'ok'

export type RouteQuality = '4K' | '2K' | '1080P' | '720P' | '480P' | '360P' | '240P' | null

export interface EffectiveScoreInput {
  /** probe 探测状态（双轨之一）*/
  readonly probeStatus: DualSignalStatus | string
  /** render 渲染状态（双轨之二 / 权重更高）*/
  readonly renderStatus: DualSignalStatus | string
  /** 探测延迟 ms / NULL 取中性 0.5 */
  readonly latencyMs: number | null
  /** 配置画质（quality 字段 / fallback 用）*/
  readonly quality: RouteQuality
  /** 实测画质（quality_detected / 优先级最高）*/
  readonly qualityDetected: RouteQuality
  /** priority_bonus（0-100 归一化到 0-1 / Migration 064 未落地默认 0）*/
  readonly priorityBonus?: number
}

// ── 权重常量（arch-reviewer 评 PASS / 与设计稿 100% 对齐）─────────────

export const WEIGHTS = {
  health: 0.5,
  quality: 0.3,
  latency: 0.15,
  priority: 0.05,
} as const

// ── 档位映射 ────────────────────────────────────────────────────────

export const PROBE_SCORE_MAP: Readonly<Record<DualSignalStatus, number>> = {
  dead: 0.0,
  pending: 0.3,
  partial: 0.6,
  ok: 1.0,
}

export const RENDER_SCORE_MAP: Readonly<Record<DualSignalStatus, number>> = {
  dead: 0.0,
  pending: 0.3,
  partial: 0.6,
  ok: 1.0,
}

/** health 内部权重：render 比 probe 更影响用户体验（设计稿 §health_score）*/
const HEALTH_PROBE_WEIGHT = 0.4
const HEALTH_RENDER_WEIGHT = 0.6

export const QUALITY_SCORE_MAP: Readonly<Record<NonNullable<RouteQuality>, number>> = {
  '4K': 1.0,
  '2K': 0.85,
  '1080P': 0.7,
  '720P': 0.5,
  '480P': 0.3,
  '360P': 0.15,
  '240P': 0.05,
}

const QUALITY_NEUTRAL = 0.4
const LATENCY_NEUTRAL = 0.5

// ── 计算函数（纯）────────────────────────────────────────────────────

function probeScore(status: string): number {
  if (status in PROBE_SCORE_MAP) return PROBE_SCORE_MAP[status as DualSignalStatus]
  return PROBE_SCORE_MAP.pending
}

function renderScore(status: string): number {
  if (status in RENDER_SCORE_MAP) return RENDER_SCORE_MAP[status as DualSignalStatus]
  return RENDER_SCORE_MAP.pending
}

export function calculateHealthScore(probeStatus: string, renderStatus: string): number {
  return probeScore(probeStatus) * HEALTH_PROBE_WEIGHT
    + renderScore(renderStatus) * HEALTH_RENDER_WEIGHT
}

/**
 * 画质评分：quality_detected（实测）优先 / quality（配置）次之 / 都 NULL 取中性
 * arch-reviewer 红线 R2 单测要求 fallback 链验证
 */
export function calculateQualityScore(quality: RouteQuality, qualityDetected: RouteQuality): number {
  if (qualityDetected != null && qualityDetected in QUALITY_SCORE_MAP) {
    return QUALITY_SCORE_MAP[qualityDetected]
  }
  if (quality != null && quality in QUALITY_SCORE_MAP) {
    return QUALITY_SCORE_MAP[quality]
  }
  return QUALITY_NEUTRAL
}

/**
 * 延迟评分：分段映射 / NULL 取中性
 * 边界：≤200 / ≤500 / ≤1000 / ≤2000 / >2000
 */
export function calculateLatencyScore(latencyMs: number | null): number {
  if (latencyMs == null) return LATENCY_NEUTRAL
  if (latencyMs <= 200) return 1.0
  if (latencyMs <= 500) return 0.7
  if (latencyMs <= 1000) return 0.5
  if (latencyMs <= 2000) return 0.3
  return 0.1
}

/**
 * effective_score 主计算函数（0.0–1.0）
 * 公式：0.5×health + 0.3×quality + 0.15×latency + 0.05×priority
 */
export function calculateEffectiveScore(input: EffectiveScoreInput): number {
  const health = calculateHealthScore(input.probeStatus, input.renderStatus)
  const quality = calculateQualityScore(input.quality, input.qualityDetected)
  const latency = calculateLatencyScore(input.latencyMs)
  const priority = input.priorityBonus ?? 0  // Migration 064 未落地默认 0（arch-reviewer C1）

  return WEIGHTS.health * health
    + WEIGHTS.quality * quality
    + WEIGHTS.latency * latency
    + WEIGHTS.priority * priority
}

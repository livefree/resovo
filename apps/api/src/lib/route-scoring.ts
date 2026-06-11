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
  /**
   * SRCHEALTH-P3-1 双时钟新鲜度衰减（arch-reviewer claude-opus-4-8 裁决 C）：
   * undefined = 调用方未传（向后兼容，不衰减 = Phase 1 数学）；
   * null = 从未探测/渲染（status 必为 pending 0.3 = STALE_TARGET，短路恒等）。
   */
  readonly lastProbedAt?: string | null
  readonly lastRenderedAt?: string | null
  /** 纯函数可测性：当前时刻 epoch ms 由调用方注入（同批源共用单一 now 保排序基准一致）；undefined → 整体不衰减 */
  readonly now?: number
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

// ── 双时钟新鲜度衰减常量（SRCHEALTH-P3-1 / D3，arch-reviewer claude-opus-4-8 裁决 A/B）──
// 进代码不进 env（P2-2 半衰先例：调参须配合 P3-2 影子验证）。
// 方案 §3 P3-1 行文「向中性值 0.345 回归」为轴混淆（0.345 是全因子总分中性），
// 子项轴正名 = pending 档 0.3（完全陈旧 ⇒ 信息价值等同从未探测）；dead 对称参与
// 衰减（0.0→0.3 有界回升：旧坏消息同样陈旧，auto-retire 180d 在 DB 层兜底退役）。
// T_render(168h) ≫ T_probe(72h)：level2 LIMIT 100 下单源 render 重测间隔达数百小时，
// 短 T 会把 health 主导项普遍压向中性 → 排序区分力坍缩（§7.2）。
// probe grace 6h 对齐 level1 cron 周期（正常节奏零惩罚）；render grace 0（暴露陈旧度即目的）。

export const FRESHNESS_DECAY = {
  STALE_TARGET: 0.3,
  T_PROBE_HOURS: 72,
  T_RENDER_HOURS: 168,
  PROBE_GRACE_HOURS: 6,
  RENDER_GRACE_HOURS: 0,
} as const

const MS_PER_HOUR = 3_600_000

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
 * 新鲜度指数衰减（SRCHEALTH-P3-1 纯函数）：子项分数随 age 向 STALE_TARGET(0.3) 回归。
 * decayed = target + (score − target) × 2^(−max(0, age − grace)/T)
 * 对 ok/partial(>target) 单调下降、对 dead(<target) 单调上升——连续/有界/单调，
 * 排序无不可解释跳变（§7.2）。负 age（时钟漂移/feedback 刚刷的未来戳）由
 * max(0, ·) 钳制，分数不会越过原档位。纯函数内禁止 Date.now()（now 由调用方注入）。
 */
export function applyFreshnessDecay(
  score: number,
  ageMs: number,
  halfLifeHours: number,
  graceHours: number,
): number {
  const target = FRESHNESS_DECAY.STALE_TARGET
  if (score === target) return score
  const effectiveAgeHours = Math.max(0, ageMs / MS_PER_HOUR - graceHours)
  if (effectiveAgeHours === 0) return score
  return target + (score - target) * Math.pow(2, -effectiveAgeHours / halfLifeHours)
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
 * SRCHEALTH-P3-1：health 双子项按双时钟分别衰减后合成（render 权重 0.6 共用单时钟
 * 会低估高权重子项陈旧度，§8.3）；now/时间戳 undefined → 不衰减（Phase 1 数学，
 * 既有校准 max=1.00/min=0.020/中性=0.345 三锚点定义不变——满健康 age=0 仍达原值）。
 */
export function calculateEffectiveScore(input: EffectiveScoreInput): number {
  let probe = probeScore(input.probeStatus)
  let render = renderScore(input.renderStatus)

  if (input.now !== undefined) {
    // null（从未探测 ⇒ pending 0.3 = target 恒等）与 undefined（未传）统一跳过
    if (input.lastProbedAt != null) {
      probe = applyFreshnessDecay(
        probe,
        Math.max(0, input.now - Date.parse(input.lastProbedAt)),
        FRESHNESS_DECAY.T_PROBE_HOURS,
        FRESHNESS_DECAY.PROBE_GRACE_HOURS,
      )
    }
    if (input.lastRenderedAt != null) {
      render = applyFreshnessDecay(
        render,
        Math.max(0, input.now - Date.parse(input.lastRenderedAt)),
        FRESHNESS_DECAY.T_RENDER_HOURS,
        FRESHNESS_DECAY.RENDER_GRACE_HOURS,
      )
    }
  }

  const health = probe * HEALTH_PROBE_WEIGHT + render * HEALTH_RENDER_WEIGHT
  const quality = calculateQualityScore(input.quality, input.qualityDetected)
  const latency = calculateLatencyScore(input.latencyMs)
  const priority = input.priorityBonus ?? 0  // Migration 064 未落地默认 0（arch-reviewer C1）

  return WEIGHTS.health * health
    + WEIGHTS.quality * quality
    + WEIGHTS.latency * latency
    + WEIGHTS.priority * priority
}

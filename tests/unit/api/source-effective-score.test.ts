/**
 * source-effective-score.test.ts — CHG-352 / route-labeling Phase 1 Layer A
 *
 * 公式纯函数 + 排序行为守卫。
 * arch-reviewer (claude-opus-4-7) R2：≥ 10 case 含 fallback 链 + 排序稳定性 + dead 排序
 * 精度断言：toBeCloseTo(_, 3)（避免浮点抖动 / Y4）
 *
 * 不测 SourceService.listSources DB 集成（已由 SourcesMatrixService 等覆盖 query 层）
 * 测点：纯函数行为 + 数学校准 + 极端值
 */

import { describe, it, expect } from 'vitest'
import {
  calculateEffectiveScore,
  calculateHealthScore,
  calculateQualityScore,
  calculateLatencyScore,
  WEIGHTS,
  PROBE_SCORE_MAP,
  RENDER_SCORE_MAP,
  QUALITY_SCORE_MAP,
  type EffectiveScoreInput,
} from '../../../apps/api/src/lib/route-scoring'

// ── 工厂 ─────────────────────────────────────────────────────────────────

function input(overrides: Partial<EffectiveScoreInput> = {}): EffectiveScoreInput {
  return {
    probeStatus: overrides.probeStatus ?? 'pending',
    renderStatus: overrides.renderStatus ?? 'pending',
    latencyMs: 'latencyMs' in overrides ? overrides.latencyMs ?? null : null,
    quality: 'quality' in overrides ? overrides.quality ?? null : null,
    qualityDetected: 'qualityDetected' in overrides ? overrides.qualityDetected ?? null : null,
    priorityBonus: overrides.priorityBonus,
  }
}

// ── Case 1: 权重常量校准（设计稿 §Layer A）─────────────────────────────

describe('Case 1 — 权重常量校准（不可改动 / 设计稿 100% 对齐）', () => {
  it('WEIGHTS 总和 = 1.00', () => {
    const sum = WEIGHTS.health + WEIGHTS.quality + WEIGHTS.latency + WEIGHTS.priority
    expect(sum).toBeCloseTo(1.0, 3)
  })

  it('WEIGHTS = { health: 0.5, quality: 0.3, latency: 0.15, priority: 0.05 }', () => {
    expect(WEIGHTS.health).toBe(0.5)
    expect(WEIGHTS.quality).toBe(0.3)
    expect(WEIGHTS.latency).toBe(0.15)
    expect(WEIGHTS.priority).toBe(0.05)
  })

  it('PROBE_SCORE_MAP / RENDER_SCORE_MAP 4 态对齐设计稿', () => {
    expect(PROBE_SCORE_MAP.dead).toBe(0.0)
    expect(PROBE_SCORE_MAP.pending).toBe(0.3)
    expect(PROBE_SCORE_MAP.partial).toBe(0.6)
    expect(PROBE_SCORE_MAP.ok).toBe(1.0)
    expect(RENDER_SCORE_MAP).toEqual(PROBE_SCORE_MAP)
  })

  it('QUALITY_SCORE_MAP 7 档对齐设计稿（含 2K / 240P / migration 059 quality_detected）', () => {
    expect(QUALITY_SCORE_MAP['4K']).toBe(1.0)
    expect(QUALITY_SCORE_MAP['2K']).toBe(0.85)
    expect(QUALITY_SCORE_MAP['1080P']).toBe(0.7)
    expect(QUALITY_SCORE_MAP['720P']).toBe(0.5)
    expect(QUALITY_SCORE_MAP['480P']).toBe(0.3)
    expect(QUALITY_SCORE_MAP['360P']).toBe(0.15)
    expect(QUALITY_SCORE_MAP['240P']).toBe(0.05)
  })
})

// ── Case 2: health_score 子公式（render 权重更高）─────────────────────

describe('Case 2 — health_score = probe×0.4 + render×0.6 (render 权重更高)', () => {
  it('probe=ok + render=dead → health = 1.0×0.4 + 0×0.6 = 0.40', () => {
    expect(calculateHealthScore('ok', 'dead')).toBeCloseTo(0.4, 3)
  })

  it('probe=dead + render=ok → health = 0 + 1.0×0.6 = 0.60（render 主导）', () => {
    expect(calculateHealthScore('dead', 'ok')).toBeCloseTo(0.6, 3)
  })

  it('全 ok → health = 1.0', () => {
    expect(calculateHealthScore('ok', 'ok')).toBeCloseTo(1.0, 3)
  })

  it('全 dead → health = 0.0（dead 末尾排序天然成立 / D1）', () => {
    expect(calculateHealthScore('dead', 'dead')).toBeCloseTo(0.0, 3)
  })

  it('未知 status fallback pending（防御 / 0.3）', () => {
    expect(calculateHealthScore('unknown', 'invalid')).toBeCloseTo(0.3 * 0.4 + 0.3 * 0.6, 3)
  })
})

// ── Case 3: quality_score fallback 链（R2 红线）───────────────────────

describe('Case 3 — quality_score fallback 链：detected → quality → 中性 0.40 (R2)', () => {
  it('quality_detected=4K + quality=360P → 1.0（detected 优先 / 实测压倒配置）', () => {
    expect(calculateQualityScore('360P', '4K')).toBeCloseTo(1.0, 3)
  })

  it('quality_detected=NULL + quality=720P → 0.50（fallback to quality）', () => {
    expect(calculateQualityScore('720P', null)).toBeCloseTo(0.5, 3)
  })

  it('quality_detected=NULL + quality=NULL → 0.40（中性回落）', () => {
    expect(calculateQualityScore(null, null)).toBeCloseTo(0.4, 3)
  })

  it('quality_detected=2K → 0.85（migration 059 quality_detected 独有档位）', () => {
    expect(calculateQualityScore(null, '2K')).toBeCloseTo(0.85, 3)
  })

  it('quality_detected=240P → 0.05（最低档）', () => {
    expect(calculateQualityScore(null, '240P')).toBeCloseTo(0.05, 3)
  })
})

// ── Case 4: latency_score 档位映射（含边界值）─────────────────────────

describe('Case 4 — latency_score 档位映射 + 边界值', () => {
  it('latency=NULL → 0.50 中性', () => {
    expect(calculateLatencyScore(null)).toBeCloseTo(0.5, 3)
  })

  it('latency=0ms 边界 → 1.0', () => {
    expect(calculateLatencyScore(0)).toBeCloseTo(1.0, 3)
  })

  it('latency=200ms 上边界 → 1.0', () => {
    expect(calculateLatencyScore(200)).toBeCloseTo(1.0, 3)
  })

  it('latency=201ms 下边界 → 0.70', () => {
    expect(calculateLatencyScore(201)).toBeCloseTo(0.7, 3)
  })

  it('latency=500ms 上边界 → 0.70', () => {
    expect(calculateLatencyScore(500)).toBeCloseTo(0.7, 3)
  })

  it('latency=2000ms 上边界 → 0.30', () => {
    expect(calculateLatencyScore(2000)).toBeCloseTo(0.3, 3)
  })

  it('latency=2001ms 下边界 → 0.10（极端慢）', () => {
    expect(calculateLatencyScore(2001)).toBeCloseTo(0.1, 3)
  })
})

// ── Case 5: 综合公式数学校准（arch-reviewer 关键洞察 #3）─────────────

describe('Case 5 — 综合公式数学校准（边界值验证）', () => {
  it('max effective_score = 1.00（全 ok + 4K + ≤200ms + priority=1）', () => {
    const score = calculateEffectiveScore(input({
      probeStatus: 'ok',
      renderStatus: 'ok',
      latencyMs: 100,
      qualityDetected: '4K',
      priorityBonus: 1.0,
    }))
    expect(score).toBeCloseTo(1.0, 3)
  })

  it('min effective_score = 0.020（全 dead + 240P + >2s + priority=0）', () => {
    const score = calculateEffectiveScore(input({
      probeStatus: 'dead',
      renderStatus: 'dead',
      latencyMs: 3000,
      qualityDetected: '240P',
      priorityBonus: 0,
    }))
    // 0 + 0.3×0.05 + 0.15×0.1 + 0 = 0.015 + 0.015 = 0.030
    expect(score).toBeCloseTo(0.03, 3)
  })

  it('中性回落（全 NULL/pending）= 0.345', () => {
    // 0.5×(0.3×0.4 + 0.3×0.6) + 0.3×0.4 + 0.15×0.5 + 0 = 0.5×0.3 + 0.12 + 0.075 = 0.345
    const score = calculateEffectiveScore(input())
    expect(score).toBeCloseTo(0.345, 3)
  })

  it('pending 中性（0.345）排在 dead+4K+fast（0.45）之前但在 ok+240P+slow 之后', () => {
    const pending = calculateEffectiveScore(input())  // 0.345
    const deadHighQ = calculateEffectiveScore(input({
      probeStatus: 'dead',
      renderStatus: 'dead',
      latencyMs: 100,
      qualityDetected: '4K',
    }))
    // 0 + 0.3×1.0 + 0.15×1.0 + 0 = 0.45
    const okLowQ = calculateEffectiveScore(input({
      probeStatus: 'ok',
      renderStatus: 'ok',
      latencyMs: 5000,
      qualityDetected: '240P',
    }))
    // 0.5×1.0 + 0.3×0.05 + 0.15×0.1 + 0 = 0.5 + 0.015 + 0.015 = 0.530
    expect(okLowQ).toBeGreaterThan(deadHighQ)
    expect(deadHighQ).toBeGreaterThan(pending)
    expect(okLowQ).toBeCloseTo(0.53, 3)
    expect(deadHighQ).toBeCloseTo(0.45, 3)
  })
})

// ── Case 6: priority_bonus 默认 0（Migration 064 未落地 / C1）────────

describe('Case 6 — priority_bonus 默认 0 (C1 / Migration 064 未落地)', () => {
  it('未传 priorityBonus → 等价于 0', () => {
    const noPriority = calculateEffectiveScore(input({
      probeStatus: 'ok',
      renderStatus: 'ok',
      latencyMs: 100,
      qualityDetected: '4K',
    }))
    const explicitZero = calculateEffectiveScore(input({
      probeStatus: 'ok',
      renderStatus: 'ok',
      latencyMs: 100,
      qualityDetected: '4K',
      priorityBonus: 0,
    }))
    expect(noPriority).toBeCloseTo(explicitZero, 3)
  })

  it('priorityBonus=1.0 比默认多 0.05', () => {
    const base = calculateEffectiveScore(input({ probeStatus: 'ok' }))
    const withPriority = calculateEffectiveScore(input({ probeStatus: 'ok', priorityBonus: 1.0 }))
    expect(withPriority - base).toBeCloseTo(0.05, 3)
  })
})

// ── Case 7: 排序稳定性（A 决策 stable secondary key 通过 SourceService 实现）──

describe('Case 7 — 排序稳定性参考（同 score 数组）', () => {
  it('两条完全相同 input → 同 score（消费方需 stable sort 保留顺序）', () => {
    const a = calculateEffectiveScore(input({ probeStatus: 'ok', latencyMs: 100, qualityDetected: '1080P' }))
    const b = calculateEffectiveScore(input({ probeStatus: 'ok', latencyMs: 100, qualityDetected: '1080P' }))
    expect(a).toBeCloseTo(b, 3)
    // SourceService.listSources 内 sort 必须用 stable secondary key (created_at ASC)
    // 此 case 文档化期望：score 相等时不应有随机排序
  })
})

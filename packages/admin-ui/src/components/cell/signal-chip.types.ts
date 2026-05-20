/**
 * signal-chip.types.ts — SignalChip 单路信号 Chip Props 契约（FIX-B）
 *
 * 真源：arch-reviewer (claude-opus-4-7) FIX-B API 设计（CHG-SN-7-MISC-MOD-PLAYER / SEQ-20260502-01）
 *
 * 与 DualSignal 的关系：
 *   - DualSignal = probe + render 垂直双行，用于线路聚合行概览
 *   - SignalChip = 单路信号，用于展开后每个 EpisodeMini 行的 probe / render 独立展示
 *
 * 设计语义：
 *   - variant='probe' → 探测信号，使用 `--dual-signal-probe(-soft)` token（与 DualSignal 一致）
 *   - variant='render' → 播放信号，使用 `--dual-signal-render(-soft)` token
 *   - state 决定文案；variant 决定配色
 *   - label 可覆盖默认「探/播 + 状态」组合文案
 *
 * 不变约束：颜色仅消费 packages/design-tokens；Edge Runtime 兼容
 */

import type { DualSignalDisplayState } from '@resovo/types'

/** 信号路别（决定配色 token） */
export type SignalChipVariant = 'probe' | 'render'

/** 尺寸（默认 'xs'；当前 Pill 固定 xxs 字号，size 供未来 Pill 扩展用 + 测试标记） */
export type SignalChipSize = 'xs' | 'sm'

export interface SignalChipProps {
  /** 信号状态（5 值：pending / ok / partial / dead / unknown） */
  readonly state: DualSignalDisplayState

  /** 路别：probe = 链接探测，render = 实际播放（决定配色） */
  readonly variant: SignalChipVariant

  /** 尺寸（默认 'xs'） */
  readonly size?: SignalChipSize

  /** 覆盖默认文案（默认「探/播 + 状态」，如"探 可用"；传入后完全替换 Pill children） */
  readonly label?: string

  /** 测试钩子 */
  readonly testId?: string
}

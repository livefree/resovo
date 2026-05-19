/**
 * segment.types.ts — Segment primitive 类型契约
 *
 * 真源：ADR-124 + screens-3.jsx:423-427 `.seg__btn` + `.badge` pill-style + reference.md §228/§886
 * 任务卡：CHG-SN-7-REDO-02-PRE-CARD-PRIMITIVE-A
 * Opus arch-reviewer 评 A 综合 / 0 红线 / 2 黄线 + 2 advisory（详 task card）
 *
 * 设计原则（D1-D6 Opus 决策）：
 *   - 仅受控（D1c / value + onChange 与 AdminSelect 单选范式一致）
 *   - badge: number | string 可选 / disabled 单项 + 容器双层
 *   - size 'sm' | 'md' | 'lg'（admin-ui 全家桶一致）
 *   - 完全 inline styles + tokens（D4a / 与 admin-card/button/select 同模式 / 0 .seg 全局类依赖）
 *   - WAI-ARIA tabs 单选 / activate-on-focus（D5）
 *   - 仅 pill 形态 / bottom-border 后续起独立 Tabs primitive 卡（D6a / 不耦合）
 */

import type { ReactNode } from 'react'

export type SegmentSize = 'sm' | 'md' | 'lg'

export interface SegmentItem {
  readonly value: string
  readonly label: ReactNode
  /** 右侧 badge（数字 / 字符串 / `99+` 等）；省略 → 不渲染 */
  readonly badge?: number | string
  readonly disabled?: boolean
}

export interface SegmentProps {
  readonly items: readonly SegmentItem[]
  readonly value: string
  readonly onChange: (next: string) => void
  /** 默认 'md' */
  readonly size?: SegmentSize
  /** 整体禁用（覆盖 item.disabled / 容器仍保留 tablist 语义 / advisory 2） */
  readonly disabled?: boolean
  readonly className?: string
  readonly 'aria-label'?: string
  readonly 'data-testid'?: string
}

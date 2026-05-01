'use client'

/**
 * vis-chip.tsx — VisChip 共享组件实装（CHG-DESIGN-12 12B）
 *
 * 真源：vis-chip.types.ts（12A Opus PASS 契约 + Codex stop-time fix 2 处 enum 真源对齐）
 *
 * 实装契约（12A 一致性硬约束）：
 *   - enum 字面镜像 packages/types：VisibilityStatus 'public|internal|hidden'，
 *     ReviewStatus 'pending_review|approved|rejected'
 *   - 5 派生分支（按优先级）：
 *     1. review === 'rejected'        → "已拒"     pill danger
 *     2. review === 'pending_review'  → "待审"     pill warn
 *     3. visibility === 'public'      → "前台可见"  pill ok
 *     4. visibility === 'internal'    → "仅内部"    pill neutral
 *     5. 其他（visibility='hidden'）   → "隐藏"     pill danger
 *   - 复用 Pill 渲染（一个 Pill 实例）；不重新实现 pill 视觉
 *   - aria-label 由派生文案 + raw 值组合（屏幕阅读器读复合语义）
 *
 * 固定 data attribute：data-vis-chip + data-visibility + data-review + data-derived
 */
import React from 'react'
import { Pill } from './pill'
import type { PillVariant } from './pill.types'
import type { VisChipProps, VisibilityStatus, ReviewStatus } from './vis-chip.types'

interface DerivedVis {
  readonly label: string
  readonly variant: PillVariant
  readonly key: 'rejected' | 'pending' | 'public' | 'internal' | 'hidden'
}

function deriveVis(visibility: VisibilityStatus, review: ReviewStatus): DerivedVis {
  // 派生优先级（与 12A 契约 + 设计稿 jsx 视觉映射等价）：
  // 1. review === 'rejected' → "已拒" danger
  if (review === 'rejected') {
    return { label: '已拒', variant: 'danger', key: 'rejected' }
  }
  // 2. review === 'pending_review' → "待审" warn
  if (review === 'pending_review') {
    return { label: '待审', variant: 'warn', key: 'pending' }
  }
  // 3. visibility === 'public' → "前台可见" ok
  if (visibility === 'public') {
    return { label: '前台可见', variant: 'ok', key: 'public' }
  }
  // 4. visibility === 'internal' → "仅内部" neutral
  if (visibility === 'internal') {
    return { label: '仅内部', variant: 'neutral', key: 'internal' }
  }
  // 5. 其他（包括 visibility='hidden'）→ "隐藏" danger
  return { label: '隐藏', variant: 'danger', key: 'hidden' }
}

export function VisChip({
  visibility,
  review,
  testId,
}: VisChipProps): React.ReactElement {
  const derived = deriveVis(visibility, review)
  // a11y 复合语义：派生文案 + raw 值（区分 "已拒 rejected" vs "隐藏 approved+hidden"）
  const ariaLabel = `${derived.label}（visibility=${visibility}, review=${review}）`

  return (
    <span
      data-vis-chip
      data-visibility={visibility}
      data-review={review}
      data-derived={derived.key}
      data-testid={testId}
    >
      <Pill variant={derived.variant} ariaLabel={ariaLabel}>
        {derived.label}
      </Pill>
    </span>
  )
}

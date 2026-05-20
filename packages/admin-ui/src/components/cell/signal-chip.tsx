'use client'

/**
 * signal-chip.tsx — SignalChip 单路信号 Chip 实装（FIX-B Stage B）
 *
 * 真源：signal-chip.types.ts（arch-reviewer Opus PASS 契约）
 *
 * 实装契约：
 *   - 复用 Pill 渲染：variant='probe' → Pill variant='probe'，'render' → Pill variant='render'
 *     （probe/render PillVariant 已定义 dual-signal-probe/render-soft 背景 + 主色前景）
 *   - state 决定文案：ok→可用 / partial→部分 / dead→失效 / pending→待测 / unknown→未测
 *   - 默认 label：`${prefix} ${stateText}`（probe → "探 可用"，render → "播 可用"）
 *   - size 记录 data-size（Pill 当前无 size prop；预留 token 供未来扩展）
 *
 * 固定 data attribute：data-signal-chip + data-variant + data-state + data-size
 */
import React from 'react'
import { Pill } from './pill'
import type { DualSignalDisplayState } from '@resovo/types'
import type { SignalChipProps } from './signal-chip.types'

function stateText(state: DualSignalDisplayState): string {
  switch (state) {
    case 'ok':      return '可用'
    case 'partial': return '部分'
    case 'dead':    return '失效'
    case 'pending': return '待测'
    case 'unknown':
    default:        return '未测'
  }
}

export function SignalChip({
  state,
  variant,
  size = 'xs',
  label,
  testId,
}: SignalChipProps): React.ReactElement {
  const text = stateText(state)
  const prefix = variant === 'probe' ? '探' : '播'
  const displayLabel = label ?? `${prefix} ${text}`
  const ariaLabel = `${variant === 'probe' ? '链接探测' : '实际播放'}：${text}`

  return (
    <span
      data-signal-chip
      data-variant={variant}
      data-state={state}
      data-size={size}
      data-testid={testId}
    >
      <Pill variant={variant} ariaLabel={ariaLabel}>
        {displayLabel}
      </Pill>
    </span>
  )
}

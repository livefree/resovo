'use client'

/**
 * bar-signal.tsx — BarSignal 共享组件实装（CHG-SN-4-04 D-14 第 1 件）
 *
 * 真源：bar-signal.types.ts（arch-reviewer Opus 2 轮 PASS 契约）
 *
 * 实装契约（契约一致性硬约束）：
 *   - 单一 SVG，两条矩形并排（左 probe / 右 render），间距由 size 决定
 *   - 颜色映射 5 值：ok → var(--state-success-fg) / partial → var(--state-warning-fg) /
 *     dead → var(--state-error-fg) / pending → var(--fg-muted) / unknown → var(--fg-muted) + opacity 0.4
 *   - size：'sm'（22×12 viewBox，柱宽 10）/ 'md'（32×16 viewBox，柱宽 13）；默认 'md'
 *   - forwardRef：onClick 存在 → 根元素 <button>（type="button" / 透明背景 / 键盘可达）；否则 <span>
 *   - 不接 i18n：ariaLabel prop 注入完整文案；缺省走中性兜底"探测/渲染信号"
 *
 * 固定 data attribute：
 *   - 根节点 `data-bar-signal`
 *   - 内部 svg rect `data-bar-signal-bar="probe|render"` + `data-bar-signal-state="<state>"`
 *   - testId 渲染为 data-testid（消费方钩子）
 */
import React, { forwardRef } from 'react'
import type { DualSignalDisplayState } from '@resovo/types'
import type { BarSignalProps } from './bar-signal.types'

interface SizeSpec {
  readonly width: number
  readonly height: number
  readonly barWidth: number
  readonly gap: number
}

const SIZE_SPECS: Record<NonNullable<BarSignalProps['size']>, SizeSpec> = {
  sm: { width: 22, height: 12, barWidth: 10, gap: 2 },
  md: { width: 32, height: 16, barWidth: 13, gap: 6 },
}

interface BarStyle {
  readonly fill: string
  readonly opacity: number
}

function barStyle(state: DualSignalDisplayState): BarStyle {
  switch (state) {
    case 'ok':       return { fill: 'var(--state-success-fg)', opacity: 1 }
    case 'partial':  return { fill: 'var(--state-warning-fg)', opacity: 1 }
    case 'dead':     return { fill: 'var(--state-error-fg)',   opacity: 1 }
    case 'pending':  return { fill: 'var(--fg-muted)',         opacity: 1 }
    case 'unknown':
    default:
      return { fill: 'var(--fg-muted)', opacity: 0.4 }
  }
}

const DEFAULT_ARIA_LABEL = '探测/渲染信号'
const RECT_RADIUS = 1.5

const BUTTON_RESET_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: 0,
  margin: 0,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  lineHeight: 0,
}

const SPAN_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  lineHeight: 0,
}

type Ref = HTMLButtonElement | HTMLSpanElement

export const BarSignal = forwardRef<Ref, BarSignalProps>(function BarSignal(
  { probeState, renderState, size = 'md', ariaLabel, onClick, testId },
  ref,
) {
  const spec = SIZE_SPECS[size]
  const probeStyleSpec = barStyle(probeState)
  const renderStyleSpec = barStyle(renderState)
  const label = ariaLabel ?? DEFAULT_ARIA_LABEL

  const probeX = (spec.width - spec.barWidth * 2 - spec.gap) / 2
  const renderX = probeX + spec.barWidth + spec.gap

  const svg = (
    <svg
      width={spec.width}
      height={spec.height}
      viewBox={`0 0 ${spec.width} ${spec.height}`}
      role="img"
      aria-label={label}
      style={{ display: 'block' }}
    >
      <rect
        data-bar-signal-bar="probe"
        data-bar-signal-state={probeState}
        x={probeX}
        y={0}
        width={spec.barWidth}
        height={spec.height}
        rx={RECT_RADIUS}
        ry={RECT_RADIUS}
        fill={probeStyleSpec.fill}
        opacity={probeStyleSpec.opacity}
      />
      <rect
        data-bar-signal-bar="render"
        data-bar-signal-state={renderState}
        x={renderX}
        y={0}
        width={spec.barWidth}
        height={spec.height}
        rx={RECT_RADIUS}
        ry={RECT_RADIUS}
        fill={renderStyleSpec.fill}
        opacity={renderStyleSpec.opacity}
      />
    </svg>
  )

  if (onClick) {
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        data-bar-signal
        data-bar-signal-size={size}
        data-testid={testId}
        aria-label={label}
        onClick={onClick}
        style={BUTTON_RESET_STYLE}
      >
        {svg}
      </button>
    )
  }

  return (
    <span
      ref={ref as React.Ref<HTMLSpanElement>}
      data-bar-signal
      data-bar-signal-size={size}
      data-testid={testId}
      style={SPAN_STYLE}
    >
      {svg}
    </span>
  )
})

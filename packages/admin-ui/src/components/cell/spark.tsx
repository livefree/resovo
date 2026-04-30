'use client'

/**
 * spark.tsx — Spark 共享组件实装（CHG-DESIGN-07 7B）
 *
 * 真源：spark.types.ts（7A Opus PASS 契约）+ reference.md §4.3 / §5.1.2
 *
 * 实装契约（7A 契约一致性硬约束）：
 *   - 0 数据点 → return null（无 DOM 节点 / 无 a11y 替代）
 *   - 1 数据点 → 渲染单点 dot（cy 居中），含 role=img + aria-label
 *   - N (≥2) 数据点 → polyline (line) / polygon (area)，含 role=img + aria-label
 *   - 颜色：仅消费 CSS 变量字符串（如 var(--accent-default)），不接受硬编码
 *   - opacity：本组件**不**注入容器 opacity；KpiCard 容器层应用 0.4
 *   - 自包含 svg path 计算（极简归一化），无外部依赖
 *
 * 归一化策略：
 *   - X 等距分布：x_i = (i / (N-1)) * width（N=1 时 x=width/2）
 *   - Y 翻转坐标系：value 高 → svg 顶（y 小）；value 低 → svg 底（y 大）
 *     y_i = height - normalize(value_i, min, max) * height
 *     min === max 时退化为水平居中线（避免除以 0）
 *
 * 固定 data attribute：
 *   - 根 svg 节点带 `data-spark`（与 admin-ui state primitives 风格一致）
 *   - 7B SHOULD：testId 渲染为 `data-testid={testId}`（消费方自定义钩子）
 */
import React from 'react'
import type { SparkProps } from './spark.types'

const DEFAULT_WIDTH = 60
const DEFAULT_HEIGHT = 18
const DEFAULT_STROKE_WIDTH = 1.5
const DEFAULT_COLOR = 'var(--accent-default)'
const DEFAULT_ARIA_LABEL = '趋势'
const AREA_FILL_OPACITY = 0.2

export function Spark({
  data,
  color = DEFAULT_COLOR,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  variant = 'line',
  strokeWidth = DEFAULT_STROKE_WIDTH,
  ariaLabel = DEFAULT_ARIA_LABEL,
  testId,
}: SparkProps): React.ReactElement | null {
  // 0 数据点契约：return null，无 DOM 节点
  if (data.length === 0) return null

  const points = computePoints(data, width, height)

  // 1 数据点：渲染单点 dot
  if (data.length === 1) {
    const [x, y] = points[0]!
    return (
      <svg
        data-spark
        data-testid={testId}
        role="img"
        aria-label={ariaLabel}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block' }}
      >
        <circle cx={x} cy={y} r={Math.max(strokeWidth, 1.5)} fill={color} />
      </svg>
    )
  }

  // N (≥2) 数据点：polyline / area
  const polylinePoints = points.map(([x, y]) => `${x},${y}`).join(' ')

  return (
    <svg
      data-spark
      data-testid={testId}
      role="img"
      aria-label={ariaLabel}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block' }}
    >
      {variant === 'area' && (
        <polygon
          data-spark-area
          points={`0,${height} ${polylinePoints} ${width},${height}`}
          fill={color}
          fillOpacity={AREA_FILL_OPACITY}
          stroke="none"
        />
      )}
      <polyline
        data-spark-line
        points={polylinePoints}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── 内部工具 ───────────────────────────────────────────────────

/**
 * 把 number[] 数据归一化为 svg viewBox 内的 [x, y] 点序列
 *
 * - X 等距分布：N=1 时居中；N≥2 时 0 → width 等距
 * - Y 翻转：value 高 → y 小（svg 顶部）；value 低 → y 大（svg 底部）
 * - min === max（所有点等值）时：所有 y 居中（避免除以 0）
 */
function computePoints(data: readonly number[], width: number, height: number): Array<[number, number]> {
  const n = data.length
  if (n === 0) return []
  if (n === 1) return [[width / 2, height / 2]]

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min

  return data.map((v, i) => {
    const x = (i / (n - 1)) * width
    const normalized = range === 0 ? 0.5 : (v - min) / range
    // y 翻转：normalized 1 → svg 顶（y=0），normalized 0 → svg 底（y=height）
    const y = height - normalized * height
    return [x, y]
  })
}

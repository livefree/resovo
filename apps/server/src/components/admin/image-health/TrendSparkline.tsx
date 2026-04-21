'use client'

import type { BrokenTrendPoint } from '@/services/image-health-stats.service'

interface TrendSparklineProps {
  data: BrokenTrendPoint[]
  height?: number
  className?: string
}

const PAD_X = 4
const PAD_Y = 4

export function TrendSparkline({ data, height = 40, className }: TrendSparklineProps) {
  if (data.length === 0) return null

  const width = 200
  const maxCount = Math.max(...data.map(d => d.count), 1)
  const points = data.map((d, i) => {
    const x = PAD_X + (i / Math.max(data.length - 1, 1)) * (width - PAD_X * 2)
    const y = PAD_Y + (1 - d.count / maxCount) * (height - PAD_Y * 2)
    return { x, y, ...d }
  })

  const polylinePoints = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  // 填充区域闭合路径（底边）
  const fillPath =
    `M ${points[0]!.x.toFixed(1)},${(height - PAD_Y).toFixed(1)} ` +
    points.map(p => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
    ` L ${points[points.length - 1]!.x.toFixed(1)},${(height - PAD_Y).toFixed(1)} Z`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden
      className={className}
      style={{ width: '100%', height, display: 'block', overflow: 'visible' }}
    >
      {/* 填充区 */}
      <path
        d={fillPath}
        fill="var(--status-danger)"
        fillOpacity={0.12}
        stroke="none"
      />
      {/* 折线 */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke="var(--status-danger)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* 数据点 */}
      {points.map((p) => (
        <circle
          key={p.date}
          cx={p.x.toFixed(1)}
          cy={p.y.toFixed(1)}
          r={2}
          fill="var(--status-danger)"
        />
      ))}
    </svg>
  )
}

/**
 * Spark 单测（CHG-DESIGN-07 7B）
 *
 * 覆盖 7A 契约硬约束：
 *   - 0 / 1 / N 数据点路径
 *   - line / area variant
 *   - 颜色 / 尺寸 / strokeWidth 注入
 *   - a11y role + aria-label
 *   - 固定 data-spark + 测试钩子
 */
import { afterEach, describe, it, expect } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import React from 'react'
import { Spark } from '../../../../../packages/admin-ui/src/components/cell/spark'

afterEach(() => {
  cleanup()
})

describe('Spark — 0 数据点契约', () => {
  it('data=[] → 不渲染任何 DOM 节点（return null）', () => {
    const { container } = render(<Spark data={[]} />)
    expect(container.querySelector('[data-spark]')).toBeNull()
    expect(container.querySelector('svg')).toBeNull()
    expect(container.firstChild).toBeNull()
  })

  it('data=[] + 显式 ariaLabel → 仍 return null（ariaLabel 不被消费）', () => {
    const { container } = render(<Spark data={[]} ariaLabel="无趋势" />)
    expect(container.querySelector('[role="img"]')).toBeNull()
    expect(container.querySelector('[aria-label="无趋势"]')).toBeNull()
  })
})

describe('Spark — 1 数据点路径', () => {
  it('data=[5] → 渲染单点 dot（svg + circle）', () => {
    const { container } = render(<Spark data={[5]} />)
    const svg = container.querySelector('[data-spark]')
    expect(svg?.tagName.toLowerCase()).toBe('svg')
    expect(svg?.querySelector('circle')).toBeTruthy()
    expect(svg?.querySelector('polyline')).toBeNull()
  })

  it('单点 dot 居中（cx=width/2, cy=height/2）', () => {
    const { container } = render(<Spark data={[7]} width={60} height={18} />)
    const circle = container.querySelector('circle')!
    expect(circle.getAttribute('cx')).toBe('30')
    expect(circle.getAttribute('cy')).toBe('9')
  })

  it('单点 dot 含 role=img + aria-label', () => {
    const { container } = render(<Spark data={[1]} ariaLabel="单点测试" />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toBe('单点测试')
  })
})

describe('Spark — N 数据点路径', () => {
  it('data=[1,2,3,4,5] → 渲染 polyline（line variant 默认）', () => {
    const { container } = render(<Spark data={[1, 2, 3, 4, 5]} />)
    const polyline = container.querySelector('[data-spark-line]')
    expect(polyline).toBeTruthy()
    expect(polyline?.tagName.toLowerCase()).toBe('polyline')
    // line variant 不渲染 polygon
    expect(container.querySelector('[data-spark-area]')).toBeNull()
  })

  it('variant=area → 渲染 polygon + polyline 双层', () => {
    const { container } = render(<Spark data={[1, 2, 3]} variant="area" />)
    expect(container.querySelector('[data-spark-area]')?.tagName.toLowerCase()).toBe('polygon')
    expect(container.querySelector('[data-spark-line]')?.tagName.toLowerCase()).toBe('polyline')
  })

  it('polyline points 等距分布 X 轴（5 点 → 0/15/30/45/60）', () => {
    const { container } = render(<Spark data={[10, 10, 10, 10, 10]} width={60} height={18} />)
    const points = container.querySelector('polyline')!.getAttribute('points')!
    const xs = points.split(' ').map((p) => Number(p.split(',')[0]))
    expect(xs).toEqual([0, 15, 30, 45, 60])
  })

  it('Y 翻转：max value → y 小（svg 顶）；min value → y 大（svg 底）', () => {
    const { container } = render(<Spark data={[0, 5, 10]} width={20} height={10} />)
    const points = container.querySelector('polyline')!.getAttribute('points')!
    const ys = points.split(' ').map((p) => Number(p.split(',')[1]))
    // value 0 (min) → y=10 (svg 底)；value 10 (max) → y=0 (svg 顶)
    expect(ys[0]).toBe(10)
    expect(ys[2]).toBe(0)
    // value 5 (中) → y=5
    expect(ys[1]).toBe(5)
  })

  it('all-equal data（min===max）→ 所有点 y 居中（避免除以 0）', () => {
    const { container } = render(<Spark data={[3, 3, 3]} width={60} height={18} />)
    const points = container.querySelector('polyline')!.getAttribute('points')!
    const ys = points.split(' ').map((p) => Number(p.split(',')[1]))
    // height/2 = 9
    expect(ys.every((y) => y === 9)).toBe(true)
  })
})

describe('Spark — 颜色 / 尺寸 / strokeWidth 注入', () => {
  it('color 默认 var(--accent-default)', () => {
    const { container } = render(<Spark data={[1, 2]} />)
    expect(container.querySelector('polyline')?.getAttribute('stroke')).toBe('var(--accent-default)')
  })

  it('color 自定义传入', () => {
    const { container } = render(<Spark data={[1, 2]} color="var(--state-warning-fg)" />)
    expect(container.querySelector('polyline')?.getAttribute('stroke')).toBe('var(--state-warning-fg)')
  })

  it('width / height 默认 60×18', () => {
    const { container } = render(<Spark data={[1, 2]} />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('width')).toBe('60')
    expect(svg.getAttribute('height')).toBe('18')
  })

  it('width / height 自定义', () => {
    const { container } = render(<Spark data={[1, 2]} width={120} height={40} />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('width')).toBe('120')
    expect(svg.getAttribute('height')).toBe('40')
  })

  it('strokeWidth 默认 1.5', () => {
    const { container } = render(<Spark data={[1, 2]} />)
    expect(container.querySelector('polyline')?.getAttribute('stroke-width')).toBe('1.5')
  })

  it('strokeWidth 自定义', () => {
    const { container } = render(<Spark data={[1, 2]} strokeWidth={2.5} />)
    expect(container.querySelector('polyline')?.getAttribute('stroke-width')).toBe('2.5')
  })
})

describe('Spark — a11y / 测试钩子', () => {
  it('ariaLabel 默认 "趋势"', () => {
    const { container } = render(<Spark data={[1, 2]} />)
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe('趋势')
  })

  it('ariaLabel 自定义', () => {
    const { container } = render(<Spark data={[1, 2]} ariaLabel="7 天访问量" />)
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe('7 天访问量')
  })

  it('testId → data-testid 渲染', () => {
    const { container } = render(<Spark data={[1, 2]} testId="kpi-spark-videos" />)
    expect(container.querySelector('[data-testid="kpi-spark-videos"]')).toBeTruthy()
  })

  it('area variant fillOpacity=0.2', () => {
    const { container } = render(<Spark data={[1, 2, 3]} variant="area" />)
    expect(container.querySelector('polygon')?.getAttribute('fill-opacity')).toBe('0.2')
  })
})

/**
 * KpiCard 单测（CHG-DESIGN-07 7B）
 *
 * 覆盖 7A 契约硬约束：
 *   - 4 variant（default / is-warn / is-danger / is-ok）容器 border + value 染色
 *   - 3 delta direction（up / down / flat）文本染色（独立于 variant）
 *   - variant + delta.direction 4 张 KPI 全部组合
 *   - spark slot null/undefined → footer 不渲染占位空白
 *   - dataSource: 'mock' → data-source attribute；undefined → 不渲染
 *   - onClick 提供 → button + 省略 → div
 *   - data-card-value（7C/7D regression gate 锚点）+ data-kpi-card 固定标记
 *   - icon slot
 *   - a11y aria-label 派生
 *   - dev warn for non-string value + missing ariaLabel
 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import React from 'react'
import { KpiCard } from '../../../../../packages/admin-ui/src/components/cell/kpi-card'
import { Spark } from '../../../../../packages/admin-ui/src/components/cell/spark'

afterEach(() => {
  cleanup()
})

describe('KpiCard — 基础渲染 + 固定 data attributes', () => {
  it('挂载 data-kpi-card + data-variant', () => {
    const { container } = render(<KpiCard label="视频总量" value="695" />)
    const card = container.querySelector('[data-kpi-card]')
    expect(card).toBeTruthy()
    expect(card?.getAttribute('data-variant')).toBe('default')
  })

  it('label / value 渲染', () => {
    const { container } = render(<KpiCard label="视频总量" value="695" />)
    expect(container.querySelector('[data-kpi-card-label]')?.textContent).toBe('视频总量')
    expect(container.querySelector('[data-card-value]')?.textContent).toBe('695')
  })

  it('value 复合 ReactNode（如 484 / 23）渲染', () => {
    const { container } = render(
      <KpiCard
        label="待审/暂存"
        ariaLabel="待审/暂存 484 / 23"
        value={<span>484 / 23</span>}
      />,
    )
    expect(container.querySelector('[data-card-value]')?.textContent).toBe('484 / 23')
  })

  it('未传 spark / icon / delta → 对应节点不渲染', () => {
    const { container } = render(<KpiCard label="L" value="1" />)
    expect(container.querySelector('[data-kpi-card-icon]')).toBeNull()
    expect(container.querySelector('[data-kpi-card-spark]')).toBeNull()
    expect(container.querySelector('[data-kpi-card-delta]')).toBeNull()
  })

  it('未传 onClick → 容器渲染为 div + role=group', () => {
    const { container } = render(<KpiCard label="L" value="1" />)
    const card = container.querySelector('[data-kpi-card]')!
    expect(card.tagName).toBe('DIV')
    expect(card.getAttribute('role')).toBe('group')
  })
})

describe('KpiCard — variant border + value 染色（4 值）', () => {
  it('default → border default + value fg-default', () => {
    const { container } = render(<KpiCard label="L" value="1" variant="default" />)
    const card = container.querySelector('[data-kpi-card]') as HTMLElement
    const value = container.querySelector('[data-card-value]') as HTMLElement
    expect(card.style.border).toContain('--border-default')
    expect(value.style.color).toContain('--fg-default')
  })

  it('is-warn → border state-warning-border + value state-warning-fg', () => {
    const { container } = render(<KpiCard label="L" value="1" variant="is-warn" />)
    const card = container.querySelector('[data-kpi-card]') as HTMLElement
    const value = container.querySelector('[data-card-value]') as HTMLElement
    expect(card.style.border).toContain('--state-warning-border')
    expect(value.style.color).toContain('--state-warning-fg')
  })

  it('is-danger → border state-error-border + value state-error-fg', () => {
    const { container } = render(<KpiCard label="L" value="1" variant="is-danger" />)
    const card = container.querySelector('[data-kpi-card]') as HTMLElement
    const value = container.querySelector('[data-card-value]') as HTMLElement
    expect(card.style.border).toContain('--state-error-border')
    expect(value.style.color).toContain('--state-error-fg')
  })

  it('is-ok → border state-success-border + value state-success-fg', () => {
    const { container } = render(<KpiCard label="L" value="1" variant="is-ok" />)
    const card = container.querySelector('[data-kpi-card]') as HTMLElement
    const value = container.querySelector('[data-card-value]') as HTMLElement
    expect(card.style.border).toContain('--state-success-border')
    expect(value.style.color).toContain('--state-success-fg')
  })

  it('data-variant attribute 与 variant prop 同步', () => {
    const { container } = render(<KpiCard label="L" value="1" variant="is-danger" />)
    expect(container.querySelector('[data-kpi-card]')?.getAttribute('data-variant')).toBe('is-danger')
  })
})

describe('KpiCard — delta direction 独立染色（3 值 + 省略）', () => {
  it('direction=up → state-success-fg', () => {
    const { container } = render(
      <KpiCard label="L" value="1" delta={{ text: '↑ +47', direction: 'up' }} />,
    )
    const delta = container.querySelector('[data-kpi-card-delta]') as HTMLElement
    expect(delta.style.color).toContain('--state-success-fg')
    expect(delta.getAttribute('data-direction')).toBe('up')
  })

  it('direction=down → state-error-fg', () => {
    const { container } = render(
      <KpiCard label="L" value="1" delta={{ text: '↓ -28', direction: 'down' }} />,
    )
    const delta = container.querySelector('[data-kpi-card-delta]') as HTMLElement
    expect(delta.style.color).toContain('--state-error-fg')
    expect(delta.getAttribute('data-direction')).toBe('down')
  })

  it('direction=flat → fg-muted', () => {
    const { container } = render(
      <KpiCard label="L" value="1" delta={{ text: '较昨日 +18', direction: 'flat' }} />,
    )
    const delta = container.querySelector('[data-kpi-card-delta]') as HTMLElement
    expect(delta.style.color).toContain('--fg-muted')
    expect(delta.getAttribute('data-direction')).toBe('flat')
  })

  it('direction 省略 → fg-muted + data-direction="flat"（等同 flat）', () => {
    const { container } = render(<KpiCard label="L" value="1" delta={{ text: '+18' }} />)
    const delta = container.querySelector('[data-kpi-card-delta]') as HTMLElement
    expect(delta.style.color).toContain('--fg-muted')
    expect(delta.getAttribute('data-direction')).toBe('flat')
  })

  it('delta.text 渲染原样（不注入箭头）', () => {
    const { container } = render(
      <KpiCard label="L" value="1" delta={{ text: '较昨日 +18', direction: 'flat' }} />,
    )
    expect(container.querySelector('[data-kpi-card-delta]')?.textContent).toBe('较昨日 +18')
  })
})

describe('KpiCard — variant × delta.direction 维度独立组合', () => {
  it('reference §5.1.2 视频总量：variant=default + delta direction=up', () => {
    const { container } = render(
      <KpiCard label="视频总量" value="695" variant="default" delta={{ text: '↑ +47 今日', direction: 'up' }} />,
    )
    const card = container.querySelector('[data-kpi-card]') as HTMLElement
    const value = container.querySelector('[data-card-value]') as HTMLElement
    const delta = container.querySelector('[data-kpi-card-delta]') as HTMLElement
    expect(card.style.border).toContain('--border-default')
    expect(value.style.color).toContain('--fg-default')
    expect(delta.style.color).toContain('--state-success-fg')
  })

  it('reference §5.1.2 待审/暂存：variant=is-warn + delta direction=flat', () => {
    const { container } = render(
      <KpiCard label="待审/暂存" value="484 / 23" variant="is-warn" delta={{ text: '较昨日 +18', direction: 'flat' }} />,
    )
    const card = container.querySelector('[data-kpi-card]') as HTMLElement
    const value = container.querySelector('[data-card-value]') as HTMLElement
    const delta = container.querySelector('[data-kpi-card-delta]') as HTMLElement
    expect(card.style.border).toContain('--state-warning-border')
    expect(value.style.color).toContain('--state-warning-fg')
    expect(delta.style.color).toContain('--fg-muted')
  })

  it('reference §5.1.2 失效源：variant=is-danger + delta direction=down', () => {
    const { container } = render(
      <KpiCard label="失效源" value="1,939" variant="is-danger" delta={{ text: '↓ -28 较昨日', direction: 'down' }} />,
    )
    const card = container.querySelector('[data-kpi-card]') as HTMLElement
    const value = container.querySelector('[data-card-value]') as HTMLElement
    const delta = container.querySelector('[data-kpi-card-delta]') as HTMLElement
    expect(card.style.border).toContain('--state-error-border')
    expect(value.style.color).toContain('--state-error-fg')
    expect(delta.style.color).toContain('--state-error-fg')
  })
})

describe('KpiCard — spark slot 行为契约', () => {
  it('spark 提供（非 null）→ 渲染 spark 容器 60×18 + opacity 0.4', () => {
    const { container } = render(
      <KpiCard label="L" value="1" spark={<svg data-test-spark width={60} height={18} />} />,
    )
    const slot = container.querySelector('[data-kpi-card-spark]') as HTMLElement
    expect(slot).toBeTruthy()
    expect(slot.style.width).toBe('60px')
    expect(slot.style.height).toBe('18px')
    expect(slot.style.opacity).toBe('0.4')
    expect(slot.querySelector('[data-test-spark]')).toBeTruthy()
  })

  it('spark 未传 → footer 不渲染 spark 占位空白', () => {
    const { container } = render(<KpiCard label="L" value="1" delta={{ text: '+1' }} />)
    expect(container.querySelector('[data-kpi-card-spark]')).toBeNull()
    // footer 仍渲染（delta 撑高）
    expect(container.querySelector('[data-kpi-card-footer]')).toBeTruthy()
  })

  it('spark={null} → footer 不渲染 spark 占位（与未传等效）', () => {
    const { container } = render(<KpiCard label="L" value="1" spark={null} />)
    expect(container.querySelector('[data-kpi-card-spark]')).toBeNull()
  })

  it('spark + delta 同时存在 → footer 左 delta + 右 spark', () => {
    const { container } = render(
      <KpiCard
        label="L"
        value="1"
        delta={{ text: '+1' }}
        spark={<svg data-test-spark />}
      />,
    )
    const footer = container.querySelector('[data-kpi-card-footer]')!
    expect(footer.querySelector('[data-kpi-card-delta]')).toBeTruthy()
    expect(footer.querySelector('[data-kpi-card-spark]')).toBeTruthy()
  })

  // 实装可证一致契约：父组件无法探测子 ReactNode 渲染结果，仅判断 prop truthy 性
  it('spark={<Spark data={[]} />}（ReactElement 渲染 null）→ slot 容器仍渲染（60×18），内部无 svg', () => {
    const { container } = render(
      <KpiCard label="L" value="1" spark={<Spark data={[]} />} />,
    )
    // slot 容器存在（spark prop 为 ReactElement truthy）
    const slot = container.querySelector('[data-kpi-card-spark]') as HTMLElement
    expect(slot).toBeTruthy()
    expect(slot.style.width).toBe('60px')
    expect(slot.style.height).toBe('18px')
    // 内部 svg 不存在（Spark data=[] return null）
    expect(slot.querySelector('[data-spark]')).toBeNull()
    expect(slot.querySelector('svg')).toBeNull()
  })

  it('footer min-height: 18px 兜底（无 spark 时 4 张 KPI 横向对齐）', () => {
    const { container } = render(<KpiCard label="L" value="1" delta={{ text: '+1' }} />)
    const footer = container.querySelector('[data-kpi-card-footer]') as HTMLElement
    expect(footer.style.minHeight).toBe('18px')
  })
})

describe('KpiCard — dataSource attribute', () => {
  it('未传 → 不渲染 data-source', () => {
    const { container } = render(<KpiCard label="L" value="1" />)
    expect(container.querySelector('[data-kpi-card]')?.hasAttribute('data-source')).toBe(false)
  })

  it("dataSource='mock' → 渲染 data-source='mock'", () => {
    const { container } = render(<KpiCard label="L" value="1" dataSource="mock" />)
    expect(container.querySelector('[data-kpi-card]')?.getAttribute('data-source')).toBe('mock')
  })

  it("dataSource='live' → 渲染 data-source='live'", () => {
    const { container } = render(<KpiCard label="L" value="1" dataSource="live" />)
    expect(container.querySelector('[data-kpi-card]')?.getAttribute('data-source')).toBe('live')
  })

  it('mock 标记不改变视觉（仍渲染正确 value）', () => {
    const { container } = render(<KpiCard label="L" value="42" dataSource="mock" />)
    expect(container.querySelector('[data-card-value]')?.textContent).toBe('42')
  })
})

describe('KpiCard — onClick / icon / a11y', () => {
  it('onClick 提供 → 容器渲染为 button + cursor pointer', () => {
    const onClick = vi.fn()
    const { container } = render(<KpiCard label="L" value="1" onClick={onClick} />)
    const card = container.querySelector('[data-kpi-card]') as HTMLButtonElement
    expect(card.tagName).toBe('BUTTON')
    expect(card.style.cursor).toBe('pointer')
    fireEvent.click(card)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('icon slot 渲染 + aria-hidden', () => {
    const { container } = render(
      <KpiCard label="L" value="1" icon={<span data-test-icon>★</span>} />,
    )
    const iconWrap = container.querySelector('[data-kpi-card-icon]')!
    expect(iconWrap.getAttribute('aria-hidden')).toBe('true')
    expect(iconWrap.querySelector('[data-test-icon]')).toBeTruthy()
  })

  it('ariaLabel 显式传 → 直接使用', () => {
    const { container } = render(<KpiCard label="L" value="1" ariaLabel="自定义无障碍标签" />)
    expect(container.querySelector('[data-kpi-card]')?.getAttribute('aria-label')).toBe('自定义无障碍标签')
  })

  it('ariaLabel 省略 + value 是 string → 派生 "label: value"', () => {
    const { container } = render(<KpiCard label="视频总量" value="695" />)
    expect(container.querySelector('[data-kpi-card]')?.getAttribute('aria-label')).toBe('视频总量: 695')
  })

  it('ariaLabel 省略 + value 是 number → 派生 "label: value"', () => {
    const { container } = render(<KpiCard label="视频总量" value={695} />)
    expect(container.querySelector('[data-kpi-card]')?.getAttribute('aria-label')).toBe('视频总量: 695')
  })

  it('testId → data-testid', () => {
    const { container } = render(<KpiCard label="L" value="1" testId="kpi-videos-total" />)
    expect(container.querySelector('[data-testid="kpi-videos-total"]')).toBeTruthy()
  })
})

describe('KpiCard — dev warn（non-primitive value + missing ariaLabel）', () => {
  it('value 是 ReactNode 且 ariaLabel 未传 → console.warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<KpiCard label="待审/暂存" value={<span>484 / 23</span>} />)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toMatch(/value is non-primitive ReactNode/)
    warn.mockRestore()
  })

  it('value 是 ReactNode 但 ariaLabel 显式传 → 不 warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<KpiCard label="L" value={<span>484 / 23</span>} ariaLabel="待审 484，暂存 23" />)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('value 是 string 且 ariaLabel 未传 → 不 warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<KpiCard label="L" value="42" />)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

/**
 * DecisionCard 单测（CHG-SN-4-04 D-14 第 5 件 · 跨层下沉例外 ADR-106）
 *
 * v1.6 patch（CHG-SN-4-FIX-A · plan v1.6 §1 G2'）：删除 BarSignal 渲染行 + onSignalClick
 *   prop；本测试同步移除 BarSignal / onSignalClick 相关 case。probeState/renderState 仍
 *   保留驱动决策建议 banner 三态推算（覆盖未变）。
 *
 * 覆盖契约硬约束：
 *   - DecisionCardVideo Pick 列表消费（id / title / reviewStatus / staffNote 等）
 *   - 决策建议三态推算（ok / warn / danger）
 *   - StaffNoteBar 条件渲染（仅 staffNote 非空 + onStaffNoteEdit 已传）
 *   - actions / header slot 渲染
 *   - onStaffNoteEdit 回调
 *   - forwardRef / testId / data-* 钩子
 *   - 颜色仅 var(--*) token（零硬编码）
 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { DecisionCard } from '../../../../../packages/admin-ui/src/components/cell/decision-card'
import type { DecisionCardVideo } from '../../../../../packages/admin-ui/src/components/cell/decision-card.types'

afterEach(() => cleanup())

const mkVideo = (overrides: Partial<DecisionCardVideo> = {}): DecisionCardVideo => ({
  id: 'v-1',
  title: '示例视频',
  reviewStatus: 'pending_review',
  visibilityStatus: 'internal',
  isPublished: false,
  staffNote: null,
  reviewLabelKey: null,
  sourceCheckStatus: 'pending',
  doubanStatus: 'pending',
  ...overrides,
})

describe('DecisionCard — 基础渲染', () => {
  it('挂载 data-decision-card + 渲染标题', () => {
    const { container } = render(
      <DecisionCard video={mkVideo({ title: '测试' })} probeState="ok" renderState="ok" />,
    )
    expect(container.querySelector('[data-decision-card]')).toBeTruthy()
    expect(screen.getByText('测试')).toBeTruthy()
  })

  it('v1.6 删除 BarSignal 渲染行 — 不渲染任何 [data-bar-signal] 节点', () => {
    const { container } = render(
      <DecisionCard video={mkVideo()} probeState="partial" renderState="dead" />,
    )
    expect(container.querySelector('[data-bar-signal]')).toBeNull()
    expect(container.querySelector('[data-decision-card-signal]')).toBeNull()
  })

  it('始终渲染决策建议条', () => {
    const { container } = render(
      <DecisionCard video={mkVideo()} probeState="ok" renderState="ok" />,
    )
    expect(container.querySelector('[data-decision-card-banner]')).toBeTruthy()
  })
})

describe('DecisionCard — 决策建议三态推算', () => {
  it('probe=ok + render=ok → tone=ok', () => {
    const { container } = render(
      <DecisionCard video={mkVideo()} probeState="ok" renderState="ok" />,
    )
    expect(
      container.querySelector('[data-decision-card]')?.getAttribute('data-decision-card-tone'),
    ).toBe('ok')
    expect(screen.getByText(/信号健康/)).toBeTruthy()
  })

  it('probe=dead + render=dead → tone=danger（建议拒绝）', () => {
    const { container } = render(
      <DecisionCard video={mkVideo()} probeState="dead" renderState="dead" />,
    )
    expect(
      container.querySelector('[data-decision-card]')?.getAttribute('data-decision-card-tone'),
    ).toBe('danger')
    expect(screen.getByText(/全线路失效/)).toBeTruthy()
  })

  it('probe=ok + render=dead（信号冲突）→ tone=warn', () => {
    const { container } = render(
      <DecisionCard video={mkVideo()} probeState="ok" renderState="dead" />,
    )
    expect(
      container.querySelector('[data-decision-card]')?.getAttribute('data-decision-card-tone'),
    ).toBe('warn')
    expect(screen.getByText(/信号冲突/)).toBeTruthy()
  })

  it('probe=partial + render=partial → tone=warn（部分失效）', () => {
    const { container } = render(
      <DecisionCard video={mkVideo()} probeState="partial" renderState="partial" />,
    )
    expect(
      container.querySelector('[data-decision-card]')?.getAttribute('data-decision-card-tone'),
    ).toBe('warn')
    expect(screen.getByText(/部分线路失效/)).toBeTruthy()
  })

  it('probe=pending + render=ok → tone=warn（信号未就绪）', () => {
    const { container } = render(
      <DecisionCard video={mkVideo()} probeState="pending" renderState="ok" />,
    )
    expect(
      container.querySelector('[data-decision-card]')?.getAttribute('data-decision-card-tone'),
    ).toBe('warn')
    expect(screen.getByText(/信号未就绪/)).toBeTruthy()
  })

  it('probe=ok + render=unknown → tone=warn（信号未就绪）', () => {
    const { container } = render(
      <DecisionCard video={mkVideo()} probeState="ok" renderState="unknown" />,
    )
    expect(
      container.querySelector('[data-decision-card]')?.getAttribute('data-decision-card-tone'),
    ).toBe('warn')
  })
})

describe('DecisionCard — StaffNoteBar 条件渲染', () => {
  it('staffNote 非空 + onStaffNoteEdit 已传 → 渲染 StaffNoteBar', () => {
    render(
      <DecisionCard
        video={mkVideo({ staffNote: '封面有水印' })}
        probeState="ok"
        renderState="ok"
        onStaffNoteEdit={() => {}}
      />,
    )
    expect(document.querySelector('[data-staff-note-bar]')).toBeTruthy()
    expect(screen.getByText('封面有水印')).toBeTruthy()
  })

  it('staffNote=null → 不渲染 StaffNoteBar', () => {
    render(
      <DecisionCard
        video={mkVideo({ staffNote: null })}
        probeState="ok"
        renderState="ok"
        onStaffNoteEdit={() => {}}
      />,
    )
    expect(document.querySelector('[data-staff-note-bar]')).toBeNull()
  })

  it('staffNote 非空但 onStaffNoteEdit 未传 → 不渲染 StaffNoteBar', () => {
    render(
      <DecisionCard
        video={mkVideo({ staffNote: '备注' })}
        probeState="ok"
        renderState="ok"
      />,
    )
    expect(document.querySelector('[data-staff-note-bar]')).toBeNull()
  })

  it('staffNote 全空白（trim 后空） → 不渲染', () => {
    render(
      <DecisionCard
        video={mkVideo({ staffNote: '   ' })}
        probeState="ok"
        renderState="ok"
        onStaffNoteEdit={() => {}}
      />,
    )
    expect(document.querySelector('[data-staff-note-bar]')).toBeNull()
  })

  it('点击编辑入口 → onStaffNoteEdit 被调用', () => {
    const onEdit = vi.fn()
    render(
      <DecisionCard
        video={mkVideo({ staffNote: '备注' })}
        probeState="ok"
        renderState="ok"
        onStaffNoteEdit={onEdit}
      />,
    )
    const trigger = document.querySelector('[data-staff-note-edit-trigger]') as HTMLButtonElement
    fireEvent.click(trigger)
    expect(onEdit).toHaveBeenCalledTimes(1)
  })
})

describe('DecisionCard — slot + 回调', () => {
  it('header slot 渲染', () => {
    const { container } = render(
      <DecisionCard
        video={mkVideo()}
        probeState="ok"
        renderState="ok"
        header={<span data-test-header>header content</span>}
      />,
    )
    const headerWrap = container.querySelector('[data-decision-card-header]')
    expect(headerWrap).toBeTruthy()
    expect(headerWrap?.querySelector('[data-test-header]')).toBeTruthy()
  })

  it('actions slot 渲染', () => {
    const { container } = render(
      <DecisionCard
        video={mkVideo()}
        probeState="ok"
        renderState="ok"
        actions={<button data-test-action>通过</button>}
      />,
    )
    const actionsWrap = container.querySelector('[data-decision-card-actions]')
    expect(actionsWrap).toBeTruthy()
    expect(actionsWrap?.querySelector('[data-test-action]')).toBeTruthy()
  })

  it('未传 header → 不渲染 header 容器', () => {
    const { container } = render(
      <DecisionCard video={mkVideo()} probeState="ok" renderState="ok" />,
    )
    expect(container.querySelector('[data-decision-card-header]')).toBeNull()
  })

  it('未传 actions → 不渲染 actions 容器', () => {
    const { container } = render(
      <DecisionCard video={mkVideo()} probeState="ok" renderState="ok" />,
    )
    expect(container.querySelector('[data-decision-card-actions]')).toBeNull()
  })

})

describe('DecisionCard — token + forwardRef + testId', () => {
  it('未硬编码颜色：决策条 background/border/color 走 var(--state-*)', () => {
    const { container } = render(
      <DecisionCard video={mkVideo()} probeState="dead" renderState="dead" />,
    )
    const banner = container.querySelector('[data-decision-card-banner]') as HTMLElement
    const style = banner.getAttribute('style') ?? ''
    expect(style).toMatch(/var\(--state-error-bg\)/)
    expect(style).toMatch(/var\(--state-error-border\)/)
    expect(style).toMatch(/var\(--state-error-fg\)/)
  })

  it('forwardRef 转发到根 div', () => {
    const ref = React.createRef<HTMLDivElement>()
    render(
      <DecisionCard ref={ref} video={mkVideo()} probeState="ok" renderState="ok" />,
    )
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
    expect(ref.current?.hasAttribute('data-decision-card')).toBe(true)
  })

  it('testId 渲染为 data-testid', () => {
    const { container } = render(
      <DecisionCard
        video={mkVideo()}
        probeState="ok"
        renderState="ok"
        testId="decision-1"
      />,
    )
    expect(container.querySelector('[data-testid="decision-1"]')).toBeTruthy()
  })
})

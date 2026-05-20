/**
 * signal-chip.test.tsx — SignalChip 单测（FIX-B Stage D；≥ 10 case）
 */
import { afterEach, describe, it, expect } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import React from 'react'
import { SignalChip } from '../../../../../packages/admin-ui/src/components/cell/signal-chip'

afterEach(() => cleanup())

// ── Case 1–2：data attributes 挂载 ───────────────────────────────────────────

describe('SignalChip — data attributes', () => {
  it('data-signal-chip / data-variant / data-state / data-size 均挂载', () => {
    const { container } = render(<SignalChip state="ok" variant="probe" />)
    const chip = container.querySelector('[data-signal-chip]') as HTMLElement
    expect(chip).toBeTruthy()
    expect(chip.getAttribute('data-variant')).toBe('probe')
    expect(chip.getAttribute('data-state')).toBe('ok')
    expect(chip.getAttribute('data-size')).toBe('xs')
  })

  it('size="sm" → data-size=sm', () => {
    const { container } = render(<SignalChip state="ok" variant="render" size="sm" />)
    expect(container.querySelector('[data-size="sm"]')).toBeTruthy()
  })
})

// ── Case 3–7：5 状态文案 probe ────────────────────────────────────────────────

describe('SignalChip — probe 状态文案', () => {
  const cases = [
    ['ok',      '探 可用'] as const,
    ['partial', '探 部分'] as const,
    ['dead',    '探 失效'] as const,
    ['pending', '探 待测'] as const,
    ['unknown', '探 未测'] as const,
  ]
  for (const [state, label] of cases) {
    it(`probe state=${state} → 文案="${label}"`, () => {
      const { container } = render(<SignalChip state={state} variant="probe" />)
      const chip = container.querySelector('[data-signal-chip]') as HTMLElement
      expect(chip.textContent).toContain(label)
    })
  }
})

// ── Case 8–9：render variant ─────────────────────────────────────────────────

describe('SignalChip — render variant', () => {
  it('render state=ok → 文案"播 可用"', () => {
    const { container } = render(<SignalChip state="ok" variant="render" />)
    expect(container.querySelector('[data-signal-chip]')?.textContent).toContain('播 可用')
  })

  it('render state=dead → 文案"播 失效"', () => {
    const { container } = render(<SignalChip state="dead" variant="render" />)
    expect(container.querySelector('[data-signal-chip]')?.textContent).toContain('播 失效')
  })
})

// ── Case 10：Pill variant 对应 probe/render ──────────────────────────────────

describe('SignalChip — Pill variant 传递', () => {
  it('variant=probe → Pill[data-variant=probe]', () => {
    const { container } = render(<SignalChip state="ok" variant="probe" />)
    expect(container.querySelector('[data-pill][data-variant="probe"]')).toBeTruthy()
  })

  it('variant=render → Pill[data-variant=render]', () => {
    const { container } = render(<SignalChip state="ok" variant="render" />)
    expect(container.querySelector('[data-pill][data-variant="render"]')).toBeTruthy()
  })
})

// ── Case 11：label 覆盖 ─────────────────────────────────────────────────────

describe('SignalChip — label 覆盖', () => {
  it('传 label 时显示自定义文案替代默认', () => {
    const { container } = render(<SignalChip state="ok" variant="probe" label="自定义标签" />)
    expect(container.querySelector('[data-signal-chip]')?.textContent).toContain('自定义标签')
    expect(container.querySelector('[data-signal-chip]')?.textContent).not.toContain('探 可用')
  })
})

// ── Case 12：aria-label 语义 ─────────────────────────────────────────────────

describe('SignalChip — a11y', () => {
  it('probe ok → Pill aria-label = "链接探测：可用"', () => {
    const { container } = render(<SignalChip state="ok" variant="probe" />)
    const pill = container.querySelector('[data-pill]') as HTMLElement
    expect(pill.getAttribute('aria-label')).toBe('链接探测：可用')
  })

  it('render dead → Pill aria-label = "实际播放：失效"', () => {
    const { container } = render(<SignalChip state="dead" variant="render" />)
    const pill = container.querySelector('[data-pill]') as HTMLElement
    expect(pill.getAttribute('aria-label')).toBe('实际播放：失效')
  })
})

// ── Case 13：testId 钩子 ─────────────────────────────────────────────────────

describe('SignalChip — testId', () => {
  it('testId → data-testid', () => {
    const { container } = render(<SignalChip state="ok" variant="probe" testId="chip-1" />)
    expect(container.querySelector('[data-testid="chip-1"]')).toBeTruthy()
  })
})

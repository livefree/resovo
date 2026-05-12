/**
 * compute-position 单测（CHG-SN-5-PRE-03-F / SEQ-20260506-02 / ADR-115 §2.2）
 * 覆盖：6 v1 placement × 3 viewport 位置 + flip 触发条件 + shift 夹紧 + flipPlacement 规则
 */
import { describe, it, expect } from 'vitest'
import {
  computePosition,
  flipPlacement,
  V1_PLACEMENTS,
  type PopoverPlacement,
  type Rect,
  type Viewport,
} from '../../../../../packages/admin-ui/src/components/popover/compute-position'

const VIEWPORT: Viewport = { width: 1280, height: 800 }
const CONTENT = { width: 200, height: 80 }
const OFFSET = 4

function trigger(at: 'center' | 'near-top' | 'near-bottom' | 'near-left' | 'near-right'): Rect {
  const w = 100
  const h = 32
  if (at === 'center') return { top: 400, left: 600, width: w, height: h }
  if (at === 'near-top') return { top: 8, left: 600, width: w, height: h }
  if (at === 'near-bottom') return { top: 760, left: 600, width: w, height: h }
  if (at === 'near-left') return { top: 400, left: 8, width: w, height: h }
  return { top: 400, left: 1170, width: w, height: h } // near-right
}

// ── flipPlacement 规则 ──────────────────────────────────────────

describe('flipPlacement — 主轴翻转保留交叉轴修饰符', () => {
  it('top → bottom', () => {
    expect(flipPlacement('top')).toBe('bottom')
  })

  it('bottom → top', () => {
    expect(flipPlacement('bottom')).toBe('top')
  })

  it('left → right', () => {
    expect(flipPlacement('left')).toBe('right')
  })

  it('right → left', () => {
    expect(flipPlacement('right')).toBe('left')
  })

  it('top-start → bottom-start（保留 -start）', () => {
    expect(flipPlacement('top-start')).toBe('bottom-start')
  })

  it('bottom-end → top-end（保留 -end）', () => {
    expect(flipPlacement('bottom-end')).toBe('top-end')
  })

  it('left-end → right-end（保留 -end，主轴翻转）', () => {
    expect(flipPlacement('left-end')).toBe('right-end')
  })
})

// ── 6 v1 placement × center viewport（不需要 flip / shift）──────

describe('computePosition — 6 v1 placement 在 viewport 中心', () => {
  const t = trigger('center')

  it('placement=bottom-start：top 在 trigger 下方 + offset；left 与 trigger 左对齐', () => {
    const r = computePosition({ trigger: t, content: CONTENT, viewport: VIEWPORT, placement: 'bottom-start', offset: OFFSET })
    expect(r.placement).toBe('bottom-start')
    expect(r.top).toBe(t.top + t.height + OFFSET)
    expect(r.left).toBe(t.left)
  })

  it('placement=bottom：水平居中 trigger', () => {
    const r = computePosition({ trigger: t, content: CONTENT, viewport: VIEWPORT, placement: 'bottom', offset: OFFSET })
    expect(r.placement).toBe('bottom')
    expect(r.top).toBe(t.top + t.height + OFFSET)
    expect(r.left).toBe(t.left + (t.width - CONTENT.width) / 2)
  })

  it('placement=top：top 在 trigger 上方 - content 高 - offset', () => {
    const r = computePosition({ trigger: t, content: CONTENT, viewport: VIEWPORT, placement: 'top', offset: OFFSET })
    expect(r.placement).toBe('top')
    expect(r.top).toBe(t.top - CONTENT.height - OFFSET)
  })

  it('placement=left：垂直居中', () => {
    const r = computePosition({ trigger: t, content: CONTENT, viewport: VIEWPORT, placement: 'left', offset: OFFSET })
    expect(r.placement).toBe('left')
    expect(r.left).toBe(t.left - CONTENT.width - OFFSET)
    expect(r.top).toBe(t.top + (t.height - CONTENT.height) / 2)
  })

  it('placement=right：垂直居中', () => {
    const r = computePosition({ trigger: t, content: CONTENT, viewport: VIEWPORT, placement: 'right', offset: OFFSET })
    expect(r.placement).toBe('right')
    expect(r.left).toBe(t.left + t.width + OFFSET)
  })

  it('placement=bottom-end：right edge align', () => {
    const r = computePosition({ trigger: t, content: CONTENT, viewport: VIEWPORT, placement: 'bottom-end', offset: OFFSET })
    expect(r.placement).toBe('bottom-end')
    expect(r.left).toBe(t.left + t.width - CONTENT.width)
  })
})

// ── flip 触发：trigger 靠近边缘 ──────────────────────────────────

describe('computePosition — flip 触发条件（trigger 在 viewport 边缘）', () => {
  it('trigger 在 viewport 顶部 + placement=top → flip 到 bottom', () => {
    const t = trigger('near-top')
    const r = computePosition({ trigger: t, content: CONTENT, viewport: VIEWPORT, placement: 'top', offset: OFFSET })
    expect(r.placement).toBe('bottom')
    expect(r.top).toBe(t.top + t.height + OFFSET)
  })

  it('trigger 在 viewport 底部 + placement=bottom → flip 到 top', () => {
    const t = trigger('near-bottom')
    const r = computePosition({ trigger: t, content: CONTENT, viewport: VIEWPORT, placement: 'bottom', offset: OFFSET })
    expect(r.placement).toBe('top')
    expect(r.top).toBe(t.top - CONTENT.height - OFFSET)
  })

  it('trigger 在左边缘 + placement=left → flip 到 right', () => {
    const t = trigger('near-left')
    const r = computePosition({ trigger: t, content: CONTENT, viewport: VIEWPORT, placement: 'left', offset: OFFSET })
    expect(r.placement).toBe('right')
    expect(r.left).toBe(t.left + t.width + OFFSET)
  })

  it('trigger 在右边缘 + placement=right → flip 到 left', () => {
    const t = trigger('near-right')
    const r = computePosition({ trigger: t, content: CONTENT, viewport: VIEWPORT, placement: 'right', offset: OFFSET })
    expect(r.placement).toBe('left')
    expect(r.left).toBe(t.left - CONTENT.width - OFFSET)
  })

  it('flip 修饰符保留：bottom-start 在底边 → flip 到 top-start', () => {
    const t = trigger('near-bottom')
    const r = computePosition({ trigger: t, content: CONTENT, viewport: VIEWPORT, placement: 'bottom-start', offset: OFFSET })
    expect(r.placement).toBe('top-start')
  })
})

// ── shift 夹紧：flip 后仍超出（极端场景）──────────────────────────

describe('computePosition — shift 夹紧到 viewport 内', () => {
  it('content 比 viewport 还大某一轴 → 夹紧到 EDGE_PADDING', () => {
    const tinyViewport: Viewport = { width: 200, height: 200 }
    const t: Rect = { top: 100, left: 100, width: 50, height: 30 }
    const r = computePosition({ trigger: t, content: CONTENT, viewport: tinyViewport, placement: 'right', offset: OFFSET })
    // flip 也放不下 → shift 夹紧；至少 left >= 8 (EDGE_PADDING)
    expect(r.left).toBeGreaterThanOrEqual(8)
  })

  it('shift 把 popover 从负值夹紧到 EDGE_PADDING（top 极端场景）', () => {
    // trigger 在 viewport 顶端（top=2），placement=top 会让 popover.top = -82（超出顶部）
    // flip 到 bottom 能 fit；这里改用更小 viewport 验证 shift 路径
    const shortViewport: Viewport = { width: 1280, height: 100 }
    const t: Rect = { top: 80, left: 600, width: 100, height: 32 }
    // placement=bottom 算出 top=80+32+4=116（超 viewport.height=100 - padding 8 = 92）→ flip 到 top: 80-80-4=-4（也超）
    // → shift：从 116 夹紧到 max(8, min(116, 100-80-8)) = max(8, min(116, 12)) = 12
    const r = computePosition({ trigger: t, content: CONTENT, viewport: shortViewport, placement: 'bottom', offset: OFFSET })
    expect(r.top).toBeGreaterThanOrEqual(8)
    expect(r.top).toBeLessThanOrEqual(shortViewport.height - 8) // 在 viewport 内
  })
})

// ── V1_PLACEMENTS 常量确证 ──────────────────────────────────────

describe('V1_PLACEMENTS — minimum viable subset 严格匹配 ADR-115', () => {
  it('恰好包含 6 个 placement', () => {
    expect(V1_PLACEMENTS.length).toBe(6)
  })

  it('清单为：top / bottom / left / right / bottom-start / bottom-end', () => {
    const expected: PopoverPlacement[] = ['top', 'bottom', 'left', 'right', 'bottom-start', 'bottom-end']
    expect([...V1_PLACEMENTS].sort()).toEqual(expected.sort())
  })
})

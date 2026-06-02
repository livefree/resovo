/**
 * header-menu-position.test.ts — HeaderMenu popover 视口感知定位（CHG-VSR-DTAF-VIEWPORT）
 *
 * computeHeaderMenuPosition(rect, panelW, naturalH, vw, vh) 纯函数：
 *   - 下方放得下完整 popover 且 footer 距视口底 ≥ SAFE_BOTTOM_GAP(56) → 向下（top 锚定）
 *   - footer 会贴近视口底（撞底部叠层）但上方放得下完整 → flip-up（bottom 锚定表头上沿）
 *   - footer 贴底 + 上方放不全但够用(≥160) → flip-up
 *   - 上方也太小 → 向下贴底 + maxHeight 约束（内部滚动）
 *   - 水平右侧溢出 → left clamp
 *
 * 根因回归：原恒 `top: rect.bottom + 4` 使中部表头 popover footer 压到视口底/右下角，撞
 * dev 工具浮标拦截点击（e2e sources test 3 footer 出屏 / test 4 footer 落右下角被 N 浮标拦截）。
 */
import { describe, it, expect } from 'vitest'
import { computeHeaderMenuPosition } from '../../../../../packages/admin-ui/src/components/data-table/header-menu'

const VW = 1280
const VH = 720
const PANEL_W = 320
const SAFE = 56 // SAFE_BOTTOM_GAP

function rect(top: number, bottom: number, left: number): DOMRect {
  return { top, bottom, left, right: left, width: 0, height: bottom - top, x: left, y: top, toJSON() {} } as DOMRect
}

describe('computeHeaderMenuPosition — 视口感知', () => {
  it('下方放得下完整 + footer 不贴底 → 向下：top=rect.bottom+4，无 bottom', () => {
    const pos = computeHeaderMenuPosition(rect(100, 120, 200), PANEL_W, 300, VW, VH)
    // footer=120+304=424 ≤ 720-56=664 → 向下
    expect(pos.top).toBe(124)
    expect(pos.bottom).toBeUndefined()
    expect(pos.left).toBe(200)
    expect(pos.maxHeight).toBe(VH - 120 - 8) // spaceBelow=592
  })

  it('中部表头 footer 会贴底（撞底部叠层）但上方放得下完整 → flip-up（test 4 回归守卫）', () => {
    // sources 中部表头 y≈350，naturalH=340：footer=370+344=714 > 664 → 不向下；needed=344 ≤ spaceAbove 不成立
    // 但走 MIN_FLIP_SPACE：spaceAbove=342≥160 → flip-up（footer 落表头上方，避右下角 N 浮标）
    const pos = computeHeaderMenuPosition(rect(350, 370, 960), PANEL_W, 340, VW, VH)
    expect(pos.top).toBeUndefined()
    expect(pos.bottom).toBe(VH - 350 + 4) // 374（footer 落表头上沿，远离视口底）
  })

  it('下方放不下但上方放得下完整 → flip-up：bottom 锚定，无 top', () => {
    const pos = computeHeaderMenuPosition(rect(400, 420, 200), PANEL_W, 300, VW, VH)
    // footer=420+304=724 > 664；needed=304 ≤ spaceAbove(392) → flip-up
    expect(pos.top).toBeUndefined()
    expect(pos.bottom).toBe(VH - 400 + 4) // 324
    expect(pos.maxHeight).toBe(400 - 8)   // spaceAbove=392
  })

  it('两侧都放不全 + 上方太小(<160) → 向下贴底 + maxHeight 约束', () => {
    // 靠顶表头 y≈80，naturalH=700；footer=804>664 不向下；needed=704>spaceAbove(72)；72<160 → 向下贴底内滚
    const pos = computeHeaderMenuPosition(rect(80, 100, 200), PANEL_W, 700, VW, VH)
    expect(pos.top).toBe(104)
    expect(pos.bottom).toBeUndefined()
    expect(pos.maxHeight).toBe(VH - 100 - 8) // spaceBelow=612
  })

  it('短菜单（footer 远离底部）→ 向下', () => {
    // 中部表头 y≈350 但短菜单 naturalH=120：footer=370+124=494 ≤ 664 → 向下（短菜单不 flip）
    const pos = computeHeaderMenuPosition(rect(350, 370, 200), PANEL_W, 120, VW, VH)
    expect(pos.top).toBe(374)
    expect(pos.bottom).toBeUndefined()
  })

  it('水平右侧溢出 → left clamp 进视口', () => {
    const pos = computeHeaderMenuPosition(rect(100, 120, 1200), PANEL_W, 200, VW, VH)
    expect(pos.left).toBe(VW - PANEL_W - 8) // 952
  })

  it('水平不溢出 → left = rect.left（不动）', () => {
    const pos = computeHeaderMenuPosition(rect(100, 120, 300), PANEL_W, 200, VW, VH)
    expect(pos.left).toBe(300)
  })

  it('maxHeight 永不为负', () => {
    const pos = computeHeaderMenuPosition(rect(4, 716, 200), PANEL_W, 400, VW, VH)
    expect(pos.maxHeight).toBeGreaterThanOrEqual(0)
  })

  // SAFE 常量在断言中显式引用，防止"魔法数"漂移
  it('SAFE_BOTTOM_GAP 边界：footer 恰好距底 = SAFE → 仍向下', () => {
    // footer = rect.bottom + naturalH + 4 = vh - SAFE → 边界含等号走向下
    const naturalH = 200
    const bottom = VH - SAFE - naturalH - 4 // footer 恰好 = vh - SAFE
    const pos = computeHeaderMenuPosition(rect(bottom - 20, bottom, 200), PANEL_W, naturalH, VW, VH)
    expect(pos.top).toBe(bottom + 4)
    expect(pos.bottom).toBeUndefined()
  })
})

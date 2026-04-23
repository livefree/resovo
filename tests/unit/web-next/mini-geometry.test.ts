/**
 * mini-geometry.test.ts — HANDOFF-03 Storage 协调协议单元测试
 *
 * 覆盖：
 *   - 读写基础正确性（roundtrip）
 *   - 4 种矛盾值解决规则（Storage 协调协议）
 *   - corner 枚举损坏降级
 *   - width 边界 clamp
 *   - nearestCorner / computeDockPosition / deriveHeightFromWidth 几何工具函数
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  MINI_GEOMETRY_CONSTRAINTS,
  MINI_GEOMETRY_DEFAULTS,
  clampWidth,
  clearMiniGeometry,
  computeDockPosition,
  deriveHeightFromWidth,
  nearestCorner,
  readMiniGeometry,
  writeMiniGeometry,
  type MiniGeometryV1,
} from '@/stores/_persist/mini-geometry'

const STORAGE_KEY = 'resovo:player-mini-geometry:v1'

// jsdom 里 localStorage 已内置；手动清理以隔离 case
beforeEach(() => {
  window.localStorage.clear()
})

describe('readMiniGeometry / writeMiniGeometry — 基础 roundtrip', () => {
  it('未写入时返回 null（让消费方 fallback 到 defaults）', () => {
    expect(readMiniGeometry()).toBeNull()
  })

  it('写入后读出完全相同的值（v=1 + width + height + corner）', () => {
    const geom: MiniGeometryV1 = { v: 1, width: 360, height: 202, corner: 'tr' }
    writeMiniGeometry(geom)
    expect(readMiniGeometry()).toEqual(geom)
  })

  it('clearMiniGeometry 后再读返回 null', () => {
    writeMiniGeometry({ v: 1, width: 400, height: 225, corner: 'bl' })
    expect(readMiniGeometry()).not.toBeNull()
    clearMiniGeometry()
    expect(readMiniGeometry()).toBeNull()
  })
})

describe('Storage 协调协议 — 矛盾值解决规则', () => {
  it('损坏 JSON → 返回 null（消费方用 defaults）', () => {
    window.localStorage.setItem(STORAGE_KEY, '{invalid json')
    expect(readMiniGeometry()).toBeNull()
  })

  it('v !== 1 → 返回 null（未来 v2 分支不污染 v1 消费方）', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ v: 2, width: 320, height: 180, corner: 'br' }),
    )
    expect(readMiniGeometry()).toBeNull()
  })

  it('corner 枚举损坏（非 tl/tr/bl/br）→ 返回 null → 消费方 fallback 到默认 corner=br', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ v: 1, width: 320, height: 180, corner: 'center' }),
    )
    expect(readMiniGeometry()).toBeNull()
    // 默认值 corner 为 br
    expect(MINI_GEOMETRY_DEFAULTS.corner).toBe('br')
  })

  it('width 越界（< MIN_WIDTH）→ 返回 null', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ v: 1, width: 100, height: 56, corner: 'br' }),
    )
    expect(readMiniGeometry()).toBeNull()
  })

  it('width 越界（> MAX_WIDTH）→ 返回 null', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ v: 1, width: 9999, height: 5625, corner: 'br' }),
    )
    expect(readMiniGeometry()).toBeNull()
  })

  it('字段类型错误（width 非 number）→ 返回 null', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ v: 1, width: '320', height: 180, corner: 'br' }),
    )
    expect(readMiniGeometry()).toBeNull()
  })

  it('Infinity / NaN width → 返回 null', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ v: 1, width: null, height: 180, corner: 'br' }),
    )
    expect(readMiniGeometry()).toBeNull()
  })
})

describe('clampWidth — 边界夹紧', () => {
  it('小于 MIN_WIDTH 夹到 MIN_WIDTH', () => {
    expect(clampWidth(100)).toBe(MINI_GEOMETRY_CONSTRAINTS.MIN_WIDTH)
  })

  it('大于 MAX_WIDTH 夹到 MAX_WIDTH', () => {
    expect(clampWidth(9999)).toBe(MINI_GEOMETRY_CONSTRAINTS.MAX_WIDTH)
  })

  it('范围内四舍五入', () => {
    expect(clampWidth(320.7)).toBe(321)
  })

  it('NaN / Infinity → defaults width', () => {
    expect(clampWidth(Number.NaN)).toBe(MINI_GEOMETRY_DEFAULTS.width)
    expect(clampWidth(Number.POSITIVE_INFINITY)).toBe(MINI_GEOMETRY_DEFAULTS.width)
  })
})

describe('deriveHeightFromWidth — 16:9 保持', () => {
  it('width=320 → height=180', () => {
    expect(deriveHeightFromWidth(320)).toBe(180)
  })

  it('width=480 → height=270（MAX_WIDTH 极限）', () => {
    expect(deriveHeightFromWidth(480)).toBe(270)
  })

  it('width=240 → height=135（MIN_WIDTH 极限）', () => {
    expect(deriveHeightFromWidth(240)).toBe(135)
  })
})

describe('nearestCorner — 吸附最近角', () => {
  // viewport 1000 × 800，中心点 (500, 400)
  const vw = 1000
  const vh = 800

  it('左上象限 → tl', () => {
    expect(nearestCorner(100, 100, vw, vh)).toBe('tl')
  })

  it('右上象限 → tr', () => {
    expect(nearestCorner(900, 100, vw, vh)).toBe('tr')
  })

  it('左下象限 → bl', () => {
    expect(nearestCorner(100, 700, vw, vh)).toBe('bl')
  })

  it('右下象限 → br（默认值常驻）', () => {
    expect(nearestCorner(900, 700, vw, vh)).toBe('br')
  })

  it('边界值（正中心）→ br（同右下象限）', () => {
    expect(nearestCorner(500, 400, vw, vh)).toBe('br')
  })
})

describe('computeDockPosition — 吸附位置', () => {
  const geom: MiniGeometryV1 = { v: 1, width: 320, height: 180, corner: 'br' }
  const vw = 1440
  const vh = 900
  const margin = MINI_GEOMETRY_CONSTRAINTS.DOCK_MARGIN // 16

  it('br 角：left=vw-w-margin，top=vh-h-margin', () => {
    expect(computeDockPosition(geom, vw, vh, margin)).toEqual({
      left: vw - 320 - margin,
      top: vh - 180 - margin,
    })
  })

  it('tl 角：left=margin，top=margin', () => {
    expect(computeDockPosition({ ...geom, corner: 'tl' }, vw, vh, margin)).toEqual({
      left: margin,
      top: margin,
    })
  })

  it('tr 角：left=vw-w-margin，top=margin', () => {
    expect(computeDockPosition({ ...geom, corner: 'tr' }, vw, vh, margin)).toEqual({
      left: vw - 320 - margin,
      top: margin,
    })
  })

  it('bl 角：left=margin，top=vh-h-margin', () => {
    expect(computeDockPosition({ ...geom, corner: 'bl' }, vw, vh, margin)).toEqual({
      left: margin,
      top: vh - 180 - margin,
    })
  })

  it('viewport 缩小到 mini 尺寸以下也不会 NaN（越界 re-snap 由消费方处理）', () => {
    const r = computeDockPosition({ ...geom, corner: 'br' }, 300, 150, margin)
    expect(Number.isFinite(r.left)).toBe(true)
    expect(Number.isFinite(r.top)).toBe(true)
  })
})

describe('MINI_GEOMETRY_DEFAULTS / CONSTRAINTS — 契约不变量', () => {
  it('DEFAULTS.corner === br（与 Storage 协调协议 §矛盾值解决规则 对齐）', () => {
    expect(MINI_GEOMETRY_DEFAULTS.corner).toBe('br')
  })

  it('DEFAULTS.width 在 [MIN_WIDTH, MAX_WIDTH] 区间内', () => {
    expect(MINI_GEOMETRY_DEFAULTS.width).toBeGreaterThanOrEqual(MINI_GEOMETRY_CONSTRAINTS.MIN_WIDTH)
    expect(MINI_GEOMETRY_DEFAULTS.width).toBeLessThanOrEqual(MINI_GEOMETRY_CONSTRAINTS.MAX_WIDTH)
  })

  it('DEFAULTS.height 符合 16:9 比例（± 1 px 容差）', () => {
    const expected = MINI_GEOMETRY_DEFAULTS.width / MINI_GEOMETRY_CONSTRAINTS.ASPECT_RATIO
    expect(Math.abs(MINI_GEOMETRY_DEFAULTS.height - expected)).toBeLessThanOrEqual(1)
  })

  it('DEFAULTS 被 frozen（防止意外 mutate）', () => {
    expect(Object.isFrozen(MINI_GEOMETRY_DEFAULTS)).toBe(true)
  })
})

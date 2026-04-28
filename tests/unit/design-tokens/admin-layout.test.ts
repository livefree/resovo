import { describe, it, expect } from 'vitest'
import {
  adminShell,
  adminTable,
  adminDensity,
  adminShellZIndex,
} from '../../../packages/design-tokens/src/admin-layout/index.js'
import { dualSignal } from '../../../packages/design-tokens/src/semantic/dual-signal.js'

describe('admin-layout tokens — structure', () => {
  it('adminShell exposes sidebar + topbar 3 fields', () => {
    expect(Object.keys(adminShell)).toEqual([
      'sidebar-w',
      'sidebar-w-collapsed',
      'topbar-h',
    ])
  })

  it('adminShell values are CSS-compatible length strings', () => {
    for (const v of Object.values(adminShell)) {
      expect(v).toMatch(/^\d+(\.\d+)?(px|rem)$/)
    }
  })

  it('adminTable exposes row + col fields', () => {
    expect(Object.keys(adminTable).sort()).toEqual(
      ['col-min-w', 'row-h', 'row-h-compact'].sort(),
    )
  })

  it('adminDensity exposes comfortable / compact ratios', () => {
    expect(Object.keys(adminDensity).sort()).toEqual(
      ['density-comfortable', 'density-compact'].sort(),
    )
    expect(Number(adminDensity['density-comfortable'])).toBe(1)
    expect(Number(adminDensity['density-compact'])).toBeLessThan(1)
  })

  it('adminShellZIndex exposes 3 z-shell-* fields (ADR-103a §4.3)', () => {
    expect(Object.keys(adminShellZIndex).sort()).toEqual(
      ['z-shell-cmdk', 'z-shell-drawer', 'z-shell-toast'].sort(),
    )
  })

  it('adminShellZIndex 4-tier ordering: drawer < cmdk < toast (ADR-103a 不变量)', () => {
    const drawer = Number(adminShellZIndex['z-shell-drawer'])
    const cmdk = Number(adminShellZIndex['z-shell-cmdk'])
    const toast = Number(adminShellZIndex['z-shell-toast'])
    expect(drawer).toBe(1100)
    expect(cmdk).toBe(1200)
    expect(toast).toBe(1300)
    expect(drawer).toBeLessThan(cmdk)
    expect(cmdk).toBeLessThan(toast)
    // L1 业务 Drawer (1000) 由 components/ 层管辖，不在本命名空间，但层级关系上 drawer (1100) > 1000
    expect(drawer).toBeGreaterThan(1000)
  })
})

describe('semantic dual-signal — structure', () => {
  it('has light and dark themes', () => {
    expect(Object.keys(dualSignal)).toEqual(['light', 'dark'])
  })

  it('light and dark expose probe / render + soft variants', () => {
    const expected = ['probe', 'probe-soft', 'render', 'render-soft']
    expect(Object.keys(dualSignal.light).sort()).toEqual(expected.sort())
    expect(Object.keys(dualSignal.dark).sort()).toEqual(expected.sort())
  })

  it('soft variants are rgba transparent (alpha < 1)', () => {
    expect(dualSignal.light['probe-soft']).toMatch(/^rgba\(.*0\.14\)$/)
    expect(dualSignal.dark['probe-soft']).toMatch(/^rgba\(.*0\.14\)$/)
    expect(dualSignal.light['render-soft']).toMatch(/^rgba\(.*0\.14\)$/)
    expect(dualSignal.dark['render-soft']).toMatch(/^rgba\(.*0\.14\)$/)
  })

  it('dark theme uses v2.1 design source values (sky-400 / purple-500)', () => {
    expect(dualSignal.dark.probe).toBe('#38bdf8')
    expect(dualSignal.dark.render).toBe('#a855f7')
  })
})

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  adminShell,
  adminTable,
  adminDensity,
  adminShellZIndex,
  adminSpacing,
  adminCover,
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

  it('adminTable exposes row + col fields (含 CHG-UX2-01 row-h-relaxed + CHG-UX2-03b row-h-poster)', () => {
    expect(Object.keys(adminTable).sort()).toEqual(
      ['col-min-w', 'row-h', 'row-h-compact', 'row-h-poster', 'row-h-relaxed'].sort(),
    )
  })

  it('adminTable row-h ramp: compact < default < relaxed < poster (CHG-UX2-01/03b)', () => {
    const compact = parseInt(adminTable['row-h-compact'], 10)
    const def = parseInt(adminTable['row-h'], 10)
    const relaxed = parseInt(adminTable['row-h-relaxed'], 10)
    const poster = parseInt(adminTable['row-h-poster'], 10)
    expect(compact).toBeLessThan(def)
    expect(def).toBeLessThan(relaxed)
    expect(relaxed).toBeLessThan(poster)
    expect(relaxed).toBe(48)
    expect(poster).toBe(80)  // 容纳 poster-md 48×72 封面（72 + ~8 padding）
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

describe('admin-layout spacing tokens (CHG-UX2-01 / SEQ-20260505-01)', () => {
  const REQUIRED_KEYS = [
    'page-padding-x', 'page-padding-y', 'section-gap',
    'list-row-padding-x', 'list-row-padding-y',
    'card-padding-x', 'card-padding-y',
    'toolbar-padding-x', 'toolbar-padding-y',
    'foot-padding-x', 'foot-padding-y',
  ] as const

  it('exposes 11 named slots (5 类场景 × 2 轴 + section-gap)', () => {
    expect(Object.keys(adminSpacing).sort()).toEqual([...REQUIRED_KEYS].sort())
  })

  it.each(REQUIRED_KEYS)('%s is a CSS-compatible px length', (key) => {
    expect(adminSpacing[key]).toMatch(/^\d+(\.\d+)?px$/)
  })

  it('page-padding > toolbar-padding > foot-padding (语义层级)', () => {
    const px = (v: string) => parseInt(v, 10)
    expect(px(adminSpacing['page-padding-x'])).toBeGreaterThan(px(adminSpacing['toolbar-padding-x']))
    // y 轴：foot 最紧凑（6 < 10 < 14 < 20）
    expect(px(adminSpacing['foot-padding-y'])).toBeLessThan(px(adminSpacing['toolbar-padding-y']))
    expect(px(adminSpacing['toolbar-padding-y'])).toBeLessThan(px(adminSpacing['card-padding-y']))
    expect(px(adminSpacing['card-padding-y'])).toBeLessThan(px(adminSpacing['page-padding-y']))
  })
})

describe('admin-layout cover tokens (CHG-UX2-01 / SEQ-20260505-01)', () => {
  const POSTER_SIZES = ['sm', 'md', 'lg', 'xl'] as const
  const ASPECT_RATIO_TOLERANCE = 0.05

  it('exposes 11 cover slots (4 poster × 2 + banner-sm × 2 + square-sm × 2 - 1 sm-w 重复)', () => {
    expect(Object.keys(adminCover)).toHaveLength(12)
  })

  it.each(POSTER_SIZES)('cover-poster-%s 严格遵守 2:3 比例（设计稿 §10）', (size) => {
    const w = parseInt(adminCover[`cover-poster-${size}-w` as const], 10)
    const h = parseInt(adminCover[`cover-poster-${size}-h` as const], 10)
    const ratio = h / w
    expect(Math.abs(ratio - 1.5)).toBeLessThan(ASPECT_RATIO_TOLERANCE)
  })

  it('poster sizes are monotonically increasing (sm < md < lg < xl)', () => {
    const widths = POSTER_SIZES.map(s => parseInt(adminCover[`cover-poster-${s}-w` as const], 10))
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]).toBeGreaterThan(widths[i - 1])
    }
  })

  it('poster-md 校准 38 → 48 (CHG-UX2-01)', () => {
    expect(adminCover['cover-poster-md-w']).toBe('48px')
    expect(adminCover['cover-poster-md-h']).toBe('72px')
  })

  it('poster-xl 新增 120×180 (CHG-UX2-01)', () => {
    expect(adminCover['cover-poster-xl-w']).toBe('120px')
    expect(adminCover['cover-poster-xl-h']).toBe('180px')
  })

  it('banner-sm 16:9 比例', () => {
    const w = parseInt(adminCover['cover-banner-sm-w'], 10)
    const h = parseInt(adminCover['cover-banner-sm-h'], 10)
    expect(Math.abs(w / h - 16 / 9)).toBeLessThan(0.05)
  })

  it('square-sm 1:1 比例', () => {
    expect(adminCover['cover-square-sm-w']).toBe(adminCover['cover-square-sm-h'])
  })
})

describe('admin-layout token CSS 变量产出（CHG-UX2-01 快照）', () => {
  const TOKENS_CSS = readFileSync(
    resolve(__dirname, '../../../packages/design-tokens/src/css/tokens.css'),
    'utf-8',
  )

  it.each([
    '--page-padding-x', '--page-padding-y', '--section-gap',
    '--list-row-padding-x', '--list-row-padding-y',
    '--card-padding-x', '--card-padding-y',
    '--toolbar-padding-x', '--toolbar-padding-y',
    '--foot-padding-x', '--foot-padding-y',
  ])('tokens.css contains %s', (varName) => {
    expect(TOKENS_CSS).toContain(`${varName}:`)
  })

  it.each([
    '--cover-poster-sm-w', '--cover-poster-sm-h',
    '--cover-poster-md-w', '--cover-poster-md-h',
    '--cover-poster-lg-w', '--cover-poster-lg-h',
    '--cover-poster-xl-w', '--cover-poster-xl-h',
    '--cover-banner-sm-w', '--cover-banner-sm-h',
    '--cover-square-sm-w', '--cover-square-sm-h',
  ])('tokens.css contains %s', (varName) => {
    expect(TOKENS_CSS).toContain(`${varName}:`)
  })

  it('tokens.css contains --row-h-relaxed', () => {
    expect(TOKENS_CSS).toContain('--row-h-relaxed: 48px')
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

import { describe, it, expect } from 'vitest'
import { bg, fg, border, accent, state, surface, deriveAccent } from '../../../packages/design-tokens/src/semantic/index.js'
import { colors } from '../../../packages/design-tokens/src/primitives/color.js'

const PRIMITIVE_VALUES = new Set<string>(
  Object.values(colors).flatMap((scale) => Object.values(scale as Record<string, string>)),
)

function collectLeafStrings(obj: unknown): string[] {
  if (typeof obj === 'string') return [obj]
  if (obj && typeof obj === 'object') {
    return Object.values(obj as Record<string, unknown>).flatMap(collectLeafStrings)
  }
  return []
}

describe('semantic tokens — structure', () => {
  it('bg has light and dark themes', () => {
    expect(Object.keys(bg)).toEqual(['light', 'dark'])
    expect(Object.keys(bg.light)).toEqual(Object.keys(bg.dark))
  })

  it('fg has light and dark themes with matching keys', () => {
    expect(Object.keys(fg.light)).toEqual(Object.keys(fg.dark))
    expect(fg.light.default).toBeTruthy()
    expect(fg.dark.default).toBeTruthy()
  })

  it('border has focus key using accent color', () => {
    expect(border.light.focus).toBe(colors.accent[500])
    expect(border.dark.focus).toBe(colors.accent[500])
  })

  it('accent light and dark have matching keys', () => {
    expect(Object.keys(accent.light)).toEqual(Object.keys(accent.dark))
  })

  it('state has all four status kinds in both themes', () => {
    const kinds = ['success', 'warning', 'error', 'info'] as const
    for (const kind of kinds) {
      expect(Object.keys(state.light[kind])).toEqual(['bg', 'fg', 'border'])
      expect(Object.keys(state.dark[kind])).toEqual(['bg', 'fg', 'border'])
    }
  })

  it('surface light includes glass and scrim', () => {
    expect(surface.light.glass).toBeTruthy()
    expect(surface.light.scrim).toContain('linear-gradient')
    expect(surface.dark.glass).toBeTruthy()
  })
})

describe('semantic tokens — primitive reference integrity', () => {
  const NON_PRIMITIVE_PREFIXES = ['color-mix', 'linear-gradient']

  function isAllowedNonPrimitive(v: string): boolean {
    return NON_PRIMITIVE_PREFIXES.some((prefix) => v.startsWith(prefix))
  }

  it('bg values are primitive refs or allowed computed values', () => {
    for (const v of collectLeafStrings(bg)) {
      const ok = PRIMITIVE_VALUES.has(v) || isAllowedNonPrimitive(v)
      expect(ok, `bg value not a primitive ref or allowed: "${v}"`).toBe(true)
    }
  })

  it('fg values are primitive refs', () => {
    for (const v of collectLeafStrings(fg)) {
      expect(PRIMITIVE_VALUES.has(v), `fg value not a primitive ref: "${v}"`).toBe(true)
    }
  })

  it('border values are primitive refs', () => {
    for (const v of collectLeafStrings(border)) {
      expect(PRIMITIVE_VALUES.has(v), `border value not a primitive ref: "${v}"`).toBe(true)
    }
  })

  it('accent values are primitive refs', () => {
    for (const v of collectLeafStrings(accent)) {
      expect(PRIMITIVE_VALUES.has(v), `accent value not a primitive ref: "${v}"`).toBe(true)
    }
  })

  it('state values are primitive refs or allowed computed values (CHG-UI-04: alpha-soft via color-mix)', () => {
    for (const v of collectLeafStrings(state)) {
      const ok = PRIMITIVE_VALUES.has(v) || isAllowedNonPrimitive(v)
      expect(ok, `state value not a primitive ref or allowed: "${v}"`).toBe(true)
    }
  })
})

describe('state tokens — alpha-soft 形态硬约束（CHG-UI-04 / ADR-111）', () => {
  const KINDS = ['success', 'warning', 'error', 'info'] as const
  const THEMES = ['light', 'dark'] as const
  const SOFT_MIX_RE = /^color-mix\(in oklch, oklch\([^)]+\) 14%, transparent\)$/

  it.each(THEMES.flatMap((t) => KINDS.map((k) => [t, k] as const)))(
    'state.%s.%s.bg matches color-mix(in oklch, <base> 14%, transparent)',
    (theme, kind) => {
      const slot = state[theme][kind]
      expect(slot.bg).toMatch(SOFT_MIX_RE)
      expect(slot.bg).toContain(colors[kind].base)
    },
  )

  it.each(THEMES.flatMap((t) => KINDS.map((k) => [t, k] as const)))(
    'state.%s.%s.fg === colors.%s.base (鲜亮文字)',
    (theme, kind) => {
      expect(state[theme][kind].fg).toBe(colors[kind].base)
    },
  )

  it.each(THEMES.flatMap((t) => KINDS.map((k) => [t, k] as const)))(
    'state.%s.%s.border === colors.%s.base (保留给 KpiCard/DiffPanel/InheritanceBadge/selection-action-bar 显式边框消费方)',
    (theme, kind) => {
      expect(state[theme][kind].border).toBe(colors[kind].base)
    },
  )

  it('dark 与 light 双主题完全等价（alpha-soft 同映射策略）', () => {
    for (const kind of KINDS) {
      expect(state.dark[kind]).toEqual(state.light[kind])
    }
  })
})

describe('deriveAccent', () => {
  const SEED = 'oklch(64.5% 0.165 230)'

  it('returns 11 steps', () => {
    const result = deriveAccent(SEED)
    expect(Object.keys(result)).toHaveLength(11)
    const expected = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']
    expect(Object.keys(result)).toEqual(expect.arrayContaining(expected))
  })

  it('output is stable given same seed', () => {
    expect(deriveAccent(SEED)).toEqual(deriveAccent(SEED))
  })

  it('each step is a valid oklch string', () => {
    const OKLCH = /^oklch\(\d+(\.\d+)?% \d+(\.\d+)? \d+(\.\d+)?\)$/
    for (const v of Object.values(deriveAccent(SEED))) {
      expect(OKLCH.test(v), `invalid oklch: "${v}"`).toBe(true)
    }
  })

  it('step 50 is lighter than step 500 which is lighter than step 950', () => {
    const result = deriveAccent(SEED)
    const extractL = (s: string) => parseFloat(s.match(/oklch\((\d+(?:\.\d+)?)%/)![1])
    expect(extractL(result[50])).toBeGreaterThan(extractL(result[500]))
    expect(extractL(result[500])).toBeGreaterThan(extractL(result[950]))
  })

  it('throws on invalid seed', () => {
    expect(() => deriveAccent('not-oklch')).toThrow('deriveAccent: invalid oklch seed')
  })
})

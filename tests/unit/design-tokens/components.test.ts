import { describe, it, expect } from 'vitest'
import { button, card, input, modal, player, table, tabs, tooltip } from '../../../packages/design-tokens/src/components/index.js'
import { colors } from '../../../packages/design-tokens/src/primitives/color.js'
import { space } from '../../../packages/design-tokens/src/primitives/space.js'
import { size } from '../../../packages/design-tokens/src/primitives/size.js'
import { radius } from '../../../packages/design-tokens/src/primitives/radius.js'
import { shadow } from '../../../packages/design-tokens/src/primitives/shadow.js'
import { typography } from '../../../packages/design-tokens/src/primitives/typography.js'
import { motion } from '../../../packages/design-tokens/src/primitives/motion.js'
import { zIndex } from '../../../packages/design-tokens/src/primitives/z-index.js'
import { bg } from '../../../packages/design-tokens/src/semantic/bg.js'
import { fg } from '../../../packages/design-tokens/src/semantic/fg.js'
import { border } from '../../../packages/design-tokens/src/semantic/border.js'
import { accent } from '../../../packages/design-tokens/src/semantic/accent.js'
import { surface } from '../../../packages/design-tokens/src/semantic/surface.js'
import { state } from '../../../packages/design-tokens/src/semantic/state.js'

function collectAllLeaves(obj: unknown): Array<string | number> {
  if (typeof obj === 'string' || typeof obj === 'number') return [obj]
  if (obj && typeof obj === 'object') {
    return Object.values(obj as Record<string, unknown>).flatMap(collectAllLeaves)
  }
  return []
}

const PRIMITIVE_STRINGS = new Set<string | number>([
  ...collectAllLeaves(colors),
  ...collectAllLeaves(space),
  ...collectAllLeaves(size),
  ...collectAllLeaves(radius),
  ...collectAllLeaves(shadow),
  ...collectAllLeaves(typography),
  ...collectAllLeaves(motion),
  ...collectAllLeaves(zIndex),
])

const SEMANTIC_STRINGS = new Set<string>([
  ...Object.values(bg.light), ...Object.values(bg.dark),
  ...Object.values(fg.light), ...Object.values(fg.dark),
  ...Object.values(border.light), ...Object.values(border.dark),
  ...Object.values(accent.light), ...Object.values(accent.dark),
  ...Object.values(surface.light), ...Object.values(surface.dark),
  ...Object.values(state.light.success), ...Object.values(state.dark.success),
  ...Object.values(state.light.warning), ...Object.values(state.dark.warning),
  ...Object.values(state.light.error), ...Object.values(state.dark.error),
  ...Object.values(state.light.info), ...Object.values(state.dark.info),
])

const ALLOWED_LITERALS = new Set(['transparent', 'none'])
const ALLOWED_PREFIXES = ['color-mix', 'linear-gradient', 'cubic-bezier']
// CSS dimension/ratio/transition values are atomic in geometry/motion tokens
const CSS_DIMENSION_RE = /^\d+(\.\d+)?(px|ms|%)$|^\d+ \/ \d+$|^\d+(ms|px) cubic-bezier\(/

function isAllowedValue(v: unknown): boolean {
  if (typeof v === 'number' && PRIMITIVE_STRINGS.has(v)) return true
  if (typeof v !== 'string') return false
  if (PRIMITIVE_STRINGS.has(v) || SEMANTIC_STRINGS.has(v)) return true
  if (ALLOWED_LITERALS.has(v)) return true
  if (ALLOWED_PREFIXES.some((p) => v.startsWith(p))) return true
  if (CSS_DIMENSION_RE.test(v)) return true
  return false
}

function collectLeaves(obj: unknown): unknown[] {
  if (typeof obj === 'string' || typeof obj === 'number') return [obj]
  if (obj && typeof obj === 'object') {
    return Object.values(obj as Record<string, unknown>).flatMap(collectLeaves)
  }
  return []
}

function assertAllowedValues(name: string, obj: unknown): void {
  for (const v of collectLeaves(obj)) {
    expect(
      isAllowedValue(v),
      `${name}: unexpected value "${v}" (not primitive/semantic/allowed literal)`,
    ).toBe(true)
  }
}

describe('component tokens — reference integrity', () => {
  it('button values are semantic/primitive refs or allowed literals', () => {
    assertAllowedValues('button', button)
  })
  it('input values are semantic/primitive refs or allowed literals', () => {
    assertAllowedValues('input', input)
  })
  it('card values are semantic/primitive refs or allowed literals', () => {
    assertAllowedValues('card', card)
  })
  it('tabs values are semantic/primitive refs or allowed literals', () => {
    assertAllowedValues('tabs', tabs)
  })
  it('modal values are semantic/primitive refs or allowed literals', () => {
    assertAllowedValues('modal', modal)
  })
  it('tooltip values are semantic/primitive refs or allowed literals', () => {
    assertAllowedValues('tooltip', tooltip)
  })
  it('table values are semantic/primitive refs or allowed literals', () => {
    assertAllowedValues('table', table)
  })
  it('player values are primitive refs or allowed literals (no light/dark)', () => {
    assertAllowedValues('player', player)
  })
})

describe('component tokens — structure', () => {
  it('button has light and dark, each with 4 variants × 3 sizes', () => {
    const variants = ['primary', 'secondary', 'ghost', 'destructive'] as const
    const sizes = ['sm', 'md', 'lg'] as const
    for (const theme of ['light', 'dark'] as const) {
      for (const v of variants) {
        for (const s of sizes) {
          expect(button[theme][v][s]).toBeDefined()
        }
      }
    }
  })

  it('button states include focusVisible', () => {
    expect(button.light.primary.md.focusVisible).toBeDefined()
    expect(button.dark.secondary.sm.focusVisible).toBeDefined()
  })

  it('input has sm/md/lg sizes in both themes', () => {
    expect(input.light.sm).toBeDefined()
    expect(input.dark.lg).toBeDefined()
    expect(input.light.placeholderFg).toBeTruthy()
  })

  it('player has full/mini/pip modes with no light/dark split', () => {
    expect(Object.keys(player)).toEqual(['full', 'mini', 'pip'])
    expect(player.full.zIndex).toBe(1700)
    expect(player.mini.zIndex).toBe(1700)
  })

  it('player progress fill uses dark accent (always dark theme)', () => {
    expect(player.full.progressFill).toBe(accent.dark.default)
    expect(player.pip.progressFill).toBe(accent.dark.default)
  })

  it('tooltip uses inverted panel bg (light theme tooltip is dark)', () => {
    expect(tooltip.light.bg).toBe(bg.dark.surfaceRaised)
    expect(tooltip.dark.bg).toBe(bg.light.surfaceRaised)
  })

  it('table has header, row states, and cell in both themes', () => {
    const rowStates = ['default', 'hover', 'selected', 'striped'] as const
    for (const theme of ['light', 'dark'] as const) {
      expect(table[theme].header).toBeDefined()
      expect(table[theme].cell).toBeDefined()
      for (const s of rowStates) {
        expect(table[theme].row[s]).toBeDefined()
      }
    }
  })

  it('modal has all 5 parts in both themes', () => {
    const parts = ['backdrop', 'panel', 'header', 'body', 'footer'] as const
    for (const theme of ['light', 'dark'] as const) {
      for (const p of parts) {
        expect(modal[theme][p]).toBeDefined()
      }
    }
  })
})

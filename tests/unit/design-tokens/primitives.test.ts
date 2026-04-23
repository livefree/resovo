import { describe, it, expect } from 'vitest'
import { colors, space, size, radius, typography, motion, shadow, zIndex } from '../../../packages/design-tokens/src/primitives/index.js'

const OKLCH_PATTERN = /^oklch\(\d+(\.\d+)?%\s+\d+(\.\d+)?\s+\d+(\.\d+)?\)$/

function collectLeaves(obj: unknown, path: string[] = []): Array<{ path: string; value: unknown }> {
  if (typeof obj === 'string' || typeof obj === 'number') {
    return [{ path: path.join('.'), value: obj }]
  }
  if (obj && typeof obj === 'object') {
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
      collectLeaves(v, [...path, k]),
    )
  }
  return []
}

describe('design-tokens primitives', () => {
  describe('colors — OKLCH format', () => {
    const colorLeaves = collectLeaves(colors)
    it.each(colorLeaves)('$path is valid oklch()', ({ value }) => {
      expect(typeof value).toBe('string')
      expect(OKLCH_PATTERN.test(value as string)).toBe(true)
    })

    it('gray scale has 13 steps', () => {
      expect(Object.keys(colors.gray)).toHaveLength(13)
    })

    it('accent scale has 5 steps', () => {
      expect(Object.keys(colors.accent)).toHaveLength(5)
    })

    it('status colors have light/base/dark keys', () => {
      for (const scale of ['success', 'warning', 'error', 'info'] as const) {
        expect(Object.keys(colors[scale])).toEqual(['light', 'base', 'dark'])
      }
    })
  })

  describe('space', () => {
    it('has 11 entries', () => {
      expect(Object.keys(space)).toHaveLength(11)
    })
    it('0.5 maps to 0.125rem', () => {
      expect(space[0.5]).toBe('0.125rem')
    })
    it('px maps to 1px', () => {
      expect(space.px).toBe('1px')
    })
  })

  describe('size', () => {
    it('has xs through 5xl (9 steps)', () => {
      expect(Object.keys(size)).toHaveLength(9)
    })
  })

  describe('radius', () => {
    it('has none/sm/md/lg/xl/full (6 steps)', () => {
      expect(Object.keys(radius)).toHaveLength(6)
      expect(radius.full).toBe('9999px')
      expect(radius.none).toBe('0')
    })
  })

  describe('typography', () => {
    it('fontSize has 9 steps', () => {
      expect(Object.keys(typography.fontSize)).toHaveLength(9)
    })
    it('lineHeight values are unitless strings', () => {
      for (const v of Object.values(typography.lineHeight)) {
        expect(/^\d+(\.\d+)?$/.test(v)).toBe(true)
      }
    })
    it('fontWeight values are numeric strings', () => {
      for (const v of Object.values(typography.fontWeight)) {
        expect(Number.isFinite(Number(v))).toBe(true)
      }
    })
  })

  describe('motion', () => {
    it('duration.instant is 0ms', () => {
      expect(motion.duration.instant).toBe('0ms')
    })
    it('all duration values end with ms', () => {
      for (const v of Object.values(motion.duration)) {
        expect(v.endsWith('ms')).toBe(true)
      }
    })
  })

  describe('shadow', () => {
    it('has 6 steps', () => {
      expect(Object.keys(shadow)).toHaveLength(6)
    })
    it('none is "none"', () => {
      expect(shadow.none).toBe('none')
    })
  })

  describe('zIndex', () => {
    it('has 9 steps', () => {
      expect(Object.keys(zIndex)).toHaveLength(9)
    })
    it('player is the highest z-index', () => {
      const values = Object.values(zIndex) as number[]
      expect(zIndex.player).toBe(Math.max(...values))
    })
    it('all values are non-negative integers', () => {
      for (const v of Object.values(zIndex)) {
        expect(Number.isInteger(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(0)
      }
    })
  })
})

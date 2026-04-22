import { describe, it, expect } from 'vitest'
import { takeover, tabbar, sharedElement, routeStack } from '../../../packages/design-tokens/src/semantic/index.js'
import { tag } from '../../../packages/design-tokens/src/semantic/tag.js'

// ── takeover ─────────────────────────────────────────────────────────────────

describe('takeover tokens', () => {
  it('has all duration keys', () => {
    expect(takeover.fastDurationMobile).toBeTruthy()
    expect(takeover.fastDurationDesktop).toBeTruthy()
    expect(takeover.standardDuration).toBeTruthy()
    expect(takeover.reducedMotionDuration).toBeTruthy()
  })

  it('fast duration mobile is 200ms', () => {
    expect(takeover.fastDurationMobile).toBe('200ms')
  })

  it('fast duration desktop is 240ms', () => {
    expect(takeover.fastDurationDesktop).toBe('240ms')
  })

  it('standard duration is 360ms', () => {
    expect(takeover.standardDuration).toBe('360ms')
  })

  it('reduced motion duration is 120ms', () => {
    expect(takeover.reducedMotionDuration).toBe('120ms')
  })

  it('has light and dark theme color keys', () => {
    const themeKeys = ['maskColorFast', 'maskColorStandard', 'floatingPlayBg', 'floatingPlayFg'] as const
    for (const k of themeKeys) {
      expect(takeover.light[k], `light.${k}`).toBeTruthy()
      expect(takeover.dark[k], `dark.${k}`).toBeTruthy()
    }
  })

  it('floating play button fg is white in both themes', () => {
    expect(takeover.light.floatingPlayFg).toBe('oklch(100% 0 0)')
    expect(takeover.dark.floatingPlayFg).toBe('oklch(100% 0 0)')
  })
})

// ── tabbar ────────────────────────────────────────────────────────────────────

describe('tabbar tokens', () => {
  it('height is 56px', () => {
    expect(tabbar.height).toBe('56px')
  })

  it('blur is 12px', () => {
    expect(tabbar.blur).toBe('12px')
  })

  it('underline transition duration is 180ms', () => {
    expect(tabbar.underlineTransitionDuration).toBe('180ms')
  })

  it('has bg and underlineColor in both themes', () => {
    expect(tabbar.light.bg).toBeTruthy()
    expect(tabbar.dark.bg).toBeTruthy()
    expect(tabbar.light.underlineColor).toBeTruthy()
    expect(tabbar.dark.underlineColor).toBeTruthy()
  })
})

// ── sharedElement ─────────────────────────────────────────────────────────────

describe('sharedElement tokens', () => {
  it('duration is 360ms', () => {
    expect(sharedElement.duration).toBe('360ms')
  })

  it('fallbackDuration is 120ms', () => {
    expect(sharedElement.fallbackDuration).toBe('120ms')
  })

  it('easing is cubic-bezier', () => {
    expect(sharedElement.easing).toContain('cubic-bezier')
  })
})

// ── routeStack ────────────────────────────────────────────────────────────────

describe('routeStack tokens', () => {
  it('edgeTriggerWidth is 20px', () => {
    expect(routeStack.edgeTriggerWidth).toBe('20px')
  })

  it('thresholdRatio is 0.3', () => {
    expect(routeStack.thresholdRatio).toBe(0.3)
  })

  it('velocityThreshold is 0.5', () => {
    expect(routeStack.velocityThreshold).toBe(0.5)
  })

  it('backAnimationDuration is 240ms', () => {
    expect(routeStack.backAnimationDuration).toBe('240ms')
  })
})

// ── tag sub-types ─────────────────────────────────────────────────────────────

describe('tag sub-type tokens', () => {
  const lifecycleSubTypes = [
    'lifecycleNewBg', 'lifecycleNewFg',
    'lifecycleComingSoonBg', 'lifecycleComingSoonFg',
    'lifecycleOngoingBg', 'lifecycleOngoingFg',
    'lifecycleCompletedBg', 'lifecycleCompletedFg',
    'lifecycleDеlistingBg', 'lifecycleDеlistingFg',
  ] as const

  const trendingSubTypes = [
    'trendingHotBg', 'trendingHotFg',
    'trendingWeeklyTopBg', 'trendingWeeklyTopFg',
    'trendingExclusiveBg', 'trendingExclusiveFg',
    'trendingEditorPickBg', 'trendingEditorPickFg',
  ] as const

  it('has all lifecycle sub-type keys in light theme', () => {
    for (const k of lifecycleSubTypes) {
      expect((tag.light as Record<string, string>)[k], `light.${k}`).toBeTruthy()
    }
  })

  it('has all lifecycle sub-type keys in dark theme', () => {
    for (const k of lifecycleSubTypes) {
      expect((tag.dark as Record<string, string>)[k], `dark.${k}`).toBeTruthy()
    }
  })

  it('has all trending sub-type keys in light theme', () => {
    for (const k of trendingSubTypes) {
      expect((tag.light as Record<string, string>)[k], `light.${k}`).toBeTruthy()
    }
  })

  it('has all trending sub-type keys in dark theme', () => {
    for (const k of trendingSubTypes) {
      expect((tag.dark as Record<string, string>)[k], `dark.${k}`).toBeTruthy()
    }
  })

  it('aggregate aliases still exist for backward compat', () => {
    expect(tag.light.lifecycleBg).toBeTruthy()
    expect(tag.light.trendingBg).toBeTruthy()
    expect(tag.dark.lifecycleBg).toBeTruthy()
    expect(tag.dark.trendingBg).toBeTruthy()
  })
})

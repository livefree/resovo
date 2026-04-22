import { colors } from '../primitives/color.js'

// Tag overlay colors (spec / rating) use glass — not mapped to color primitives
const GLASS_DARK  = 'color-mix(in oklch, oklch(6.5% 0.004 247) 72%, transparent)'
const GLASS_LIGHT = 'color-mix(in oklch, oklch(6.5% 0.004 247) 56%, transparent)'
const WHITE       = 'oklch(100% 0 0)'

export const tag = {
  light: {
    // ── aggregate aliases (kept for backward compat) ──────────────────────
    lifecycleBg:     colors.success.light,
    lifecycleFg:     colors.success.dark,
    lifecycleBorder: colors.success.base,
    trendingBg:      colors.warning.light,
    trendingFg:      colors.warning.dark,
    trendingBorder:  colors.warning.base,

    // ── lifecycle sub-types ───────────────────────────────────────────────
    lifecycleNewBg:         colors.success.light,
    lifecycleNewFg:         colors.success.dark,
    lifecycleComingSoonBg:  colors.info.light,
    lifecycleComingSoonFg:  colors.info.dark,
    lifecycleOngoingBg:     colors.success.light,
    lifecycleOngoingFg:     colors.success.dark,
    lifecycleCompletedBg:   'oklch(92.9% 0.006 247)',
    lifecycleCompletedFg:   'oklch(32.8% 0.012 247)',
    lifecycleDelistingBg:   colors.warning.light,
    lifecycleDelistingFg:   colors.warning.dark,

    // ── trending sub-types ────────────────────────────────────────────────
    trendingHotBg:          colors.error.light,
    trendingHotFg:          colors.error.dark,
    trendingWeeklyTopBg:    colors.warning.light,
    trendingWeeklyTopFg:    colors.warning.dark,
    trendingExclusiveBg:    colors.accent[100],
    trendingExclusiveFg:    colors.accent[700],
    trendingEditorPickBg:   colors.info.light,
    trendingEditorPickFg:   colors.info.dark,

    // ── spec / rating ─────────────────────────────────────────────────────
    specBg:          GLASS_DARK,
    specFg:          WHITE,
    specBorder:      'transparent',
    ratingBg:        GLASS_LIGHT,
    ratingBorder:    'transparent',
    borderRadius:    '4px',
  },
  dark: {
    // ── aggregate aliases (kept for backward compat) ──────────────────────
    lifecycleBg:     colors.success.dark,
    lifecycleFg:     colors.success.light,
    lifecycleBorder: colors.success.base,
    trendingBg:      colors.warning.dark,
    trendingFg:      colors.warning.light,
    trendingBorder:  colors.warning.base,

    // ── lifecycle sub-types ───────────────────────────────────────────────
    lifecycleNewBg:         colors.success.dark,
    lifecycleNewFg:         colors.success.light,
    lifecycleComingSoonBg:  colors.info.dark,
    lifecycleComingSoonFg:  colors.info.light,
    lifecycleOngoingBg:     colors.success.dark,
    lifecycleOngoingFg:     colors.success.light,
    lifecycleCompletedBg:   'oklch(23.0% 0.010 247)',
    lifecycleCompletedFg:   'oklch(70.8% 0.012 247)',
    lifecycleDelistingBg:   colors.warning.dark,
    lifecycleDelistingFg:   colors.warning.light,

    // ── trending sub-types ────────────────────────────────────────────────
    trendingHotBg:          colors.error.dark,
    trendingHotFg:          colors.error.light,
    trendingWeeklyTopBg:    colors.warning.dark,
    trendingWeeklyTopFg:    colors.warning.light,
    trendingExclusiveBg:    colors.accent[900],
    trendingExclusiveFg:    colors.accent[100],
    trendingEditorPickBg:   colors.info.dark,
    trendingEditorPickFg:   colors.info.light,

    // ── spec / rating ─────────────────────────────────────────────────────
    specBg:          GLASS_DARK,
    specFg:          WHITE,
    specBorder:      'transparent',
    ratingBg:        GLASS_DARK,
    ratingBorder:    'transparent',
    borderRadius:    '4px',
  },
} as const

export type TagToken = typeof tag.light
export type TagTheme = keyof typeof tag

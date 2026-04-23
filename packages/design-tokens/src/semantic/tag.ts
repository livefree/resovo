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

    // ── type chips ────────────────────────────────────────────────────────
    chipMovieBg:     colors.accent[100],
    chipMovieFg:     colors.accent[700],
    chipSeriesBg:    colors.warning.light,
    chipSeriesFg:    colors.warning.dark,
    chipAnimeBg:     'oklch(91% 0.08 320)',
    chipAnimeFg:     'oklch(40% 0.14 320)',
    chipTvshowBg:    colors.success.light,
    chipTvshowFg:    colors.success.dark,
    chipDocBg:       colors.gray[200],
    chipDocFg:       colors.gray[700],

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

    // ── type chips ────────────────────────────────────────────────────────
    chipMovieBg:     colors.accent[900],
    chipMovieFg:     colors.accent[100],
    chipSeriesBg:    colors.warning.dark,
    chipSeriesFg:    colors.warning.light,
    chipAnimeBg:     'oklch(35% 0.12 320)',
    chipAnimeFg:     'oklch(91% 0.08 320)',
    chipTvshowBg:    colors.success.dark,
    chipTvshowFg:    colors.success.light,
    chipDocBg:       colors.gray[800],
    chipDocFg:       colors.gray[300],

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

import { colors } from '../primitives/color.js'

// Tag overlay colors (spec / rating) use glass — not mapped to color primitives
const GLASS_DARK  = 'color-mix(in oklch, oklch(6.5% 0.004 247) 72%, transparent)'
const GLASS_LIGHT = 'color-mix(in oklch, oklch(6.5% 0.004 247) 56%, transparent)'
const WHITE       = 'oklch(100% 0 0)'

export const tag = {
  light: {
    lifecycleBg:     colors.success.light,
    lifecycleFg:     colors.success.dark,
    lifecycleBorder: colors.success.base,
    trendingBg:      colors.warning.light,
    trendingFg:      colors.warning.dark,
    trendingBorder:  colors.warning.base,
    specBg:          GLASS_DARK,
    specFg:          WHITE,
    specBorder:      'transparent',
    ratingBg:        GLASS_LIGHT,
    ratingBorder:    'transparent',
    borderRadius:    '4px',
  },
  dark: {
    lifecycleBg:     colors.success.dark,
    lifecycleFg:     colors.success.light,
    lifecycleBorder: colors.success.base,
    trendingBg:      colors.warning.dark,
    trendingFg:      colors.warning.light,
    trendingBorder:  colors.warning.base,
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

import { colors } from '../primitives/color.js'

export const accent = {
  light: {
    default: colors.accent[500],
    hover: colors.accent[700],
    active: colors.accent[900],
    muted: colors.accent[100],
    fg: colors.gray[0],
  },
  dark: {
    default: colors.accent[500],
    hover: colors.accent[300],
    active: colors.accent[100],
    muted: colors.accent[900],
    fg: colors.gray[0],
  },
} as const

export type AccentToken = keyof typeof accent.light
export type AccentTheme = keyof typeof accent

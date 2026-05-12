import { colors } from '../primitives/color.js'

export const fg = {
  light: {
    default: colors.gray[950],
    muted: colors.gray[700],
    subtle: colors.gray[500],
    onAccent: colors.gray[0],
    disabled: colors.gray[400],
  },
  dark: {
    default: colors.gray[50],
    muted: colors.gray[300],
    subtle: colors.gray[500],
    onAccent: colors.gray[0],
    disabled: colors.gray[600],
  },
} as const

export type FgToken = keyof typeof fg.light
export type FgTheme = keyof typeof fg

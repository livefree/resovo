import { colors } from '../primitives/color.js'

export const border = {
  light: {
    default: colors.gray[200],
    strong: colors.gray[400],
    subtle: colors.gray[100],
    focus: colors.accent[500],
  },
  dark: {
    default: colors.gray[800],
    strong: colors.gray[600],
    subtle: colors.gray[900],
    focus: colors.accent[500],
  },
} as const

export type BorderToken = keyof typeof border.light
export type BorderTheme = keyof typeof border

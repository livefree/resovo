import { colors } from '../primitives/color.js'

export const state = {
  light: {
    success: { bg: colors.success.light, fg: colors.success.dark, border: colors.success.base },
    warning: { bg: colors.warning.light, fg: colors.warning.dark, border: colors.warning.base },
    error: { bg: colors.error.light, fg: colors.error.dark, border: colors.error.base },
    info: { bg: colors.info.light, fg: colors.info.dark, border: colors.info.base },
  },
  dark: {
    success: { bg: colors.success.dark, fg: colors.success.light, border: colors.success.base },
    warning: { bg: colors.warning.dark, fg: colors.warning.light, border: colors.warning.base },
    error: { bg: colors.error.dark, fg: colors.error.light, border: colors.error.base },
    info: { bg: colors.info.dark, fg: colors.info.light, border: colors.info.base },
  },
} as const

export type StateKind = keyof typeof state.light
export type StateSlot = keyof typeof state.light.success
export type StateTheme = keyof typeof state

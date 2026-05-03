import { colors } from '../primitives/color.js'

const softMix = (color: string): string =>
  `color-mix(in oklch, ${color} 14%, transparent)`

const sharedSlots = {
  success: {
    bg: softMix(colors.success.base),
    fg: colors.success.base,
    border: colors.success.base,
  },
  warning: {
    bg: softMix(colors.warning.base),
    fg: colors.warning.base,
    border: colors.warning.base,
  },
  error: {
    bg: softMix(colors.error.base),
    fg: colors.error.base,
    border: colors.error.base,
  },
  info: {
    bg: softMix(colors.info.base),
    fg: colors.info.base,
    border: colors.info.base,
  },
} as const

export const state = {
  light: sharedSlots,
  dark: sharedSlots,
} as const

export type StateKind = keyof typeof state.light
export type StateSlot = keyof typeof state.light.success
export type StateTheme = keyof typeof state

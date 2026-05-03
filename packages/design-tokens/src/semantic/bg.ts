import { colors } from '../primitives/color.js'

export const bg = {
  light: {
    canvas: colors.gray[100],
    surface: colors.gray[0],
    surfaceRaised: colors.gray[0],
    surfaceRow: colors.gray[100],
    surfaceElevated: colors.gray[0],
    surfaceSunken: colors.gray[100],
    overlay: `color-mix(in oklch, ${colors.gray[1000]} 50%, transparent)`,
  },
  dark: {
    canvas: colors.gray[1000],
    surface: colors.gray[950],
    surfaceRaised: colors.gray[925],
    surfaceRow: colors.gray[900],
    surfaceElevated: colors.gray[800],
    surfaceSunken: colors.gray[1000],
    overlay: `color-mix(in oklch, ${colors.gray[1000]} 70%, transparent)`,
  },
} as const

export type BgToken = keyof typeof bg.light
export type BgTheme = keyof typeof bg

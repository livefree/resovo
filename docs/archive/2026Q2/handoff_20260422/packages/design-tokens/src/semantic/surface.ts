import { colors } from '../primitives/color.js'

export const surface = {
  light: {
    canvas: colors.gray[50],
    surface: colors.gray[0],
    surfaceRaised: colors.gray[0],
    surfaceSunken: colors.gray[100],
    overlay: `color-mix(in oklch, ${colors.gray[1000]} 50%, transparent)`,
    glass: `color-mix(in oklch, ${colors.gray[0]} 70%, transparent)`,
    scrim: `linear-gradient(180deg, transparent 0%, ${colors.gray[1000]} 100%)`,
  },
  dark: {
    canvas: colors.gray[1000],
    surface: colors.gray[950],
    surfaceRaised: colors.gray[900],
    surfaceSunken: colors.gray[1000],
    overlay: `color-mix(in oklch, ${colors.gray[1000]} 70%, transparent)`,
    glass: `color-mix(in oklch, ${colors.gray[950]} 60%, transparent)`,
    scrim: `linear-gradient(180deg, transparent 0%, ${colors.gray[1000]} 100%)`,
  },
} as const

export type SurfaceToken = keyof typeof surface.light
export type SurfaceTheme = keyof typeof surface

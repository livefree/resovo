import { border } from '../semantic/border.js'
import { fg } from '../semantic/fg.js'
import { surface } from '../semantic/surface.js'
import { radius } from '../primitives/radius.js'
import { shadow } from '../primitives/shadow.js'
import { space } from '../primitives/space.js'

const base = {
  paddingX: space[6],
  paddingY: space[6],
  gap: space[4],
  radius: radius.lg,
} as const

function buildVariants(theme: 'light' | 'dark') {
  return {
    default: {
      default: { ...base, bg: surface[theme].surface, fg: fg[theme].default, border: border[theme].subtle, shadow: shadow.none },
      hover: { ...base, bg: surface[theme].surfaceRaised, fg: fg[theme].default, border: border[theme].default, shadow: shadow.sm },
    },
    elevated: {
      default: { ...base, bg: surface[theme].surfaceRaised, fg: fg[theme].default, border: 'transparent' as const, shadow: shadow.md },
      hover: { ...base, bg: surface[theme].surfaceRaised, fg: fg[theme].default, border: 'transparent' as const, shadow: shadow.lg },
    },
    outlined: {
      default: { ...base, bg: 'transparent' as const, fg: fg[theme].default, border: border[theme].default, shadow: shadow.none },
      hover: { ...base, bg: surface[theme].surfaceRaised, fg: fg[theme].default, border: border[theme].strong, shadow: shadow.sm },
    },
  } as const
}

export const card = {
  light: buildVariants('light'),
  dark: buildVariants('dark'),
} as const

export type CardTheme = keyof typeof card
export type CardVariant = keyof typeof card.light
export type CardState = keyof typeof card.light.default

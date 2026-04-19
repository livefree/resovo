import { bg } from '../semantic/bg.js'
import { border } from '../semantic/border.js'
import { fg } from '../semantic/fg.js'
import { state } from '../semantic/state.js'
import { surface } from '../semantic/surface.js'
import { radius } from '../primitives/radius.js'
import { shadow } from '../primitives/shadow.js'
import { space } from '../primitives/space.js'
import { typography } from '../primitives/typography.js'

const sizes = {
  sm: { height: space[8], paddingX: space[2], paddingY: space[1], fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.snug, radius: radius.sm },
  md: { height: space[12], paddingX: space[3], paddingY: space[2], fontSize: typography.fontSize.base, lineHeight: typography.lineHeight.normal, radius: radius.md },
  lg: { height: space[16], paddingX: space[4], paddingY: space[3], fontSize: typography.fontSize.lg, lineHeight: typography.lineHeight.normal, radius: radius.md },
} as const

function buildStates(theme: 'light' | 'dark') {
  return {
    default: { bg: surface[theme].surface, fg: fg[theme].default, border: border[theme].default, shadow: shadow.none },
    hover: { bg: surface[theme].surface, fg: fg[theme].default, border: border[theme].strong, shadow: shadow.none },
    focus: { bg: surface[theme].surface, fg: fg[theme].default, border: border[theme].focus, shadow: shadow.sm },
    error: { bg: surface[theme].surface, fg: fg[theme].default, border: state[theme].error.border, shadow: shadow.sm },
    disabled: { bg: bg[theme].surfaceSunken, fg: fg[theme].disabled, border: border[theme].subtle, shadow: shadow.none },
  } as const
}

function buildSizes(theme: 'light' | 'dark') {
  const states = buildStates(theme)
  return {
    sm: { ...sizes.sm, ...states },
    md: { ...sizes.md, ...states },
    lg: { ...sizes.lg, ...states },
  } as const
}

export const input = {
  light: { ...buildSizes('light'), placeholderFg: fg.light.subtle, labelFg: fg.light.muted },
  dark: { ...buildSizes('dark'), placeholderFg: fg.dark.subtle, labelFg: fg.dark.muted },
} as const

export type InputTheme = keyof typeof input
export type InputSize = 'sm' | 'md' | 'lg'
export type InputState = keyof ReturnType<typeof buildStates>

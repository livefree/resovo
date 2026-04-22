import { accent } from '../semantic/accent.js'
import { border } from '../semantic/border.js'
import { fg } from '../semantic/fg.js'
import { state } from '../semantic/state.js'
import { surface } from '../semantic/surface.js'
import { radius } from '../primitives/radius.js'
import { shadow } from '../primitives/shadow.js'
import { space } from '../primitives/space.js'
import { typography } from '../primitives/typography.js'

const sizes = {
  sm: {
    height: space[8],
    paddingX: space[3],
    paddingY: space[1],
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.tight,
    fontWeight: typography.fontWeight.medium,
    radius: radius.sm,
    gap: space[1],
  },
  md: {
    height: space[12],
    paddingX: space[4],
    paddingY: space[2],
    fontSize: typography.fontSize.base,
    lineHeight: typography.lineHeight.snug,
    fontWeight: typography.fontWeight.medium,
    radius: radius.md,
    gap: space[2],
  },
  lg: {
    height: space[16],
    paddingX: space[6],
    paddingY: space[3],
    fontSize: typography.fontSize.lg,
    lineHeight: typography.lineHeight.snug,
    fontWeight: typography.fontWeight.semibold,
    radius: radius.md,
    gap: space[2],
  },
} as const

function primaryStates(theme: 'light' | 'dark') {
  return {
    default: { bg: accent[theme].default, fg: accent[theme].fg, border: accent[theme].default, shadow: shadow.sm },
    hover: { bg: accent[theme].hover, fg: accent[theme].fg, border: accent[theme].hover, shadow: shadow.md },
    active: { bg: accent[theme].active, fg: accent[theme].fg, border: accent[theme].active, shadow: shadow.sm },
    disabled: { bg: accent[theme].muted, fg: fg[theme].disabled, border: accent[theme].muted, shadow: shadow.none },
    focusVisible: { bg: accent[theme].default, fg: accent[theme].fg, border: border[theme].focus, shadow: shadow.md },
  } as const
}

function secondaryStates(theme: 'light' | 'dark') {
  return {
    default: { bg: surface[theme].surface, fg: fg[theme].default, border: border[theme].default, shadow: shadow.sm },
    hover: { bg: surface[theme].surfaceRaised, fg: fg[theme].default, border: border[theme].strong, shadow: shadow.md },
    active: { bg: surface[theme].surfaceSunken, fg: fg[theme].default, border: border[theme].strong, shadow: shadow.sm },
    disabled: { bg: surface[theme].surfaceSunken, fg: fg[theme].disabled, border: border[theme].subtle, shadow: shadow.none },
    focusVisible: { bg: surface[theme].surface, fg: fg[theme].default, border: border[theme].focus, shadow: shadow.md },
  } as const
}

function ghostStates(theme: 'light' | 'dark') {
  return {
    default: { bg: 'transparent' as const, fg: fg[theme].default, border: 'transparent' as const, shadow: shadow.none },
    hover: { bg: surface[theme].surfaceRaised, fg: fg[theme].default, border: 'transparent' as const, shadow: shadow.none },
    active: { bg: surface[theme].surfaceSunken, fg: fg[theme].default, border: 'transparent' as const, shadow: shadow.none },
    disabled: { bg: 'transparent' as const, fg: fg[theme].disabled, border: 'transparent' as const, shadow: shadow.none },
    focusVisible: { bg: 'transparent' as const, fg: fg[theme].default, border: border[theme].focus, shadow: shadow.none },
  } as const
}

function destructiveStates(theme: 'light' | 'dark') {
  return {
    default: { bg: state[theme].error.bg, fg: state[theme].error.fg, border: state[theme].error.border, shadow: shadow.sm },
    hover: { bg: state[theme].error.border, fg: state[theme].error.bg, border: state[theme].error.border, shadow: shadow.md },
    active: { bg: state[theme].error.fg, fg: state[theme].error.bg, border: state[theme].error.fg, shadow: shadow.sm },
    disabled: { bg: state[theme].error.bg, fg: fg[theme].disabled, border: state[theme].error.bg, shadow: shadow.none },
    focusVisible: { bg: state[theme].error.bg, fg: state[theme].error.fg, border: border[theme].focus, shadow: shadow.md },
  } as const
}

function buildVariants(theme: 'light' | 'dark') {
  const p = primaryStates(theme)
  const s = secondaryStates(theme)
  const g = ghostStates(theme)
  const d = destructiveStates(theme)
  return {
    primary: { sm: { ...sizes.sm, ...p }, md: { ...sizes.md, ...p }, lg: { ...sizes.lg, ...p } },
    secondary: { sm: { ...sizes.sm, ...s }, md: { ...sizes.md, ...s }, lg: { ...sizes.lg, ...s } },
    ghost: { sm: { ...sizes.sm, ...g }, md: { ...sizes.md, ...g }, lg: { ...sizes.lg, ...g } },
    destructive: { sm: { ...sizes.sm, ...d }, md: { ...sizes.md, ...d }, lg: { ...sizes.lg, ...d } },
  } as const
}

export const button = {
  light: buildVariants('light'),
  dark: buildVariants('dark'),
} as const

export type ButtonTheme = keyof typeof button
export type ButtonVariant = keyof typeof button.light
export type ButtonSize = keyof typeof button.light.primary
export type ButtonState = keyof typeof button.light.primary.md

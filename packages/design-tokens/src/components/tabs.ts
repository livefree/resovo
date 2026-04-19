import { accent } from '../semantic/accent.js'
import { border } from '../semantic/border.js'
import { fg } from '../semantic/fg.js'
import { surface } from '../semantic/surface.js'
import { radius } from '../primitives/radius.js'
import { space } from '../primitives/space.js'
import { typography } from '../primitives/typography.js'

const base = {
  paddingX: space[4],
  paddingY: space[2],
  gap: space[2],
  fontSize: typography.fontSize.sm,
  lineHeight: typography.lineHeight.snug,
  fontWeight: typography.fontWeight.medium,
  radius: radius.sm,
  indicatorHeight: space[0.5],
  indicatorRadius: radius.full,
} as const

function buildStates(theme: 'light' | 'dark') {
  return {
    default: { ...base, bg: 'transparent' as const, fg: fg[theme].muted, border: 'transparent' as const },
    active: { ...base, bg: 'transparent' as const, fg: accent[theme].default, border: 'transparent' as const },
    hover: { ...base, bg: surface[theme].surfaceRaised, fg: fg[theme].default, border: 'transparent' as const },
    disabled: { ...base, bg: 'transparent' as const, fg: fg[theme].disabled, border: 'transparent' as const },
  } as const
}

export const tabs = {
  light: {
    item: buildStates('light'),
    indicator: { bg: accent.light.default, border: border.light.focus },
    list: { bg: 'transparent' as const, borderBottom: border.light.subtle },
  },
  dark: {
    item: buildStates('dark'),
    indicator: { bg: accent.dark.default, border: border.dark.focus },
    list: { bg: 'transparent' as const, borderBottom: border.dark.subtle },
  },
} as const

export type TabsTheme = keyof typeof tabs
export type TabsItemState = keyof typeof tabs.light.item

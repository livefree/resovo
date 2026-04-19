import { bg } from '../semantic/bg.js'
import { border } from '../semantic/border.js'
import { fg } from '../semantic/fg.js'
import { radius } from '../primitives/radius.js'
import { shadow } from '../primitives/shadow.js'
import { space } from '../primitives/space.js'
import { typography } from '../primitives/typography.js'
import { zIndex } from '../primitives/z-index.js'

function buildTooltip(theme: 'light' | 'dark') {
  const panelBg = theme === 'light' ? bg.dark.surfaceRaised : bg.light.surfaceRaised
  const panelFg = theme === 'light' ? fg.dark.default : fg.light.default
  return {
    bg: panelBg,
    fg: panelFg,
    border: border[theme].subtle,
    shadow: shadow.md,
    radius: radius.sm,
    paddingX: space[2],
    paddingY: space[1],
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.snug,
    fontWeight: typography.fontWeight.medium,
    arrow: { bg: panelBg, size: space[2] },
    zIndex: zIndex.tooltip,
  } as const
}

export const tooltip = {
  light: buildTooltip('light'),
  dark: buildTooltip('dark'),
} as const

export type TooltipTheme = keyof typeof tooltip

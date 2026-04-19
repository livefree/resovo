import { accent } from '../semantic/accent.js'
import { border } from '../semantic/border.js'
import { fg } from '../semantic/fg.js'
import { surface } from '../semantic/surface.js'
import { space } from '../primitives/space.js'
import { typography } from '../primitives/typography.js'

function buildTable(theme: 'light' | 'dark') {
  return {
    header: {
      bg: surface[theme].surfaceSunken, fg: fg[theme].muted, border: border[theme].default,
      paddingX: space[4], paddingY: space[3],
      fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.snug,
      fontWeight: typography.fontWeight.semibold,
    },
    row: {
      default: { bg: surface[theme].surface, fg: fg[theme].default, border: border[theme].subtle },
      hover: { bg: surface[theme].surfaceRaised, fg: fg[theme].default, border: border[theme].default },
      selected: { bg: accent[theme].muted, fg: fg[theme].default, border: accent[theme].default },
      striped: { bg: surface[theme].surfaceSunken, fg: fg[theme].default, border: border[theme].subtle },
    },
    cell: {
      paddingX: space[4], paddingY: space[3], border: border[theme].subtle,
      fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.normal,
      fontWeight: typography.fontWeight.regular, fg: fg[theme].default,
    },
  } as const
}

export const table = {
  light: buildTable('light'),
  dark: buildTable('dark'),
} as const

export type TableTheme = keyof typeof table
export type TableRowState = keyof typeof table.light.row

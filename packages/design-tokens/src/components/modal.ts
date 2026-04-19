import { border } from '../semantic/border.js'
import { fg } from '../semantic/fg.js'
import { surface } from '../semantic/surface.js'
import { radius } from '../primitives/radius.js'
import { shadow } from '../primitives/shadow.js'
import { space } from '../primitives/space.js'
import { typography } from '../primitives/typography.js'
import { zIndex } from '../primitives/z-index.js'

function buildParts(theme: 'light' | 'dark') {
  return {
    backdrop: { bg: surface[theme].overlay, zIndex: zIndex.overlay },
    panel: {
      bg: surface[theme].surfaceRaised, fg: fg[theme].default, border: border[theme].subtle,
      radius: radius.lg, shadow: shadow.xl, paddingX: space[6], paddingY: space[6],
      gap: space[4], zIndex: zIndex.modal,
    },
    header: {
      bg: 'transparent' as const, fg: fg[theme].default, borderBottom: border[theme].subtle,
      paddingX: space[6], paddingY: space[4],
      fontSize: typography.fontSize.lg, lineHeight: typography.lineHeight.snug,
      fontWeight: typography.fontWeight.semibold,
    },
    body: {
      bg: 'transparent' as const, fg: fg[theme].default,
      paddingX: space[6], paddingY: space[4],
      fontSize: typography.fontSize.base, lineHeight: typography.lineHeight.normal,
      fontWeight: typography.fontWeight.regular,
    },
    footer: {
      bg: 'transparent' as const, fg: fg[theme].muted, borderTop: border[theme].subtle,
      paddingX: space[6], paddingY: space[4], gap: space[2],
    },
  } as const
}

export const modal = {
  light: buildParts('light'),
  dark: buildParts('dark'),
} as const

export type ModalTheme = keyof typeof modal
export type ModalPart = keyof typeof modal.light

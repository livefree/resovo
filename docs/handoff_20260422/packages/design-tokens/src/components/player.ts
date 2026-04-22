import { colors } from '../primitives/color.js'
import { accent } from '../semantic/accent.js'
import { radius } from '../primitives/radius.js'
import { shadow } from '../primitives/shadow.js'
import { space } from '../primitives/space.js'
import { zIndex } from '../primitives/z-index.js'

const controlsFg = colors.gray[50]
const progressTrack = `color-mix(in oklch, ${colors.gray[0]} 25%, transparent)`
const bufferFill = `color-mix(in oklch, ${colors.gray[0]} 45%, transparent)`

export const player = {
  full: {
    bg: colors.gray[1000],
    overlay: `color-mix(in oklch, ${colors.gray[1000]} 70%, transparent)`,
    controlsFg,
    progressTrack,
    progressFill: accent.dark.default,
    bufferFill,
    radius: radius.none,
    shadow: shadow.none,
    paddingX: space[4],
    paddingY: space[3],
    zIndex: zIndex.player,
  },
  mini: {
    bg: colors.gray[950],
    overlay: `color-mix(in oklch, ${colors.gray[1000]} 55%, transparent)`,
    controlsFg,
    progressTrack,
    progressFill: accent.dark.default,
    bufferFill,
    radius: radius.md,
    shadow: shadow.lg,
    paddingX: space[2],
    paddingY: space[2],
    zIndex: zIndex.player,
  },
  pip: {
    bg: colors.gray[900],
    overlay: `color-mix(in oklch, ${colors.gray[1000]} 40%, transparent)`,
    controlsFg,
    progressTrack,
    progressFill: accent.dark.default,
    bufferFill,
    radius: radius.full,
    shadow: shadow.xl,
    paddingX: space[2],
    paddingY: space[2],
    zIndex: zIndex.player,
  },
} as const

export type PlayerMode = keyof typeof player
export type PlayerSlot = keyof typeof player.full

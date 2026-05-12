import { colors } from '../primitives/color.js'

export interface TakeoverTheme {
  maskColorFast:     string
  maskColorStandard: string
  floatingPlayBg:    string
  floatingPlayFg:    string
}

export interface TakeoverToken {
  fastDurationMobile:    string
  fastDurationDesktop:   string
  standardDuration:      string
  reducedMotionDuration: string
  light: TakeoverTheme
  dark:  TakeoverTheme
}

export const takeover: TakeoverToken = {
  fastDurationMobile:    '200ms',
  fastDurationDesktop:   '240ms',
  standardDuration:      '360ms',
  reducedMotionDuration: '120ms',
  light: {
    maskColorFast:     'color-mix(in oklch, oklch(6.5% 0.004 247) 45%, transparent)',
    maskColorStandard: 'color-mix(in oklch, oklch(6.5% 0.004 247) 60%, transparent)',
    floatingPlayBg:    colors.accent[500],
    floatingPlayFg:    'oklch(100% 0 0)',
  },
  dark: {
    maskColorFast:     'color-mix(in oklch, oklch(6.5% 0.004 247) 55%, transparent)',
    maskColorStandard: 'color-mix(in oklch, oklch(6.5% 0.004 247) 70%, transparent)',
    floatingPlayBg:    colors.accent[500],
    floatingPlayFg:    'oklch(100% 0 0)',
  },
}

import { colors } from '../primitives/color.js'

export interface TabbarTheme {
  bg:             string
  underlineColor: string
}

export interface TabbarToken {
  height:                      string
  blur:                        string
  underlineTransitionDuration: string
  light: TabbarTheme
  dark:  TabbarTheme
}

export const tabbar: TabbarToken = {
  height:                      '56px',
  blur:                        '12px',
  underlineTransitionDuration: '180ms',
  light: {
    bg:             'color-mix(in oklch, oklch(100% 0 0) 85%, transparent)',
    underlineColor: colors.accent[500],
  },
  dark: {
    bg:             'color-mix(in oklch, oklch(11.2% 0.006 247) 85%, transparent)',
    underlineColor: colors.accent[500],
  },
}

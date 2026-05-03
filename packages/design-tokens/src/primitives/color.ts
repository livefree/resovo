export const colors = {
  gray: {
    0: 'oklch(100% 0 0)',
    50: 'oklch(98.5% 0.002 247)',
    100: 'oklch(96.8% 0.004 247)',
    200: 'oklch(92.9% 0.006 247)',
    300: 'oklch(86.9% 0.009 247)',
    400: 'oklch(70.8% 0.012 247)',
    500: 'oklch(55.4% 0.014 247)',
    600: 'oklch(43.9% 0.014 247)',
    700: 'oklch(32.8% 0.012 247)',
    800: 'oklch(23.0% 0.010 247)',
    900: 'oklch(16.5% 0.008 247)',
    925: 'oklch(13.5% 0.007 247)',
    950: 'oklch(11.2% 0.006 247)',
    1000: 'oklch(6.5% 0.004 247)',
  },
  accent: {
    100: 'oklch(92.0% 0.045 230)',
    300: 'oklch(78.0% 0.110 230)',
    500: 'oklch(64.5% 0.165 230)',
    700: 'oklch(52.0% 0.155 230)',
    900: 'oklch(38.0% 0.120 230)',
  },
  success: {
    light: 'oklch(88.0% 0.090 155)',
    base: 'oklch(62.0% 0.165 155)',
    dark: 'oklch(44.0% 0.135 155)',
  },
  warning: {
    light: 'oklch(90.0% 0.095 85)',
    base: 'oklch(74.0% 0.160 85)',
    dark: 'oklch(52.0% 0.135 85)',
  },
  error: {
    light: 'oklch(88.0% 0.080 25)',
    base: 'oklch(62.0% 0.195 25)',
    dark: 'oklch(45.0% 0.165 25)',
  },
  info: {
    light: 'oklch(90.0% 0.060 250)',
    base: 'oklch(66.0% 0.145 250)',
    dark: 'oklch(48.0% 0.125 250)',
  },
} as const

export type ColorToken = typeof colors
export type ColorScale = keyof ColorToken
export type GrayStep = keyof ColorToken['gray']
export type AccentStep = keyof ColorToken['accent']
export type StatusStep = keyof ColorToken['success']

export const typography = {
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
    '5xl': '3rem',
  },
  lineHeight: {
    tight: '1.15',
    snug: '1.3',
    normal: '1.5',
    relaxed: '1.65',
    loose: '1.85',
  },
  fontWeight: {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  fontFamily: {
    sans: "'Inter', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', system-ui, sans-serif",
    mono: "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace",
  },
} as const

export type TypographyToken = typeof typography
export type FontSizeStep = keyof TypographyToken['fontSize']
export type LineHeightStep = keyof TypographyToken['lineHeight']
export type FontWeightStep = keyof TypographyToken['fontWeight']
export type FontFamilyStep = keyof TypographyToken['fontFamily']

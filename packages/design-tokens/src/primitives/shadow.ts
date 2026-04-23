export const shadow = {
  none: 'none',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.45), 0 0 0 1px rgb(255 255 255 / 0.04)',
  md: '0 4px 8px -2px rgb(0 0 0 / 0.55), 0 2px 4px -2px rgb(0 0 0 / 0.45), 0 0 0 1px rgb(255 255 255 / 0.05)',
  lg: '0 10px 20px -4px rgb(0 0 0 / 0.65), 0 6px 10px -4px rgb(0 0 0 / 0.5), 0 0 0 1px rgb(255 255 255 / 0.06)',
  xl: '0 24px 48px -8px rgb(0 0 0 / 0.75), 0 12px 20px -8px rgb(0 0 0 / 0.55), 0 0 0 1px rgb(255 255 255 / 0.07)',
  cardHover: '0 8px 24px -8px rgb(0 0 0 / 0.28), 0 2px 6px rgb(0 0 0 / 0.08)',
} as const

export type ShadowToken = typeof shadow
export type ShadowStep = keyof ShadowToken

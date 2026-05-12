export const size = {
  xs: '1rem',
  sm: '1.5rem',
  md: '2rem',
  lg: '2.5rem',
  xl: '3rem',
  '2xl': '4rem',
  '3xl': '6rem',
  '4xl': '8rem',
  '5xl': '12rem',
} as const

export type SizeToken = typeof size
export type SizeStep = keyof SizeToken

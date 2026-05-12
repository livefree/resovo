export interface SkeletonTheme {
  bgBase:      string
  bgHighlight: string
}

export interface SkeletonToken {
  light:             SkeletonTheme
  dark:              SkeletonTheme
  shimmerDuration:   string
  delayTier1:        string
  delayTier2:        string
}

export const skeleton: SkeletonToken = {
  light: {
    bgBase:      'oklch(93.0% 0.004 247)',
    bgHighlight: 'oklch(98.5% 0.002 247)',
  },
  dark: {
    bgBase:      'oklch(22.0% 0.006 247)',
    bgHighlight: 'oklch(30.0% 0.008 247)',
  },
  shimmerDuration: '1.5s',
  delayTier1:      '300ms',
  delayTier2:      '800ms',
}

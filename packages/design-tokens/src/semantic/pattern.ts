export interface PatternTheme {
  dotsBg:   string
  gridBg:   string
  noiseBg:  string
  dotsSize: string
  gridSize: string
}

export interface PatternToken {
  light: PatternTheme
  dark:  PatternTheme
}

export const pattern: PatternToken = {
  light: {
    dotsBg:   'radial-gradient(oklch(86.9% 0.009 247) 1px, transparent 1px)',
    gridBg:   'linear-gradient(oklch(92.9% 0.006 247) 1px, transparent 1px), linear-gradient(90deg, oklch(92.9% 0.006 247) 1px, transparent 1px)',
    noiseBg:  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.9'/%3E%3CfeColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.04 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
    dotsSize: '20px 20px',
    gridSize: '40px 40px',
  },
  dark: {
    dotsBg:   'radial-gradient(oklch(23.0% 0.010 247) 1px, transparent 1px)',
    gridBg:   'linear-gradient(oklch(16.5% 0.008 247) 1px, transparent 1px), linear-gradient(90deg, oklch(16.5% 0.008 247) 1px, transparent 1px)',
    noiseBg:  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.9'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.03 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
    dotsSize: '20px 20px',
    gridSize: '40px 40px',
  },
}

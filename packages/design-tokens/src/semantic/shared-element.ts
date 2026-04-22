export interface SharedElementToken {
  duration:         string
  easing:           string
  fallbackDuration: string
}

export const sharedElement: SharedElementToken = {
  duration:         '360ms',
  easing:           'cubic-bezier(0.4, 0, 0.2, 1)',
  fallbackDuration: '120ms',
}

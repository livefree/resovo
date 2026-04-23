export const motion = {
  duration: {
    instant: '0ms',
    fast: '120ms',
    base: '200ms',
    slow: '320ms',
    slower: '480ms',
    slowest: '720ms',
    fade: '200ms',
    push: '240ms',
    snap: '260ms',
    shimmer: '1400ms',
  },
  easing: {
    linear: 'linear',
    'ease-in': 'cubic-bezier(0.4, 0, 1, 1)',
    'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
    'ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const

export type MotionToken = typeof motion
export type DurationStep = keyof MotionToken['duration']
export type EasingStep = keyof MotionToken['easing']

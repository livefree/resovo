export interface RouteTransitionToken {
  fadeDuration:    string
  fadeEasing:      string
  slideDuration:   string
  slideDistance:   string
  slideEasing:     string
  sharedDuration:  string
  sharedEasing:    string
  reducedDuration: string
}

export const routeTransition: RouteTransitionToken = {
  fadeDuration:    '200ms',
  fadeEasing:      'cubic-bezier(0, 0, 0.2, 1)',
  slideDuration:   '320ms',
  slideDistance:   '32px',
  slideEasing:     'cubic-bezier(0.4, 0, 0.2, 1)',
  sharedDuration:  '360ms',
  sharedEasing:    'cubic-bezier(0.4, 0, 0.2, 1)',
  reducedDuration: '80ms',
}

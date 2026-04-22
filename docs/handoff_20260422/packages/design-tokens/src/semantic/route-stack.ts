export interface RouteStackToken {
  edgeTriggerWidth:      string
  thresholdRatio:        number
  velocityThreshold:     number
  backAnimationDuration: string
}

export const routeStack: RouteStackToken = {
  edgeTriggerWidth:      '20px',
  thresholdRatio:        0.3,
  velocityThreshold:     0.5,
  backAnimationDuration: '240ms',
}

export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  overlay: 1200,
  modal: 1300,
  popover: 1400,
  tooltip: 1500,
  toast: 1600,
  player: 1700,
} as const

export type ZIndexToken = typeof zIndex
export type ZIndexStep = keyof ZIndexToken

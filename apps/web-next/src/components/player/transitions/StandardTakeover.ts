const DURATION_MOBILE = 280
const DURATION_DESKTOP = 360
const DURATION_REDUCED = 160
const EASING = 'cubic-bezier(0.32, 0.72, 0, 1)'

export function applyStandardTakeoverEntry(el: HTMLElement): Animation {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (prefersReduced) {
    return el.animate(
      [{ opacity: '0' }, { opacity: '1' }],
      { duration: DURATION_REDUCED, easing: 'ease', fill: 'forwards' },
    )
  }

  const isMobile = window.matchMedia('(hover: none)').matches
  const total = isMobile ? DURATION_MOBILE : DURATION_DESKTOP

  // Deliberate reveal: fade in with slight upward slide (SharedElement cover → full frame)
  return el.animate(
    [
      { opacity: '0', transform: 'scale(0.96) translateY(8px)', offset: 0 },
      { opacity: '0.6', transform: 'scale(0.99) translateY(2px)', offset: 0.5 },
      { opacity: '1', transform: 'scale(1) translateY(0)', offset: 1 },
    ],
    { duration: total, easing: EASING, fill: 'forwards' },
  )
}

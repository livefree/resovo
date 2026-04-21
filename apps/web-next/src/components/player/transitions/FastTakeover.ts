const DURATION_MOBILE = 200
const DURATION_DESKTOP = 240
const DURATION_REDUCED = 120
const EASING = 'cubic-bezier(0.4, 0, 0.2, 1)'

// Phase boundary: 60% of total duration separates scale+overlay from controls fade-in
const PHASE_A_RATIO = 0.6

export function applyFastTakeoverEntry(el: HTMLElement): Animation {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (prefersReduced) {
    return el.animate(
      [{ opacity: '0' }, { opacity: '1' }],
      { duration: DURATION_REDUCED, easing: 'ease', fill: 'forwards' },
    )
  }

  // Hover pointer detection: (hover: none) = touch device
  const isMobile = window.matchMedia('(hover: none)').matches
  const total = isMobile ? DURATION_MOBILE : DURATION_DESKTOP
  const phaseA = total * PHASE_A_RATIO

  // Phase A: overlay darkens as the card image scales up (visual "punch")
  // Phase B: content fades in as the full-frame player takes over
  return el.animate(
    [
      { opacity: '0', transform: 'scale(0.97)', offset: 0 },
      { opacity: '0.85', transform: 'scale(1.01)', offset: phaseA / total },
      { opacity: '1', transform: 'scale(1)', offset: 1 },
    ],
    { duration: total, easing: EASING, fill: 'forwards' },
  )
}

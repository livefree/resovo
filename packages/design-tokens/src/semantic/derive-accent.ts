export type AccentScale = {
  50: string
  100: string
  200: string
  300: string
  400: string
  500: string
  600: string
  700: string
  800: string
  900: string
  950: string
}

type OklchParts = { l: number; c: number; h: number; alpha: number | null }

const STEP_LIGHTNESS: Record<keyof AccentScale, number> = {
  50: 95,
  100: 90,
  200: 82,
  300: 72,
  400: 62,
  500: 54,
  600: 47,
  700: 40,
  800: 33,
  900: 26,
  950: 20,
}

function parseOklch(input: string): OklchParts {
  const match = input
    .trim()
    .match(
      /^oklch\(\s*([0-9.]+)%?\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*([0-9.]+%?))?\s*\)$/i,
    )
  if (!match) throw new Error(`deriveAccent: invalid oklch seed: ${input}`)
  const rawL = parseFloat(match[1])
  const c = parseFloat(match[2])
  const h = parseFloat(match[3])
  const alpha =
    match[4] != null
      ? match[4].endsWith('%')
        ? parseFloat(match[4]) / 100
        : parseFloat(match[4])
      : null
  return { l: rawL > 1 ? rawL : rawL * 100, c, h, alpha }
}

function formatOklch(parts: OklchParts, targetL: number): string {
  const { c, h, alpha } = parts
  const l = targetL.toFixed(2)
  const cStr = c.toFixed(3)
  const hStr = h.toFixed(2)
  return alpha != null
    ? `oklch(${l}% ${cStr} ${hStr} / ${alpha})`
    : `oklch(${l}% ${cStr} ${hStr})`
}

export function deriveAccent(seedOklch: string): AccentScale {
  const seed = parseOklch(seedOklch)
  const keys = (Object.keys(STEP_LIGHTNESS) as unknown) as Array<keyof AccentScale>
  const out = {} as AccentScale
  for (const key of keys) {
    const targetL = STEP_LIGHTNESS[key]
    // chroma 在极亮/极暗两端 gamut 外会溢出，按距种子的 L 距离线性衰减
    const distance = Math.abs(targetL - seed.l) / 75
    const chromaScale = Math.max(0.25, 1 - distance * 0.6)
    out[key] = formatOklch({ ...seed, c: seed.c * chromaScale }, targetL)
  }
  return out
}

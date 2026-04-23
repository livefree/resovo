import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { colors } from '../src/primitives/color.js'
import { space } from '../src/primitives/space.js'
import { size } from '../src/primitives/size.js'
import { radius } from '../src/primitives/radius.js'
import { typography } from '../src/primitives/typography.js'
import { motion } from '../src/primitives/motion.js'
import { shadow } from '../src/primitives/shadow.js'
import { zIndex } from '../src/primitives/z-index.js'
import { bg, fg, border, accent, surface, state, tag, pattern, routeTransition, layout } from '../src/semantic/index.js'
import { player } from '../src/components/player.js'
import { defaultBrandOverrides, DEFAULT_BRAND_SLUG } from '../src/brands/default.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

type TokenLeaf = string | number
type TokenTree = Record<string, unknown>

const PREFIX_MAP: Record<string, string> = {
  colors: 'color',
  space: 'space',
  size: 'size',
  radius: 'radius',
  shadow: 'shadow',
  zIndex: 'z',
  'typography.fontSize': 'font-size',
  'typography.lineHeight': 'line-height',
  'typography.fontWeight': 'font-weight',
  'typography.fontFamily': 'font-family',
  'motion.duration': 'duration',
  'motion.easing': 'easing',
}

function toKebab(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/\./g, '-')
    .toLowerCase()
}

function flatten(node: unknown, path: string[], out: Array<[string, string]>): void {
  if (node === null || node === undefined) return
  if (typeof node === 'string' || typeof node === 'number') {
    const varName = `--${path.map(toKebab).join('-')}`
    out.push([varName, String(node)])
    return
  }
  if (typeof node === 'object') {
    for (const [key, value] of Object.entries(node as TokenTree)) {
      flatten(value, [...path, key], out)
    }
  }
}

function buildGroup(rootKey: string, node: unknown): Array<[string, string]> {
  const out: Array<[string, string]> = []
  if (node === null || typeof node !== 'object') return out

  for (const [key, value] of Object.entries(node as TokenTree)) {
    const nestedPath = `${rootKey}.${key}`
    if (PREFIX_MAP[nestedPath]) {
      const prefix = PREFIX_MAP[nestedPath]
      const leaves: Array<[string, string]> = []
      flatten(value, [], leaves)
      for (const [leaf, v] of leaves) {
        const suffix = leaf.replace(/^--/, '')
        out.push([suffix ? `--${prefix}-${suffix}` : `--${prefix}`, v])
      }
    } else if (PREFIX_MAP[rootKey]) {
      const prefix = PREFIX_MAP[rootKey]
      const leaves: Array<[string, string]> = []
      flatten(value, [key], leaves)
      for (const [leaf, v] of leaves) {
        const suffix = leaf.replace(/^--/, '')
        out.push([`--${prefix}-${suffix}`, v])
      }
    }
  }
  return out
}

// ── Semantic 层辅助 ─────────────────────────────────────────────

type ThemeKey = 'light' | 'dark'
type SemanticGroup = { light: Record<string, unknown>; dark: Record<string, unknown> }

function buildSemanticGroup(prefix: string, group: SemanticGroup, theme: ThemeKey): Array<[string, string]> {
  const out: Array<[string, string]> = []
  const themeNode = group[theme]
  for (const [token, value] of Object.entries(themeNode)) {
    if (typeof value === 'string' || typeof value === 'number') {
      out.push([`--${prefix}-${toKebab(token)}`, String(value)])
    } else if (typeof value === 'object' && value !== null) {
      // nested (e.g. state.success.{bg,fg,border})
      for (const [slot, slotVal] of Object.entries(value as Record<string, unknown>)) {
        if (typeof slotVal === 'string' || typeof slotVal === 'number') {
          out.push([`--${prefix}-${toKebab(token)}-${toKebab(slot)}`, String(slotVal)])
        }
      }
    }
  }
  return out
}

function buildSemanticVars(theme: ThemeKey): Array<[string, string]> {
  return [
    ...buildSemanticGroup('bg', bg as SemanticGroup, theme),
    ...buildSemanticGroup('fg', fg as SemanticGroup, theme),
    ...buildSemanticGroup('border', border as SemanticGroup, theme),
    ...buildSemanticGroup('accent', accent as SemanticGroup, theme),
    ...buildSemanticGroup('surface', surface as SemanticGroup, theme),
    ...buildSemanticGroup('state', state as SemanticGroup, theme),
    ...buildSemanticGroup('tag', tag as SemanticGroup, theme),
    ...buildSemanticGroup('pattern', pattern as SemanticGroup, theme),
  ]
}

function buildThemeIndependentVars(): Array<[string, string]> {
  const out: Array<[string, string]> = []

  for (const [key, value] of Object.entries(routeTransition) as Array<[string, string]>) {
    out.push([`--route-transition-${toKebab(key)}`, value])
  }

  for (const [mode, slots] of Object.entries(player) as Array<[string, Record<string, unknown>]>) {
    for (const [slot, value] of Object.entries(slots)) {
      if (typeof value === 'string' || typeof value === 'number') {
        out.push([`--player-${toKebab(mode)}-${toKebab(slot)}`, String(value)])
      }
    }
  }

  // layout — 叶子 key 即 CSS 变量名（不含 --），直接输出，不加文件前缀
  for (const group of Object.values(layout)) {
    for (const [varName, value] of Object.entries(group as Record<string, string>)) {
      out.push([`--${varName}`, value])
    }
  }

  return out
}

// ── Brand 覆写层辅助 ────────────────────────────────────────────

function buildBrandOverrideVars(
  overrides: typeof defaultBrandOverrides,
  theme: ThemeKey,
): Array<[string, string]> {
  const out: Array<[string, string]> = []
  const sem = overrides.semantic
  if (!sem) return out

  const semGroups: Array<[string, Record<string, Record<string, string | undefined>> | undefined]> = [
    ['bg', sem.bg?.[theme] ? { [theme]: sem.bg[theme] as Record<string, string> } : undefined],
    ['fg', sem.fg?.[theme] ? { [theme]: sem.fg[theme] as Record<string, string> } : undefined],
    ['border', sem.border?.[theme] ? { [theme]: sem.border[theme] as Record<string, string> } : undefined],
    ['accent', sem.accent?.[theme] ? { [theme]: sem.accent[theme] as Record<string, string> } : undefined],
    ['surface', sem.surface?.[theme] ? { [theme]: sem.surface[theme] as Record<string, string> } : undefined],
  ]
  for (const [prefix, node] of semGroups) {
    if (!node) continue
    const themeNode = node[theme]
    if (!themeNode) continue
    for (const [token, value] of Object.entries(themeNode)) {
      if (typeof value === 'string') {
        out.push([`--${prefix}-${toKebab(token)}`, value])
      }
    }
  }

  // state overrides
  const stateOverride = sem.state?.[theme]
  if (stateOverride) {
    for (const [kind, slots] of Object.entries(stateOverride)) {
      if (!slots) continue
      for (const [slot, value] of Object.entries(slots)) {
        if (typeof value === 'string') {
          out.push([`--state-${toKebab(kind)}-${toKebab(slot)}`, value])
        }
      }
    }
  }

  return out
}

// ── CSS 生成 ───────────────────────────────────────────────────

function buildCss(): string {
  // Primitive vars (theme-independent)
  const sources: Array<[string, unknown]> = [
    ['colors', colors],
    ['space', space],
    ['size', size],
    ['radius', radius],
    ['shadow', shadow],
    ['zIndex', zIndex],
    ['typography', typography],
    ['motion', motion],
  ]
  const primitiveVars: Array<[string, string]> = []
  for (const [rootKey, node] of sources) {
    primitiveVars.push(...buildGroup(rootKey, node))
  }

  // Semantic light vars (go in :root alongside primitives)
  const semanticLightVars = buildSemanticVars('light')

  // Brand light overrides for default brand (slug='resovo')
  const brandLightOverrides = buildBrandOverrideVars(defaultBrandOverrides, 'light')

  const themeIndependentVars = buildThemeIndependentVars()
  const rootVars = [...primitiveVars, ...themeIndependentVars, ...semanticLightVars, ...brandLightOverrides]
  const rootBody = rootVars.map(([k, v]) => `  ${k}: ${v};`).join('\n')

  // Semantic dark vars
  const semanticDarkVars = buildSemanticVars('dark')
  const brandDarkOverrides = buildBrandOverrideVars(defaultBrandOverrides, 'dark')
  const darkVars = [...semanticDarkVars, ...brandDarkOverrides]
  const darkBody = darkVars.map(([k, v]) => `  ${k}: ${v};`).join('\n')

  return [
    '/* AUTO-GENERATED by scripts/build-css.ts — DO NOT EDIT */',
    ':root {',
    rootBody,
    '}',
    '',
    '/* dark theme — triggered by [data-theme="dark"] on <html> */',
    '[data-theme="dark"] {',
    darkBody,
    '}',
    '',
  ].join('\n')
}

function main(): void {
  const outDir = resolve(__dirname, '../src/css')
  const outFile = resolve(outDir, 'tokens.css')
  mkdirSync(outDir, { recursive: true })
  const css = buildCss()
  writeFileSync(outFile, css, 'utf-8')
  console.log(`[design-tokens] wrote ${outFile} (${css.split('\n').length} lines)`)
}

main()

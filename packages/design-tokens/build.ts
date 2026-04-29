import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { colors } from './src/primitives/color.js'
import { space } from './src/primitives/space.js'
import { size } from './src/primitives/size.js'
import { radius } from './src/primitives/radius.js'
import { typography } from './src/primitives/typography.js'
import { motion } from './src/primitives/motion.js'
import { shadow } from './src/primitives/shadow.js'
import { zIndex } from './src/primitives/z-index.js'
import { bg } from './src/semantic/bg.js'
import { fg } from './src/semantic/fg.js'
import { border } from './src/semantic/border.js'
import { accent } from './src/semantic/accent.js'
import { surface } from './src/semantic/surface.js'
import { state } from './src/semantic/state.js'
import { layout } from './src/semantic/layout.js'
import { dualSignal } from './src/semantic/dual-signal.js'
import { adminShell, adminTable, adminDensity, adminShellZIndex, adminLayoutZIndexBusiness, adminShellSurfaces } from './src/admin-layout/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

type TokenTree = Record<string, unknown>

const PRIMITIVE_PREFIX_MAP: Record<string, string> = {
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
  return key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/\./g, '-').toLowerCase()
}

function flattenLeaves(node: unknown, path: string[], out: Array<[string, string]>): void {
  if (node === null || node === undefined) return
  if (typeof node === 'string' || typeof node === 'number') {
    out.push([`--${path.map(toKebab).join('-')}`, String(node)])
    return
  }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node as TokenTree)) flattenLeaves(v, [...path, k], out)
  }
}

function buildPrimitiveVars(): Array<[string, string]> {
  const sources: Array<[string, unknown]> = [
    ['colors', colors], ['space', space], ['size', size], ['radius', radius],
    ['shadow', shadow], ['zIndex', zIndex], ['typography', typography], ['motion', motion],
  ]
  const out: Array<[string, string]> = []
  for (const [rootKey, node] of sources) {
    for (const [subKey, subVal] of Object.entries(node as TokenTree)) {
      const nestedKey = `${rootKey}.${subKey}`
      const isNested = Boolean(PRIMITIVE_PREFIX_MAP[nestedKey])
      const prefix = PRIMITIVE_PREFIX_MAP[nestedKey] ?? PRIMITIVE_PREFIX_MAP[rootKey]
      if (!prefix) continue
      // For nested-prefix keys (e.g. typography.fontSize → font-size), the subKey IS the
      // category name so we don't repeat it; for root-prefix keys include subKey in path.
      const startPath = isNested ? [] : [subKey]
      const leaves: Array<[string, string]> = []
      flattenLeaves(subVal, startPath, leaves)
      for (const [leaf, v] of leaves) {
        const suffix = leaf.replace(/^--/, '')
        out.push([suffix ? `--${prefix}-${suffix}` : `--${prefix}`, v])
      }
    }
  }
  return out
}

function flattenSemantic(prefix: string, node: unknown, out: Array<[string, string]>): void {
  if (typeof node === 'string') { out.push([`--${prefix}`, node]); return }
  if (typeof node === 'object' && node !== null) {
    for (const [k, v] of Object.entries(node as TokenTree)) {
      flattenSemantic(`${prefix}-${toKebab(k)}`, v, out)
    }
  }
}

function buildSemanticVars(theme: 'light' | 'dark'): Array<[string, string]> {
  const sources: Array<[string, Record<'light' | 'dark', unknown>]> = [
    ['bg', bg], ['fg', fg], ['border', border],
    ['accent', accent], ['surface', surface], ['state', state],
    ['dual-signal', dualSignal],
  ]
  const out: Array<[string, string]> = []
  for (const [prefix, token] of sources) flattenSemantic(prefix, token[theme], out)
  return out
}

function buildLayoutVars(): Array<[string, string]> {
  const out: Array<[string, string]> = []
  for (const group of Object.values(layout)) {
    for (const [varName, value] of Object.entries(group as Record<string, string>)) {
      out.push([`--${varName}`, value])
    }
  }
  // admin-layout — 同 layout 模式（admin 专属，前台 0 消费 by ESLint + verify-token-isolation，CHG-SN-1-07/-09）
  // adminShellZIndex（CHG-SN-2-02 新增）：ADR-103a §4.3 4 级 z-index 规范
  // adminLayoutZIndexBusiness（CHG-SN-2-13）：ADR-103 §4.6 业务层 z-index
  // adminShellSurfaces（fix(CHG-SN-2-12)#vs）：admin 专属视觉 token
  for (const group of [adminShell, adminTable, adminDensity, adminShellZIndex, adminLayoutZIndexBusiness, adminShellSurfaces]) {
    for (const [varName, value] of Object.entries(group as Record<string, string>)) {
      out.push([`--${varName}`, value])
    }
  }
  return out
}

function buildCss(primitiveVars: Array<[string, string]>, lightVars: Array<[string, string]>, darkVars: Array<[string, string]>): string {
  const header = '/* AUTO-GENERATED by build.ts — DO NOT EDIT */\n'
  const layoutVars = buildLayoutVars()
  const rootBody = [...primitiveVars, ...layoutVars, ...lightVars].map(([k, v]) => `  ${k}: ${v};`).join('\n')
  const darkBody = darkVars.map(([k, v]) => `  ${k}: ${v};`).join('\n')
  return `${header}:root {\n${rootBody}\n}\n\n.dark {\n${darkBody}\n}\n`
}

function buildJs(): string {
  const tokens = {
    primitives: { colors, space, size, radius, shadow, typography, motion, zIndex },
    semantic: { bg, fg, border, accent, surface, state, dualSignal, layout },
    adminLayout: { adminShell, adminTable, adminDensity, adminShellZIndex, adminLayoutZIndexBusiness, adminShellSurfaces },
  }
  return `/* AUTO-GENERATED by build.ts — DO NOT EDIT */\nexport const tokens = ${JSON.stringify(tokens, null, 2)}\n`
}

function buildDts(primitiveVars: Array<[string, string]>, lightVars: Array<[string, string]>): string {
  const primitiveNames = primitiveVars.map(([k]) => `  | '${k}'`).join('\n')
  const semanticNames = lightVars.map(([k]) => `  | '${k}'`).join('\n')
  const layoutNames = buildLayoutVars().map(([k]) => `  | '${k}'`).join('\n')
  return [
    '/* AUTO-GENERATED by build.ts — DO NOT EDIT */',
    'export declare const tokens: {',
    '  primitives: { colors: object; space: object; size: object; radius: object; shadow: object; typography: object; motion: object; zIndex: object }',
    '  semantic: { bg: object; fg: object; border: object; accent: object; surface: object; state: object; dualSignal: object; layout: object }',
    '  adminLayout: { adminShell: object; adminTable: object; adminDensity: object; adminShellZIndex: object; adminLayoutZIndexBusiness: object; adminShellSurfaces: object }',
    '}',
    'export type PrimitiveVarName =',
    primitiveNames,
    'export type SemanticVarName =',
    semanticNames,
    'export type LayoutVarName =',
    layoutNames,
    'export type TokenVarName = PrimitiveVarName | SemanticVarName | LayoutVarName',
    '',
  ].join('\n')
}

function buildBaseTheme(lightVars: Array<[string, string]>, darkVars: Array<[string, string]>): string {
  const header = '/* AUTO-GENERATED by build.ts — DO NOT EDIT */\n'
  const lightBody = lightVars.map(([k, v]) => `  ${k}: ${v};`).join('\n')
  const darkBody = darkVars.map(([k, v]) => `  ${k}: ${v};`).join('\n')
  const mediaDark = darkVars.map(([k, v]) => `    ${k}: ${v};`).join('\n')
  return [
    header,
    ':root {',
    '  color-scheme: light dark;',
    lightBody,
    '}\n',
    '.dark {',
    darkBody,
    '}\n',
    '@media (prefers-color-scheme: dark) {',
    "  :root:not([data-theme='light']) {",
    mediaDark,
    '  }',
    '}\n',
  ].join('\n')
}

function main(): void {
  const outDir = resolve(__dirname, 'dist')
  mkdirSync(outDir, { recursive: true })

  const primitiveVars = buildPrimitiveVars()
  const lightVars = buildSemanticVars('light')
  const darkVars = buildSemanticVars('dark')

  const css = buildCss(primitiveVars, lightVars, darkVars)
  const baseTheme = buildBaseTheme(lightVars, darkVars)
  const js = buildJs()
  const dts = buildDts(primitiveVars, lightVars)

  writeFileSync(resolve(outDir, 'tokens.css'), css, 'utf-8')
  writeFileSync(resolve(outDir, 'base-theme.css'), baseTheme, 'utf-8')
  writeFileSync(resolve(outDir, 'tokens.js'), js, 'utf-8')
  writeFileSync(resolve(outDir, 'tokens.d.ts'), dts, 'utf-8')

  const cssKb = (Buffer.byteLength(css, 'utf-8') / 1024).toFixed(1)
  console.log(`[design-tokens] dist/tokens.css ${cssKb}KB (${css.split('\n').length} lines)`)
  console.log(`[design-tokens] dist/base-theme.css ${(Buffer.byteLength(baseTheme, 'utf-8') / 1024).toFixed(1)}KB`)
  console.log(`[design-tokens] dist/tokens.js ${(Buffer.byteLength(js, 'utf-8') / 1024).toFixed(1)}KB`)
  console.log(`[design-tokens] dist/tokens.d.ts written`)
}

main()

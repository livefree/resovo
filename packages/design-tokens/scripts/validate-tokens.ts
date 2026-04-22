/**
 * validate-tokens.ts
 * REG-M1-04-PREP: design-tokens 构建基础设施补全
 *
 * 验证范围：
 *   1. Primitive 层：所有叶值必须是 string | number（不验证数值合理性）
 *   2. Semantic 层：bg/fg/border/accent/surface/state 所有叶值必须是 string | number
 *   3. Component 层：所有叶值必须是 string | number
 *   4. Brand 层：defaultBrandOverrides 的键只能是 semantic | component（不得含 primitive 键）
 *
 * 退出码：0 = 全部通过；1 = 存在错误
 */

import { colors, space, size, radius, typography, motion, shadow, zIndex } from '../src/primitives/index.js'
import { bg, fg, border, accent, surface, state } from '../src/semantic/index.js'
import { button, card, input, modal, player, table, tabs, tooltip } from '../src/components/index.js'
import { defaultBrandOverrides } from '../src/brands/default.js'
import type { BrandOverrides } from '../src/brands/types.js'

type TokenLeaf = string | number
type TokenTree = Record<string, unknown>

const errors: string[] = []

// ── 递归校验叶值 ────────────────────────────────────────────────

function validateLeaves(node: unknown, path: string): void {
  if (node === null || node === undefined) {
    errors.push(`[null/undefined] ${path}`)
    return
  }
  if (typeof node === 'string' || typeof node === 'number') return
  if (typeof node !== 'object') {
    errors.push(`[unexpected type "${typeof node}"] ${path}`)
    return
  }
  for (const [key, value] of Object.entries(node as TokenTree)) {
    validateLeaves(value, `${path}.${key}`)
  }
}

// ── Primitive 层 ────────────────────────────────────────────────

const primitives: Array<[string, unknown]> = [
  ['colors', colors],
  ['space', space],
  ['size', size],
  ['radius', radius],
  ['shadow', shadow],
  ['zIndex', zIndex],
  ['typography', typography],
  ['motion', motion],
]
for (const [name, node] of primitives) {
  validateLeaves(node, `primitive.${name}`)
}

// ── Semantic 层 ────────────────────────────────────────────────

const semantics: Array<[string, unknown]> = [
  ['bg', bg],
  ['fg', fg],
  ['border', border],
  ['accent', accent],
  ['surface', surface],
  ['state', state],
]
for (const [name, node] of semantics) {
  validateLeaves(node, `semantic.${name}`)
}

// ── Component 层 ────────────────────────────────────────────────

const components: Array<[string, unknown]> = [
  ['button', button],
  ['card', card],
  ['input', input],
  ['modal', modal],
  ['player', player],
  ['table', table],
  ['tabs', tabs],
  ['tooltip', tooltip],
]
for (const [name, node] of components) {
  validateLeaves(node, `component.${name}`)
}

// ── Brand 层：键约束 ────────────────────────────────────────────
// BrandOverrides 只允许 semantic | component，禁止 primitive 顶层键

const PRIMITIVE_FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
  'colors', 'space', 'radius', 'typography', 'shadow', 'motion', 'size', 'zIndex',
])

function validateBrandOverrides(overrides: BrandOverrides, path: string): void {
  for (const key of Object.keys(overrides)) {
    if (PRIMITIVE_FORBIDDEN_KEYS.has(key)) {
      errors.push(`[primitive key forbidden in BrandOverrides] ${path}.${key}`)
    }
  }
  if (overrides.semantic !== undefined) {
    validateLeaves(overrides.semantic, `${path}.semantic`)
  }
  if (overrides.component !== undefined) {
    validateLeaves(overrides.component, `${path}.component`)
  }
}

validateBrandOverrides(defaultBrandOverrides, 'brand.defaultBrandOverrides')

// ── 输出结果 ───────────────────────────────────────────────────

if (errors.length > 0) {
  console.error('[design-tokens] validate-tokens FAILED:')
  for (const err of errors) {
    console.error(`  ✗ ${err}`)
  }
  process.exit(1)
} else {
  console.log('[design-tokens] validate-tokens OK — all layers valid')
  process.exit(0)
}

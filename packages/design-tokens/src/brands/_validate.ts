/**
 * _validate.ts — BrandOverrides 运行时校验（纯函数，无副作用，无 process/fs 依赖）
 * REG-M1-04: 供 validate-tokens.ts 薄壳和 DesignTokensService 复用
 */

import type { BrandOverrides } from './types.js'

// ── 常量 ────────────────────────────────────────────────────────

export const PRIMITIVE_FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
  'colors', 'space', 'radius', 'typography', 'shadow', 'motion', 'size', 'zIndex',
])

const SEMANTIC_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  'bg', 'fg', 'border', 'accent', 'surface', 'state',
])

const COMPONENT_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  'button', 'card', 'input', 'modal', 'player', 'table', 'tabs', 'tooltip',
])

// ── 类型 ────────────────────────────────────────────────────────

export interface ValidationError {
  readonly path: string
  readonly message: string
}

export interface ValidationResult {
  readonly ok: boolean
  readonly errors: readonly ValidationError[]
}

// ── 工具 ────────────────────────────────────────────────────────

function leafError(path: string, message: string): ValidationError {
  return { path, message }
}

function validateLeafValues(node: unknown, path: string, errors: ValidationError[]): void {
  if (node === null || node === undefined) {
    errors.push(leafError(path, 'null/undefined leaf'))
    return
  }
  if (typeof node === 'string' || typeof node === 'number') return
  if (typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      validateLeafValues(value, path ? `${path}.${key}` : key, errors)
    }
    return
  }
  errors.push(leafError(path, `unexpected type "${typeof node}"`))
}

// ── 主函数 ──────────────────────────────────────────────────────

/**
 * validateBrandOverridesShape — 校验 BrandOverrides 结构合法性
 *
 * 校验项：
 *   1. 顶层键不含 primitive 禁止键
 *   2. 顶层键只能是 semantic | component（unknown 键 → 警告，不阻断）
 *   3. semantic 下键只能是 bg/fg/border/accent/surface/state
 *   4. component 下键只能是 button/card/input/modal/player/table/tabs/tooltip
 *   5. 所有叶值必须是 string | number（不校验数值合理性）
 */
export function validateBrandOverridesShape(input: unknown): ValidationResult {
  const errors: ValidationError[] = []

  if (input === null || input === undefined) {
    return { ok: true, errors: [] }
  }

  if (typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: [leafError('', 'BrandOverrides must be a plain object')] }
  }

  const overrides = input as Record<string, unknown>

  for (const key of Object.keys(overrides)) {
    if (PRIMITIVE_FORBIDDEN_KEYS.has(key)) {
      errors.push(leafError(key, `primitive key "${key}" is forbidden in BrandOverrides (ADR-022)`))
    }
  }

  if (errors.length > 0) return { ok: false, errors }

  const semantic = overrides['semantic']
  if (semantic !== undefined && semantic !== null) {
    if (typeof semantic !== 'object' || Array.isArray(semantic)) {
      errors.push(leafError('semantic', 'must be a plain object'))
    } else {
      for (const key of Object.keys(semantic as Record<string, unknown>)) {
        if (!SEMANTIC_ALLOWED_KEYS.has(key)) {
          errors.push(leafError(`semantic.${key}`, `"${key}" is not an allowed semantic override key`))
        }
      }
      validateLeafValues(semantic, 'semantic', errors)
    }
  }

  const component = overrides['component']
  if (component !== undefined && component !== null) {
    if (typeof component !== 'object' || Array.isArray(component)) {
      errors.push(leafError('component', 'must be a plain object'))
    } else {
      for (const key of Object.keys(component as Record<string, unknown>)) {
        if (!COMPONENT_ALLOWED_KEYS.has(key)) {
          errors.push(leafError(`component.${key}`, `"${key}" is not an allowed component override key`))
        }
      }
      validateLeafValues(component, 'component', errors)
    }
  }

  return { ok: errors.length === 0, errors }
}

/**
 * assertBrandOverridesShape — 校验失败抛出 Error（方便 service 链式调用）
 */
export function assertBrandOverridesShape(input: unknown): asserts input is BrandOverrides {
  const result = validateBrandOverridesShape(input)
  if (!result.ok) {
    const messages = result.errors.map((e) => `  [${e.path}] ${e.message}`).join('\n')
    throw new Error(`BrandOverrides validation failed:\n${messages}`)
  }
}

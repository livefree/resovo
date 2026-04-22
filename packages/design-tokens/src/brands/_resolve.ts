/**
 * _resolve.ts — Brand token 解析（纯函数，无副作用）
 * REG-M1-04: 产出 { base, resolved, overrideMap } 供 service GET 响应和继承指示 UI
 */

import { bg } from '../semantic/bg.js'
import { fg } from '../semantic/fg.js'
import { border } from '../semantic/border.js'
import { accent } from '../semantic/accent.js'
import { surface } from '../semantic/surface.js'
import { state } from '../semantic/state.js'
import { button } from '../components/button.js'
import { card } from '../components/card.js'
import { input } from '../components/input.js'
import { modal } from '../components/modal.js'
import { player } from '../components/player.js'
import { table } from '../components/table.js'
import { tabs } from '../components/tabs.js'
import { tooltip } from '../components/tooltip.js'
import type { BrandOverrides } from './types.js'

// ── 类型 ────────────────────────────────────────────────────────

export type FlatTokenMap = Record<string, string>
export type OverrideSource = 'base' | 'brand-override'
export type OverrideMap = Record<string, OverrideSource>

export interface ResolvedBrandTokens {
  readonly base: FlatTokenMap
  readonly resolved: FlatTokenMap
  readonly overrideMap: OverrideMap
}

// ── 展平工具 ─────────────────────────────────────────────────────

function flattenNode(node: unknown, prefix: string, out: FlatTokenMap): void {
  if (node === null || node === undefined) return
  if (typeof node === 'string' || typeof node === 'number') {
    out[prefix] = String(node)
    return
  }
  if (typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      flattenNode(value, prefix ? `${prefix}.${key}` : key, out)
    }
  }
}

// ── Base token 展平 ─────────────────────────────────────────────

const SEMANTIC_SOURCES: Record<string, unknown> = { bg, fg, border, accent, surface, state }
const COMPONENT_SOURCES: Record<string, unknown> = {
  button, card, input, modal, player, table, tabs, tooltip,
}

function buildBaseTokens(): FlatTokenMap {
  const out: FlatTokenMap = {}
  for (const [name, node] of Object.entries(SEMANTIC_SOURCES)) {
    flattenNode(node, `semantic.${name}`, out)
  }
  for (const [name, node] of Object.entries(COMPONENT_SOURCES)) {
    flattenNode(node, `component.${name}`, out)
  }
  return out
}

// ── Override 展平 ─────────────────────────────────────────────

function buildOverrideKeys(overrides: BrandOverrides): ReadonlySet<string> {
  const keys = new Set<string>()
  if (overrides.semantic) {
    flattenNode(overrides.semantic, 'semantic', {} as FlatTokenMap)
    const tmp: FlatTokenMap = {}
    flattenNode(overrides.semantic, 'semantic', tmp)
    for (const k of Object.keys(tmp)) keys.add(k)
  }
  if (overrides.component) {
    const tmp: FlatTokenMap = {}
    flattenNode(overrides.component, 'component', tmp)
    for (const k of Object.keys(tmp)) keys.add(k)
  }
  return keys
}

function buildOverrideFlatMap(overrides: BrandOverrides): FlatTokenMap {
  const out: FlatTokenMap = {}
  if (overrides.semantic) flattenNode(overrides.semantic, 'semantic', out)
  if (overrides.component) flattenNode(overrides.component, 'component', out)
  return out
}

// ── 主函数 ──────────────────────────────────────────────────────

export function resolveBrandTokens(overrides: BrandOverrides): ResolvedBrandTokens {
  const base = buildBaseTokens()
  const overrideFlatMap = buildOverrideFlatMap(overrides)
  const overrideKeySet = buildOverrideKeys(overrides)

  const resolved: FlatTokenMap = { ...base, ...overrideFlatMap }
  const overrideMap: OverrideMap = {}

  for (const key of Object.keys(resolved)) {
    overrideMap[key] = overrideKeySet.has(key) ? 'brand-override' : 'base'
  }

  return { base, resolved, overrideMap }
}

/**
 * Brand 层类型定义 — TOKEN-08
 *
 * 设计原则（ADR-022）：
 *   - 品牌层禁止覆盖 Primitive 层（colors/space/radius/typography/shadow/motion/size/zIndex）
 *   - 品牌层只能深度部分覆盖 Semantic 与 Component 子集
 *   - TS 编译期保证：excess property check 拒绝任何 primitive 顶层键
 */

import type { BgToken, BgTheme } from '../semantic/bg.js'
import type { FgToken } from '../semantic/fg.js'
import type { BorderToken } from '../semantic/border.js'
import type { AccentToken } from '../semantic/accent.js'
import type { SurfaceToken } from '../semantic/surface.js'
import type { StateKind, StateSlot } from '../semantic/state.js'

// Primitive 禁止键（供编译期注释文档化，不用于运行期）
export type PrimitiveForbiddenKey =
  | 'colors' | 'space' | 'radius' | 'typography'
  | 'shadow' | 'motion' | 'size' | 'zIndex'

// ── Semantic 可覆盖结构（深度可选）─────────────────────────────

type ThemedPartial<TToken extends string> = {
  readonly [Theme in BgTheme]?: {
    readonly [K in TToken]?: string
  }
}

export type BgOverride = ThemedPartial<BgToken>
export type FgOverride = ThemedPartial<FgToken>
export type BorderOverride = ThemedPartial<BorderToken>
export type AccentOverride = ThemedPartial<AccentToken>
export type SurfaceOverride = ThemedPartial<SurfaceToken>
export type StateOverride = {
  readonly [Theme in BgTheme]?: {
    readonly [K in StateKind]?: {
      readonly [S in StateSlot]?: string
    }
  }
}

export interface SemanticOverrides {
  readonly bg?: BgOverride
  readonly fg?: FgOverride
  readonly border?: BorderOverride
  readonly accent?: AccentOverride
  readonly surface?: SurfaceOverride
  readonly state?: StateOverride
}

// ── Component 可覆盖结构 ────────────────────────────────────────

export type ComponentOverrideKey =
  | 'button' | 'card' | 'input' | 'modal'
  | 'player' | 'table' | 'tabs' | 'tooltip'

export interface ComponentTokenNode {
  readonly [key: string]: string | ComponentTokenNode | undefined
}

export type ComponentOverrides = {
  readonly [K in ComponentOverrideKey]?: ComponentTokenNode
}

// ── BrandOverrides — 对外唯一形状，primitive 键 excess-property 报错 ──

/**
 * 只暴露 semantic + component 两个槽位。
 * 写入任何 primitive 顶层键（colors/space/radius/...）将被 TS excess-property check 拒绝。
 *
 * 负向类型测试（取消注释 → TS2353 报错，证明 primitive 键被拦截）：
 *   const _bad: BrandOverrides = { colors: {} }  // ❌ TS2353
 *   const _bad2: BrandOverrides = { space: {} }  // ❌ TS2353
 */
export interface BrandOverrides {
  readonly semantic?: SemanticOverrides
  readonly component?: ComponentOverrides
}

// ── Brand 实体 ─────────────────────────────────────────────────

export interface Brand {
  readonly id: string
  readonly slug: string
  readonly name: string
  readonly overrides: BrandOverrides
  readonly createdAt: Date
  readonly updatedAt: Date
}

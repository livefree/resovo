/**
 * Brand / Theme 前端上下文类型（TOKEN-09 / ADR-024 / ADR-033）
 *
 * Brand 接口与 packages/design-tokens/src/brands/types.ts 保持结构兼容（TS 结构类型）。
 * 不跨包 import 以避免 tsconfig 路径配置依赖。
 */

export interface BrandOverrides {
  readonly semantic?: Record<string, unknown>
  readonly component?: Record<string, unknown>
}

export interface Brand {
  readonly id: string
  readonly slug: string
  readonly name: string
  readonly overrides: BrandOverrides
  readonly createdAt: Date
  readonly updatedAt: Date
}

export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export interface BrandContextValue {
  readonly brand: Brand
  readonly setBrand: (slug: string) => void
}

export interface ThemeContextValue {
  readonly theme: Theme
  readonly resolvedTheme: ResolvedTheme
  readonly setTheme: (next: Theme) => void
}

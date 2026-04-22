/**
 * Brand / Theme 前端上下文类型（REG-M1-01 / ADR-038）
 *
 * 与 apps/web/src/types/brand.ts 保持同构（TS 结构类型），不跨 app import。
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

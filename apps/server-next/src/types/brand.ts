/**
 * Brand / Theme 前端上下文类型 — server-next 副本（ADR-038/039 / ADR-102）
 *
 * 与 apps/web-next/src/types/brand.ts 保持同构（TS 结构类型，不跨 apps import）。
 * 物理副本而非共享：plan §4.4 明示 BrandProvider/ThemeProvider 不下沉到
 * packages/admin-ui，server-next 直接持有自己的 contexts；plan §4.6 ESLint 边界
 * 禁止 apps/server-next 直接 import apps/web-next 内部代码。
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

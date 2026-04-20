/**
 * brand-detection.ts — REG-M1-02 / ADR-039
 *
 * 纯函数工具：从 cookie 字符串解析 brand slug 和 theme。
 * 不依赖浏览器 API，可在 Edge Runtime / Server Component 中使用。
 * 与 apps/web/src/lib/brand-detection.ts 保持同构。
 */

import type { Theme } from '@/types/brand'

const VALID_THEMES = new Set<string>(['light', 'dark', 'system'])

export const COOKIE_BRAND = 'resovo-brand'
export const COOKIE_THEME = 'resovo-theme'
export const HEADER_BRAND = 'x-resovo-brand'
export const HEADER_THEME = 'x-resovo-theme'

export const DEFAULT_BRAND_SLUG = 'resovo'
export const DEFAULT_THEME: Theme = 'system'

export function parseBrandSlug(raw: string | undefined): string {
  if (!raw) return DEFAULT_BRAND_SLUG
  const slug = raw.trim().toLowerCase()
  if (/^[a-z0-9-]{1,64}$/.test(slug)) return slug
  return DEFAULT_BRAND_SLUG
}

export function parseTheme(raw: string | undefined): Theme {
  if (raw && VALID_THEMES.has(raw)) return raw as Theme
  return DEFAULT_THEME
}

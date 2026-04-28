/**
 * brand-detection.ts — server-next 副本（ADR-039 / ADR-102）
 *
 * 纯函数工具：从 cookie 字符串解析 brand slug 和 theme。
 * 不依赖浏览器 API，可在 Edge Runtime / Server Component 中使用。
 * 与 apps/web-next/src/lib/brand-detection.ts 保持同构（物理副本）。
 *
 * server-next 差异：
 * - DEFAULT_THEME 改为 'dark'（plan §4.3 / ADR-102 dark-first；admin 默认深色）
 * - QUERY_THEME 保留以备 UI 复核截图需要
 */

import type { Theme } from '@/types/brand'

const VALID_THEMES = new Set<string>(['light', 'dark', 'system'])

export const COOKIE_BRAND = 'resovo-brand'
export const COOKIE_THEME = 'resovo-theme'
export const HEADER_BRAND = 'x-resovo-brand'
export const HEADER_THEME = 'x-resovo-theme'

export const DEFAULT_BRAND_SLUG = 'resovo'
export const DEFAULT_BRAND_NAME = 'Resovo' as const
export const DEFAULT_THEME: Theme = 'dark'

export const QUERY_THEME_KEY = '_theme'

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

export function parseThemeFromQuery(params: URLSearchParams): Theme | undefined {
  const raw = params.get(QUERY_THEME_KEY)
  if (raw && VALID_THEMES.has(raw)) return raw as Theme
  return undefined
}

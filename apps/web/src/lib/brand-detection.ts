/**
 * brand-detection.ts — TOKEN-10 / ADR-024
 *
 * 纯函数工具：从 cookie 字符串解析 brand slug 和 theme。
 * 不依赖浏览器 API，可在 Edge Runtime / Server Component 中使用。
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
  // 仅允许 kebab-case slug（字母/数字/连字符，1-64 字符）
  if (/^[a-z0-9-]{1,64}$/.test(slug)) return slug
  return DEFAULT_BRAND_SLUG
}

export function parseTheme(raw: string | undefined): Theme {
  if (raw && VALID_THEMES.has(raw)) return raw as Theme
  return DEFAULT_THEME
}

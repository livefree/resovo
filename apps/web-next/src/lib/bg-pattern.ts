/**
 * bg-pattern.ts — HANDOFF-42（设计稿 Global Shell · 设置抽屉 · 外观 · 背景图案）
 *
 * 背景图案是纯客户端视觉偏好（无 SSR / middleware 需求），存储统一走 localStorage
 * `resovo:bg-pattern`，镜像既有动效强度偏好 `resovo:motion-scale` 的范式。
 *
 * 应用机制镜像主题（data-theme）：写 `<html data-bg-pattern="...">`，由 globals.css
 * 的 `html[data-bg-pattern=...] .app-shell` 规则把底纹画到 `.app-shell`（不透明 canvas
 * 盖住 body，body 底纹不可见）。首绘前的 FOUC 由 theme-init-script 同步设属性消除
 * （该 inline script 无法 import，故 storage key 字面量在脚本内重复，见其注释）。
 */

export const BG_PATTERNS = ['none', 'dots', 'grid', 'noise'] as const

export type BgPattern = (typeof BG_PATTERNS)[number]

/** 默认底纹 = 圆点（遵设计稿 `<body class="pattern-dots">` + state 默认）。 */
export const DEFAULT_BG_PATTERN: BgPattern = 'dots'

/** localStorage key（与 theme-init-script 内字面量保持一致）。 */
export const BG_PATTERN_STORAGE_KEY = 'resovo:bg-pattern'

export function isBgPattern(value: unknown): value is BgPattern {
  return typeof value === 'string' && (BG_PATTERNS as readonly string[]).includes(value)
}

/** 读取持久化的底纹偏好；SSR / 非法值 / localStorage 不可用时回退默认。 */
export function readBgPattern(): BgPattern {
  if (typeof window === 'undefined') return DEFAULT_BG_PATTERN
  try {
    const stored = window.localStorage.getItem(BG_PATTERN_STORAGE_KEY)
    return isBgPattern(stored) ? stored : DEFAULT_BG_PATTERN
  } catch {
    // localStorage 被禁用（隐私模式等）：回退默认，仅内存态生效
    return DEFAULT_BG_PATTERN
  }
}

/** 同步底纹到 DOM（写 `<html data-bg-pattern>`，不写存储）——供 mount 回放复用。 */
export function applyBgPattern(pattern: BgPattern): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.bgPattern = pattern
}

/** 持久化底纹偏好到 localStorage（localStorage 不可用时静默降级）。 */
export function persistBgPattern(pattern: BgPattern): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(BG_PATTERN_STORAGE_KEY, pattern)
  } catch {
    // localStorage 被禁用：仅内存态生效，不抛出
  }
}

/** 设置底纹：同步 DOM + 持久化（设置抽屉点击入口）。 */
export function setBgPattern(pattern: BgPattern): void {
  applyBgPattern(pattern)
  persistBgPattern(pattern)
}

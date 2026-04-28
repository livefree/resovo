/**
 * platform.ts — Mac/非 Mac 平台检测 + 快捷键 spec 解析与渲染（ADR-103a §4.1.10）
 *
 * 真源（按优先级）：
 *   - ADR-103a §4.1.10 KeyboardShortcuts + 平台检测
 *   - ADR-103a §4.4-2 Edge Runtime 兼容（模块顶层零 navigator 访问 — hydration-safe）
 *
 * ── Hydration-safe 设计（CHG-SN-2-04 fix · 2026-04-29）──
 *
 * 关键原则：模块顶层永远是 SSR 默认值（IS_MAC=false / MOD_KEY_LABEL='Ctrl'），
 * 不直接读 navigator。客户端真实平台值通过 hook（usePlatform / useFormatShortcut）
 * 在 useEffect 内检测后切换，避免 React hydration mismatch。
 *
 * 旧版本（2026-04-29 早）顶层 detectIsMac() 直接读 navigator，导致：
 *   - SSR 渲染 'Ctrl+K' / 客户端水合 '⌘K' → React hydration mismatch warning
 *   - 把责任推给消费方包装 useEffect+useState 是糟糕的 API 设计
 * Codex stop-time review 识别该问题；本次 fix 在 packages/admin-ui 内解决。
 *
 * ── 公开 API ──
 *   - 顶层常量（SSR 默认）：IS_MAC / MOD_KEY_LABEL
 *   - 纯函数：parseShortcut / formatShortcut（接受可选 isMac） / matchesEvent
 *   - hooks（hydration-safe）：usePlatform / useFormatShortcut
 *
 * 跨域消费：本文件被 packages/admin-ui Shell 内部消费 + server-next 应用层 Sidebar/CmdK
 * 通过 hook 接入；不暴露到其他包。
 */
import { useEffect, useState } from 'react'

/** 当前平台是否为 Mac（顶层 SSR 默认 false；客户端检测需用 usePlatform hook） */
export const IS_MAC: boolean = false

/** Mod 键文案（顶层 SSR 默认 'Ctrl'；客户端检测需用 usePlatform hook） */
export const MOD_KEY_LABEL: '⌘' | 'Ctrl' = 'Ctrl'

/** 快捷键 spec 解析后的匹配器（KeyboardShortcuts listener 用此与 KeyboardEvent 比对） */
export interface ShortcutMatcher {
  /** 是否需要 mod（Mac 上的 metaKey / 其他平台的 ctrlKey） */
  readonly mod: boolean
  readonly shift: boolean
  readonly alt: boolean
  /** 单字面键，如 'k' / ',' / 'Escape' / '1'；规范化为 lower-case（Escape 等特殊键保留 Pascal） */
  readonly key: string
}

/** 解析规范化 spec 字符串为 matcher
 *  支持的修饰键（顺序无关，大小写不敏感）：mod / shift / alt
 *  支持的单键：单字符（k / 1 / ,）/ 'esc' → 'Escape' / 'enter' → 'Enter' / 'space' → ' ' / 'tab' → 'Tab'
 *  示例：'mod+k' / 'shift+mod+v' / 'alt+esc' / 'esc' / 'mod+,' */
export function parseShortcut(spec: string): ShortcutMatcher {
  const tokens = spec.toLowerCase().split('+').map((t) => t.trim()).filter(Boolean)
  let mod = false
  let shift = false
  let alt = false
  let key = ''
  for (const token of tokens) {
    if (token === 'mod') mod = true
    else if (token === 'shift') shift = true
    else if (token === 'alt' || token === 'option') alt = true
    else key = NAMED_KEY_MAP[token] ?? token
  }
  return { mod, shift, alt, key }
}

/** 命名键映射（lower-case key → KeyboardEvent.key 标准值） */
const NAMED_KEY_MAP: Record<string, string> = {
  esc: 'Escape',
  escape: 'Escape',
  enter: 'Enter',
  return: 'Enter',
  space: ' ',
  tab: 'Tab',
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
}

/** 渲染期格式化快捷键文案
 *  - mod → '⌘'（Mac）/ 'Ctrl'（其他）
 *  - shift → '⇧'（Mac）/ 'Shift+'（其他）
 *  - alt → '⌥'（Mac）/ 'Alt+'（其他）
 *  - 命名键（esc/enter/...）显示首字母大写形式（Esc/Enter/...）
 *  - 单字符键 → upper-case
 *
 *  isMac 参数（默认 false = SSR 安全）：消费方需要 Mac 风格时显式传 true，
 *  或使用 useFormatShortcut hook（hydration-safe，自动客户端检测）。 */
export function formatShortcut(spec: string, isMac: boolean = IS_MAC): string {
  const { mod, shift, alt, key } = parseShortcut(spec)
  const parts: string[] = []
  if (isMac) {
    if (mod) parts.push('⌘')
    if (shift) parts.push('⇧')
    if (alt) parts.push('⌥')
    parts.push(formatKeyLabel(key))
    return parts.join('')
  }
  if (mod) parts.push('Ctrl')
  if (shift) parts.push('Shift')
  if (alt) parts.push('Alt')
  parts.push(formatKeyLabel(key))
  return parts.join('+')
}

function formatKeyLabel(key: string): string {
  if (!key) return ''
  if (key.length === 1) return key.toUpperCase()
  // 命名键（Escape / Enter / Tab / ArrowUp 等）显示为首字母大写形式
  if (key === 'Escape') return 'Esc'
  if (key.startsWith('Arrow')) return key.slice(5)  // ArrowUp → Up
  return key
}

/** matcher 与 KeyboardEvent 比对（KeyboardShortcuts listener 用） */
export function matchesEvent(matcher: ShortcutMatcher, event: KeyboardEvent): boolean {
  // mod 自动映射 metaKey（Mac）/ ctrlKey（其他）
  const eventMod = event.metaKey || event.ctrlKey
  if (matcher.mod !== eventMod) return false
  if (matcher.shift !== event.shiftKey) return false
  if (matcher.alt !== event.altKey) return false
  // key 比对：toLowerCase 不敏感（空格/特殊键已映射为标准 KeyboardEvent.key 值）
  return event.key.toLowerCase() === matcher.key.toLowerCase()
}

/** 客户端平台检测（仅在 useEffect / 事件 handler 内调用，遵守 §4.4-2 顶层零 navigator） */
function detectIsMacFromNavigator(): boolean {
  if (typeof navigator === 'undefined') return false
  const platform = (navigator as Navigator).platform || ''
  const ua = (navigator as Navigator).userAgent || ''
  return /Mac|iPhone|iPad|iPod/.test(platform) || /Mac OS X/.test(ua)
}

export interface UsePlatformReturn {
  readonly isMac: boolean
  readonly modKeyLabel: '⌘' | 'Ctrl'
}

/** Hydration-safe 平台检测 hook
 *  - SSR + 首渲染：返 { isMac: false, modKeyLabel: 'Ctrl' }（与顶层常量一致 → 不触发 mismatch）
 *  - 客户端 mount 后：useEffect 检测 navigator 真实值并 setState（普通 rerender，非 hydration） */
export function usePlatform(): UsePlatformReturn {
  const [isMac, setIsMac] = useState(false)
  useEffect(() => {
    if (detectIsMacFromNavigator()) setIsMac(true)
  }, [])
  return { isMac, modKeyLabel: isMac ? '⌘' : 'Ctrl' }
}

/** Hydration-safe formatShortcut hook
 *  消费方（Sidebar / CmdK / UserMenu）在 Client Component 内用此 hook 渲染快捷键文案：
 *    const label = useFormatShortcut('mod+k')  // SSR + 首渲染：'Ctrl+K'；客户端 mount 后 Mac 上变 '⌘K' */
export function useFormatShortcut(spec: string): string {
  const { isMac } = usePlatform()
  return formatShortcut(spec, isMac)
}

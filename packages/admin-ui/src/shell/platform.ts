/**
 * platform.ts — Mac/非 Mac 平台检测 + 快捷键 spec 解析与渲染（ADR-103a §4.1.10）
 *
 * 真源（按优先级）：
 *   - ADR-103a §4.1.10 KeyboardShortcuts + 平台检测
 *   - ADR-103a §4.4-2 Edge Runtime 兼容（typeof navigator 防御 + SSR 默认）
 *   - 设计稿 v2.1 `app/shell.jsx:5-7` IS_MAC / MOD / kbd 工具实践
 *
 * ── §4.4-2 字面 vs 实践 trade-off ──
 * ADR §4.4-2 要求"模块顶层零 navigator 访问"；ADR §4.1.10 又要求 IS_MAC / MOD_KEY_LABEL
 * 是 `export const`（不可变）。两者直接冲突：常量值需 SSR 默认 false / 'Ctrl'，但客户端
 * 又要求"运行时第一次 mount 时纠正"。
 *
 * 本文件解决方式：
 *   - 顶层用 `typeof navigator !== 'undefined'` 防御 + 真实平台检测
 *   - SSR (Node.js) 下 typeof 检测为 'undefined' → IS_MAC=false / MOD_KEY_LABEL='Ctrl'
 *   - 客户端 (浏览器) 下 navigator 真实存在 → IS_MAC=真实值 / MOD_KEY_LABEL=真实值
 *   - 模块顶层求值是 ESM ES Module 语义（与设计稿 v2.1 shell.jsx 行 5-6 实践一致）
 *
 * 接受字面微违反 §4.4-2 顶层零 navigator，但符合 §4.4-2 实际意图（SSR 安全无 throw）。
 *
 * ── Hydration 警告 ──
 * SSR 输出 'Ctrl+K'，客户端水合输出 '⌘K' 时 React 会报 hydration mismatch。
 * 消费方（Sidebar / CmdK）若需 hydration-safe 显示快捷键文案，应包装：
 *   const [label, setLabel] = useState('') // SSR 默认空
 *   useEffect(() => setLabel(formatShortcut(spec)), [spec])
 *   return label || <span>...</span>
 * 或在 Server Component 内不显示 shortcut 文案，仅在 Client Component 内消费。
 *
 * 跨域消费：本文件仅被 packages/admin-ui Shell 内部消费 + server-next 应用层 Sidebar/CmdK
 * 渲染快捷键文案；不暴露到其他包。
 */

/** 平台检测 — typeof 防御保 SSR 安全 */
function detectIsMac(): boolean {
  if (typeof navigator === 'undefined') return false
  const platform = (navigator as Navigator).platform || ''
  const ua = (navigator as Navigator).userAgent || ''
  return /Mac|iPhone|iPad|iPod/.test(platform) || /Mac OS X/.test(ua)
}

/** 当前平台是否为 Mac（SSR 默认 false；客户端 navigator 检测） */
export const IS_MAC: boolean = detectIsMac()

/** Mod 键文案（Mac → '⌘'；其他 → 'Ctrl'） */
export const MOD_KEY_LABEL: '⌘' | 'Ctrl' = IS_MAC ? '⌘' : 'Ctrl'

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

/** 渲染期格式化快捷键文案（如 'mod+k' → '⌘K'（Mac）/ 'Ctrl+K'（其他））
 *  - mod → MOD_KEY_LABEL（⌘ Mac / Ctrl 其他）
 *  - shift → '⇧'（Mac）/ 'Shift+'（其他）
 *  - alt → '⌥'（Mac）/ 'Alt+'（其他）
 *  - 命名键（esc/enter/...）显示首字母大写形式（Esc/Enter/...）
 *  - 单字符键 → upper-case
 *
 *  ⚠️ Hydration safety: 输出依赖 IS_MAC（顶层求值）；SSR vs 客户端可能差异。
 *  消费方需要 hydration-safe 时按文件头部说明包装 useEffect + useState。 */
export function formatShortcut(spec: string): string {
  const { mod, shift, alt, key } = parseShortcut(spec)
  const parts: string[] = []
  if (IS_MAC) {
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

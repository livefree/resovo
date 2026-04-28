/**
 * platform.ts 单测（CHG-SN-2-04）
 *
 * 覆盖：parseShortcut（多种 spec 形态）/ formatShortcut（Mac vs 非 Mac 输出）/
 * matchesEvent（KeyboardEvent 比对 + mod 自动映射 metaKey/ctrlKey）/
 * IS_MAC / MOD_KEY_LABEL 顶层导出值（jsdom 测试环境视具体 navigator）
 *
 * 注：jsdom 默认 navigator.platform 通常含 'Linux' 或类似（非 Mac），所以本测试断言
 * IS_MAC=false / MOD_KEY_LABEL='Ctrl'；formatShortcut 走非 Mac 分支。
 */
import { describe, it, expect } from 'vitest'
import {
  IS_MAC,
  MOD_KEY_LABEL,
  parseShortcut,
  formatShortcut,
  matchesEvent,
  type ShortcutMatcher,
} from '../../../../../packages/admin-ui/src/shell/platform'

describe('platform — IS_MAC / MOD_KEY_LABEL（顶层 SSR 默认值，hydration-safe）', () => {
  it('IS_MAC 顶层永远 false（SSR 安全；客户端真实值通过 usePlatform hook 获取）', () => {
    expect(IS_MAC).toBe(false)
  })

  it('MOD_KEY_LABEL 顶层永远 "Ctrl"（SSR 安全；客户端真实值通过 usePlatform hook 获取）', () => {
    expect(MOD_KEY_LABEL).toBe('Ctrl')
  })
})

describe('platform — parseShortcut', () => {
  it('单键："k" → key=k', () => {
    expect(parseShortcut('k')).toEqual({ mod: false, shift: false, alt: false, key: 'k' })
  })

  it('mod+key：mod=true', () => {
    expect(parseShortcut('mod+k')).toEqual({ mod: true, shift: false, alt: false, key: 'k' })
  })

  it('shift+mod+key：mod + shift 都 true（顺序无关）', () => {
    expect(parseShortcut('shift+mod+v')).toEqual({ mod: true, shift: true, alt: false, key: 'v' })
    expect(parseShortcut('mod+shift+v')).toEqual({ mod: true, shift: true, alt: false, key: 'v' })
  })

  it('alt 与 option 是同义词', () => {
    expect(parseShortcut('alt+esc').alt).toBe(true)
    expect(parseShortcut('option+esc').alt).toBe(true)
  })

  it('命名键映射：esc → Escape / enter → Enter / space → " " / tab → Tab', () => {
    expect(parseShortcut('esc').key).toBe('Escape')
    expect(parseShortcut('enter').key).toBe('Enter')
    expect(parseShortcut('space').key).toBe(' ')
    expect(parseShortcut('tab').key).toBe('Tab')
  })

  it('箭头键映射：up/down/left/right → ArrowUp/...', () => {
    expect(parseShortcut('up').key).toBe('ArrowUp')
    expect(parseShortcut('down').key).toBe('ArrowDown')
    expect(parseShortcut('left').key).toBe('ArrowLeft')
    expect(parseShortcut('right').key).toBe('ArrowRight')
  })

  it('特殊符号键：mod+, → key=","', () => {
    expect(parseShortcut('mod+,')).toEqual({ mod: true, shift: false, alt: false, key: ',' })
  })

  it('大小写不敏感', () => {
    expect(parseShortcut('Mod+K')).toEqual(parseShortcut('mod+k'))
    expect(parseShortcut('SHIFT+MOD+V')).toEqual(parseShortcut('shift+mod+v'))
  })
})

describe('platform — formatShortcut 默认 isMac=false（SSR 安全 / Ctrl 风格）', () => {
  it('mod+k → "Ctrl+K"', () => {
    expect(formatShortcut('mod+k')).toBe('Ctrl+K')
  })

  it('shift+mod+v → "Ctrl+Shift+V"（修饰顺序：Ctrl/Shift/Alt → Key）', () => {
    expect(formatShortcut('shift+mod+v')).toBe('Ctrl+Shift+V')
  })

  it('mod+, → "Ctrl+,"', () => {
    expect(formatShortcut('mod+,')).toBe('Ctrl+,')
  })

  it('esc → "Esc"（无修饰）', () => {
    expect(formatShortcut('esc')).toBe('Esc')
  })

  it('alt+esc → "Alt+Esc"', () => {
    expect(formatShortcut('alt+esc')).toBe('Alt+Esc')
  })

  it('箭头键 up → "Up"（去 Arrow 前缀）', () => {
    expect(formatShortcut('up')).toBe('Up')
  })
})

describe('platform — formatShortcut 显式 isMac=true（Mac 风格）', () => {
  it('mod+k → "⌘K"（Mac 串接无分隔符）', () => {
    expect(formatShortcut('mod+k', true)).toBe('⌘K')
  })

  it('shift+mod+v → "⌘⇧V"', () => {
    expect(formatShortcut('shift+mod+v', true)).toBe('⌘⇧V')
  })

  it('mod+, → "⌘,"', () => {
    expect(formatShortcut('mod+,', true)).toBe('⌘,')
  })

  it('alt+esc → "⌥Esc"', () => {
    expect(formatShortcut('alt+esc', true)).toBe('⌥Esc')
  })
})

describe('platform — formatShortcut 显式 isMac=false（与默认一致，向后兼容）', () => {
  it('mod+k 显式 false 与默认一致输出 "Ctrl+K"', () => {
    expect(formatShortcut('mod+k', false)).toBe(formatShortcut('mod+k'))
  })
})

describe('platform — matchesEvent（KeyboardEvent 比对）', () => {
  function makeEvent(opts: {
    key: string
    metaKey?: boolean
    ctrlKey?: boolean
    shiftKey?: boolean
    altKey?: boolean
  }): KeyboardEvent {
    return new KeyboardEvent('keydown', {
      key: opts.key,
      metaKey: !!opts.metaKey,
      ctrlKey: !!opts.ctrlKey,
      shiftKey: !!opts.shiftKey,
      altKey: !!opts.altKey,
    })
  }

  it('mod+k：metaKey 触发匹配（Mac 路径）', () => {
    const matcher: ShortcutMatcher = { mod: true, shift: false, alt: false, key: 'k' }
    expect(matchesEvent(matcher, makeEvent({ key: 'k', metaKey: true }))).toBe(true)
  })

  it('mod+k：ctrlKey 触发匹配（非 Mac 路径，自动映射 metaKey || ctrlKey）', () => {
    const matcher: ShortcutMatcher = { mod: true, shift: false, alt: false, key: 'k' }
    expect(matchesEvent(matcher, makeEvent({ key: 'k', ctrlKey: true }))).toBe(true)
  })

  it('mod+k：无修饰键 → 不匹配', () => {
    const matcher: ShortcutMatcher = { mod: true, shift: false, alt: false, key: 'k' }
    expect(matchesEvent(matcher, makeEvent({ key: 'k' }))).toBe(false)
  })

  it('shift+mod+v：缺少 shift → 不匹配', () => {
    const matcher: ShortcutMatcher = { mod: true, shift: true, alt: false, key: 'v' }
    expect(matchesEvent(matcher, makeEvent({ key: 'v', metaKey: true }))).toBe(false)
    expect(matchesEvent(matcher, makeEvent({ key: 'v', metaKey: true, shiftKey: true }))).toBe(true)
  })

  it('key 大小写不敏感', () => {
    const matcher: ShortcutMatcher = { mod: false, shift: false, alt: false, key: 'k' }
    expect(matchesEvent(matcher, makeEvent({ key: 'K' }))).toBe(true)
    expect(matchesEvent(matcher, makeEvent({ key: 'k' }))).toBe(true)
  })

  it('Escape 等命名键比对', () => {
    const matcher = parseShortcut('esc')
    expect(matchesEvent(matcher, makeEvent({ key: 'Escape' }))).toBe(true)
    expect(matchesEvent(matcher, makeEvent({ key: 'escape' }))).toBe(true)  // 大小写不敏感
  })
})

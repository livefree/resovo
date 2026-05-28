/**
 * route-theme-storage.test.ts — localStorage helper（CHG-369 / plan §17.2 #16）
 *
 * 不依赖 jsdom localStorage（pre-existing flaky / 见下次会话恢复入口）。
 * 改用 vi.stubGlobal 安装 in-memory localStorage stub。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  readStoredThemeId,
  writeStoredThemeId,
  findThemeById,
  parseCustomTheme,
  readStoredCustomTheme,
  writeStoredCustomTheme,
  clearStoredCustomTheme,
  customThemeToRouteTheme,
  CUSTOM_THEME_ID,
  CUSTOM_THEME_CONSTRAINTS,
  type CustomThemeData,
} from '@/lib/route-theme-storage'
import { ALL_THEMES, THEME_JIE_QI, THEME_NATO } from '@/lib/line-display-name'

function makeMemoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() { return map.size },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v) },
    removeItem: (k: string) => { map.delete(k) },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
  }
}

describe('route-theme-storage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeMemoryStorage())
  })

  it('合法 themeId 写后读：roundtrip 一致', () => {
    writeStoredThemeId(THEME_NATO.id)
    expect(readStoredThemeId()).toBe(THEME_NATO.id)
  })

  it('无任何写入 → readStoredThemeId 返回 null（让消费方走 default）', () => {
    expect(readStoredThemeId()).toBeNull()
  })

  it('localStorage 含非法 themeId（脏数据）→ readStoredThemeId 返回 null（校验失败 / 防污染）', () => {
    window.localStorage.setItem('resovo:route-theme', 'bogus_theme_id')
    expect(readStoredThemeId()).toBeNull()
  })

  it('findThemeById 命中返回 RouteTheme / 未命中返回 null', () => {
    expect(findThemeById(THEME_JIE_QI.id)).toBe(THEME_JIE_QI)
    expect(findThemeById('not_a_real_theme')).toBeNull()
  })

  it('ALL_THEMES 所有 id 均可 round-trip 还原（5 主题全覆盖）', () => {
    for (const t of ALL_THEMES) {
      writeStoredThemeId(t.id)
      expect(readStoredThemeId()).toBe(t.id)
    }
  })

  // ── CHG-369-B 自定义主题 ────────────────────────────────────────

  it('themeId="custom" 是合法值（readStoredThemeId 返回 CUSTOM_THEME_ID / 防 ALL_THEMES 白名单误删）', () => {
    writeStoredThemeId(CUSTOM_THEME_ID)
    expect(readStoredThemeId()).toBe(CUSTOM_THEME_ID)
  })

  it('parseCustomTheme：合法 JSON → CustomThemeData', () => {
    const raw = JSON.stringify({ displayName: '我的主题', labels: ['极速', '备用'], deadLabel: '断了' })
    const data = parseCustomTheme(raw)
    expect(data).not.toBeNull()
    expect(data?.displayName).toBe('我的主题')
    expect(data?.labels).toEqual(['极速', '备用'])
    expect(data?.deadLabel).toBe('断了')
  })

  it('parseCustomTheme：displayName 为空 → null', () => {
    const raw = JSON.stringify({ displayName: '   ', labels: ['a'] })
    expect(parseCustomTheme(raw)).toBeNull()
  })

  it(`parseCustomTheme：displayName 超 ${CUSTOM_THEME_CONSTRAINTS.displayNameMaxChars} 字符 → null`, () => {
    const raw = JSON.stringify({ displayName: 'x'.repeat(11), labels: ['a'] })
    expect(parseCustomTheme(raw)).toBeNull()
  })

  it('parseCustomTheme：labels 数组为空 → null', () => {
    const raw = JSON.stringify({ displayName: 'OK', labels: [] })
    expect(parseCustomTheme(raw)).toBeNull()
  })

  it(`parseCustomTheme：labels 超 ${CUSTOM_THEME_CONSTRAINTS.labelsMaxCount} 个 → null`, () => {
    const raw = JSON.stringify({ displayName: 'OK', labels: Array.from({ length: 31 }, (_, i) => String(i)) })
    expect(parseCustomTheme(raw)).toBeNull()
  })

  it(`parseCustomTheme：单个 label 超 ${CUSTOM_THEME_CONSTRAINTS.labelMaxChars} 字符 → 被过滤（其余有效则通过）`, () => {
    const raw = JSON.stringify({ displayName: 'OK', labels: ['正常', 'x'.repeat(11), '备用'] })
    const data = parseCustomTheme(raw)
    expect(data?.labels).toEqual(['正常', '备用'])
  })

  it('parseCustomTheme：labels 非数组 → null', () => {
    const raw = JSON.stringify({ displayName: 'OK', labels: 'not-an-array' })
    expect(parseCustomTheme(raw)).toBeNull()
  })

  it('parseCustomTheme：非 JSON / 非对象 → null（脏数据防御）', () => {
    expect(parseCustomTheme('not-json')).toBeNull()
    expect(parseCustomTheme('"plain-string"')).toBeNull()
    expect(parseCustomTheme('null')).toBeNull()
  })

  it('parseCustomTheme：deadLabel 可选 / 缺省返回 undefined', () => {
    const raw = JSON.stringify({ displayName: 'OK', labels: ['a'] })
    const data = parseCustomTheme(raw)
    expect(data?.deadLabel).toBeUndefined()
  })

  it(`parseCustomTheme：deadLabel 超 ${CUSTOM_THEME_CONSTRAINTS.deadLabelMaxChars} 字符 → 当作未提供（undefined / 不导致整体失败）`, () => {
    const raw = JSON.stringify({ displayName: 'OK', labels: ['a'], deadLabel: 'x'.repeat(11) })
    const data = parseCustomTheme(raw)
    expect(data).not.toBeNull()
    expect(data?.deadLabel).toBeUndefined()
  })

  it('read/write/clearStoredCustomTheme：完整 roundtrip', () => {
    const data: CustomThemeData = { displayName: 'My', labels: ['A', 'B'], deadLabel: 'X' }
    writeStoredCustomTheme(data)
    expect(readStoredCustomTheme()).toEqual(data)
    clearStoredCustomTheme()
    expect(readStoredCustomTheme()).toBeNull()
  })

  it('readStoredCustomTheme：localStorage 含脏 JSON → null（不抛 / 不污染）', () => {
    window.localStorage.setItem('resovo:route-theme:custom', '{bad json')
    expect(readStoredCustomTheme()).toBeNull()
  })

  it('customThemeToRouteTheme：id=custom + 字段透传 + deadLabel 默认值', () => {
    const data: CustomThemeData = { displayName: 'My', labels: ['A', 'B'] }
    const theme = customThemeToRouteTheme(data)
    expect(theme.id).toBe(CUSTOM_THEME_ID)
    expect(theme.displayName).toBe('My')
    expect(theme.labels).toEqual(['A', 'B'])
    expect(theme.deadLabel).toBe('已断')
    expect(theme.fallbackPrefix).toBe('线路')
  })

  it('customThemeToRouteTheme：deadLabel 透传（用户给值不被默认覆盖）', () => {
    const data: CustomThemeData = { displayName: 'My', labels: ['A'], deadLabel: '断了' }
    expect(customThemeToRouteTheme(data).deadLabel).toBe('断了')
  })
})

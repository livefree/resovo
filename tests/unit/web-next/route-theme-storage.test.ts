/**
 * route-theme-storage.test.ts — localStorage helper（CHG-369 / plan §17.2 #16）
 *
 * 不依赖 jsdom localStorage（pre-existing flaky / 见下次会话恢复入口）。
 * 改用 vi.stubGlobal 安装 in-memory localStorage stub。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readStoredThemeId, writeStoredThemeId, findThemeById } from '@/lib/route-theme-storage'
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
})

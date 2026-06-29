/**
 * SettingsDrawer.test.tsx — HANDOFF-42（设置抽屉 · 外观 · 背景图案）
 *
 * 锁两层：
 *  1. lib/bg-pattern.ts —— read/apply/persist/set + isBgPattern 守卫（localStorage + data-bg-pattern）
 *  2. SettingsDrawer —— 渲染 4 选项 + active 反映存储值 + 点击切换写 localStorage & 设 html 属性
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'system', resolvedTheme: 'light', setTheme: vi.fn() }),
}))

import {
  BG_PATTERNS,
  BG_PATTERN_STORAGE_KEY,
  DEFAULT_BG_PATTERN,
  applyBgPattern,
  isBgPattern,
  persistBgPattern,
  readBgPattern,
  setBgPattern,
} from '@/lib/bg-pattern'
import { SettingsDrawer } from '@/components/layout/SettingsDrawer'

beforeEach(() => {
  cleanup()
  localStorage.clear()
  document.documentElement.removeAttribute('data-bg-pattern')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('lib/bg-pattern', () => {
  it('BG_PATTERNS 枚举 = none/dots/grid/noise，默认 dots', () => {
    expect(BG_PATTERNS).toEqual(['none', 'dots', 'grid', 'noise'])
    expect(DEFAULT_BG_PATTERN).toBe('dots')
  })

  it('isBgPattern 守卫：合法值 true，非法值/非串 false', () => {
    expect(isBgPattern('dots')).toBe(true)
    expect(isBgPattern('noise')).toBe(true)
    expect(isBgPattern('spiral')).toBe(false)
    expect(isBgPattern(null)).toBe(false)
    expect(isBgPattern(42)).toBe(false)
  })

  it('readBgPattern：无存储 → 默认 dots', () => {
    expect(readBgPattern()).toBe('dots')
  })

  it('readBgPattern：存储合法值 → 原样返回', () => {
    localStorage.setItem(BG_PATTERN_STORAGE_KEY, 'grid')
    expect(readBgPattern()).toBe('grid')
  })

  it('readBgPattern：存储非法值 → 回退默认', () => {
    localStorage.setItem(BG_PATTERN_STORAGE_KEY, 'bogus')
    expect(readBgPattern()).toBe('dots')
  })

  it('applyBgPattern：写 <html data-bg-pattern>，不写存储', () => {
    applyBgPattern('noise')
    expect(document.documentElement.dataset.bgPattern).toBe('noise')
    expect(localStorage.getItem(BG_PATTERN_STORAGE_KEY)).toBeNull()
  })

  it('persistBgPattern：仅写 localStorage', () => {
    persistBgPattern('grid')
    expect(localStorage.getItem(BG_PATTERN_STORAGE_KEY)).toBe('grid')
  })

  it('setBgPattern：同步 DOM + 持久化', () => {
    setBgPattern('none')
    expect(document.documentElement.dataset.bgPattern).toBe('none')
    expect(localStorage.getItem(BG_PATTERN_STORAGE_KEY)).toBe('none')
  })
})

describe('SettingsDrawer · 背景图案', () => {
  it('渲染全部 4 个背景图案选项', () => {
    render(<SettingsDrawer open onClose={vi.fn()} />)
    for (const value of BG_PATTERNS) {
      expect(screen.getByTestId(`settings-bg-pattern-${value}`)).toBeTruthy()
    }
  })

  it('active 反映存储值：存 grid → grid 选项 aria-checked', () => {
    localStorage.setItem(BG_PATTERN_STORAGE_KEY, 'grid')
    render(<SettingsDrawer open onClose={vi.fn()} />)
    expect(screen.getByTestId('settings-bg-pattern-grid').getAttribute('aria-checked')).toBe('true')
    expect(screen.getByTestId('settings-bg-pattern-dots').getAttribute('aria-checked')).toBe('false')
  })

  it('无存储 → 默认 dots active', () => {
    render(<SettingsDrawer open onClose={vi.fn()} />)
    expect(screen.getByTestId('settings-bg-pattern-dots').getAttribute('aria-checked')).toBe('true')
  })

  it('点击切换：写 localStorage + 设 html 属性 + active 迁移', () => {
    render(<SettingsDrawer open onClose={vi.fn()} />)
    fireEvent.click(screen.getByTestId('settings-bg-pattern-noise'))
    expect(localStorage.getItem(BG_PATTERN_STORAGE_KEY)).toBe('noise')
    expect(document.documentElement.dataset.bgPattern).toBe('noise')
    expect(screen.getByTestId('settings-bg-pattern-noise').getAttribute('aria-checked')).toBe('true')
    expect(screen.getByTestId('settings-bg-pattern-dots').getAttribute('aria-checked')).toBe('false')
  })
})

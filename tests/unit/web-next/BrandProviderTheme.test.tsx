/**
 * BrandProviderTheme.test.tsx — web-next 副本 resolvedTheme hydration 稳定 + 防闪烁守卫
 * （CHG-SHELL-THEME-HYDRATION-FIX；server-next 副本全量行为断言见
 * tests/unit/components/server-next/BrandProviderTheme.test.tsx，本文件锁
 * web-next 差异面：SSR 确定值 'light' + theme-init-script 值保护）
 *
 * Codex review 第 2 轮：theme-init-script 已在首绘前按 matchMedia 解析正确
 * data-theme，provider 首次 commit 用未解析回退值覆写会重引主题闪烁——
 * 'system' 未解析阶段不得写 DOM。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { useContext } from 'react'

vi.mock('../../../apps/web-next/src/lib/logger.client', () => ({
  clientLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  installGlobalHooks: vi.fn(),
}))

import { BrandProvider, ThemeContext } from '../../../apps/web-next/src/contexts/BrandProvider'
import type { Brand } from '../../../apps/web-next/src/types/brand'

function installMatchMedia(prefersDark: boolean) {
  const mql = {
    matches: prefersDark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  vi.stubGlobal('matchMedia', vi.fn(() => mql))
}

const BRAND: Brand = { slug: 'resovo', name: 'Resovo' } as Brand

const seen: string[] = []
function Probe() {
  const ctx = useContext(ThemeContext)
  seen.push(ctx?.resolvedTheme ?? 'none')
  return <span data-testid="resolved">{ctx?.resolvedTheme}</span>
}

beforeEach(() => {
  cleanup()
  seen.length = 0
  document.documentElement.removeAttribute('data-theme')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('web-next BrandProvider resolvedTheme', () => {
  it("system + OS 深色：首渲染恒 SSR 确定值 'light'（hydration 稳定）→ 挂载后解析 'dark'", () => {
    installMatchMedia(true)
    render(
      <BrandProvider initialBrand={BRAND} initialTheme="system">
        <Probe />
      </BrandProvider>,
    )
    expect(seen[0]).toBe('light') // web-next SSR 分支确定值
    expect(screen.getByTestId('resolved').textContent).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('system 未解析阶段不覆写 theme-init-script 已落的 data-theme（防闪烁，Codex review）', async () => {
    document.documentElement.dataset.theme = 'dark' // 脚本首绘前解析结果
    const observed: Array<string | null> = []
    const mo = new MutationObserver(() => undefined)
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
      attributeOldValue: true,
    })

    installMatchMedia(true)
    render(
      <BrandProvider initialBrand={BRAND} initialTheme="system">
        <Probe />
      </BrandProvider>,
    )
    await Promise.resolve()
    for (const record of mo.takeRecords()) observed.push(record.oldValue)
    mo.disconnect()

    // 未解析回退值 'light' 从未写入 DOM（oldValue 序列无 'light' 痕迹）
    expect(observed).not.toContain('light')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it("非 system（'dark'）直通：首渲染即 'dark' + DOM 同步", () => {
    installMatchMedia(false)
    render(
      <BrandProvider initialBrand={BRAND} initialTheme="dark">
        <Probe />
      </BrandProvider>,
    )
    expect(seen[0]).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})

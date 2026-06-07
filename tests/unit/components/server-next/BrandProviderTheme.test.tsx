/**
 * BrandProviderTheme.test.tsx — resolvedTheme 派生的 hydration 稳定性
 * （CHG-SHELL-THEME-HYDRATION-FIX，server-next 副本；web-next 同构同步同卡）
 *
 * 用户实测直报：/admin/home Topbar 主题图标 hydration mismatch——
 * theme='system' 时 SSR resolvedTheme='dark' 而客户端首渲染直读 matchMedia
 * 返 'light'。修复后约束：
 *   1. 首渲染 resolvedTheme 恒为 SSR 确定值（不读 matchMedia）
 *   2. 挂载后经 matchMedia 解析（OS 浅色 → 'light'）并同步 data-theme
 *   3. OS 偏好变化 → context resolvedTheme 重渲（连带修复：此前仅同步 DOM）
 *   4. 非 system 主题直通，不受 OS 解析影响
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import { useContext } from 'react'
import { BrandProvider, ThemeContext } from '../../../../apps/server-next/src/contexts/BrandProvider'
import type { Brand } from '../../../../apps/server-next/src/types/brand'

// ── matchMedia 可控 mock（OS 偏好 + change 事件触发器）─────────────────────

type MqlListener = (e: { matches: boolean }) => void

function installMatchMedia(prefersDark: boolean) {
  let matches = prefersDark
  const listeners = new Set<MqlListener>()
  const mql = {
    get matches() { return matches },
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, l: MqlListener) => { listeners.add(l) },
    removeEventListener: (_: string, l: MqlListener) => { listeners.delete(l) },
  }
  vi.stubGlobal('matchMedia', vi.fn(() => mql))
  return {
    setPrefersDark(next: boolean) {
      matches = next
      listeners.forEach((l) => l({ matches }))
    },
  }
}

const BRAND: Brand = { slug: 'resovo', name: 'Resovo' } as Brand

/** 首渲染（render 期）resolvedTheme 探针：记录每次 render 看到的值 */
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

describe('BrandProvider resolvedTheme — hydration 稳定性', () => {
  it("system + OS 浅色：首渲染恒 'dark'（SSR 确定值，不读 matchMedia）→ 挂载后解析为 'light'", () => {
    installMatchMedia(false) // OS 偏好浅色——原缺陷下首渲染即返 'light' 与 SSR 'dark' 撕裂
    render(
      <BrandProvider initialBrand={BRAND} initialTheme="system">
        <Probe />
      </BrandProvider>,
    )
    // 首渲染（= hydration 对齐 SSR 的那一帧）必须是 'dark'
    expect(seen[0]).toBe('dark')
    // 挂载 effect 解析后 → 'light'（DOM data-theme 同步跟随）
    expect(screen.getByTestId('resolved').textContent).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it("system + OS 深色：首渲染 'dark' 且挂载后维持 'dark'（无多余翻转）", () => {
    installMatchMedia(true)
    render(
      <BrandProvider initialBrand={BRAND} initialTheme="system">
        <Probe />
      </BrandProvider>,
    )
    expect(seen[0]).toBe('dark')
    expect(screen.getByTestId('resolved').textContent).toBe('dark')
  })

  it("system 未解析阶段不覆写既有 data-theme（pre-hydration/SSR 值保护——防主题闪烁，Codex review）", async () => {
    // 模拟首绘前已落正确值（web-next theme-init-script / server-next SSR attr）
    document.documentElement.dataset.theme = 'dark'
    const observed: Array<string | null> = []
    const mo = new MutationObserver(() => undefined)
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
      attributeOldValue: true,
    })

    installMatchMedia(true) // OS 深色：解析结果与脚本值一致
    render(
      <BrandProvider initialBrand={BRAND} initialTheme="system">
        <Probe />
      </BrandProvider>,
    )
    await Promise.resolve() // 冲洗 MutationObserver 微任务队列
    for (const record of mo.takeRecords()) observed.push(record.oldValue)
    mo.disconnect()

    // DOM 全程不得出现未解析回退值的覆写（oldValue 序列无 'light' = 从未闪过浅色）
    expect(observed).not.toContain('light')
    expect(document.documentElement.dataset.theme).toBe('dark')
    // context 首渲染仍为 SSR 确定值（hydration 稳定不受守卫影响）
    expect(seen[0]).toBe('dark')
  })

  it('OS 偏好变化 → context resolvedTheme 重渲 + DOM 同步（连带修复）', () => {
    const os = installMatchMedia(true)
    render(
      <BrandProvider initialBrand={BRAND} initialTheme="system">
        <Probe />
      </BrandProvider>,
    )
    expect(screen.getByTestId('resolved').textContent).toBe('dark')

    act(() => os.setPrefersDark(false))
    expect(screen.getByTestId('resolved').textContent).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it("非 system（'light'）直通：首渲染即 'light'，OS 深色不干扰", () => {
    installMatchMedia(true)
    render(
      <BrandProvider initialBrand={BRAND} initialTheme="light">
        <Probe />
      </BrandProvider>,
    )
    expect(seen[0]).toBe('light')
    expect(screen.getByTestId('resolved').textContent).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('setTheme 显式切换 → resolvedTheme + DOM 单路径同步', () => {
    installMatchMedia(true)
    function Toggle() {
      const ctx = useContext(ThemeContext)
      return (
        <button data-testid="to-light" onClick={() => ctx?.setTheme('light')}>
          {ctx?.resolvedTheme}
        </button>
      )
    }
    render(
      <BrandProvider initialBrand={BRAND} initialTheme="dark">
        <Toggle />
      </BrandProvider>,
    )
    expect(screen.getByTestId('to-light').textContent).toBe('dark')
    act(() => { screen.getByTestId('to-light').click() })
    expect(screen.getByTestId('to-light').textContent).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})

/**
 * tests/unit/design-tokens/typography-font-family.test.ts — CHORE-08
 *
 * 验证字体族决策（2026-04-22 Noto Sans）落地：
 * - typography.fontFamily.sans 首项是 next/font 注入的 --font-noto-sans CSS var
 * - fallback 栈保留系统中文字体（PingFang SC 等）
 * - mono 栈保持不变（mono 决策未调整）
 */

import { describe, it, expect } from 'vitest'
import { typography } from '../../../packages/design-tokens/src/primitives/typography.js'

describe('typography.fontFamily — CHORE-08 Noto Sans 决策落地', () => {
  const sans = typography.fontFamily.sans

  it('sans 栈首项为 var(--font-noto-sans)（next/font 注入）', () => {
    const first = sans.split(',')[0].trim()
    expect(first).toBe('var(--font-noto-sans)')
  })

  it('sans 栈第二项为 var(--font-noto-sans-sc)（简中 next/font）', () => {
    const second = sans.split(',')[1].trim()
    expect(second).toBe('var(--font-noto-sans-sc)')
  })

  it('sans 栈保留系统中文字体 fallback（PingFang SC / Hiragino Sans GB / Microsoft YaHei）', () => {
    expect(sans).toContain('PingFang SC')
    expect(sans).toContain('Hiragino Sans GB')
    expect(sans).toContain('Microsoft YaHei')
  })

  it('sans 栈以 system-ui + sans-serif 结尾（保底）', () => {
    expect(sans).toContain('system-ui')
    expect(sans.trim().endsWith('sans-serif')).toBe(true)
  })

  it('sans 栈不再包含 Inter（已由 Noto Sans 取代）', () => {
    expect(sans).not.toContain('Inter')
  })

  it('mono 栈保持 JetBrains Mono 为首项（本卡不调整）', () => {
    const mono = typography.fontFamily.mono
    expect(mono.split(',')[0].trim()).toBe("'JetBrains Mono'")
  })
})

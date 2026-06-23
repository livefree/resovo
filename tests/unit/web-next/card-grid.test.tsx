/**
 * card-grid.test.tsx — CARD-SIZE-CARDGRID / ADR-214 D-214-7/10 + Amendment A1 D-214-A1-1/2/3
 *
 * 两层：
 * ① 组件契约（jsdom）：class 应用 + className/data-testid 透传 + children 渲染（sizeClass 收窄为唯一 'standard'）。
 * ② globals.css 契约（脆性源快照）：`.card-grid` 基础含 minmax(0,1fr) / `> *` min-width:0 /
 *    standard ≥1024px size-driven auto-fill 引 --card-w-standard / gap 引 DB 注入 var / compact 废弃无残留。
 *    —— jsdom 不算布局，无法断言 computed 模板；size-driven「真实生效」由 CARD-SIZE-A1-E2E 视觉回归锁。
 *    本层只防 auto-fill/minmax/min-width:0 关键 token 被误删的源级回归。
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
// 相对路径导入：本组件在 web-next 共享层（CLAUDE.md / ADR-214 D-214-7），测试绕开 alias 直引（仿 card-size-fetch.test）。
import { CardGrid } from '../../../apps/web-next/src/components/shared/card-grid/CardGrid'

describe('CardGrid — 组件契约（D-214-7 + Amendment A1：standard 唯一网格档）', () => {
  it('应用 card-grid + standard 档位修饰类', () => {
    render(
      <CardGrid sizeClass="standard" data-testid="cg">
        <div>child</div>
      </CardGrid>,
    )
    const el = screen.getByTestId('cg')
    expect(el.className).toContain('card-grid')
    expect(el.className).toContain('card-grid--standard')
  })

  it('透传 className（与内置类共存）', () => {
    render(
      <CardGrid sizeClass="standard" className="extra-class" data-testid="cg">
        <div>c</div>
      </CardGrid>,
    )
    const el = screen.getByTestId('cg')
    expect(el.className).toContain('card-grid')
    expect(el.className).toContain('card-grid--standard')
    expect(el.className).toContain('extra-class')
  })

  it('渲染 children', () => {
    render(
      <CardGrid sizeClass="standard">
        <span>卡片子项</span>
      </CardGrid>,
    )
    expect(screen.getByText('卡片子项')).toBeTruthy()
  })

  it('无 data-testid 时不崩（可选 prop）', () => {
    const { container } = render(
      <CardGrid sizeClass="standard">
        <div>x</div>
      </CardGrid>,
    )
    const grid = container.querySelector('.card-grid')
    expect(grid).toBeTruthy()
    expect(grid?.className).toContain('card-grid--standard')
  })
})

describe('CardGrid — globals.css 契约（D-214-7/10 + Amendment A1 D-214-A1-1/2/3，源快照）', () => {
  // vitest 从 repo root 运行（vitest.config 在根）→ process.cwd() = 仓库根
  const cssPath = resolve(process.cwd(), 'apps/web-next/src/app/globals.css')
  // 去空白后做 token 匹配（容忍格式化差异，仅锁关键契约 token）
  const cssNoWs = readFileSync(cssPath, 'utf8').replace(/\s/g, '')

  it('.card-grid 基础模板含 repeat(var(--cg-cols,2), minmax(0,1fr))（移动/平板计数 + 缺值兜底退 2 列）', () => {
    expect(cssNoWs).toContain('repeat(var(--cg-cols,2),minmax(0,1fr))')
  })

  it('.card-grid > * 强制 min-width:0（防溢出，D-214-7/Codex-R2）', () => {
    expect(cssNoWs).toContain('.card-grid>*{min-width:0')
  })

  it('standard ≥1024px size-driven auto-fill 引 --card-w-standard（卡宽恒定最小、列数容器派生，D-214-A1-1）', () => {
    expect(cssNoWs).toContain(
      'repeat(auto-fill,minmax(min(var(--card-w-standard,200px),100%),1fr))',
    )
  })

  it('compact 档已废弃：globals.css 无 .card-grid--compact / --card-cols-compact-desktop（D-214-A1-3）', () => {
    expect(cssNoWs).not.toContain('card-grid--compact')
    expect(cssNoWs).not.toContain('--card-cols-compact-desktop')
  })

  it('gap 走 DB 注入 --card-gap-standard（D-214-7，非 --page-inline-gap 旧真源）', () => {
    expect(cssNoWs).toContain('gap:var(--card-gap-standard)')
  })
})

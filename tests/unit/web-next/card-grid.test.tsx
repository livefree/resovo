/**
 * card-grid.test.tsx — CARD-SIZE-CARDGRID / ADR-214 D-214-4/7/10（SEQ-20260622-03 Phase 2）
 *
 * 两层：
 * ① 组件契约（jsdom）：class 应用 + className/data-testid 透传 + children 渲染 + sizeClass 封闭枚举。
 * ② globals.css 契约（脆性源快照）：`.card-grid` 模板含 minmax(0,1fr) / `> *` min-width:0 /
 *    桌面媒体查询引 SSR per-class 真源 / gap 引 DB 注入 var。
 *    —— jsdom 不算布局，无法断言 computed 模板；防溢出/列数「真实生效」由 CARD-SIZE-E2E
 *    窄容器+长标题视觉回归锁（arch-reviewer 裁决 5）。本层只防 minmax/min-width:0 被误删的源级回归。
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
// 相对路径导入：vitest config 把 `@/components/shared/*` 硬路由到 server-next（CUTOVER 历史），
// 本组件在 web-next 共享层（CLAUDE.md / ADR-214 D-214-7），故测试绕开 alias 直引（仿 card-size-fetch.test）。
import { CardGrid } from '../../../apps/web-next/src/components/shared/card-grid/CardGrid'

describe('CardGrid — 组件契约（D-214-7）', () => {
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

  it('应用 compact 档位修饰类', () => {
    render(
      <CardGrid sizeClass="compact" data-testid="cg">
        <div>c</div>
      </CardGrid>,
    )
    expect(screen.getByTestId('cg').className).toContain('card-grid--compact')
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
      <CardGrid sizeClass="compact">
        <div>x</div>
      </CardGrid>,
    )
    const grid = container.querySelector('.card-grid')
    expect(grid).toBeTruthy()
    expect(grid?.className).toContain('card-grid--compact')
  })
})

describe('CardGrid — globals.css 契约（D-214-4/7/10，源快照）', () => {
  // vitest 从 repo root 运行（vitest.config 在根）→ process.cwd() = 仓库根
  const cssPath = resolve(process.cwd(), 'apps/web-next/src/app/globals.css')
  // 去空白后做 token 匹配（容忍格式化差异，仅锁关键契约 token）
  const cssNoWs = readFileSync(cssPath, 'utf8').replace(/\s/g, '')

  it('.card-grid 模板含 repeat(var(--cg-cols,2), minmax(0,1fr))（防溢出 + 缺值兜底退 2 列）', () => {
    expect(cssNoWs).toContain('repeat(var(--cg-cols,2),minmax(0,1fr))')
  })

  it('.card-grid > * 强制 min-width:0（防溢出，D-214-7/Codex-R2）', () => {
    expect(cssNoWs).toContain('.card-grid>*{min-width:0')
  })

  it('桌面媒体查询引 SSR per-class 列数真源（--card-cols-{class}-desktop）', () => {
    expect(cssNoWs).toContain('--cg-cols:var(--card-cols-standard-desktop)')
    expect(cssNoWs).toContain('--cg-cols:var(--card-cols-compact-desktop)')
  })

  it('gap 走 DB 注入 --card-gap-{class}（D-214-7，非 --page-inline-gap 旧真源）', () => {
    expect(cssNoWs).toContain('gap:var(--card-gap-standard)')
    expect(cssNoWs).toContain('gap:var(--card-gap-compact)')
  })
})

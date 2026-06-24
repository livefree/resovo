/**
 * card-grid.test.tsx — CARD-SIZE-CARDGRID / ADR-214 D-214-7 + Amendment A2 D-214-A2-2/3/6
 *
 * 两层：
 * ① 组件契约（jsdom）：class 应用 + className/data-testid 透传 + children 渲染（sizeClass 收敛为单值 'global'）。
 * ② globals.css 契约（脆性源快照）：`.card-grid` auto-fit 精确定宽 min(var(--card-w),100%) +
 *    justify-content:center 居中 + gap 引单一 --card-gap / `> *` min-width:0 / 分档变量与 auto-fill 已回收。
 *    —— jsdom 不算布局，无法断言 computed 模板；精确定宽 + 居中「真实生效」由 A2-5 e2e 视觉回归锁。
 *    本层只防 auto-fit/min(--card-w)/justify-center/min-width:0 关键 token 被误删的源级回归。
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
// 相对路径导入：本组件在 web-next 共享层（CLAUDE.md / ADR-214 D-214-7），测试绕开 alias 直引（仿 card-size-fetch.test）。
import { CardGrid } from '../../../apps/web-next/src/components/shared/card-grid/CardGrid'

describe('CardGrid — 组件契约（D-214-7 + Amendment A2：单值 global）', () => {
  it('应用 card-grid + global 档位修饰类', () => {
    render(
      <CardGrid sizeClass="global" data-testid="cg">
        <div>child</div>
      </CardGrid>,
    )
    const el = screen.getByTestId('cg')
    expect(el.className).toContain('card-grid')
    expect(el.className).toContain('card-grid--global')
  })

  it('透传 className（与内置类共存）', () => {
    render(
      <CardGrid sizeClass="global" className="extra-class" data-testid="cg">
        <div>c</div>
      </CardGrid>,
    )
    const el = screen.getByTestId('cg')
    expect(el.className).toContain('card-grid')
    expect(el.className).toContain('card-grid--global')
    expect(el.className).toContain('extra-class')
  })

  it('渲染 children', () => {
    render(
      <CardGrid sizeClass="global">
        <span>卡片子项</span>
      </CardGrid>,
    )
    expect(screen.getByText('卡片子项')).toBeTruthy()
  })

  it('无 data-testid 时不崩（可选 prop）', () => {
    const { container } = render(
      <CardGrid sizeClass="global">
        <div>x</div>
      </CardGrid>,
    )
    const grid = container.querySelector('.card-grid')
    expect(grid).toBeTruthy()
    expect(grid?.className).toContain('card-grid--global')
  })
})

describe('CardGrid — globals.css 契约（D-214-A2-2/3，源快照）', () => {
  // vitest 从 repo root 运行（vitest.config 在根）→ process.cwd() = 仓库根
  const cssPath = resolve(process.cwd(), 'apps/web-next/src/app/globals.css')
  // 去空白后做 token 匹配（容忍格式化差异，仅锁关键契约 token）
  const cssNoWs = readFileSync(cssPath, 'utf8').replace(/\s/g, '')

  it('.card-grid 精确定宽 auto-fit min(var(--card-w),100%)（卡宽恒 = W、列数容器派生，D-214-A2-2）', () => {
    expect(cssNoWs).toContain('repeat(auto-fit,min(var(--card-w,160px),100%))')
  })

  it('.card-grid justify-content:center（末列留白居中，D-214-A2-3）', () => {
    expect(cssNoWs).toContain('.card-grid{')
    expect(cssNoWs).toContain('justify-content:center')
  })

  it('.card-grid > * 强制 min-width:0（防溢出，Codex-R2）', () => {
    expect(cssNoWs).toContain('.card-grid>*{min-width:0')
  })

  it('gap 走单一 DB 注入 --card-gap（A2 全站统一，无档位后缀）', () => {
    expect(cssNoWs).toContain('gap:var(--card-gap,16px)')
  })

  it('A2 分档变量与 auto-fill/计数级联已回收（无 standard/scroll/compact/cg-cols 残留）', () => {
    expect(cssNoWs).not.toContain('card-grid--standard')
    expect(cssNoWs).not.toContain('card-grid--scroll')
    expect(cssNoWs).not.toContain('card-grid--compact')
    expect(cssNoWs).not.toContain('--card-w-standard')
    expect(cssNoWs).not.toContain('--card-w-scroll')
    expect(cssNoWs).not.toContain('--cg-cols')
    // 网格不再用 auto-fill repeat（auto-fit 取代；注释里的「auto-fill」字样不算 CSS 调用）
    expect(cssNoWs).not.toContain('repeat(auto-fill')
  })
})

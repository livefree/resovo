/**
 * scroll-row.test.tsx — CARD-SIZE-A1-SCROLLROW / ADR-214 Amendment A1 D-214-A1-6
 *
 * 两层：
 * ① 组件契约（jsdom）：scroll-row class + children 包裹 .scroll-row__item + 可达性(role/tabindex/aria-label)
 *    + className/data-testid 透传 + null child 跳过 + Fragment 边界（顶层 Fragment 当单 child，锁契约）。
 * ② globals.css 契约（源快照）：.scroll-row flex 横滚 + scroll-snap / __item 定宽 var(--card-w-scroll,170px) 兜底 / gap。
 *    —— jsdom 不算布局，横滚「真实生效」由 CARD-SIZE-A1-E2E 视觉回归锁；本层只防关键 token / a11y 属性被误删的源级回归。
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { ScrollRow } from '../../../apps/web-next/src/components/shared/scroll-row/ScrollRow'

describe('ScrollRow — 组件契约（D-214-A1-6）', () => {
  it('应用 scroll-row class + data-testid', () => {
    render(
      <ScrollRow aria-label="相关视频" data-testid="sr">
        <div>a</div>
        <div>b</div>
      </ScrollRow>,
    )
    expect(screen.getByTestId('sr').className).toContain('scroll-row')
  })

  it('可达性：容器 role=region + tabindex=0 + aria-label（WCAG 2.1.1 / arch-reviewer HIGH）', () => {
    render(
      <ScrollRow aria-label="相关视频" data-testid="sr">
        <div>a</div>
      </ScrollRow>,
    )
    const el = screen.getByTestId('sr')
    expect(el.getAttribute('role')).toBe('region')
    expect(el.getAttribute('tabindex')).toBe('0')
    expect(el.getAttribute('aria-label')).toBe('相关视频')
  })

  it('每个 child 包裹为 .scroll-row__item（定宽 item）', () => {
    const { container } = render(
      <ScrollRow aria-label="相关视频">
        <div data-testid="card-a">a</div>
        <div data-testid="card-b">b</div>
      </ScrollRow>,
    )
    const items = container.querySelectorAll('.scroll-row__item')
    expect(items).toHaveLength(2)
    expect(items[0].querySelector('[data-testid="card-a"]')).not.toBeNull()
    expect(items[1].querySelector('[data-testid="card-b"]')).not.toBeNull()
  })

  it('透传 className（与内置类共存）', () => {
    render(
      <ScrollRow aria-label="相关视频" className="extra" data-testid="sr">
        <div>a</div>
      </ScrollRow>,
    )
    const el = screen.getByTestId('sr')
    expect(el.className).toContain('scroll-row')
    expect(el.className).toContain('extra')
  })

  it('null/falsy child 跳过（不渲染空 item）', () => {
    const { container } = render(
      <ScrollRow aria-label="相关视频">
        <div>a</div>
        {null}
        {false}
      </ScrollRow>,
    )
    expect(container.querySelectorAll('.scroll-row__item')).toHaveLength(1)
  })

  it('Fragment 边界（契约锁）：顶层 Fragment 被当单 child 包成 1 个 item — 故消费方禁用 Fragment 聚合', () => {
    const { container } = render(
      <ScrollRow aria-label="相关视频">
        <>
          <div data-testid="frag-a">a</div>
          <div data-testid="frag-b">b</div>
        </>
      </ScrollRow>,
    )
    // 锁定 arch-reviewer 揭示的行为：Fragment 聚合 → 单 item（错位风险），契约要求消费方传数组/并列 element
    expect(container.querySelectorAll('.scroll-row__item')).toHaveLength(1)
  })

  it('渲染 children 内容', () => {
    render(
      <ScrollRow aria-label="相关视频">
        <span>相关视频卡</span>
      </ScrollRow>,
    )
    expect(screen.getByText('相关视频卡')).toBeTruthy()
  })
})

describe('ScrollRow — globals.css 契约（D-214-A1-6，源快照）', () => {
  // vitest 从 repo root 运行 → process.cwd() = 仓库根
  const cssPath = resolve(process.cwd(), 'apps/web-next/src/app/globals.css')
  const cssNoWs = readFileSync(cssPath, 'utf8').replace(/\s/g, '')

  it('.scroll-row flex 横滚 + scroll-snap + 消费 --card-gap-scroll', () => {
    expect(cssNoWs).toContain('.scroll-row{display:flex')
    expect(cssNoWs).toContain('overflow-x:auto')
    expect(cssNoWs).toContain('scroll-snap-type:xmandatory')
    expect(cssNoWs).toContain('gap:var(--card-gap-scroll)')
  })

  it('.scroll-row__item 定宽 var(--card-w-scroll,170px) 兜底 + flex-shrink:0 + scroll-snap-align', () => {
    expect(cssNoWs).toContain('.scroll-row__item{width:var(--card-w-scroll,170px)')
    expect(cssNoWs).toContain('flex-shrink:0')
    expect(cssNoWs).toContain('scroll-snap-align:start')
  })
})

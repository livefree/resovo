/**
 * SplitPane 单测（CHG-SN-4-01）
 * 覆盖：基础渲染 / 栏数校验 / hidden 栏过滤 / header 渲染 / noPadding / data-testid / a11y / gridTemplateColumns
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { SplitPane } from '../../../../../packages/admin-ui/src/components/layout/split-pane'

function makeSplitPane(overrides: Partial<Parameters<typeof SplitPane>[0]> = {}) {
  return render(
    <SplitPane
      height="600px"
      panes={[
        { width: 280, children: <p>左栏</p> },
        { width: '1fr', children: <p>中栏</p> },
        { width: 300, children: <p>右栏</p> },
      ]}
      {...overrides}
    />,
  )
}

// ── 基础渲染 ─────────────────────────────────────────────────────

describe('SplitPane — 基础渲染', () => {
  it('渲染 data-split 容器', () => {
    const { container } = makeSplitPane()
    expect(container.querySelector('[data-split]')).toBeTruthy()
  })

  it('渲染三个 data-split-pane 子栏', () => {
    const { container } = makeSplitPane()
    expect(container.querySelectorAll('[data-split-pane]')).toHaveLength(3)
  })

  it('data-testid 传递到容器', () => {
    const { container } = makeSplitPane({ 'data-testid': 'sp-root' })
    expect(container.querySelector('[data-testid="sp-root"]')).toBeTruthy()
  })
})

// ── gridTemplateColumns ──────────────────────────────────────────

describe('SplitPane — gridTemplateColumns', () => {
  it('number width → px，string width 原样', () => {
    const { container } = makeSplitPane()
    const el = container.querySelector('[data-split]') as HTMLElement
    expect(el.style.gridTemplateColumns).toBe('280px 1fr 300px')
  })

  it('gap 默认 12px', () => {
    const { container } = makeSplitPane()
    const el = container.querySelector('[data-split]') as HTMLElement
    expect(el.style.gap).toBe('12px')
  })

  it('自定义 gap', () => {
    const { container } = makeSplitPane({ gap: 20 })
    const el = container.querySelector('[data-split]') as HTMLElement
    expect(el.style.gap).toBe('20px')
  })

  it('height 字符串原样', () => {
    const { container } = makeSplitPane({ height: 'calc(100vh - 40px)' })
    const el = container.querySelector('[data-split]') as HTMLElement
    expect(el.style.height).toBe('calc(100vh - 40px)')
  })

  it('height number → px', () => {
    const { container } = makeSplitPane({ height: 500 })
    const el = container.querySelector('[data-split]') as HTMLElement
    expect(el.style.height).toBe('500px')
  })
})

// ── hidden 栏过滤 ────────────────────────────────────────────────

describe('SplitPane — hidden 栏过滤', () => {
  it('hidden=true 时不渲染该栏', () => {
    const { container } = makeSplitPane({
      panes: [
        { width: 280, children: <p>左栏</p> },
        { width: '1fr', children: <p>中栏</p> },
        { width: 300, children: <p>右栏</p>, hidden: true },
      ],
    })
    expect(container.querySelectorAll('[data-split-pane]')).toHaveLength(2)
  })

  it('hidden 栏宽不出现在 gridTemplateColumns', () => {
    const { container } = makeSplitPane({
      panes: [
        { width: 280, children: <p>左栏</p> },
        { width: '1fr', children: <p>中栏</p> },
        { width: 300, children: <p>右栏</p>, hidden: true },
      ],
    })
    const el = container.querySelector('[data-split]') as HTMLElement
    expect(el.style.gridTemplateColumns).toBe('280px 1fr')
  })
})

// ── header ───────────────────────────────────────────────────────

describe('SplitPane — header', () => {
  it('传入 header 时渲染 data-split-pane-head', () => {
    const { container } = makeSplitPane({
      panes: [
        { width: 280, header: <span>头部</span>, children: <p>左栏</p> },
        { width: '1fr', children: <p>中栏</p> },
      ],
    })
    expect(container.querySelector('[data-split-pane-head]')).toBeTruthy()
  })

  it('不传 header 时不渲染 data-split-pane-head', () => {
    const { container } = makeSplitPane({
      panes: [
        { width: 280, children: <p>左栏</p> },
        { width: '1fr', children: <p>中栏</p> },
      ],
    })
    expect(container.querySelector('[data-split-pane-head]')).toBeNull()
  })
})

// ── noPadding ────────────────────────────────────────────────────

describe('SplitPane — noPadding', () => {
  it('默认有 padding 12px', () => {
    const { container } = makeSplitPane({
      panes: [
        { width: 280, children: <p>左栏</p> },
        { width: '1fr', children: <p>中栏</p> },
      ],
    })
    const body = container.querySelector('[data-split-pane-body]') as HTMLElement
    expect(body.style.padding).toBe('12px')
  })

  it('noPadding=true 时无 padding', () => {
    const { container } = makeSplitPane({
      panes: [
        { width: 280, children: <p>左栏</p>, noPadding: true },
        { width: '1fr', children: <p>中栏</p> },
      ],
    })
    const bodies = container.querySelectorAll('[data-split-pane-body]')
    expect((bodies[0] as HTMLElement).style.padding).toBe('')
  })
})

// ── a11y ─────────────────────────────────────────────────────────

describe('SplitPane — a11y', () => {
  it('容器 role + aria-label 传递', () => {
    const { container } = makeSplitPane({ role: 'region', 'aria-label': '审核台' })
    const el = container.querySelector('[data-split]') as HTMLElement
    expect(el.getAttribute('role')).toBe('region')
    expect(el.getAttribute('aria-label')).toBe('审核台')
  })

  it('栏级 role + aria-label 传递', () => {
    const { container } = makeSplitPane({
      panes: [
        { width: 280, children: <p>左栏</p>, role: 'complementary', 'aria-label': '队列' },
        { width: '1fr', children: <p>中栏</p> },
      ],
    })
    const pane = container.querySelector('[data-split-pane]') as HTMLElement
    expect(pane.getAttribute('role')).toBe('complementary')
    expect(pane.getAttribute('aria-label')).toBe('队列')
  })

  it('栏级 data-testid 传递', () => {
    const { container } = makeSplitPane({
      panes: [
        { width: 280, children: <p>左栏</p>, 'data-testid': 'pane-left' },
        { width: '1fr', children: <p>中栏</p> },
      ],
    })
    expect(container.querySelector('[data-testid="pane-left"]')).toBeTruthy()
  })
})

// ── dev 警告 ─────────────────────────────────────────────────────

describe('SplitPane — dev 警告', () => {
  it('panes.length < 2 触发 console.warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(
      <SplitPane height="400px" panes={[{ width: 280, children: <p>only</p> }]} />,
    )
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[SplitPane]'))
    warn.mockRestore()
  })

  it('resizable=true 触发 not-yet-implemented 警告', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    makeSplitPane({ resizable: true })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('resizable is not yet implemented'))
    warn.mockRestore()
  })
})
